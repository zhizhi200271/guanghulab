// exe-engine/src/monitor/dashboard.js
// EXE-Engine · 监控仪表盘
// 实时指标采集与快照
// PRJ-EXE-001 · Phase 1 · ZY-EXE-P1-006
// 版权：国作登字-2026-A-00037559

'use strict';

/**
 * 监控仪表盘
 *
 * 本体论锚定：仪表盘 = 笔的健康面板。
 * 每秒写了多少字、响应多快、用了多少墨水、出了几次错，
 * 一切尽在仪表盘。
 */
class MonitorDashboard {
  /**
   * @param {object} deps
   * @param {ResourceMeter} deps.resourceMeter  资源计量器
   */
  constructor(deps = {}) {
    this._resourceMeter = deps.resourceMeter || null;
    this._metrics = [];
  }

  /**
   * 记录一个指标数据点
   * @param {string} name   指标名称
   * @param {number} value  指标值
   * @param {object} [tags] 标签
   */
  recordMetric(name, value, tags = {}) {
    this._metrics.push({
      name,
      value,
      tags,
      timestamp: Date.now()
    });
  }

  /**
   * 获取指定时间范围内的指标
   * @param {string} name           指标名称
   * @param {number} [timeRangeMs=60000]  时间范围（毫秒）
   * @returns {object[]}
   */
  getMetrics(name, timeRangeMs = 60000) {
    const cutoff = Date.now() - timeRangeMs;
    return this._metrics.filter(m =>
      m.name === name && m.timestamp >= cutoff
    );
  }

  /**
   * 获取系统快照
   * @returns {object}
   */
  getSnapshot() {
    const now = Date.now();
    const oneMinuteAgo = now - 60000;

    // 最近一分钟的请求计数
    const recentRequests = this._metrics.filter(m =>
      m.name === 'request_count' && m.timestamp >= oneMinuteAgo
    );

    // 最近一分钟的延迟
    const recentLatency = this._metrics.filter(m =>
      m.name === 'latency_ms' && m.timestamp >= oneMinuteAgo
    );

    // 最近一分钟的 token 消耗
    const recentTokens = this._metrics.filter(m =>
      m.name === 'tokens_used' && m.timestamp >= oneMinuteAgo
    );

    // 最近一分钟的错误
    const recentErrors = this._metrics.filter(m =>
      m.name === 'error_count' && m.timestamp >= oneMinuteAgo
    );

    // 计算 QPS
    const qps = recentRequests.length > 0
      ? recentRequests.reduce((sum, m) => sum + m.value, 0) / 60
      : 0;

    // 计算平均延迟
    const avgLatency = recentLatency.length > 0
      ? recentLatency.reduce((sum, m) => sum + m.value, 0) / recentLatency.length
      : 0;

    // 总 token 数
    const totalTokens = recentTokens.reduce((sum, m) => sum + m.value, 0);

    // 错误率
    const totalRequests = recentRequests.reduce((sum, m) => sum + m.value, 0);
    const totalErrors = recentErrors.reduce((sum, m) => sum + m.value, 0);
    const errorRate = totalRequests > 0 ? totalErrors / totalRequests : 0;

    return {
      qps: Math.round(qps * 1000) / 1000,
      avgLatency: Math.round(avgLatency * 100) / 100,
      totalTokens,
      errorRate: Math.round(errorRate * 10000) / 10000,
      metricsCount: this._metrics.length,
      timestamp: new Date().toISOString()
    };
  }

  /**
   * 清除所有已采集的指标
   */
  resetMetrics() {
    this._metrics = [];
  }
}

module.exports = MonitorDashboard;
