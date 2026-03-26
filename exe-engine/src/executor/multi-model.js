// exe-engine/src/executor/multi-model.js
// EXE-Engine · 多模型执行器
// 支持 fastest / consensus / fallback 多策略执行
// PRJ-EXE-001 · Phase 1 · ZY-EXE-P1-003
// 版权：国作登字-2026-A-00037559

'use strict';

const { randomUUID } = require('crypto');

// consensus 策略：输出长度差异在此比例内视为一致
const CONSENSUS_LENGTH_THRESHOLD = 0.2;

/**
 * 多模型执行器
 *
 * 本体论锚定：多模型 = 同时用多瓶墨水写字。
 * fastest 赛跑取最快，consensus 共识取多数，fallback 逐瓶尝试。
 */
class MultiModelExecutor {
  /**
   * @param {object} deps
   * @param {Map<string, BaseAdapter>} deps.adapters     适配器 Map
   * @param {LoadBalancer}             deps.loadBalancer  负载均衡器
   */
  constructor(deps = {}) {
    this._adapters = deps.adapters || new Map();
    this._loadBalancer = deps.loadBalancer || null;
  }

  /**
   * 执行多模型策略
   * @param {object} request          EXE 标准请求
   * @param {string} [strategy='fastest']  执行策略
   * @returns {Promise<object>} EXE 标准响应 + _strategy + _modelsUsed
   */
  async execute(request, strategy = 'fastest') {
    const requestId = `exe-mm-${randomUUID().slice(0, 8)}`;
    const startTime = Date.now();

    const availableAdapters = this._getHealthyAdapters();
    if (availableAdapters.length === 0) {
      return this._buildErrorResponse(requestId, startTime, strategy,
        'NO_AVAILABLE_MODEL', '没有可用的模型适配器');
    }

    try {
      switch (strategy) {
        case 'fastest':
          return await this._executeFastest(request, availableAdapters, requestId, startTime);
        case 'consensus':
          return await this._executeConsensus(request, availableAdapters, requestId, startTime);
        case 'fallback':
          return await this._executeFallback(request, availableAdapters, requestId, startTime);
        default:
          return this._buildErrorResponse(requestId, startTime, strategy,
            'INVALID_STRATEGY', `未知策略: ${strategy}`);
      }
    } catch (err) {
      return this._buildErrorResponse(requestId, startTime, strategy,
        'EXECUTION_FAILED', err.message);
    }
  }

  /**
   * 获取可用模型名列表
   * @returns {string[]}
   */
  getAvailableModels() {
    const models = [];
    for (const [name, adapter] of this._adapters) {
      if (!adapter.isInCooldown()) {
        models.push(name);
      }
    }
    return models;
  }

  // ── 策略实现 ──

  /**
   * fastest 策略：赛跑，返回最快结果
   */
  async _executeFastest(request, adapters, requestId, startTime) {
    const promises = adapters.map(adapter =>
      adapter.execute(request).then(result => ({ adapter, result }))
    );

    const { adapter, result } = await Promise.any(promises);

    return {
      requestId,
      model: result.model || adapter.name,
      output: result.output,
      usage: result.usage,
      latency: Date.now() - startTime,
      status: 'success',
      _strategy: 'fastest',
      _modelsUsed: [adapter.name]
    };
  }

  /**
   * consensus 策略：全部执行，多数同意则返回
   * 简化判断：输出长度差异在 ±20% 内视为一致
   */
  async _executeConsensus(request, adapters, requestId, startTime) {
    const results = await Promise.allSettled(
      adapters.map(adapter =>
        adapter.execute(request).then(result => ({ adapter, result }))
      )
    );

    const successful = results
      .filter(r => r.status === 'fulfilled')
      .map(r => r.value);

    if (successful.length === 0) {
      return this._buildErrorResponse(requestId, startTime, 'consensus',
        'ALL_MODELS_FAILED', '所有模型执行失败');
    }

    // 用第一个成功结果作为基准
    const baseline = successful[0];
    const baseLen = (baseline.result.output || '').length || 1;
    let agreements = 0;

    for (const s of successful) {
      const len = (s.result.output || '').length;
      if (Math.abs(len - baseLen) / baseLen <= CONSENSUS_LENGTH_THRESHOLD) {
        agreements++;
      }
    }

    const consensus = agreements > successful.length / 2;
    const chosen = baseline;

    return {
      requestId,
      model: chosen.result.model || chosen.adapter.name,
      output: chosen.result.output,
      usage: chosen.result.usage,
      latency: Date.now() - startTime,
      status: 'success',
      _strategy: 'consensus',
      _consensus: consensus,
      _modelsUsed: successful.map(s => s.adapter.name)
    };
  }

  /**
   * fallback 策略：按优先级逐个尝试，返回第一个成功
   */
  async _executeFallback(request, adapters, requestId, startTime) {
    const errors = [];

    for (const adapter of adapters) {
      try {
        const result = await adapter.execute(request);
        return {
          requestId,
          model: result.model || adapter.name,
          output: result.output,
          usage: result.usage,
          latency: Date.now() - startTime,
          status: 'success',
          _strategy: 'fallback',
          _modelsUsed: [adapter.name],
          _attemptsCount: errors.length + 1
        };
      } catch (err) {
        errors.push({ model: adapter.name, error: err.message });
      }
    }

    return this._buildErrorResponse(requestId, startTime, 'fallback',
      'ALL_MODELS_FAILED', `所有模型执行失败: ${errors.map(e => e.model).join(', ')}`);
  }

  // ── 辅助方法 ──

  _getHealthyAdapters() {
    const healthy = [];
    for (const [, adapter] of this._adapters) {
      if (!adapter.isInCooldown()) {
        healthy.push(adapter);
      }
    }
    return healthy;
  }

  _buildErrorResponse(requestId, startTime, strategy, code, message) {
    return {
      requestId,
      model: null,
      output: null,
      usage: { inputTokens: 0, outputTokens: 0, cost: 0, unit: 'CNY' },
      latency: Date.now() - startTime,
      status: 'error',
      error: { code, message },
      _strategy: strategy,
      _modelsUsed: []
    };
  }
}

module.exports = MultiModelExecutor;
