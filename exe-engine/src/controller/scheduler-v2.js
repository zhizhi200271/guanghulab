// exe-engine/src/controller/scheduler-v2.js
// EXE-Engine · 调度器 v2
// 优先队列 + 依赖图的增强调度
// PRJ-EXE-001 · Phase 1 · ZY-EXE-P1-005
// 版权：国作登字-2026-A-00037559

'use strict';

const { randomUUID } = require('crypto');

// 优先级数值映射：数值越小优先级越高（high=0 最先出队）
const PRIORITY_MAP = { high: 0, normal: 1, low: 2 };

/**
 * 调度器 v2
 *
 * 本体论锚定：调度器 = 笔的时间管理器。
 * 哪些字先写、哪些字后写、哪些字要等前面的字写完才能写，
 * 调度器用优先队列和依赖图来决定。
 */
class SchedulerV2 {
  /**
   * @param {object} deps
   * @param {AgentController} deps.agentController  Agent 调度器
   * @param {number} [deps.maxConcurrency=3]        最大并发数
   */
  constructor(deps = {}) {
    this._agentController = deps.agentController || null;
    this._maxConcurrency = deps.maxConcurrency || 3;

    // 待处理队列
    this._queue = [];
    // 已完成任务 { taskId: result }
    this._completed = new Map();
    // 失败任务 { taskId: error }
    this._failed = new Map();
    // 正在执行的任务
    this._running = new Set();
  }

  /**
   * 入队任务
   * @param {object} task
   * @param {string} [task.taskId]        任务 ID（自动生成）
   * @param {string} task.agentId         Agent ID
   * @param {string} [task.priority='normal']  优先级
   * @param {string[]} [task.dependsOn=[]]     依赖任务 ID 列表
   * @param {object} task.payload         任务载荷
   * @returns {string} taskId
   */
  enqueue(task) {
    const taskId = task.taskId || `task-${randomUUID().slice(0, 8)}`;

    const entry = {
      taskId,
      agentId: task.agentId,
      priority: task.priority || 'normal',
      dependsOn: task.dependsOn || [],
      payload: task.payload || {},
      status: 'pending',
      enqueuedAt: new Date().toISOString()
    };

    this._queue.push(entry);

    // 按优先级排序（同优先级保持 FIFO）
    this._queue.sort((a, b) => {
      const pa = PRIORITY_MAP[a.priority] ?? 1;
      const pb = PRIORITY_MAP[b.priority] ?? 1;
      return pa - pb;
    });

    return taskId;
  }

  /**
   * 出队：返回优先级最高且依赖已满足的任务
   * @returns {object|null}
   */
  dequeue() {
    for (let i = 0; i < this._queue.length; i++) {
      const task = this._queue[i];
      if (this._areDependenciesMet(task)) {
        this._queue.splice(i, 1);
        task.status = 'running';
        this._running.add(task.taskId);
        return task;
      }
    }
    return null;
  }

  /**
   * 标记任务完成
   * @param {string} taskId
   * @param {*} result  执行结果
   */
  complete(taskId, result) {
    this._completed.set(taskId, {
      result,
      completedAt: new Date().toISOString()
    });
    this._running.delete(taskId);
  }

  /**
   * 标记任务失败
   * @param {string} taskId
   * @param {string} error  错误信息
   */
  fail(taskId, error) {
    this._failed.set(taskId, {
      error,
      failedAt: new Date().toISOString()
    });
    this._running.delete(taskId);
  }

  /**
   * 获取当前队列状态
   * @returns {object[]}
   */
  getQueue() {
    return [...this._queue];
  }

  /**
   * 获取调度器指标
   * @returns {object}
   */
  getStatus() {
    return {
      pending: this._queue.length,
      running: this._running.size,
      completed: this._completed.size,
      failed: this._failed.size,
      maxConcurrency: this._maxConcurrency
    };
  }

  // ── 内部方法 ──

  /**
   * 检查任务依赖是否全部满足
   * @param {object} task
   * @returns {boolean}
   */
  _areDependenciesMet(task) {
    if (!task.dependsOn || task.dependsOn.length === 0) return true;
    return task.dependsOn.every(depId => this._completed.has(depId));
  }
}

module.exports = SchedulerV2;
