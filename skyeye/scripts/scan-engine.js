#!/usr/bin/env node
/**
 * skyeye/scripts/scan-engine.js
 * 天眼扫描引擎 — 全量 + 增量基础设施扫描
 * Phase 1 of weekly scan: Infrastructure Scan
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '../..');
const SKYEYE_DIR = path.resolve(__dirname, '..');
const MANIFEST_PATH = path.join(SKYEYE_DIR, 'infra-manifest.json');
const GUARDS_DIR = path.join(SKYEYE_DIR, 'guards');
const LOGS_DIR = path.join(SKYEYE_DIR, 'logs');

function getTimestamp() {
  return new Date().toISOString();
}

function getDateStr() {
  const d = new Date();
  return d.toISOString().slice(0, 10).replace(/-/g, '');
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

function scanGuardConfigs() {
  const results = { total: 0, valid: 0, invalid: [], missing_fields: [] };
  const requiredFields = ['guard_id', 'status', 'mode', 'quota_policy', 'health_check'];

  const files = fs.readdirSync(GUARDS_DIR).filter(f => f.endsWith('.json') && f !== 'guard-template.json');
  results.total = files.length;

  for (const file of files) {
    const filePath = path.join(GUARDS_DIR, file);
    const guard = loadJSON(filePath);
    if (!guard) {
      results.invalid.push({ file, reason: 'Invalid JSON' });
      continue;
    }
    const missing = requiredFields.filter(f => !(f in guard));
    if (missing.length > 0) {
      results.missing_fields.push({ file, missing });
    } else {
      results.valid++;
    }
  }
  return results;
}

function scanWorkflows() {
  const workflowDir = path.join(ROOT, '.github/workflows');
  const results = { total: 0, files: [], errors: [] };

  if (!fs.existsSync(workflowDir)) {
    results.errors.push('Workflow directory not found');
    return results;
  }

  const files = fs.readdirSync(workflowDir).filter(f => f.endsWith('.yml') || f.endsWith('.yaml'));
  results.total = files.length;
  results.files = files;
  return results;
}

function scanDirectoryStructure() {
  const requiredDirs = [
    'buffer',
    'buffer/inbox',
    'buffer/staging',
    'buffer/scripts',
    'buffer/config',
    'grid-db',
    'skyeye',
    'skyeye/guards',
    'skyeye/scripts',
    'skyeye/logs',
    'skyeye/scan-report',
    '.github/persona-brain',
    '.github/workflows',
    'scripts/skyeye'
  ];

  const results = { checked: requiredDirs.length, present: 0, missing: [] };

  for (const dir of requiredDirs) {
    const fullPath = path.join(ROOT, dir);
    if (fs.existsSync(fullPath) && fs.statSync(fullPath).isDirectory()) {
      results.present++;
    } else {
      results.missing.push(dir);
    }
  }
  return results;
}

function scanSubRepos(manifest) {
  const results = { total: 0, verified: [] };
  if (!manifest || !manifest.infrastructure || !manifest.infrastructure.github) return results;

  const repos = manifest.infrastructure.github.repos || [];
  results.total = repos.length;

  for (const repo of repos) {
    results.verified.push({
      name: repo.name,
      role: repo.role,
      guard_path_exists: repo.guard ? fs.existsSync(path.join(ROOT, repo.guard)) : false
    });
  }
  return results;
}

function run() {
  const args = process.argv.slice(2);
  const mode = args.find(a => a.startsWith('--mode='))?.split('=')[1] || 'full';

  console.log(`[SkyEye Scan Engine] Mode: ${mode}`);
  console.log(`[SkyEye Scan Engine] Timestamp: ${getTimestamp()}`);

  const manifest = loadJSON(MANIFEST_PATH);
  if (!manifest) {
    console.error('[SkyEye Scan Engine] ERROR: Cannot load infra-manifest.json');
    process.exit(1);
  }

  const scanResult = {
    scan_id: `SCAN-${getDateStr()}`,
    mode,
    timestamp: getTimestamp(),
    guard_scan: scanGuardConfigs(),
    workflow_scan: scanWorkflows(),
    directory_scan: scanDirectoryStructure(),
    sub_repo_scan: scanSubRepos(manifest),
    issues: [],
    summary: {}
  };

  // Collect issues
  if (scanResult.guard_scan.invalid.length > 0) {
    scanResult.issues.push(...scanResult.guard_scan.invalid.map(i => ({
      severity: 'error',
      category: 'guard_config',
      detail: `Invalid guard config: ${i.file} - ${i.reason}`
    })));
  }
  if (scanResult.guard_scan.missing_fields.length > 0) {
    scanResult.issues.push(...scanResult.guard_scan.missing_fields.map(i => ({
      severity: 'warning',
      category: 'guard_config',
      detail: `Guard ${i.file} missing fields: ${i.missing.join(', ')}`
    })));
  }
  if (scanResult.directory_scan.missing.length > 0) {
    scanResult.issues.push(...scanResult.directory_scan.missing.map(d => ({
      severity: 'warning',
      category: 'directory_structure',
      detail: `Missing directory: ${d}`
    })));
  }

  // Summary
  scanResult.summary = {
    total_issues: scanResult.issues.length,
    errors: scanResult.issues.filter(i => i.severity === 'error').length,
    warnings: scanResult.issues.filter(i => i.severity === 'warning').length,
    guards_healthy: `${scanResult.guard_scan.valid}/${scanResult.guard_scan.total}`,
    workflows_found: scanResult.workflow_scan.total,
    directories_ok: `${scanResult.directory_scan.present}/${scanResult.directory_scan.checked}`
  };

  // Update manifest
  manifest.last_scan = getTimestamp();
  manifest.last_scan_by = 'skyeye-scan-engine';
  saveJSON(MANIFEST_PATH, manifest);

  // Write log
  const logDir = path.join(LOGS_DIR, mode === 'full' ? 'weekly' : 'daily');
  if (!fs.existsSync(logDir)) fs.mkdirSync(logDir, { recursive: true });
  const logPath = path.join(logDir, `scan-${getDateStr()}.json`);
  saveJSON(logPath, scanResult);

  console.log(`[SkyEye Scan Engine] Scan complete.`);
  console.log(`[SkyEye Scan Engine] Guards: ${scanResult.summary.guards_healthy}`);
  console.log(`[SkyEye Scan Engine] Workflows: ${scanResult.summary.workflows_found}`);
  console.log(`[SkyEye Scan Engine] Directories: ${scanResult.summary.directories_ok}`);
  console.log(`[SkyEye Scan Engine] Issues: ${scanResult.summary.total_issues} (${scanResult.summary.errors} errors, ${scanResult.summary.warnings} warnings)`);
  console.log(`[SkyEye Scan Engine] Log saved: ${logPath}`);

  // Output full result as JSON for pipeline
  console.log('---SCAN_RESULT_JSON---');
  console.log(JSON.stringify(scanResult, null, 2));

  return scanResult;
}

run();
