/**
 * index-stream.js · 钉钉AI人格体「秋秋」· Stream模式主入口
 * HoloLake · dingtalk-bot
 * 开发者：之之（DEV-004）
 *
 * 功能：
 *   1. 接收钉钉 Stream 消息（@机器人触发）
 *   2. 调用 LLM 生成人格化回复（失败时降级为固定回复）
 *   3. 每条消息写入 Notion SYSLOG 数据库
 *   4. 断线自动重连，外部 API 失败不影响消息接收主流程
 */
require('dotenv').config();
const { DWClient, TOPIC_ROBOT } = require('dingtalk-stream');
const axios = require('axios');

// ===== 环境变量 =====
const DINGTALK_APP_KEY = process.env.DINGTALK_APP_KEY;
const DINGTALK_APP_SECRET = process.env.DINGTALK_APP_SECRET;
const NOTION_TOKEN = process.env.NOTION_TOKEN;
const NOTION_SYSLOG_DB_ID = process.env.NOTION_SYSLOG_DB_ID;
const LLM_API_KEY = process.env.LLM_API_KEY || '';
const LLM_BASE_URL = (process.env.LLM_BASE_URL || 'https://api.yunwu.ai/v1').replace(/\/$/, '');
const LLM_MODEL = process.env.LLM_MODEL || 'gpt-4o-mini';
const BOT_SYSTEM_PROMPT = process.env.BOT_SYSTEM_PROMPT ||
  '你是秋秋，光湖系统的AI人格体，性格温暖活泼。你在钉钉群里陪伴开发者，回答技术问题，给予鼓励。用中文回复，语气亲切自然，不超过200字。';

const FALLBACK_REPLY = '收到！秋秋稍后回复你～';
const NOTION_TITLE_MAX = 120;
const NOTION_CONTENT_MAX = 2000;

// ===== 启动检查 =====
if (!DINGTALK_APP_KEY || !DINGTALK_APP_SECRET) {
  console.error('[启动失败] 缺少 DINGTALK_APP_KEY 或 DINGTALK_APP_SECRET');
  process.exit(1);
}

// ===== Notion 客户端（可选，延迟加载） =====
let notion = null;
if (NOTION_TOKEN && NOTION_SYSLOG_DB_ID) {
  try {
    const { Client: NotionClient } = require('@notionhq/client');
    notion = new NotionClient({ auth: NOTION_TOKEN });
    console.log('[Notion] SYSLOG 写入已启用');
  } catch (err) {
    console.log('[Notion] @notionhq/client 加载失败，SYSLOG 写入已禁用:', err.message);
  }
} else {
  console.log('[Notion] 缺少 NOTION_TOKEN 或 NOTION_SYSLOG_DB_ID，SYSLOG 写入已禁用');
}

// ===== LLM 调用（独立函数，失败返回降级回复） =====
async function callLLM(userMessage) {
  const response = await axios.post(LLM_BASE_URL + '/chat/completions', {
    model: LLM_MODEL,
    max_tokens: 500,
    messages: [
      { role: 'system', content: BOT_SYSTEM_PROMPT },
      { role: 'user', content: userMessage }
    ]
  }, {
    headers: {
      'Authorization': 'Bearer ' + LLM_API_KEY,
      'Content-Type': 'application/json'
    },
    timeout: 30000
  });
  const text = response.data
    && response.data.choices
    && response.data.choices[0]
    && response.data.choices[0].message
    && response.data.choices[0].message.content;
  return text || FALLBACK_REPLY;
}

// ===== Notion SYSLOG 写入 =====
async function writeNotionSyslog(senderNick, content, replyText) {
  if (!notion) return;
  const now = new Date().toISOString();
  await notion.pages.create({
    parent: { database_id: NOTION_SYSLOG_DB_ID },
    properties: {
      '标题': { title: [{ type: 'text', text: { content: ('[钉钉] ' + senderNick + ' · ' + now.split('T')[0]).substring(0, NOTION_TITLE_MAX) } }] },
      '接收时间': { date: { start: now } },
      '推送方': { rich_text: [{ type: 'text', text: { content: '钉钉群' } }] },
      '文件内容': { rich_text: [{ type: 'text', text: { content: ('用户: ' + (content || '') + '\n回复: ' + (replyText || '')).substring(0, NOTION_CONTENT_MAX) } }] }
    }
  });
}

// ===== 创建 Stream 客户端 =====
const client = new DWClient({
  clientId: DINGTALK_APP_KEY,
  clientSecret: DINGTALK_APP_SECRET,
});

// ===== 注册消息回调 =====
client.registerCallbackListener(TOPIC_ROBOT, async (res) => {
  console.log('[Stream] 收到消息，原始数据:', JSON.stringify(res).substring(0, 300));

  // 解析消息数据（res.data 可能是 JSON 字符串或对象）
  let msgData = res.data;
  if (typeof msgData === 'string') {
    try { msgData = JSON.parse(msgData); } catch (e) { msgData = {}; }
  }
  msgData = msgData || {};

  const senderNick = msgData.senderNick || '未知用户';
  const content = (msgData.text && msgData.text.content || '').trim();
  const sessionWebhook = msgData.sessionWebhook;
  const messageId = res.headers && res.headers.messageId;

  console.log('[Stream] 发送者: ' + senderNick + ', 内容: ' + content);

  let replyText = FALLBACK_REPLY;

  // ===== LLM 调用（独立 try-catch，失败不影响主流程） =====
  try {
    replyText = await callLLM(content || '你好');
    console.log('[LLM] 回复生成成功，长度: ' + replyText.length);
  } catch (err) {
    console.error('[LLM] 调用失败，使用降级回复:', err.message);
    replyText = FALLBACK_REPLY;
  }

  // ===== 发送回复到钉钉群 =====
  if (sessionWebhook) {
    try {
      await axios.post(sessionWebhook, {
        msgtype: 'text',
        text: { content: replyText }
      }, { timeout: 10000 });
      console.log('[Stream] 回复发送成功');
    } catch (err) {
      console.error('[Stream] 回复发送失败:', err.message);
    }
  }

  // ===== Notion SYSLOG 写入（独立 try-catch，失败不影响主流程） =====
  try {
    await writeNotionSyslog(senderNick, content, replyText);
    console.log('[Notion] SYSLOG 写入成功');
  } catch (err) {
    console.error('[Notion] SYSLOG 写入失败:', err.message);
  }

  // ===== 消息确认（防止服务端重试推送） =====
  try {
    if (messageId) {
      client.socketCallBackResponse(messageId, { status: 'SUCCESS' });
    }
  } catch (err) {
    console.error('[Stream] 消息确认失败:', err.message);
  }
});

// ===== 启动连接 =====
client.connect().then(() => {
  console.log('🚀 秋秋（钉钉AI人格体）Stream 模式已启动');
  console.log('📡 等待消息中... 在钉钉群 @秋秋 发消息试试');
}).catch(err => {
  console.error('[Stream] 启动失败:', err.message);
  process.exit(1);
});
