// grid-db/src/index/secondary-index.js
// Grid-DB · 二级索引
// 按任意字段建立索引，支持一对多映射
// PRJ-GDB-001 · Phase 1 · ZY-GDB-P1-006
// 版权：国作登字-2026-A-00037559

'use strict';

/**
 * SecondaryIndex — 二级索引
 *
 * 本体论锚定：二级索引 = 纸的侧面标签。
 * 同一个标签可以贴在多个格子上（一对多）。
 * 通过标签可以快速找到所有相关的格子。
 *
 * fieldValue → Set<primaryKey> 的映射结构。
 * 支持范围查询（利用排序后的键列表）。
 */
class SecondaryIndex {
  /**
   * @param {string} fieldName 索引的字段名
   */
  constructor(fieldName) {
    if (!fieldName || typeof fieldName !== 'string') {
      throw new Error('SecondaryIndex: fieldName 必须是非空字符串');
    }
    this._fieldName = fieldName;
    /** @type {Map<string, Set<string>>} */
    this._map = new Map();
    this._size = 0;
  }

  /**
   * 索引中的条目总数（所有 primaryKey 的总计）
   * @returns {number}
   */
  get size() {
    return this._size;
  }

  /**
   * 添加索引条目
   * @param {string} fieldValue  字段值
   * @param {string} primaryKey  主键
   */
  add(fieldValue, primaryKey) {
    const strValue = String(fieldValue);
    let keys = this._map.get(strValue);
    if (!keys) {
      keys = new Set();
      this._map.set(strValue, keys);
    }
    if (!keys.has(primaryKey)) {
      keys.add(primaryKey);
      this._size++;
    }
  }

  /**
   * 移除索引条目
   * @param {string} fieldValue  字段值
   * @param {string} primaryKey  主键
   * @returns {boolean} 是否移除成功
   */
  remove(fieldValue, primaryKey) {
    const strValue = String(fieldValue);
    const keys = this._map.get(strValue);
    if (!keys) return false;

    if (keys.delete(primaryKey)) {
      this._size--;
      if (keys.size === 0) {
        this._map.delete(strValue);
      }
      return true;
    }
    return false;
  }

  /**
   * 查找指定字段值的所有主键
   * @param {string} fieldValue
   * @returns {string[]} 主键数组
   */
  find(fieldValue) {
    const strValue = String(fieldValue);
    const keys = this._map.get(strValue);
    if (!keys) return [];
    return Array.from(keys);
  }

  /**
   * 范围查询（闭区间 [startValue, endValue]）
   * @param {string} startValue 起始值
   * @param {string} endValue   结束值
   * @returns {string[]} 主键数组（去重）
   */
  range(startValue, endValue) {
    const start = String(startValue);
    const end = String(endValue);
    const resultSet = new Set();

    // 获取所有键并排序
    const sortedKeys = Array.from(this._map.keys()).sort();

    for (const key of sortedKeys) {
      if (key >= start && key <= end) {
        const primaryKeys = this._map.get(key);
        for (const pk of primaryKeys) {
          resultSet.add(pk);
        }
      }
      if (key > end) break;
    }

    return Array.from(resultSet);
  }

  /**
   * 清空索引
   */
  clear() {
    this._map.clear();
    this._size = 0;
  }
}

module.exports = SecondaryIndex;
