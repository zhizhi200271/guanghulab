// exe-engine/src/router/stubs/dialogue-stub.js
// HLI 路由 · DIALOGUE 域
// Phase 1 实装 — 对话发送、流式、历史
// PRJ-EXE-001 · 版权：国作登字-2026-A-00037559

'use strict';

const { randomUUID } = require('crypto');

// 对话存储（session_id → turns[]）
const _dialogueStore = new Map();

const dialogueStubs = [
  {
    routeId: 'HLI-DIALOGUE-001',
    path: '/hli/dialogue/send',
    phase: 'P1',
    handler: async (req) => {
      const body = req.body || req;
      const { session_id, message, persona_id } = body;

      if (!session_id || !message) {
        return {
          statusCode: 400,
          body: { error: true, code: 'MISSING_PARAMS', message: '缺少 session_id 或 message' }
        };
      }

      // 获取或创建会话轮次列表
      if (!_dialogueStore.has(session_id)) {
        _dialogueStore.set(session_id, []);
      }

      const turns = _dialogueStore.get(session_id);
      const turnId = `turn-${randomUUID().slice(0, 12)}`;

      // 模拟回复（Phase 1 无真实 AI，返回确认回复）
      const reply = `[${persona_id || 'system'}] 已收到: ${message}`;

      turns.push({
        turnId,
        user: message,
        assistant: reply,
        persona_id: persona_id || null,
        timestamp: new Date().toISOString()
      });

      return {
        statusCode: 200,
        body: { reply, session_id, turn_id: turnId }
      };
    }
  },
  {
    routeId: 'HLI-DIALOGUE-002',
    path: '/hli/dialogue/stream',
    phase: 'P1',
    handler: async (req) => {
      const body = req.body || req;
      const { session_id } = body;

      // SSE 流式占位 — Phase 1 返回 ready 状态
      return {
        statusCode: 200,
        body: {
          type: 'stream',
          session_id: session_id || null,
          status: 'ready'
        }
      };
    }
  },
  {
    routeId: 'HLI-DIALOGUE-003',
    path: '/hli/dialogue/history',
    phase: 'P1',
    handler: async (req) => {
      const body = req.body || req;
      const { session_id, limit } = body;

      if (!session_id) {
        return {
          statusCode: 400,
          body: { error: true, code: 'MISSING_SESSION_ID', message: '缺少 session_id' }
        };
      }

      const allTurns = _dialogueStore.get(session_id) || [];
      const returnTurns = limit && limit > 0 ? allTurns.slice(-limit) : allTurns;

      return {
        statusCode: 200,
        body: {
          session_id,
          turns: returnTurns,
          total: allTurns.length
        }
      };
    }
  }
];

module.exports = { dialogueStubs };
