/**
 * ═══════════════════════════════════════════════════════════
 * MCP 工具 · 活模块操作
 * (registerModule / getModule / listModules / moduleHeartbeat /
 *  diagnoseModule / getModuleAlerts / getModuleLearnings /
 *  sendHLDP / getHLDPStats)
 * ═══════════════════════════════════════════════════════════
 *
 * 编号: ZY-TASK-007 · S5 Agent系统级
 * 签发: 铸渊 · ICE-GL-ZY001
 * 版权: 国作登字-2026-A-00037559
 */

'use strict';

const db = require('../db');

// ═══════════════════════════════════════════════════════════
// 活模块管理
// ═══════════════════════════════════════════════════════════

/**
 * 注册活模块（通过MCP接口，用于远程模块注册）
 */
async function registerModule(input) {
  const { module_id, name, module_type, owner, config, capabilities, deploy_host, deploy_port } = input;
  if (!module_id || !name) throw new Error('缺少 module_id 或 name');

  const result = await db.query(
    `INSERT INTO living_modules (module_id, name, module_type, owner, status, health_score, config, capabilities, deploy_host, deploy_port)
     VALUES ($1, $2, $3, $4, 'initializing', 100, $5, $6, $7, $8)
     ON CONFLICT (module_id) DO UPDATE SET
       name = EXCLUDED.name,
       config = EXCLUDED.config,
       capabilities = EXCLUDED.capabilities,
       deploy_host = EXCLUDED.deploy_host,
       deploy_port = EXCLUDED.deploy_port,
       updated_at = NOW()
     RETURNING *`,
    [
      module_id, name, module_type || 'agent', owner || 'zhuyuan',
      JSON.stringify(config || {}), JSON.stringify(capabilities || []),
      deploy_host || null, deploy_port || null
    ]
  );

  return { success: true, module: result.rows[0] };
}

/**
 * 获取活模块详情
 */
async function getModule(input) {
  const { module_id } = input;
  if (!module_id) throw new Error('缺少 module_id');

  const result = await db.query(
    `SELECT * FROM living_modules WHERE module_id = $1`,
    [module_id]
  );

  if (result.rows.length === 0) {
    return { found: false, module: null };
  }

  // 获取最近的诊断记录
  const diagnosis = await db.query(
    `SELECT * FROM module_diagnoses WHERE module_id = $1 ORDER BY created_at DESC LIMIT 1`,
    [module_id]
  );

  // 获取未解决的报警
  const alerts = await db.query(
    `SELECT * FROM module_alerts WHERE module_id = $1 AND resolved = FALSE ORDER BY created_at DESC LIMIT 5`,
    [module_id]
  );

  return {
    found: true,
    module: result.rows[0],
    lastDiagnosis: diagnosis.rows[0] || null,
    unresolvedAlerts: alerts.rows
  };
}

/**
 * 列出所有活模块
 */
async function listModules(input) {
  const { status, module_type, limit } = input || {};

  let sql = 'SELECT * FROM living_modules WHERE 1=1';
  const params = [];

  if (status) {
    params.push(status);
    sql += ` AND status = $${params.length}`;
  }
  if (module_type) {
    params.push(module_type);
    sql += ` AND module_type = $${params.length}`;
  }

  sql += ' ORDER BY registered_at';

  if (limit) {
    params.push(limit);
    sql += ` LIMIT $${params.length}`;
  }

  const result = await db.query(sql, params);

  // 统计概览
  const allModules = await db.query('SELECT status, COUNT(*) as count FROM living_modules GROUP BY status');
  const statusSummary = {};
  for (const row of allModules.rows) {
    statusSummary[row.status] = parseInt(row.count, 10);
  }

  return {
    total: result.rows.length,
    statusSummary,
    modules: result.rows
  };
}

/**
 * 远程心跳上报
 */
async function moduleHeartbeat(input) {
  const { module_id, health_score, cpu_usage, memory_usage, active_tasks, details } = input;
  if (!module_id) throw new Error('缺少 module_id');

  const score = typeof health_score === 'number' ? health_score : 100;

  // 更新模块状态
  let status = 'alive';
  if (score <= 30) status = 'degraded';
  if (score <= 0) status = 'dead';

  await db.query(
    `UPDATE living_modules SET last_heartbeat_at = NOW(), health_score = $1, status = $2, updated_at = NOW() WHERE module_id = $3`,
    [score, status, module_id]
  );

  // 记录心跳
  await db.query(
    `INSERT INTO module_heartbeats (module_id, status, health_score, cpu_usage, memory_usage, active_tasks, details)
     VALUES ($1, $2, $3, $4, $5, $6, $7)`,
    [module_id, status, score, cpu_usage || null, memory_usage || null, active_tasks || 0, JSON.stringify(details || {})]
  );

  return { success: true, status, health_score: score };
}

/**
 * 获取模块诊断记录
 */
async function diagnoseModule(input) {
  const { module_id, limit } = input;
  if (!module_id) throw new Error('缺少 module_id');

  const result = await db.query(
    `SELECT * FROM module_diagnoses WHERE module_id = $1 ORDER BY created_at DESC LIMIT $2`,
    [module_id, limit || 10]
  );

  return { module_id, diagnoses: result.rows };
}

/**
 * 获取模块报警记录
 */
async function getModuleAlerts(input) {
  const { module_id, resolved, severity, limit } = input || {};

  let sql = 'SELECT * FROM module_alerts WHERE 1=1';
  const params = [];

  if (module_id) {
    params.push(module_id);
    sql += ` AND module_id = $${params.length}`;
  }
  if (typeof resolved === 'boolean') {
    params.push(resolved);
    sql += ` AND resolved = $${params.length}`;
  }
  if (severity) {
    params.push(severity);
    sql += ` AND severity = $${params.length}`;
  }

  sql += ' ORDER BY created_at DESC';
  params.push(limit || 20);
  sql += ` LIMIT $${params.length}`;

  const result = await db.query(sql, params);
  return { alerts: result.rows };
}

/**
 * 获取模块学习记录
 */
async function getModuleLearnings(input) {
  const { module_id, learning_source, limit } = input || {};

  let sql = 'SELECT * FROM module_learning_logs WHERE 1=1';
  const params = [];

  if (module_id) {
    params.push(module_id);
    sql += ` AND module_id = $${params.length}`;
  }
  if (learning_source) {
    params.push(learning_source);
    sql += ` AND learning_source = $${params.length}`;
  }

  sql += ' ORDER BY created_at DESC';
  params.push(limit || 20);
  sql += ` LIMIT $${params.length}`;

  const result = await db.query(sql, params);
  return { learnings: result.rows };
}

/**
 * 发送HLDP消息（通过MCP接口）
 */
async function sendHLDP(input) {
  const { from_module, to_module, msg_type, payload } = input;
  if (!from_module || !msg_type) throw new Error('缺少 from_module 或 msg_type');

  const { v4: uuidv4 } = require('uuid');
  const messageId = uuidv4();

  await db.query(
    `INSERT INTO hldp_messages (message_id, from_module, to_module, msg_type, payload, status, expires_at)
     VALUES ($1, $2, $3, $4, $5, 'pending', NOW() + INTERVAL '5 minutes')`,
    [messageId, from_module, to_module || null, msg_type, JSON.stringify(payload || {})]
  );

  return { success: true, message_id: messageId };
}

/**
 * 获取HLDP消息统计
 */
async function getHLDPStats(input) {
  const stats = await db.query(
    `SELECT msg_type, status, COUNT(*) as count
     FROM hldp_messages
     WHERE created_at > NOW() - INTERVAL '24 hours'
     GROUP BY msg_type, status
     ORDER BY msg_type, status`
  );

  const pending = await db.query(
    `SELECT COUNT(*) as count FROM hldp_messages WHERE status = 'pending'`
  );

  return {
    last24h: stats.rows,
    pendingMessages: parseInt(pending.rows[0]?.count || '0', 10),
    timestamp: new Date().toISOString()
  };
}

module.exports = {
  registerModule,
  getModule,
  listModules,
  moduleHeartbeat,
  diagnoseModule,
  getModuleAlerts,
  getModuleLearnings,
  sendHLDP,
  getHLDPStats
};
