// src/brain/brain-bridge.js
// 冰朔核心大脑桥 · Bingshuo Brain Bridge v1.0
//
// 职责：
//   1. 维护冰朔核心大脑双层互通系统的统一同步字段
//   2. 执行版本一致性检查
//   3. 管理主控模式（HUMAN_CONTROL / AUTONOMOUS_MODE）
//   4. 管理人类开发者编号系统（EXP-XXX）
//   5. 生成同步摘要供 Notion ↔ GitHub 桥接使用

'use strict';

const fs   = require('fs');
const path = require('path');

// ══════════════════════════════════════════════════════════
// 常量
// ══════════════════════════════════════════════════════════

const BRIDGE_STATE_PATH   = path.join(__dirname, '../../.github/brain/bingshuo-brain-bridge.json');
const HUMAN_REGISTRY_PATH = path.join(__dirname, '../../.github/brain/human-registry.json');
const SYSTEM_HEALTH_PATH  = path.join(__dirname, '../../.github/brain/bingshuo-system-health.json');
const ISSUES_INDEX_PATH   = path.join(__dirname, '../../.github/brain/bingshuo-issues-index.json');

const MASTER_MODES = ['HUMAN_CONTROL', 'AUTONOMOUS_MODE'];

const SYNC_FIELDS = [
  'brain_identity',
  'brain_version',
  'master_mode',
  'system_summary',
  'top_priorities',
  'top_issues',
  'human_status_summary',
  'runtime_status',
  'last_updated',
];

// ══════════════════════════════════════════════════════════
// 桥接状态读写
// ══════════════════════════════════════════════════════════

/**
 * 加载桥接状态文件
 * @returns {object|null}
 */
function loadBridgeState() {
  try {
    if (!fs.existsSync(BRIDGE_STATE_PATH)) return null;
    return JSON.parse(fs.readFileSync(BRIDGE_STATE_PATH, 'utf8'));
  } catch {
    return null;
  }
}

/**
 * 保存桥接状态文件
 * @param {object} state
 */
function saveBridgeState(state) {
  state.sync_state.last_updated = new Date().toISOString();
  fs.writeFileSync(BRIDGE_STATE_PATH, JSON.stringify(state, null, 2));
}

/**
 * 获取当前同步字段快照
 * @returns {object}
 */
function getSyncSnapshot() {
  const state = loadBridgeState();
  if (!state || !state.sync_state) {
    return {
      brain_identity: 'BINGSHUO_CORE',
      brain_version: '1.0',
      master_mode: 'HUMAN_CONTROL',
      system_summary: '',
      top_priorities: [],
      top_issues: [],
      human_status_summary: '',
      runtime_status: {},
      last_updated: new Date().toISOString(),
    };
  }
  return state.sync_state;
}

/**
 * 更新同步字段（部分更新）
 * @param {object} updates — 要更新的字段
 * @returns {object} 更新后的 sync_state
 */
function updateSyncState(updates) {
  const state = loadBridgeState();
  if (!state) {
    throw new Error('桥接状态文件不存在');
  }

  for (const key of Object.keys(updates)) {
    if (SYNC_FIELDS.includes(key) && key !== 'last_updated') {
      state.sync_state[key] = updates[key];
    }
  }

  saveBridgeState(state);
  return state.sync_state;
}

// ══════════════════════════════════════════════════════════
// 主控模式管理
// ══════════════════════════════════════════════════════════

/**
 * 获取当前主控模式
 * @returns {object} { mode, master, description }
 */
function getMasterMode() {
  const sync = getSyncSnapshot();
  const mode = sync.master_mode || 'HUMAN_CONTROL';

  if (mode === 'HUMAN_CONTROL') {
    return {
      mode,
      master: '冰朔',
      description: '冰朔在线，主控模式激活',
    };
  }

  return {
    mode,
    master: '曜冥（代理主控）',
    description: '冰朔离线，曜冥代理主控',
    proxy_permissions: ['巡检', '维护', '更新摘要', '调度自动 Agent'],
    proxy_restrictions: ['不得改变核心系统架构'],
  };
}

/**
 * 切换主控模式
 * @param {string} newMode — HUMAN_CONTROL 或 AUTONOMOUS_MODE
 * @returns {object} 更新后的主控模式信息
 */
function setMasterMode(newMode) {
  if (!MASTER_MODES.includes(newMode)) {
    throw new Error(`无效的主控模式: ${newMode}，可选: ${MASTER_MODES.join(', ')}`);
  }

  const humanSummary = newMode === 'HUMAN_CONTROL'
    ? '冰朔在线，主控模式激活'
    : '冰朔离线，曜冥代理主控';

  updateSyncState({
    master_mode: newMode,
    human_status_summary: humanSummary,
  });

  return getMasterMode();
}

// ══════════════════════════════════════════════════════════
// 版本一致性检查
// ══════════════════════════════════════════════════════════

/**
 * 校验 GitHub 侧与提供的 Notion 侧状态是否一致
 * @param {object} notionState — 从 Notion 读取的同步字段
 * @returns {object} { consistent, mismatches, alert }
 */
function checkConsistency(notionState) {
  const githubState = getSyncSnapshot();
  const fieldsToCheck = ['brain_version', 'master_mode', 'top_priorities', 'top_issues'];
  const mismatches = [];

  for (const field of fieldsToCheck) {
    const gVal = JSON.stringify(githubState[field]);
    const nVal = JSON.stringify(notionState[field]);

    if (gVal !== nVal) {
      mismatches.push({
        field,
        github_value: githubState[field],
        notion_value: notionState[field],
      });
    }
  }

  const consistent = mismatches.length === 0;
  const result = {
    consistent,
    mismatches,
    checked_at: new Date().toISOString(),
    fields_checked: fieldsToCheck,
  };

  if (!consistent) {
    result.alert = '冰朔大脑版本分裂警告';
    result.alert_detail = `${mismatches.length} 个字段不一致: ${mismatches.map(m => m.field).join(', ')}`;

    // 写入 GitHub 问题索引
    writeConsistencyAlert(result);
  }

  return result;
}

/**
 * 将一致性告警写入 GitHub 问题索引
 * @param {object} alertResult
 */
function writeConsistencyAlert(alertResult) {
  try {
    let index = { issues: [] };
    if (fs.existsSync(ISSUES_INDEX_PATH)) {
      index = JSON.parse(fs.readFileSync(ISSUES_INDEX_PATH, 'utf8'));
    }

    // 避免重复写入同一类型告警（保留最近 20 条）
    index.issues = index.issues.filter(i => i.type !== 'BRAIN_SPLIT_ALERT').slice(0, 19);

    index.issues.unshift({
      id: `BS-SPLIT-${Date.now()}`,
      type: 'BRAIN_SPLIT_ALERT',
      title: alertResult.alert,
      detail: alertResult.alert_detail,
      mismatches: alertResult.mismatches,
      created_at: alertResult.checked_at,
      status: 'open',
    });

    fs.writeFileSync(ISSUES_INDEX_PATH, JSON.stringify(index, null, 2));
  } catch {
    // 写入失败不影响主流程
  }
}

// ══════════════════════════════════════════════════════════
// 人类开发者编号系统 (EXP-XXX)
// ══════════════════════════════════════════════════════════

/**
 * 加载人类开发者注册表
 * @returns {object}
 */
function loadHumanRegistry() {
  try {
    if (!fs.existsSync(HUMAN_REGISTRY_PATH)) return { developers: [] };
    return JSON.parse(fs.readFileSync(HUMAN_REGISTRY_PATH, 'utf8'));
  } catch {
    return { developers: [] };
  }
}

/**
 * 保存人类开发者注册表
 * @param {object} registry
 */
function saveHumanRegistry(registry) {
  registry.last_updated = new Date().toISOString();
  fs.writeFileSync(HUMAN_REGISTRY_PATH, JSON.stringify(registry, null, 2));
}

/**
 * 获取开发者列表
 * @returns {Array}
 */
function listDevelopers() {
  const reg = loadHumanRegistry();
  return reg.developers || [];
}

/**
 * 根据 EXP ID 查找开发者
 * @param {string} expId
 * @returns {object|null}
 */
function findDeveloper(expId) {
  const devs = listDevelopers();
  return devs.find(d => d.exp_id === expId) || null;
}

/**
 * 注册新的人类开发者
 * @param {object} info — { name, github_username, role }
 * @returns {object} 注册结果，包含分配的 EXP ID
 */
function registerDeveloper(info) {
  const registry = loadHumanRegistry();
  const devs = registry.developers || [];

  // 计算下一个 EXP 编号
  const maxId = devs.reduce((max, d) => {
    const num = parseInt(d.exp_id.replace('EXP-', ''), 10);
    return isNaN(num) ? max : Math.max(max, num);
  }, 0);

  const nextId = `EXP-${String(maxId + 1).padStart(3, '0')}`;

  const newDev = {
    exp_id: nextId,
    name: info.name,
    github_username: info.github_username || '',
    role: info.role || 'developer',
    status: 'active',
    created_at: new Date().toISOString(),
    notified: false,
  };

  registry.developers.push(newDev);
  saveHumanRegistry(registry);

  return newDev;
}

/**
 * 生成开发者通知内容
 * @param {string} expId
 * @returns {object} { exp_id, notification }
 */
function generateDeveloperNotification(expId) {
  const dev = findDeveloper(expId);
  if (!dev) {
    return { error: true, message: `开发者 ${expId} 不存在` };
  }

  return {
    exp_id: dev.exp_id,
    name: dev.name,
    notification: [
      `你已被纳入 Persona Studio 人类开发者编号系统。`,
      ``,
      `你的开发编号：${dev.exp_id}`,
      ``,
      `今后进入 Persona Studio 时，请使用该编号识别身份。`,
      `该编号为你的长期开发者身份标识。`,
      ``,
      `如需新增权限或编号，由冰朔主控授权。`,
    ].join('\n'),
  };
}

// ══════════════════════════════════════════════════════════
// 运行时状态收集（GitHub 执行层）
// ══════════════════════════════════════════════════════════

/**
 * 收集 GitHub 执行层运行时状态
 * @returns {object}
 */
function collectRuntimeStatus() {
  const status = {
    persona_studio: 'unknown',
    deployment: 'unknown',
    workflows: 'unknown',
    api_routes: 'unknown',
  };

  // 检查系统健康文件
  try {
    if (fs.existsSync(SYSTEM_HEALTH_PATH)) {
      const health = JSON.parse(fs.readFileSync(SYSTEM_HEALTH_PATH, 'utf8'));
      const h = health.health || {};

      status.deployment = h.deployment_health?.status || 'unknown';
      status.workflows = h.workflow_health?.status || 'unknown';
      status.persona_studio = h.persona_studio_health?.status || 'unknown';
      status.api_routes = h.routing_health?.status || 'unknown';
    }
  } catch {
    // 文件读取失败，保持 unknown
  }

  return status;
}

/**
 * 生成 GitHub → Notion 同步负载
 * @returns {object}
 */
function generateGitHubToNotionPayload() {
  const sync = getSyncSnapshot();
  const runtime = collectRuntimeStatus();

  return {
    brain_identity: sync.brain_identity,
    brain_version: sync.brain_version,
    master_mode: sync.master_mode,
    runtime_status: runtime,
    top_issues: sync.top_issues,
    system_summary: sync.system_summary,
    generated_at: new Date().toISOString(),
    direction: 'GitHub→Notion',
  };
}

/**
 * 接收 Notion → GitHub 同步负载并更新本地状态
 * @param {object} payload — Notion 发来的同步数据
 * @returns {object} 更新结果
 */
function receiveNotionToGitHubPayload(payload) {
  const updates = {};
  const allowedFields = [
    'master_mode',
    'top_priorities',
    'top_issues',
    'human_status_summary',
    'system_summary',
  ];

  for (const field of allowedFields) {
    if (payload[field] !== undefined) {
      updates[field] = payload[field];
    }
  }

  if (Object.keys(updates).length === 0) {
    return { updated: false, message: '无可更新字段' };
  }

  const newState = updateSyncState(updates);
  return {
    updated: true,
    fields_updated: Object.keys(updates),
    sync_state: newState,
  };
}

// ══════════════════════════════════════════════════════════
// 导出
// ══════════════════════════════════════════════════════════

module.exports = {
  // 常量
  MASTER_MODES,
  SYNC_FIELDS,

  // 桥接状态
  loadBridgeState,
  getSyncSnapshot,
  updateSyncState,

  // 主控模式
  getMasterMode,
  setMasterMode,

  // 一致性检查
  checkConsistency,

  // 人类开发者编号
  loadHumanRegistry,
  listDevelopers,
  findDeveloper,
  registerDeveloper,
  generateDeveloperNotification,

  // 运行时状态
  collectRuntimeStatus,
  generateGitHubToNotionPayload,
  receiveNotionToGitHubPayload,
};
