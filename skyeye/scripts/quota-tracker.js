#!/usr/bin/env node
/**
 * skyeye/scripts/quota-tracker.js
 * 天眼配额追踪器 — 配额审计与预算精算
 * Phase 2 of weekly scan: Quota Audit
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '../..');
const SKYEYE_DIR = path.resolve(__dirname, '..');
const LEDGER_PATH = path.join(SKYEYE_DIR, 'quota-ledger.json');
const MANIFEST_PATH = path.join(SKYEYE_DIR, 'infra-manifest.json');
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

function calculateUsagePercent(used, limit) {
  if (!limit || limit === 0) return 0;
  return Math.round((used / limit) * 100 * 10) / 10;
}

function getDaysRemainingInMonth() {
  const now = new Date();
  const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  return lastDay.getDate() - now.getDate();
}

function auditService(name, serviceData, manifest) {
  const result = {
    service: name,
    status: 'healthy',
    usage_percent: 0,
    alerts: [],
    recommendations: []
  };

  switch (name) {
    case 'github_actions': {
      const pct = calculateUsagePercent(serviceData.used, serviceData.limit);
      result.usage_percent = pct;
      const daysLeft = getDaysRemainingInMonth();
      const dailyBudget = daysLeft > 0 ? Math.round(serviceData.remaining / daysLeft) : 0;

      if (pct > 90) {
        result.status = 'critical';
        result.alerts.push('GitHub Actions 配额使用超过 90%，仅允许紧急操作');
      } else if (pct > 70) {
        result.status = 'warning';
        result.alerts.push('GitHub Actions 配额使用超过 70%，建议降低触发频率');
      }

      result.recommendations.push(`日均可用预算: ${dailyBudget} 分钟 (剩余 ${daysLeft} 天)`);
      break;
    }
    case 'google_drive': {
      const pct = calculateUsagePercent(serviceData.storage_used_gb, serviceData.storage_limit_gb);
      result.usage_percent = pct;

      if (pct > 80) {
        result.status = 'warning';
        result.alerts.push('Google Drive 存储使用超过 80%，建议清理旧文件');
      }

      if (serviceData.apps_script_triggers_today >= serviceData.apps_script_triggers_limit * 0.9) {
        result.alerts.push('Apps Script 每日触发数接近上限');
      }
      break;
    }
    case 'notion_api': {
      if (serviceData.errors_today > 10) {
        result.status = 'warning';
        result.alerts.push(`Notion API 今日错误数较高: ${serviceData.errors_today}`);
      }
      break;
    }
    case 'gemini': {
      const pct = calculateUsagePercent(serviceData.daily_used, serviceData.daily_limit);
      result.usage_percent = pct;

      if (pct > 90) {
        result.status = 'critical';
        result.alerts.push('Gemini 每日配额即将耗尽');
      } else if (pct > 70) {
        result.status = 'warning';
        result.alerts.push('Gemini 每日配额使用超过 70%');
      }
      break;
    }
  }

  return result;
}

function run() {
  const args = process.argv.slice(2);
  const isAudit = args.includes('--audit');

  console.log(`[SkyEye Quota Tracker] Mode: ${isAudit ? 'full audit' : 'quick check'}`);
  console.log(`[SkyEye Quota Tracker] Timestamp: ${getTimestamp()}`);

  const ledger = loadJSON(LEDGER_PATH);
  if (!ledger) {
    console.error('[SkyEye Quota Tracker] ERROR: Cannot load quota-ledger.json');
    process.exit(1);
  }

  const manifest = loadJSON(MANIFEST_PATH);

  const auditResult = {
    audit_id: `AUDIT-${getDateStr()}`,
    timestamp: getTimestamp(),
    mode: isAudit ? 'full' : 'quick',
    services: {},
    overall_status: 'healthy',
    total_alerts: 0,
    recommendations: []
  };

  // Audit each service
  for (const [name, data] of Object.entries(ledger.services)) {
    const serviceAudit = auditService(name, data, manifest);
    auditResult.services[name] = serviceAudit;

    if (serviceAudit.status === 'critical') {
      auditResult.overall_status = 'critical';
    } else if (serviceAudit.status === 'warning' && auditResult.overall_status !== 'critical') {
      auditResult.overall_status = 'warning';
    }

    auditResult.total_alerts += serviceAudit.alerts.length;
    auditResult.recommendations.push(...serviceAudit.recommendations);
  }

  // Update ledger health summary
  ledger.health_summary.overall = auditResult.overall_status;
  ledger.health_summary.alerts = [];
  for (const [, svc] of Object.entries(auditResult.services)) {
    ledger.health_summary.alerts.push(...svc.alerts);
  }
  ledger.health_summary.last_updated = getTimestamp();
  saveJSON(LEDGER_PATH, ledger);

  // Write audit log
  const logDir = path.join(LOGS_DIR, isAudit ? 'weekly' : 'daily');
  if (!fs.existsSync(logDir)) fs.mkdirSync(logDir, { recursive: true });
  const logPath = path.join(logDir, `quota-audit-${getDateStr()}.json`);
  saveJSON(logPath, auditResult);

  console.log(`[SkyEye Quota Tracker] Overall status: ${auditResult.overall_status}`);
  console.log(`[SkyEye Quota Tracker] Total alerts: ${auditResult.total_alerts}`);
  for (const [name, svc] of Object.entries(auditResult.services)) {
    console.log(`  ${name}: ${svc.status} (${svc.usage_percent}% used)`);
  }
  console.log(`[SkyEye Quota Tracker] Log saved: ${logPath}`);

  console.log('---AUDIT_RESULT_JSON---');
  console.log(JSON.stringify(auditResult, null, 2));

  return auditResult;
}

run();
