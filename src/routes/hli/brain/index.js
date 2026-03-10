// src/routes/hli/brain/index.js
// HLI BRAIN 域路由 — 铸渊核心大脑接口
// 不需要鉴权（前端壳层需要调用这些接口来组装 AI 请求）

'use strict';

const express = require('express');
const router = express.Router();
const brain = require('../../../brain');

// POST /hli/brain/prompt — 组装系统提示词
router.post('/prompt', (req, res) => {
  const { userName, ghUser, role, mode, devStatus } = req.body;

  if (!userName) {
    return res.status(400).json({
      error: true,
      code: 'MISSING_USERNAME',
      message: '缺少 userName 参数',
    });
  }

  const detectedMode = mode || brain.detectMode(req.body.text || '').mode;
  const prompt = brain.assemblePrompt({
    userName,
    ghUser: ghUser || '',
    role: role || 'guest',
    mode: detectedMode,
    brain: brain.loadLongTermMemory() || brain.FALLBACK_BRAIN,
    devStatus: devStatus || null,
    userMeta: brain.ROLE_MAP[userName] || null,
  });

  res.json({
    hli_id: 'HLI-BRAIN-001',
    prompt,
    brain_version: brain.BRAIN_VERSION,
    mode: detectedMode,
  });
});

// POST /hli/brain/route — 任务型模型路由
router.post('/route', (req, res) => {
  const { text, contextLength, isGuest } = req.body;

  if (!text) {
    return res.status(400).json({
      error: true,
      code: 'MISSING_TEXT',
      message: '缺少 text 参数',
    });
  }

  const modeResult = brain.detectMode(text);
  const modelResult = brain.selectModel(modeResult.mode, {
    contextLength: contextLength || 0,
    isGuest: isGuest || false,
  });

  res.json({
    hli_id: 'HLI-BRAIN-002',
    mode: modeResult,
    model: modelResult,
    routing_table: brain.getRoutingTable(),
    failure_status: brain.getFailureStatus(),
  });
});

// POST /hli/brain/context — 上下文裁剪
router.post('/context', (req, res) => {
  const { messages, systemMessages, isGuest, contextBudget } = req.body;

  if (!messages || !Array.isArray(messages)) {
    return res.status(400).json({
      error: true,
      code: 'MISSING_MESSAGES',
      message: '缺少 messages 参数',
    });
  }

  const result = brain.trimMessages(
    systemMessages || [],
    messages,
    { isGuest: isGuest || false, contextBudget: contextBudget || 0 },
  );

  res.json({
    hli_id: 'HLI-BRAIN-003',
    messages: result.messages,
    trimmed: result.trimmed,
    totalTokens: result.totalTokens,
  });
});

// POST /hli/brain/memory — 记忆分析与候选生成
router.post('/memory', (req, res) => {
  const { text, source } = req.body;

  if (!text) {
    return res.status(400).json({
      error: true,
      code: 'MISSING_TEXT',
      message: '缺少 text 参数',
    });
  }

  const candidates = brain.generateCandidates(text, source || 'user');
  const memoryStatus = brain.getMemoryStatus();

  res.json({
    hli_id: 'HLI-BRAIN-004',
    candidates,
    memory_status: memoryStatus,
  });
});

// GET /hli/brain/status — 大脑状态概览
router.get('/status', (req, res) => {
  const longTermMemory = brain.loadLongTermMemory();

  res.json({
    hli_id: 'HLI-BRAIN-STATUS',
    brain_version: brain.BRAIN_VERSION,
    modes: brain.MODES,
    routing_table: brain.getRoutingTable(),
    failure_status: brain.getFailureStatus(),
    context_config: brain.CONTEXT_CONFIG,
    memory_status: brain.getMemoryStatus(),
    long_term_loaded: !!longTermMemory,
    role_map: Object.keys(brain.ROLE_MAP),
  });
});

module.exports = router;
