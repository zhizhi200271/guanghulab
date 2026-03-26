// grid-db/src/events/event-log.js
// Grid-DB · 事件溯源日志
// 不可变事件流 + 审计日志
// PRJ-GDB-001 · Phase 0 + Phase 1（回放、序列号回放、操作过滤、天眼钩子）
// 版权：国作登字-2026-A-00037559

'use strict';

const { randomUUID } = require('crypto');

/**
 * EventLog — 事件溯源日志
 *
 * 每次写操作生成不可变 Event，可被天眼订阅实现实时审计。
 *
 * 本体论锚定：事件日志 = 笔的笔迹记录。
 * 每写一笔，笔迹就留在了历史中，不可篡改。
 * 天眼通过观察笔迹，发现异常行为。
 *
 * Phase 0：内存事件流（保留最近 1000 条）
 * Phase 1：持久化事件流 + 回放 + 订阅
 */
class EventLog {
  /**
   * @param {object} [options]
   * @param {number} [options.maxEvents]  最大保留事件数
   */
  constructor(options = {}) {
    this._maxEvents = options.maxEvents || 1000;
    this._events = [];
    this._subscribers = [];
    this._seqNo = 0;
  }

  /**
   * 记录事件
   * @param {string} namespace   命名空间
   * @param {string} operation   操作类型 (put | delete | scan)
   * @param {string} gridCellKey 格点键
   * @param {object} [payload]   额外数据
   * @returns {object} 事件对象
   */
  append(namespace, operation, gridCellKey, payload = null) {
    this._seqNo++;
    const event = {
      eventId: `evt-${randomUUID().slice(0, 12)}`,
      seqNo: this._seqNo,
      timestamp: new Date().toISOString(),
      namespace,
      operation,
      gridCellKey,
      payload
    };

    this._events.push(event);

    // 容量控制
    if (this._events.length > this._maxEvents) {
      this._events = this._events.slice(-this._maxEvents);
    }

    // 通知订阅者
    for (const sub of this._subscribers) {
      try {
        sub.handler(event);
      } catch {
        // 订阅者错误不阻断主流程
      }
    }

    return event;
  }

  /**
   * 获取最近 N 条事件
   * @param {number} [n]
   * @returns {object[]}
   */
  getRecent(n = 20) {
    return this._events.slice(-n);
  }

  /**
   * 按命名空间过滤事件
   * @param {string} namespace
   * @param {number} [limit]
   * @returns {object[]}
   */
  getByNamespace(namespace, limit = 50) {
    return this._events
      .filter(e => e.namespace === namespace)
      .slice(-limit);
  }

  /**
   * 订阅事件流（Phase 0 简版，P1 支持持久订阅）
   * @param {string} subscriberId
   * @param {Function} handler
   * @returns {Function} 取消订阅函数
   */
  subscribe(subscriberId, handler) {
    const sub = { id: subscriberId, handler };
    this._subscribers.push(sub);
    return () => {
      this._subscribers = this._subscribers.filter(s => s.id !== subscriberId);
    };
  }

  /**
   * 从指定时间戳回放事件
   * @param {string} fromTimestamp  ISO 8601 时间戳
   * @returns {object[]}
   */
  replay(fromTimestamp) {
    return this._events.filter(e => e.timestamp >= fromTimestamp);
  }

  /**
   * 从指定序列号回放事件
   * @param {number} seqNo  起始序列号（包含）
   * @returns {object[]}
   */
  replayFromSeqNo(seqNo) {
    return this._events.filter(e => e.seqNo >= seqNo);
  }

  /**
   * 按操作类型过滤事件
   * @param {string} operation  操作类型 (put | delete | scan)
   * @param {number} [limit]    最大返回数
   * @returns {object[]}
   */
  getByOperation(operation, limit) {
    const filtered = this._events.filter(e => e.operation === operation);
    if (limit && limit > 0) {
      return filtered.slice(-limit);
    }
    return filtered;
  }

  /**
   * 设置天眼钩子 — 天眼集成占位接口
   *
   * 天眼通过此钩子实时接收事件流，实现全域审计。
   * Phase 1 提供接口，Phase 2 实现完整天眼协议。
   *
   * @param {Function} handler  天眼事件处理函数
   */
  setTianyanHook(handler) {
    this._tianyanHook = handler;
    // 注册为特殊订阅者
    if (typeof handler === 'function') {
      this.subscribe('__tianyan__', handler);
    }
  }

  /**
   * 获取事件日志状态
   * @returns {object}
   */
  getStatus() {
    return {
      totalEvents: this._events.length,
      maxEvents: this._maxEvents,
      seqNo: this._seqNo,
      subscriberCount: this._subscribers.length
    };
  }
}

module.exports = EventLog;
