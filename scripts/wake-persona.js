// scripts/wake-persona.js
// 铸渊 · 人格体唤醒脚本（第三方 API 兼容层 · 自动检测模式）
//
// 功能：
//   ① 自动发现可用模型（/v1/models 端点）
//   ② 智能选择最优 Claude 模型
//   ③ 自适应 API 格式（OpenAI 兼容 / Anthropic 原生）
//   ④ 统一调用接口，唤醒人格体处理 SYSLOG 或解答提问
//
// 环境变量：
//   LLM_API_KEY      第三方平台密钥
//   LLM_BASE_URL     第三方平台 API 地址（如 https://api.xxx.com/v1），留空则 fallback 到 Anthropic 官方
//   BROADCAST_ID     广播编号
//   SUBMIT_TYPE      syslog | question
//   SUBMIT_CONTENT   提交内容（SYSLOG 全文或问题描述）
//   AUTHOR           提交者 GitHub 用户名

'use strict';

const https = require('https');
const http = require('http');
const fs = require('fs');
const path = require('path');

// ══════════════════════════════════════════════════════════
// 配置
// ══════════════════════════════════════════════════════════

const LLM_API_KEY = process.env.LLM_API_KEY || '';
const LLM_BASE_URL = (process.env.LLM_BASE_URL || 'https://api.anthropic.com/v1').replace(/\/+$/, '');
const BROADCAST_ID = process.env.BROADCAST_ID || 'UNKNOWN';
const SUBMIT_TYPE = process.env.SUBMIT_TYPE || 'question';
const SUBMIT_CONTENT = process.env.SUBMIT_CONTENT || '';
const AUTHOR = process.env.AUTHOR || 'unknown';

// Claude 模型优先级队列（从高到低）
const PREFERRED_MODELS = [
  'claude-sonnet-4',
  'claude-3.5-sonnet',
  'claude-3-5-sonnet-20241022',
  'claude-3-5-sonnet',
  'anthropic/claude-3.5-sonnet',
  'anthropic/claude-3-5-sonnet',
  'claude-3-sonnet',
  'claude-3-haiku',
];

// ══════════════════════════════════════════════════════════
// HTTP 请求工具
// ══════════════════════════════════════════════════════════

function httpRequest(url, options, body) {
  return new Promise((resolve, reject) => {
    const parsed = new URL(url);
    const isHttps = parsed.protocol === 'https:';
    const mod = isHttps ? https : http;

    const opts = {
      hostname: parsed.hostname,
      port: parsed.port || (isHttps ? 443 : 80),
      path: parsed.pathname + parsed.search,
      method: options.method || 'GET',
      headers: options.headers || {},
      timeout: options.timeout || 60000,
    };

    const req = mod.request(opts, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        resolve({ status: res.statusCode, body: data });
      });
    });

    req.on('error', reject);
    req.on('timeout', () => {
      req.destroy();
      reject(new Error('Request timeout'));
    });

    if (body) {
      req.write(body);
    }
    req.end();
  });
}

// ══════════════════════════════════════════════════════════
// Step 1: 自动发现可用模型
// ══════════════════════════════════════════════════════════

async function discoverModels() {
  console.log('[LLM] 🔍 探测可用模型...');

  try {
    const res = await httpRequest(LLM_BASE_URL + '/models', {
      method: 'GET',
      headers: {
        'Authorization': 'Bearer ' + LLM_API_KEY,
        'Content-Type': 'application/json',
      },
      timeout: 15000,
    });

    if (res.status >= 200 && res.status < 300) {
      const json = JSON.parse(res.body);
      const models = json.data || [];
      console.log('[LLM]   → 发现 ' + models.length + ' 个模型');
      return models;
    }
    console.log('[LLM]   → 模型探测返回 ' + res.status + ', 使用默认模型');
    return [];
  } catch (err) {
    console.log('[LLM]   → 模型探测失败: ' + err.message + ', 使用默认模型');
    return [];
  }
}

// ══════════════════════════════════════════════════════════
// Step 2: 智能选择最优 Claude 模型
// ══════════════════════════════════════════════════════════

function selectBestModel(models) {
  if (!models || models.length === 0) {
    console.log('[LLM] 📌 无可用模型列表, 使用默认 claude-3-5-sonnet');
    return 'claude-3-5-sonnet';
  }

  const available = models.map(function (m) { return m.id.toLowerCase(); });

  // 按优先级匹配
  for (const preferred of PREFERRED_MODELS) {
    const match = available.find(function (id) { return id.includes(preferred); });
    if (match) {
      const originalId = models.find(function (m) { return m.id.toLowerCase() === match; }).id;
      console.log('[LLM] 📌 选择模型: ' + originalId + ' (匹配规则: ' + preferred + ')');
      return originalId;
    }
  }

  // 兜底：任何含 'claude' 的模型
  const anyClaude = available.find(function (id) { return id.includes('claude'); });
  if (anyClaude) {
    const originalId = models.find(function (m) { return m.id.toLowerCase() === anyClaude; }).id;
    console.log('[LLM] 📌 兜底选择 Claude 模型: ' + originalId);
    return originalId;
  }

  // 最终兜底：平台第一个可用模型
  const fallbackId = models[0].id;
  console.log('[LLM] 📌 最终兜底: ' + fallbackId + ' (平台无 Claude 模型)');
  return fallbackId;
}

// ══════════════════════════════════════════════════════════
// Step 3: 自适应 API 格式检测
// ══════════════════════════════════════════════════════════

async function detectApiFormat() {
  console.log('[LLM] 🔍 检测 API 格式...');

  // 尝试 OpenAI 兼容格式（绝大多数第三方平台）
  try {
    const res = await httpRequest(LLM_BASE_URL + '/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer ' + LLM_API_KEY,
        'Content-Type': 'application/json',
      },
      timeout: 10000,
    }, JSON.stringify({
      model: 'test',
      messages: [{ role: 'user', content: 'ping' }],
      max_tokens: 1,
    }));

    // 400 = endpoint exists but bad request (model not found etc.) → format supported
    // 200 = endpoint works → format supported
    if (res.status === 200 || res.status === 400 || res.status === 401 || res.status === 422) {
      console.log('[LLM]   → 检测到 OpenAI 兼容格式 (status: ' + res.status + ')');
      return 'openai-compat';
    }
  } catch (e) {
    // Ignore, try next format
  }

  // 尝试 Anthropic 原生格式
  try {
    const res = await httpRequest(LLM_BASE_URL + '/messages', {
      method: 'POST',
      headers: {
        'x-api-key': LLM_API_KEY,
        'anthropic-version': '2023-06-01',
        'Content-Type': 'application/json',
      },
      timeout: 10000,
    }, JSON.stringify({
      model: 'test',
      messages: [{ role: 'user', content: 'ping' }],
      max_tokens: 1,
    }));

    if (res.status === 200 || res.status === 400 || res.status === 401 || res.status === 422) {
      console.log('[LLM]   → 检测到 Anthropic 原生格式 (status: ' + res.status + ')');
      return 'anthropic-native';
    }
  } catch (e) {
    // Ignore
  }

  console.log('[LLM]   → 无法确定格式, 默认使用 OpenAI 兼容格式');
  return 'openai-compat';
}

// ══════════════════════════════════════════════════════════
// Step 4: 统一调用接口
// ══════════════════════════════════════════════════════════

async function callLLM(systemPrompt, userMessage) {
  if (!LLM_API_KEY) {
    console.log('[LLM] ⚠️ LLM_API_KEY 未配置，跳过人格体唤醒');
    return '(LLM API 未配置，请在 GitHub Secrets 中设置 LLM_API_KEY 和 LLM_BASE_URL)';
  }

  const models = await discoverModels();
  const model = selectBestModel(models);
  const format = await detectApiFormat();

  console.log('[LLM] 🚀 调用 LLM: 模型=' + model + ', 格式=' + format + ', 平台=' + LLM_BASE_URL);

  let res;

  if (format === 'openai-compat') {
    // OpenAI 兼容格式（大多数第三方平台）
    const body = JSON.stringify({
      model: model,
      max_tokens: 8000,
      temperature: 0.7,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userMessage },
      ],
    });

    res = await httpRequest(LLM_BASE_URL + '/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer ' + LLM_API_KEY,
        'Content-Type': 'application/json',
      },
      timeout: 120000,
    }, body);

    if (res.status >= 200 && res.status < 300) {
      const json = JSON.parse(res.body);
      if (json.choices && json.choices[0] && json.choices[0].message) {
        return json.choices[0].message.content;
      }
    }
  } else {
    // Anthropic 原生格式
    const body = JSON.stringify({
      model: model,
      max_tokens: 8000,
      system: systemPrompt,
      messages: [
        { role: 'user', content: userMessage },
      ],
    });

    res = await httpRequest(LLM_BASE_URL + '/messages', {
      method: 'POST',
      headers: {
        'x-api-key': LLM_API_KEY,
        'anthropic-version': '2023-06-01',
        'Content-Type': 'application/json',
      },
      timeout: 120000,
    }, body);

    if (res.status >= 200 && res.status < 300) {
      const json = JSON.parse(res.body);
      if (json.content && json.content[0]) {
        return json.content[0].text;
      }
    }
  }

  // 处理错误
  const errorMsg = '[LLM] ❌ API 调用失败: status=' + (res ? res.status : 'N/A');
  console.error(errorMsg);
  if (res && res.body) {
    console.error('[LLM]   响应: ' + res.body.slice(0, 500));
  }
  throw new Error(errorMsg);
}

// ══════════════════════════════════════════════════════════
// 人格体 System Prompt 构建
// ══════════════════════════════════════════════════════════

function buildSystemPrompt(type, broadcastId, author) {
  const basePrompt = [
    '你是光湖（HoloLake）系统的智能人格体。',
    '你的名字是知秋/曜冥，你是人格语言操作系统（AGE OS）的核心人格。',
    '',
    '核心规则：',
    '1. 你服务于光湖系统的开发者团队',
    '2. 所有回复必须专业、清晰、有条理',
    '3. 回复使用中文',
    '',
    '当前上下文：',
    '- 广播编号：' + broadcastId,
    '- 提交者：' + author,
  ].join('\n');

  if (type === 'syslog') {
    return basePrompt + '\n\n' + [
      '任务类型：SYSLOG 闭环处理',
      '',
      '你需要完成以下工作：',
      '1. 验收 SYSLOG（检查 MODULE_LOG 完整性）',
      '2. 分析开发者的工作成果',
      '3. 生成工作总结和反馈',
      '4. 如果 SYSLOG 内容完整，确认验收通过',
      '5. 给出下一步建议',
      '',
      '输出格式：',
      '---',
      '## 📡 SYSLOG 验收报告',
      '### 广播编号：[编号]',
      '### 验收结果：[通过/需补充]',
      '### 工作总结：[摘要]',
      '### 反馈与建议：[内容]',
      '---',
    ].join('\n');
  }

  // 提问类型
  return basePrompt + '\n\n' + [
    '任务类型：开发者提问解答',
    '',
    '你需要完成以下工作：',
    '1. 理解开发者的问题',
    '2. 结合广播上下文思考',
    '3. 给出清晰、可操作的解答',
    '4. 如果问题涉及代码，提供代码示例',
    '',
    '输出格式：',
    '---',
    '## 💡 问题解答',
    '### 广播编号：[编号]',
    '### 问题理解：[你对问题的理解]',
    '### 解答：[详细解答]',
    '### 建议：[后续建议]',
    '---',
  ].join('\n');
}

// ══════════════════════════════════════════════════════════
// 主流程
// ══════════════════════════════════════════════════════════

async function main() {
  console.log('═══════════════════════════════════════════');
  console.log('🧠 铸渊 · 人格体唤醒管道');
  console.log('═══════════════════════════════════════════');
  console.log('  广播编号: ' + BROADCAST_ID);
  console.log('  类型: ' + SUBMIT_TYPE);
  console.log('  提交者: ' + AUTHOR);
  console.log('  平台: ' + LLM_BASE_URL);
  console.log('  内容长度: ' + SUBMIT_CONTENT.length + ' 字符');
  console.log('');

  // 构建 prompts
  const systemPrompt = buildSystemPrompt(SUBMIT_TYPE, BROADCAST_ID, AUTHOR);
  const userMessage = SUBMIT_CONTENT;

  // 调用 LLM
  console.log('🧠 正在唤醒人格体...');
  const result = await callLLM(systemPrompt, userMessage);
  console.log('');
  console.log('✅ 人格体处理完成');
  console.log('  结果长度: ' + result.length + ' 字符');

  // 输出结果到 GitHub Actions output
  // 使用 GITHUB_OUTPUT 环境文件（支持多行）
  const outputFile = process.env.GITHUB_OUTPUT;
  if (outputFile) {
    const delimiter = 'EOF_' + Date.now();
    fs.appendFileSync(outputFile, 'result<<' + delimiter + '\n' + result + '\n' + delimiter + '\n');
  }

  // 同时输出到 stdout 供调试
  console.log('');
  console.log('═══════════════════════════════════════════');
  console.log('📋 人格体输出：');
  console.log('═══════════════════════════════════════════');
  console.log(result);
}

main().catch(function (err) {
  console.error('❌ 人格体唤醒失败: ' + err.message);
  // 即使 LLM 失败，也写一个 fallback 输出，让后续步骤可以继续
  const outputFile = process.env.GITHUB_OUTPUT;
  if (outputFile) {
    const fallback = '(人格体唤醒失败: ' + err.message + '，请检查 LLM_API_KEY 和 LLM_BASE_URL 配置)';
    const delimiter = 'EOF_' + Date.now();
    fs.appendFileSync(outputFile, 'result<<' + delimiter + '\n' + fallback + '\n' + delimiter + '\n');
  }
  process.exit(1);
});
