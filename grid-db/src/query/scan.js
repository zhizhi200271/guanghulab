// grid-db/src/query/scan.js
// Grid-DB · 范围扫描器
// 矩形区域查询
// PRJ-GDB-001 · Phase 1 · ZY-GDB-P1-003
// 版权：国作登字-2026-A-00037559

'use strict';

const GridCell = require('../core/grid-cell');

/**
 * RangeScanner — 范围扫描器
 *
 * 本体论锚定：扫描 = 在纸上画一个矩形区域，找出所有落在区域内的格子。
 * 矩形由 xRange 和 yRange 定义，layer 可选过滤。
 *
 * 支持 BTree 索引和 Map 索引两种后端。
 */
class RangeScanner {
  /**
   * @param {object} deps
   * @param {Map|object} deps.index       索引（Map 或 BTree，需支持遍历）
   * @param {object}     deps.pageManager 页管理器
   */
  constructor({ index, pageManager }) {
    if (!index) {
      throw new Error('RangeScanner: index 不能为空');
    }
    if (!pageManager) {
      throw new Error('RangeScanner: pageManager 不能为空');
    }
    this._index = index;
    this._pageManager = pageManager;
  }

  /**
   * 矩形区域扫描
   *
   * @param {string} namespace 命名空间
   * @param {object} [options]
   * @param {number[]} [options.xRange] X 范围 [min, max]
   * @param {number[]} [options.yRange] Y 范围 [min, max]
   * @param {string}   [options.layer]  层级过滤
   * @param {number}   [options.limit]  最大返回数
   * @param {number}   [options.offset] 跳过前 N 条
   * @returns {Array<{cell: GridCell, data: *}>} 按 (gridX, gridY) 排序
   */
  scan(namespace, options = {}) {
    const { xRange, yRange, layer, limit, offset = 0 } = options;
    const results = [];

    // 遍历索引中所有条目
    const entries = this._getEntries();

    for (const [key, pageId] of entries) {
      try {
        const cell = GridCell.fromKey(key);

        // 命名空间过滤
        if (cell.namespace !== namespace) continue;

        // 层级过滤
        if (layer && cell.layer !== layer) continue;

        // X 范围过滤
        if (xRange) {
          if (cell.gridX < xRange[0] || cell.gridX > xRange[1]) continue;
        }

        // Y 范围过滤
        if (yRange) {
          if (cell.gridY < yRange[0] || cell.gridY > yRange[1]) continue;
        }

        // 读取数据
        const dataBuf = this._pageManager.readPage(pageId);
        if (dataBuf) {
          let data;
          try { data = JSON.parse(dataBuf.toString('utf-8')); } catch { data = dataBuf; }
          results.push({ cell, data });
        }
      } catch {
        // 跳过无效键
      }
    }

    // 按 (gridX, gridY) 排序
    results.sort((a, b) => {
      if (a.cell.gridX !== b.cell.gridX) return a.cell.gridX - b.cell.gridX;
      return a.cell.gridY - b.cell.gridY;
    });

    // offset + limit
    const start = offset || 0;
    const end = limit ? start + limit : results.length;
    return results.slice(start, end);
  }

  /**
   * 获取索引中的所有条目（兼容 Map 和 BTree）
   * @returns {Array<[string, *]>}
   */
  _getEntries() {
    if (this._index instanceof Map) {
      return Array.from(this._index.entries());
    }
    // BTree：通过 toJSON 获取所有条目
    if (typeof this._index.toJSON === 'function') {
      const json = this._index.toJSON();
      return json.entries.map(e => [e.key, e.value]);
    }
    // 其他可迭代对象
    if (typeof this._index.entries === 'function') {
      return Array.from(this._index.entries());
    }
    return [];
  }
}

module.exports = RangeScanner;
