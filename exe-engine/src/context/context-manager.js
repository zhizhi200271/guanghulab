// exe-engine/src/context/context-manager.js
// EXE-Engine · 上下文管理器
// 支持持久化的升级上下文系统（Grid-DB 接口预留）
// PRJ-EXE-001 · Phase 1 · ZY-EXE-P1-001
// 版权：国作登字-2026-A-00037559

'use strict';

const { randomUUID } = require('crypto');

/**
 * 上下文管理器
 *
 * 本体论锚定：上下文 = 笔的记忆链。
 * 每次对话都有连续的记忆，管理器负责维护这条记忆链。
 * Phase 1 使用内存 + ContextCache，Phase 2 对接 Grid-DB 持久化。
 */
class ContextManager {
  /**
   * @param {object} deps
   * @param {ContextCache} deps.cache  上下文缓存实例
   */
  constructor(deps = {}) {
    this._cache = deps.cache || null;
    this._contexts = new Map();
    // Grid-DB 持久化接口预留
    this._gridDB = null;
  }

  /**
   * 创建新上下文
   * @param {string} agentId    Agent ID
   * @param {string} sessionId  会话 ID
   * @param {object} [initialData]  初始数据
   * @returns {string} contextId
   */
  createContext(agentId, sessionId, initialData = {}) {
    const contextId = `ctx-${randomUUID().slice(0, 12)}`;
    const now = new Date().toISOString();

    const context = {
      contextId,
      agentId,
      sessionId,
      data: { ...initialData },
      messages: [],
      createdAt: now,
      updatedAt: now,
      status: 'active'
    };

    this._contexts.set(contextId, context);

    // 同步到缓存
    if (this._cache) {
      this._cache.set(contextId, context);
    }

    return contextId;
  }

  /**
   * 获取上下文
   * @param {string} contextId
   * @returns {object|null}
   */
  getContext(contextId) {
    // 先查内存
    const ctx = this._contexts.get(contextId);
    if (ctx) return ctx;

    // 再查缓存
    if (this._cache) {
      const cached = this._cache.get(contextId);
      if (cached) {
        this._contexts.set(contextId, cached);
        return cached;
      }
    }

    return null;
  }

  /**
   * 更新上下文数据
   * @param {string} contextId
   * @param {object} updates  要合并的更新
   * @returns {boolean} 是否成功
   */
  updateContext(contextId, updates) {
    const ctx = this._contexts.get(contextId);
    if (!ctx) return false;

    Object.assign(ctx.data, updates);
    ctx.updatedAt = new Date().toISOString();

    if (this._cache) {
      this._cache.set(contextId, ctx);
    }

    return true;
  }

  /**
   * 标记上下文为过期
   * @param {string} contextId
   * @returns {boolean}
   */
  expireContext(contextId) {
    const ctx = this._contexts.get(contextId);
    if (!ctx) return false;

    ctx.status = 'expired';
    ctx.updatedAt = new Date().toISOString();

    return true;
  }

  /**
   * 列出指定 Agent 的所有上下文
   * @param {string} agentId
   * @returns {object[]}
   */
  listContexts(agentId) {
    const results = [];
    for (const [, ctx] of this._contexts) {
      if (ctx.agentId === agentId) {
        results.push(ctx);
      }
    }
    return results;
  }

  /**
   * 向上下文追加消息
   * @param {string} contextId
   * @param {string} role     角色 (user | assistant | system)
   * @param {string} content  消息内容
   * @returns {boolean}
   */
  addMessage(contextId, role, content) {
    const ctx = this._contexts.get(contextId);
    if (!ctx) return false;

    ctx.messages.push({
      role,
      content,
      timestamp: new Date().toISOString()
    });
    ctx.updatedAt = new Date().toISOString();

    if (this._cache) {
      this._cache.set(contextId, ctx);
    }

    return true;
  }

  /**
   * 设置 Grid-DB 持久化实例（P2 对接预留）
   * @param {object} gridDBInstance
   */
  setGridDBPersistence(gridDBInstance) {
    this._gridDB = gridDBInstance;
  }
}

module.exports = ContextManager;
