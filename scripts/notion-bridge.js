// scripts/notion-bridge.js
// 铸渊 → Notion 数据桥（共用模块）
//
// 管道 A (syslog):   node scripts/notion-bridge.js syslog
// 管道 E (changes):  node scripts/notion-bridge.js changes
//
// 必需环境变量：
//   NOTION_TOKEN         GitHub Secret: NOTION_TOKEN
//   NOTION_SYSLOG_DB_ID  管道A · 「GitHub SYSLOG 收件箱」数据库 ID
//   NOTION_CHANGES_DB_ID 管道E · 「GitHub 变更日志」数据库 ID
//
// 所有其他上下文通过环境变量传入（见下方各管道章节）

'use strict';

const https = require('https');
const fs    = require('fs');
const path  = require('path');

// ══════════════════════════════════════════════════════════
// Notion API 基础调用
// ══════════════════════════════════════════════════════════

const NOTION_VERSION         = '2022-06-28';
const NOTION_API             = 'api.notion.com';
const NOTION_RICH_TEXT_MAX   = 2000; // Notion rich_text content length limit per block
const NOTION_TITLE_MAX       = 120;  // Practical limit for Notion page title

/**
 * 向 Notion API 发起 HTTPS POST 请求
 * @param {string} endpoint  - e.g. '/v1/pages'
 * @param {object} body      - JSON body
 * @param {string} token     - Bearer token
 * @returns {Promise<object>} - Notion API 返回值
 */
function notionPost(endpoint, body, token) {
  return new Promise((resolve, reject) => {
    const payload = JSON.stringify(body);
    const opts = {
      hostname: NOTION_API,
      port:     443,
      path:     endpoint,
      method:   'POST',
      headers: {
        'Authorization':  'Bearer ' + token,
        'Content-Type':   'application/json',
        'Notion-Version': NOTION_VERSION,
        'Content-Length': Buffer.byteLength(payload),
      },
    };

    const req = https.request(opts, res => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          if (res.statusCode >= 200 && res.statusCode < 300) {
            resolve(parsed);
          } else {
            reject(new Error(`Notion API ${res.statusCode}: ${parsed.message || data}`));
          }
        } catch (e) {
          reject(new Error(`Notion API parse error: ${data}`));
        }
      });
    });

    req.on('error', reject);
    req.write(payload);
    req.end();
  });
}

/**
 * 构建 Notion rich_text 块
 * @param {string} content
 */
function richText(content) {
  const MAX = 2000; // Notion 单个 rich_text 内容上限
  return [{ type: 'text', text: { content: String(content || '').slice(0, MAX) } }];
}

/**
 * 构建 Notion paragraph block
 */
function paragraph(content) {
  const MAX = 2000;
  const text = String(content || '').slice(0, MAX);
  return {
    object:    'block',
    type:      'paragraph',
    paragraph: { rich_text: richText(text) },
  };
}

/**
 * 构建 Notion heading_3 block
 */
function heading3(content) {
  return {
    object:    'block',
    type:      'heading_3',
    heading_3: { rich_text: richText(String(content || '')) },
  };
}

// ══════════════════════════════════════════════════════════
// 管道 A · SYSLOG 收件箱同步到 Notion
// ══════════════════════════════════════════════════════════

/**
 * 将单条 syslog entry 写入 Notion 数据库
 * @param {string} dbId      - 「GitHub SYSLOG 收件箱」database_id
 * @param {object} entry     - syslog JSON 内容
 * @param {string} filename  - 源文件名（用于溯源）
 * @param {string} token     - Notion token
 */
async function createSyslogRecord(dbId, entry, filename, token) {
  const title   = entry.title || filename;
  const devId   = entry.from  || entry.dev_id || '未知';
  const ts      = entry.timestamp || new Date().toISOString();
  const content = JSON.stringify(entry, null, 2);

  const body = {
    parent:     { database_id: dbId },
    properties: {
      // 「名称」是 Notion 数据库的默认标题列，始终存在
      '名称': { title: richText(title) },
      // 以下属性若不存在会被 Notion 忽略，不影响创建
      'DEV编号':  { rich_text: richText(devId) },
      '来源文件': { rich_text: richText(filename) },
      '接收时间': { date: { start: ts } },
      '处理状态': { select: { name: '待处理' } },
    },
    children: [
      heading3('📋 SYSLOG 原始内容'),
      paragraph(content),
    ],
  };

  return notionPost('/v1/pages', body, token);
}

async function runPipelineA() {
  const token = process.env.NOTION_TOKEN;
  const dbId  = process.env.NOTION_SYSLOG_DB_ID;

  if (!token || !dbId) {
    console.log('⚠️  管道A: 缺少 NOTION_TOKEN 或 NOTION_SYSLOG_DB_ID，跳过 Notion 同步');
    process.exit(0);
  }

  const INBOX_DIR = 'syslog-inbox';
  if (!fs.existsSync(INBOX_DIR)) {
    console.log('📭 syslog-inbox/ 目录不存在，跳过');
    process.exit(0);
  }

  const files = fs.readdirSync(INBOX_DIR)
    .filter(f => (f.endsWith('.json') || f.endsWith('.md') || f.endsWith('.txt')) && f !== '.gitkeep');

  if (files.length === 0) {
    console.log('📭 syslog-inbox/ 无待处理条目，跳过 Notion 同步');
    process.exit(0);
  }

  console.log(`📥 管道A: 发现 ${files.length} 条 syslog，开始同步到 Notion…`);

  let ok = 0, failed = 0;

  for (const file of files) {
    const fullPath = path.join(INBOX_DIR, file);
    let entry;

    try {
      const raw = fs.readFileSync(fullPath, 'utf8');
      entry = file.endsWith('.json') ? JSON.parse(raw) : { title: file, content: raw };
    } catch (e) {
      console.error(`❌ 读取 ${file} 失败: ${e.message}`);
      failed++;
      continue;
    }

    try {
      const page = await createSyslogRecord(dbId, entry, file, token);
      console.log(`  ✅ ${file} → Notion page: ${page.id}`);
      ok++;
    } catch (e) {
      console.error(`  ❌ ${file} → Notion 失败: ${e.message}`);
      failed++;
    }
  }

  console.log(`\n✅ 管道A Notion 同步完成 · 成功 ${ok} 条 · 失败 ${failed} 条`);
  if (failed > 0) process.exit(1);
}

// ══════════════════════════════════════════════════════════
// 管道 E · GitHub 变更日志同步到 Notion
// ══════════════════════════════════════════════════════════

/**
 * 将单次 commit / PR 写入 Notion 变更日志数据库
 * 环境变量（由 workflow 注入）：
 *   EVENT_TYPE       commit | pr
 *   COMMIT_SHA       提交 SHA (commit)
 *   COMMIT_MSG       commit message
 *   COMMITTER        提交者用户名
 *   COMMIT_TIMESTAMP 提交时间 ISO
 *   CHANGED_FILES    逗号分隔的变更文件路径
 *   PR_NUMBER        PR 编号 (pr)
 *   PR_TITLE         PR 标题 (pr)
 *   PR_ACTION        opened | closed (pr)
 *   PR_MERGED        true | false (pr)
 */
async function runPipelineE() {
  const token = process.env.NOTION_TOKEN;
  const dbId  = process.env.NOTION_CHANGES_DB_ID;

  if (!token || !dbId) {
    console.log('⚠️  管道E: 缺少 NOTION_TOKEN 或 NOTION_CHANGES_DB_ID，跳过 Notion 同步');
    process.exit(0);
  }

  const eventType = process.env.EVENT_TYPE || 'commit';
  const now       = process.env.COMMIT_TIMESTAMP || new Date().toISOString();

  let title, type, committer, changedFiles, description;

  if (eventType === 'pr') {
    const action   = process.env.PR_ACTION  || 'opened';
    const merged   = process.env.PR_MERGED  === 'true';
    const prNum    = process.env.PR_NUMBER  || '';
    const prTitle  = process.env.PR_TITLE   || '(无标题)';
    const finalAct = merged ? 'merged' : action;

    title       = `PR #${prNum}: ${prTitle}`;
    type        = 'PR';
    committer   = process.env.COMMITTER    || '未知';
    changedFiles = process.env.CHANGED_FILES || '';
    description  = `PR #${prNum} ${finalAct} by ${committer}`;
  } else {
    const sha = (process.env.COMMIT_SHA || '').slice(0, 7);
    const msg = process.env.COMMIT_MSG || '(无 commit message)';
    title       = msg.split('\n')[0].slice(0, 120); // 取第一行
    type        = 'commit';
    committer   = process.env.COMMITTER    || '未知';
    changedFiles = process.env.CHANGED_FILES || '';
    description  = `${sha}: ${title}`;
  }

  console.log(`📡 管道E: 同步变更记录到 Notion: ${title}`);

  const body = {
    parent:     { database_id: dbId },
    properties: {
      '名称':    { title: richText(title) },
      '提交者':  { rich_text: richText(committer) },
      '类型':    { select: { name: type } },
      '时间':    { date: { start: now } },
      '变更文件': { rich_text: richText(changedFiles) },
    },
    children: [
      heading3('📝 变更详情'),
      paragraph(description),
      ...(changedFiles ? [
        heading3('📁 变更文件列表'),
        paragraph(changedFiles.split(',').join('\n')),
      ] : []),
    ],
  };

  try {
    const page = await notionPost('/v1/pages', body, token);
    console.log(`✅ 管道E 变更记录已写入 Notion: ${page.id}`);
  } catch (e) {
    console.error(`❌ 管道E 写入 Notion 失败: ${e.message}`);
    process.exit(1);
  }
}

// ══════════════════════════════════════════════════════════
// 入口
// ══════════════════════════════════════════════════════════

const mode = process.argv[2];

if (mode === 'syslog') {
  runPipelineA().catch(e => { console.error(e); process.exit(1); });
} else if (mode === 'changes') {
  runPipelineE().catch(e => { console.error(e); process.exit(1); });
} else {
  console.error('用法: node scripts/notion-bridge.js [syslog|changes]');
  process.exit(1);
}
