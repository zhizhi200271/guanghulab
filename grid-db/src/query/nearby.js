// grid-db/src/query/nearby.js
// Grid-DB · 近邻查询
// 基于欧几里得距离的邻近查询
// PRJ-GDB-001 · Phase 1 · ZY-GDB-P1-004
// 版权：国作登字-2026-A-00037559

'use strict';

const GridCell = require('../core/grid-cell');

/**
 * NearbyQuery — 近邻查询
 *
 * 本体论锚定：近邻 = 以某个格子为中心，画一个圆，找出圆内所有格子。
 * 圆由中心坐标和半径定义。
 * 结果按距离排序，最近的在前面。
 */
class NearbyQuery {
  /**
   * @param {object} deps
   * @param {Map|object} deps.index       索引
   * @param {object}     deps.pageManager 页管理器
   */
  constructor({ index, pageManager }) {
    if (!index) {
      throw new Error('NearbyQuery: index 不能为空');
    }
    if (!pageManager) {
      throw new Error('NearbyQuery: pageManager 不能为空');
    }
    this._index = index;
    this._pageManager = pageManager;
  }

  /**
   * 近邻查询
   *
   * @param {string} namespace  命名空间
   * @param {number} centerX    中心 X 坐标
   * @param {number} centerY    中心 Y 坐标
   * @param {number} radius     搜索半径（欧几里得距离）
   * @param {object} [options]
   * @param {string} [options.layer]   层级过滤
   * @param {number} [options.limit]   最大返回数
   * @param {string} [options.sortBy]  排序方式（默认 'distance'）
   * @returns {Array<{cell: GridCell, data: *, distance: number}>}
   */
  nearby(namespace, centerX, centerY, radius, options = {}) {
    const { layer, limit, sortBy = 'distance' } = options;
    const results = [];

    const entries = this._getEntries();

    for (const [key, pageId] of entries) {
      try {
        const cell = GridCell.fromKey(key);

        // 命名空间过滤
        if (cell.namespace !== namespace) continue;

        // 层级过滤
        if (layer && cell.layer !== layer) continue;

        // 欧几里得距离计算
        const dx = cell.gridX - centerX;
        const dy = cell.gridY - centerY;
        const distance = Math.sqrt(dx * dx + dy * dy);

        // 半径过滤
        if (distance > radius) continue;

        // 读取数据
        const dataBuf = this._pageManager.readPage(pageId);
        if (dataBuf) {
          let data;
          try { data = JSON.parse(dataBuf.toString('utf-8')); } catch { data = dataBuf; }
          results.push({ cell, data, distance });
        }
      } catch {
        // 跳过无效键
      }
    }

    // 按距离升序排序
    if (sortBy === 'distance') {
      results.sort((a, b) => a.distance - b.distance);
    }

    // limit
    if (limit && limit > 0) {
      return results.slice(0, limit);
    }

    return results;
  }

  /**
   * 获取索引中的所有条目（兼容 Map 和 BTree）
   * @returns {Array<[string, *]>}
   */
  _getEntries() {
    if (this._index instanceof Map) {
      return Array.from(this._index.entries());
    }
    if (typeof this._index.toJSON === 'function') {
      const json = this._index.toJSON();
      return json.entries.map(e => [e.key, e.value]);
    }
    if (typeof this._index.entries === 'function') {
      return Array.from(this._index.entries());
    }
    return [];
  }
}

module.exports = NearbyQuery;
