// exe-engine/src/context/session.js
// EXE-Engine · 会话管理
// 多轮对话的会话生命周期管理
// PRJ-EXE-001 · Phase 1 · ZY-EXE-P1-002
// 版权：国作登字-2026-A-00037559

'use strict';

const { randomUUID } = require('crypto');

/**
 * 会话管理器
 *
 * 本体论锚定：会话 = 笔与纸之间的一段连续书写。
 * 每段书写有开始和结束，中间的每一笔都被记录。
 */
class Session {
  /**
   * @param {object} deps
   * @param {ContextManager} deps.contextManager  上下文管理器
   */
  constructor(deps = {}) {
    this._contextManager = deps.contextManager || null;
    this._sessions = new Map();
  }

  /**
   * 创建新会话
   * @param {string} agentId      Agent ID
   * @param {object} [metadata]   会话元数据
   * @returns {{ sessionId: string, contextId: string }}
   */
  createSession(agentId, metadata = {}) {
    const sessionId = `sess-${randomUUID().slice(0, 12)}`;
    let contextId = null;

    // 如果有上下文管理器，同步创建上下文
    if (this._contextManager) {
      contextId = this._contextManager.createContext(agentId, sessionId);
    }

    const now = new Date().toISOString();

    const session = {
      sessionId,
      agentId,
      contextId,
      turns: [],
      metadata: { ...metadata },
      createdAt: now,
      status: 'active'
    };

    this._sessions.set(sessionId, session);

    return { sessionId, contextId };
  }

  /**
   * 获取会话
   * @param {string} sessionId
   * @returns {object|null}
   */
  getSession(sessionId) {
    return this._sessions.get(sessionId) || null;
  }

  /**
   * 添加对话轮次
   * @param {string} sessionId
   * @param {string} userMessage      用户消息
   * @param {string} assistantMessage 助手回复
   * @returns {boolean}
   */
  addTurn(sessionId, userMessage, assistantMessage) {
    const session = this._sessions.get(sessionId);
    if (!session || session.status !== 'active') return false;

    const turn = {
      turnId: session.turns.length + 1,
      user: userMessage,
      assistant: assistantMessage,
      timestamp: new Date().toISOString()
    };

    session.turns.push(turn);

    // 同步到上下文管理器
    if (this._contextManager && session.contextId) {
      this._contextManager.addMessage(session.contextId, 'user', userMessage);
      this._contextManager.addMessage(session.contextId, 'assistant', assistantMessage);
    }

    return true;
  }

  /**
   * 获取对话历史
   * @param {string} sessionId
   * @param {number} [limit]  返回最近 N 轮
   * @returns {object[]}
   */
  getHistory(sessionId, limit) {
    const session = this._sessions.get(sessionId);
    if (!session) return [];

    if (limit && limit > 0) {
      return session.turns.slice(-limit);
    }
    return [...session.turns];
  }

  /**
   * 结束会话
   * @param {string} sessionId
   * @returns {boolean}
   */
  endSession(sessionId) {
    const session = this._sessions.get(sessionId);
    if (!session) return false;

    session.status = 'ended';

    // 同步过期上下文
    if (this._contextManager && session.contextId) {
      this._contextManager.expireContext(session.contextId);
    }

    return true;
  }

  /**
   * 列出指定 Agent 的所有会话
   * @param {string} agentId
   * @returns {object[]}
   */
  listSessions(agentId) {
    const results = [];
    for (const [, session] of this._sessions) {
      if (session.agentId === agentId) {
        results.push(session);
      }
    }
    return results;
  }
}

module.exports = Session;
