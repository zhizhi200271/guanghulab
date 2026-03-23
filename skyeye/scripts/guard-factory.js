#!/usr/bin/env node
/**
 * skyeye/scripts/guard-factory.js
 * 天眼 Guard 工厂 — 从模板自动生成新 Guard 配置
 */

const fs = require('fs');
const path = require('path');

const SKYEYE_DIR = path.resolve(__dirname, '..');
const GUARDS_DIR = path.join(SKYEYE_DIR, 'guards');
const TEMPLATE_PATH = path.join(GUARDS_DIR, 'guard-template.json');

function getTimestamp() {
  return new Date().toISOString();
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

function createGuard(serviceName, options = {}) {
  const template = loadJSON(TEMPLATE_PATH);
  if (!template) {
    console.error('[Guard Factory] ERROR: Cannot load guard-template.json');
    process.exit(1);
  }

  const guardId = `GUARD-${serviceName.toUpperCase().replace(/\s+/g, '-')}`;
  const fileName = `${serviceName.toLowerCase().replace(/\s+/g, '-')}-guard.json`;
  const outputPath = path.join(GUARDS_DIR, fileName);

  if (fs.existsSync(outputPath)) {
    console.warn(`[Guard Factory] WARNING: ${fileName} already exists. Use --force to overwrite.`);
    if (!options.force) return null;
  }

  const guard = {
    ...template,
    guard_id: guardId,
    target_service: options.targetService || serviceName,
    status: 'initializing',
    mode: options.mode || 'buffer',
    buffer_policy: {
      ...template.buffer_policy,
      buffer_path: options.bufferPath || `buffer/${serviceName.toLowerCase()}-staging/`,
    },
    quota_policy: {
      ...template.quota_policy,
      monthly_limit: options.monthlyLimit || template.quota_policy.monthly_limit,
    },
    health_check: {
      ...template.health_check,
      method: options.healthCheckMethod || 'api_ping',
    },
    last_updated_by: 'skyeye-guard-factory',
    last_updated_at: getTimestamp()
  };

  saveJSON(outputPath, guard);
  console.log(`[Guard Factory] Created: ${fileName}`);
  console.log(`[Guard Factory] Guard ID: ${guardId}`);
  console.log(`[Guard Factory] Status: initializing`);

  return { fileName, guard };
}

function listGuards() {
  const files = fs.readdirSync(GUARDS_DIR)
    .filter(f => f.endsWith('.json') && f !== 'guard-template.json');

  console.log(`[Guard Factory] Current guards (${files.length}):`);
  for (const file of files) {
    const guard = loadJSON(path.join(GUARDS_DIR, file));
    if (guard) {
      console.log(`  ${guard.guard_id}: ${guard.target_service} [${guard.status}] (${guard.mode})`);
    } else {
      console.log(`  ${file}: [INVALID JSON]`);
    }
  }
  return files;
}

function run() {
  const args = process.argv.slice(2);

  if (args.includes('--list')) {
    listGuards();
    return;
  }

  if (args.includes('--create')) {
    const nameIdx = args.indexOf('--create') + 1;
    if (nameIdx >= args.length) {
      console.error('[Guard Factory] Usage: --create <service_name> [--force]');
      process.exit(1);
    }
    const serviceName = args[nameIdx];
    const force = args.includes('--force');
    createGuard(serviceName, { force });
    return;
  }

  // Default: list existing guards
  console.log('[Guard Factory] 天眼 Guard 工厂');
  console.log('Usage:');
  console.log('  --list              List all existing guards');
  console.log('  --create <name>     Create a new guard from template');
  console.log('  --force             Overwrite existing guard');
  listGuards();
}

run();
