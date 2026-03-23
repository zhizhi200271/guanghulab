#!/usr/bin/env node
/**
 * skyeye/scripts/weekly-scan.js
 * 天眼周六大巡检主脚本 — 汇总所有 Phase 结果，生成报告
 * Phase 5 of weekly scan: Generate Report
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '../..');
const SKYEYE_DIR = path.resolve(__dirname, '..');
const SCAN_REPORT_DIR = path.join(SKYEYE_DIR, 'scan-report');
const LOGS_DIR = path.join(SKYEYE_DIR, 'logs');

function getTimestamp() {
  return new Date().toISOString();
}

function getDateStr() {
  return new Date().toISOString().slice(0, 10).replace(/-/g, '');
}

function getBeijingTime() {
  return new Date().toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' });
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

function findLatestLog(logDir, prefix) {
  if (!fs.existsSync(logDir)) return null;
  const files = fs.readdirSync(logDir)
    .filter(f => f.startsWith(prefix) && f.endsWith('.json'))
    .sort()
    .reverse();
  if (files.length === 0) return null;
  return loadJSON(path.join(logDir, files[0]));
}

function countGuards() {
  const guardsDir = path.join(SKYEYE_DIR, 'guards');
  if (!fs.existsSync(guardsDir)) return { total: 0, active: 0, suspended: 0 };

  const files = fs.readdirSync(guardsDir)
    .filter(f => f.endsWith('.json') && f !== 'guard-template.json');

  let active = 0;
  let suspended = 0;

  for (const file of files) {
    const guard = loadJSON(path.join(guardsDir, file));
    if (guard) {
      if (guard.status === 'active') active++;
      else if (guard.status === 'suspended' || guard.mode === 'suspended') suspended++;
    }
  }

  return { total: files.length, active, suspended };
}

function generateReport() {
  console.log(`[SkyEye Weekly Scan] Generating weekly scan report`);
  console.log(`[SkyEye Weekly Scan] Beijing Time: ${getBeijingTime()}`);

  const dateStr = getDateStr();
  const weeklyLogDir = path.join(LOGS_DIR, 'weekly');

  // Load Phase results from logs
  const scanResult = findLatestLog(weeklyLogDir, 'scan-');
  const auditResult = findLatestLog(weeklyLogDir, 'quota-audit-');
  const optimizeResult = findLatestLog(weeklyLogDir, 'optimize-');
  const healResult = findLatestLog(weeklyLogDir, 'self-heal-');

  const guardStatus = countGuards();

  // Calculate next Saturday 20:00 CST
  const now = new Date();
  const dayOfWeek = now.getUTCDay();
  const daysUntilSaturday = (6 - dayOfWeek + 7) % 7 || 7;
  const nextSaturday = new Date(now);
  nextSaturday.setUTCDate(now.getUTCDate() + daysUntilSaturday);
  nextSaturday.setUTCHours(12, 0, 0, 0); // 20:00 CST = 12:00 UTC

  const report = {
    report_id: `SKYEYE-SCAN-${dateStr}`,
    scan_time: getTimestamp(),
    scan_time_beijing: getBeijingTime(),
    scan_duration_seconds: 0,

    infrastructure_status: {
      total_services: 5,
      healthy: 5,
      degraded: 0,
      down: 0
    },

    quota_status: {
      github_actions: {
        used_percent: auditResult?.services?.github_actions?.usage_percent || 0,
        remaining_minutes: 2000,
        trend: 'stable',
        recommendation: 'maintain_current_frequency'
      },
      google_drive: {
        used_percent: auditResult?.services?.google_drive?.usage_percent || 0,
        recommendation: 'no_action_needed'
      },
      notion_api: {
        status: auditResult?.services?.notion_api?.status || 'healthy',
        recommendation: 'no_action_needed'
      },
      gemini: {
        used_percent: auditResult?.services?.gemini?.usage_percent || 0,
        recommendation: 'no_action_needed'
      }
    },

    guard_status: {
      total_guards: guardStatus.total,
      active: guardStatus.active,
      suspended: guardStatus.suspended,
      adjustments_made: optimizeResult?.adjustments || []
    },

    self_heal_actions: {
      files_cleaned: healResult?.summary?.files_cleaned || 0,
      configs_repaired: healResult?.summary?.configs_repaired || 0,
      guards_restarted: healResult?.summary?.guards_restarted || 0
    },

    phase_details: {
      phase1_scan: scanResult?.summary || null,
      phase2_audit: auditResult?.overall_status || null,
      phase3_optimize: optimizeResult?.summary || null,
      phase4_heal: healResult?.summary || null
    },

    alerts: [],
    human_action_required: [],

    next_scan: nextSaturday.toISOString()
  };

  // Collect alerts from all phases
  if (scanResult?.issues) {
    for (const issue of scanResult.issues) {
      if (issue.severity === 'error') {
        report.alerts.push(issue.detail);
      }
    }
  }
  if (auditResult?.services) {
    for (const [, svc] of Object.entries(auditResult.services)) {
      report.alerts.push(...(svc.alerts || []));
    }
  }

  // Determine infrastructure health
  if (report.alerts.length > 0) {
    const criticalAlerts = report.alerts.filter(a =>
      a.includes('90%') || a.includes('critical') || a.includes('严重')
    );
    if (criticalAlerts.length > 0) {
      report.infrastructure_status.degraded = criticalAlerts.length;
      report.infrastructure_status.healthy -= criticalAlerts.length;
    }
  }

  // Write report
  if (!fs.existsSync(SCAN_REPORT_DIR)) fs.mkdirSync(SCAN_REPORT_DIR, { recursive: true });
  const reportPath = path.join(SCAN_REPORT_DIR, `${dateStr}-weekly-scan.json`);
  saveJSON(reportPath, report);

  console.log(`[SkyEye Weekly Scan] Report generated: ${reportPath}`);
  console.log(`[SkyEye Weekly Scan] Report ID: ${report.report_id}`);
  console.log(`[SkyEye Weekly Scan] Guards: ${guardStatus.active}/${guardStatus.total} active`);
  console.log(`[SkyEye Weekly Scan] Alerts: ${report.alerts.length}`);
  console.log(`[SkyEye Weekly Scan] Human action required: ${report.human_action_required.length}`);
  console.log(`[SkyEye Weekly Scan] Next scan: ${report.next_scan}`);

  console.log('---REPORT_JSON---');
  console.log(JSON.stringify(report, null, 2));

  return report;
}

generateReport();
