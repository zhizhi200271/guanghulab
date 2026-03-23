#!/usr/bin/env node
/**
 * skyeye/scripts/optimizer.js
 * 天眼动态调优引擎 — 基于配额使用情况自动调整 Guard 触发频率
 * Phase 3 of weekly scan: Optimize Guards
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '../..');
const SKYEYE_DIR = path.resolve(__dirname, '..');
const GUARDS_DIR = path.join(SKYEYE_DIR, 'guards');
const LEDGER_PATH = path.join(SKYEYE_DIR, 'quota-ledger.json');
const LOGS_DIR = path.join(SKYEYE_DIR, 'logs');

function getTimestamp() {
  return new Date().toISOString();
}

function getDateStr() {
  return new Date().toISOString().slice(0, 10).replace(/-/g, '');
}

function loadJSON(filePath) {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch (e) {
    return null;
  }
}

function saveJSON(filePath, data) {
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2) + '\n', 'utf8');
}

function calculateUsagePercent(guard) {
  const qp = guard.quota_policy;
  if (!qp || !qp.monthly_limit || qp.monthly_limit === 0) return 0;
  return Math.round(((qp.current_month_used || 0) / qp.monthly_limit) * 100 * 10) / 10;
}

const OPTIMIZATION_RULES = [
  {
    name: 'quota_warning_reduce_frequency',
    condition: (guard) => {
      const pct = calculateUsagePercent(guard);
      return pct > 70 && pct <= 90;
    },
    action: (guard) => {
      const prev = guard.trigger_policy.default_frequency;
      guard.trigger_policy.default_frequency = guard.trigger_policy.min_frequency;
      return {
        rule: 'quota_warning_reduce_frequency',
        guard_id: guard.guard_id,
        action: 'reduce_frequency',
        detail: `配额超 70%，频率从 ${prev} 降至 ${guard.trigger_policy.min_frequency}`,
        previous: prev,
        current: guard.trigger_policy.min_frequency
      };
    }
  },
  {
    name: 'quota_critical_emergency_only',
    condition: (guard) => {
      const pct = calculateUsagePercent(guard);
      return pct > 90;
    },
    action: (guard) => {
      const prevMode = guard.mode;
      guard.mode = 'emergency_only';
      return {
        rule: 'quota_critical_emergency_only',
        guard_id: guard.guard_id,
        action: 'switch_to_emergency',
        detail: `配额超 90%，切换至仅紧急模式`,
        previous_mode: prevMode,
        current_mode: 'emergency_only'
      };
    }
  },
  {
    name: 'health_check_failures_suspend',
    condition: (guard) => {
      return guard.health_check && guard.health_check.consecutive_failures >= 3;
    },
    action: (guard) => {
      const prevMode = guard.mode;
      guard.mode = 'suspended';
      return {
        rule: 'health_check_failures_suspend',
        guard_id: guard.guard_id,
        action: 'suspend',
        detail: `连续 ${guard.health_check.consecutive_failures} 次健康检查失败，已暂停`,
        previous_mode: prevMode,
        current_mode: 'suspended'
      };
    }
  },
  {
    name: 'backlog_increase_frequency',
    condition: (guard) => {
      const pct = calculateUsagePercent(guard);
      const pending = guard.buffer_policy && guard.buffer_policy.pending_count;
      return pending > 100 && pct < 50;
    },
    action: (guard) => {
      const prev = guard.trigger_policy.default_frequency;
      guard.trigger_policy.default_frequency = guard.trigger_policy.max_frequency;
      return {
        rule: 'backlog_increase_frequency',
        guard_id: guard.guard_id,
        action: 'increase_frequency',
        detail: `消息积压 ${guard.buffer_policy.pending_count} 条，配额充裕，已加频`,
        previous: prev,
        current: guard.trigger_policy.max_frequency
      };
    }
  }
];

function optimizeGuard(guard) {
  const adjustments = [];

  for (const rule of OPTIMIZATION_RULES) {
    if (rule.condition(guard)) {
      const adjustment = rule.action(guard);
      adjustments.push(adjustment);
      // Critical/emergency rules take priority - stop processing
      if (rule.name === 'quota_critical_emergency_only' || rule.name === 'health_check_failures_suspend') {
        break;
      }
    }
  }

  if (adjustments.length > 0) {
    guard.last_updated_by = 'skyeye-optimizer';
    guard.last_updated_at = getTimestamp();
  }

  return adjustments;
}

function run() {
  const args = process.argv.slice(2);
  const applyChanges = args.includes('--apply');

  console.log(`[SkyEye Optimizer] Mode: ${applyChanges ? 'apply' : 'dry-run'}`);
  console.log(`[SkyEye Optimizer] Timestamp: ${getTimestamp()}`);

  const optimizeResult = {
    optimize_id: `OPT-${getDateStr()}`,
    timestamp: getTimestamp(),
    mode: applyChanges ? 'apply' : 'dry-run',
    guards_checked: 0,
    adjustments: [],
    summary: {}
  };

  const guardFiles = fs.readdirSync(GUARDS_DIR)
    .filter(f => f.endsWith('.json') && f !== 'guard-template.json');

  for (const file of guardFiles) {
    const filePath = path.join(GUARDS_DIR, file);
    const guard = loadJSON(filePath);
    if (!guard) {
      console.warn(`[SkyEye Optimizer] WARNING: Cannot load ${file}`);
      continue;
    }

    optimizeResult.guards_checked++;
    const adjustments = optimizeGuard(guard);

    if (adjustments.length > 0) {
      optimizeResult.adjustments.push(...adjustments);
      if (applyChanges) {
        saveJSON(filePath, guard);
        console.log(`  [APPLIED] ${file}: ${adjustments.length} adjustment(s)`);
      } else {
        console.log(`  [DRY-RUN] ${file}: ${adjustments.length} adjustment(s) would be applied`);
      }
    } else {
      console.log(`  [OK] ${file}: no adjustments needed`);
    }
  }

  optimizeResult.summary = {
    guards_checked: optimizeResult.guards_checked,
    total_adjustments: optimizeResult.adjustments.length,
    applied: applyChanges
  };

  // Write log
  const logDir = path.join(LOGS_DIR, 'weekly');
  if (!fs.existsSync(logDir)) fs.mkdirSync(logDir, { recursive: true });
  const logPath = path.join(logDir, `optimize-${getDateStr()}.json`);
  saveJSON(logPath, optimizeResult);

  console.log(`[SkyEye Optimizer] Guards checked: ${optimizeResult.guards_checked}`);
  console.log(`[SkyEye Optimizer] Adjustments: ${optimizeResult.adjustments.length}`);
  console.log(`[SkyEye Optimizer] Log saved: ${logPath}`);

  console.log('---OPTIMIZE_RESULT_JSON---');
  console.log(JSON.stringify(optimizeResult, null, 2));

  return optimizeResult;
}

run();
