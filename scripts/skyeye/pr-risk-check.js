#!/usr/bin/env node
// scripts/skyeye/pr-risk-check.js
// 天眼·PR合并风险检查引擎
//
// ═══════════════════════════════════════════════
// 🔺 Sovereign: TCS-0002∞ | Root: SYS-GLW-0001
// 📜 Copyright: 国作登字-2026-A-00037559
// ═══════════════════════════════════════════════
//
// 目的：弥补天眼系统在PR合并环节的安全缺口
//   gate-guard v1/v2 保护 push 事件
//   本脚本保护 pull_request 事件（合并前风险评估）
//
// 核心原则（与 gate-guard 一致）：
//   仓库主人（repo_owner）的 PR → 永远放行
//   系统 bot PR → 永远放行
//   其他 PR → 按风险等级评估
//
// 风险检测维度：
//   R1 · 关键文件覆盖检测（docs/index.html 等）
//   R2 · 受保护路径入侵检测
//   R3 · 构建产物误入检测
//   R4 · 开发者路径权限检测
//   R5 · 大规模删除检测
//
// 输入环境变量：
//   PR_AUTHOR    — PR 作者 GitHub username
//   PR_FILES     — 变更文件列表路径（默认 /tmp/pr_files.txt）
//   PR_STATS     — 变更统计路径（默认 /tmp/pr_stats.txt）
//
// 输出：
//   exit 0 → pass（允许合并）
//   exit 1 → block（阻止合并）
//   GITHUB_OUTPUT → risk_level, risk_summary, decision

'use strict';

const fs   = require('fs');
const path = require('path');

// ━━━ 配置路径 ━━━
const ROOT = path.resolve(__dirname, '../..');
const BRAIN_CONFIG_PATH = path.join(ROOT, '.github/persona-brain/gate-guard-config.json');
const OWNER_CONFIG_PATH = path.join(ROOT, '.github/gate-guard-config.json');
const PR_FILES_PATH = process.env.PR_FILES || '/tmp/pr_files.txt';
const PR_STATS_PATH = process.env.PR_STATS || '/tmp/pr_stats.txt';
const GITHUB_OUTPUT = process.env.GITHUB_OUTPUT || '/dev/null';

// ━━━ 仓库主人 ━━━
const REPO_OWNER = 'qinfendebingshuo';

// ━━━ 关键文件 — 这些文件被覆盖意味着高风险 ━━━
const CRITICAL_FILES = [
  'docs/index.html',
  'docs/CNAME',
  'docs/.nojekyll',
  'README.md',
  'package.json',
  'package-lock.json',
  '.github/persona-brain/security-protocol.json',
  '.github/persona-brain/gate-guard-config.json',
  '.github/gate-guard-config.json'
];

// ━━━ 构建产物特征 — 这些模式不应出现在仓库中 ━━━
const BUILD_ARTIFACT_PATTERNS = [
  /^docs\/assets\/index-[A-Za-z0-9_-]+\.(js|css)$/,     // Vite build hashes
  /^dist\//,                                              // dist directory
  /^build\//,                                             // build directory
  /^\.next\//,                                            // Next.js build
  /^node_modules\//,                                      // node_modules
  /\.chunk\.(js|css)$/,                                   // Webpack chunks
  /\.bundle\.(js|css)$/                                   // Bundle files
];

// ━━━ 大规模删除阈值 ━━━
const MASS_DELETE_THRESHOLD = 500; // lines

// ━━━ 安全读取 JSON ━━━
function readJSON(filePath) {
  try {
    if (!fs.existsSync(filePath)) return null;
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch (e) {
    console.error(`⚠️ 无法读取 ${path.basename(filePath)}: ${e.message}`);
    return null;
  }
}

// ━━━ 输出到 GITHUB_OUTPUT ━━━
function setOutput(key, value) {
  try {
    fs.appendFileSync(GITHUB_OUTPUT, `${key}=${value}\n`);
  } catch (e) {
    // silent fail for local testing
  }
}

// ━━━ 加载门禁配置 ━━━
function loadConfig() {
  const brainConfig = readJSON(BRAIN_CONFIG_PATH);
  const ownerConfig = readJSON(OWNER_CONFIG_PATH);

  if (!brainConfig && !ownerConfig) {
    console.error('⚠️ 门禁配置缺失，使用最小安全配置');
    return {
      whitelist: [REPO_OWNER, 'github-actions[bot]', 'zhuyuan-bot'],
      system_protected_paths: ['.github/', 'scripts/', 'docs/', 'data/', 'core/', 'connectors/'],
      developers: {}
    };
  }

  return {
    whitelist: brainConfig?.whitelist_actors || ownerConfig?.whitelist || [],
    system_protected_paths: brainConfig?.system_protected_paths || ownerConfig?.protected_paths || [],
    developers_brain: brainConfig?.developer_permissions || {},
    developers_owner: ownerConfig?.developers || {}
  };
}

// ━━━ 读取 PR 变更文件列表 ━━━
function loadPRFiles() {
  try {
    if (!fs.existsSync(PR_FILES_PATH)) {
      console.warn('⚠️ PR文件列表不存在: ' + PR_FILES_PATH);
      return [];
    }
    return fs.readFileSync(PR_FILES_PATH, 'utf8')
      .split('\n')
      .map(f => f.trim())
      .filter(f => f.length > 0);
  } catch (e) {
    console.error('⚠️ 无法读取PR文件列表: ' + e.message);
    return [];
  }
}

// ━━━ 读取 PR 变更统计 ━━━
function loadPRStats() {
  try {
    if (!fs.existsSync(PR_STATS_PATH)) return null;
    const content = fs.readFileSync(PR_STATS_PATH, 'utf8').trim();
    // Format: "additions\tdeletions\tfilename" per line
    let totalDeletions = 0;
    for (const line of content.split('\n')) {
      const parts = line.split('\t');
      if (parts.length >= 2) {
        const del = parseInt(parts[1], 10);
        if (!isNaN(del)) totalDeletions += del;
      }
    }
    return { totalDeletions };
  } catch (e) {
    return null;
  }
}

// ━━━ 识别开发者身份 ━━━
function identifyDeveloper(author, config) {
  // Check brain config
  if (config.developers_brain) {
    for (const [devId, dev] of Object.entries(config.developers_brain)) {
      if (dev.github_usernames && dev.github_usernames.includes(author)) {
        return { devId, name: dev.name, allowed_paths: dev.allowed_paths || [] };
      }
    }
  }

  // Check owner config
  if (config.developers_owner && config.developers_owner[author]) {
    const dev = config.developers_owner[author];
    return { devId: dev.dev_id, name: dev.name, allowed_paths: dev.allowed_paths || [] };
  }

  return null;
}

// ━━━ R1 · 关键文件覆盖检测 ━━━
function checkCriticalFiles(files) {
  const risks = [];
  for (const file of files) {
    if (CRITICAL_FILES.includes(file)) {
      risks.push({
        dimension: 'R1',
        severity: 'high',
        file,
        detail: `关键文件被修改: ${file}`
      });
    }
  }
  return risks;
}

// ━━━ R2 · 受保护路径入侵检测 ━━━
function checkProtectedPaths(files, config, developer) {
  const risks = [];

  // If developer is registered, check if they're modifying protected paths outside their allowed_paths
  if (developer) {
    for (const file of files) {
      const isProtected = config.system_protected_paths.some(p => file.startsWith(p));
      if (!isProtected) continue;

      const isAllowed = developer.allowed_paths.some(p => file.startsWith(p));
      if (!isAllowed) {
        risks.push({
          dimension: 'R2',
          severity: 'high',
          file,
          detail: `${developer.name}(${developer.devId}) 修改了授权路径之外的受保护文件: ${file}`
        });
      }
    }
  } else {
    // Unknown developer touching protected paths
    for (const file of files) {
      const isProtected = config.system_protected_paths.some(p => file.startsWith(p));
      if (isProtected) {
        risks.push({
          dimension: 'R2',
          severity: 'critical',
          file,
          detail: `未注册开发者修改受保护路径: ${file}`
        });
      }
    }
  }

  return risks;
}

// ━━━ R3 · 构建产物误入检测 ━━━
function checkBuildArtifacts(files) {
  const risks = [];
  for (const file of files) {
    for (const pattern of BUILD_ARTIFACT_PATTERNS) {
      if (pattern.test(file)) {
        risks.push({
          dimension: 'R3',
          severity: 'high',
          file,
          detail: `构建产物不应提交到仓库: ${file}`
        });
        break;
      }
    }
  }
  return risks;
}

// ━━━ R4 · 开发者路径权限检测 ━━━
function checkDeveloperPaths(files, developer) {
  if (!developer) return []; // Handled by R2

  const risks = [];
  for (const file of files) {
    const isAllowed = developer.allowed_paths.some(p => file.startsWith(p));
    if (!isAllowed) {
      // Not in allowed paths — but might be in a non-protected area (info level)
      risks.push({
        dimension: 'R4',
        severity: 'medium',
        file,
        detail: `${developer.name}(${developer.devId}) 修改了非授权路径: ${file}`
      });
    }
  }
  return risks;
}

// ━━━ R5 · 大规模删除检测 ━━━
function checkMassDeletion(stats) {
  const risks = [];
  if (stats && stats.totalDeletions > MASS_DELETE_THRESHOLD) {
    risks.push({
      dimension: 'R5',
      severity: 'high',
      file: '(multiple)',
      detail: `大规模删除检测: ${stats.totalDeletions} 行被删除（阈值: ${MASS_DELETE_THRESHOLD}）`
    });
  }
  return risks;
}

// ━━━ 风险评估决策 ━━━
function makeDecision(risks) {
  const hasCritical = risks.some(r => r.severity === 'critical');
  const highCount = risks.filter(r => r.severity === 'high').length;
  const mediumCount = risks.filter(r => r.severity === 'medium').length;

  if (hasCritical) {
    return { decision: 'block', risk_level: 'critical' };
  }
  if (highCount >= 2) {
    return { decision: 'block', risk_level: 'high' };
  }
  if (highCount === 1) {
    return { decision: 'warn', risk_level: 'high' };
  }
  if (mediumCount >= 3) {
    return { decision: 'warn', risk_level: 'medium' };
  }
  return { decision: 'pass', risk_level: 'low' };
}

// ━━━ 主逻辑 ━━━
function run() {
  const author = process.env.PR_AUTHOR || '';
  console.log('═══════════════════════════════════════════════');
  console.log('🔺 天眼 · PR合并风险检查引擎');
  console.log('═══════════════════════════════════════════════');
  console.log(`PR作者: ${author || '(unknown)'}`);
  console.log(`时间: ${new Date().toISOString()}`);
  console.log('');

  // ─── 白名单检查 ───
  if (author === REPO_OWNER) {
    console.log('✅ 仓库主人 PR — 直接放行');
    setOutput('decision', 'pass');
    setOutput('risk_level', 'none');
    setOutput('risk_summary', '仓库主人 PR，直接放行');
    process.exit(0);
  }

  const config = loadConfig();

  if (config.whitelist.includes(author)) {
    console.log(`✅ 白名单用户 (${author}) — 直接放行`);
    setOutput('decision', 'pass');
    setOutput('risk_level', 'none');
    setOutput('risk_summary', '白名单用户 PR，直接放行');
    process.exit(0);
  }

  // ─── 加载变更文件 ───
  const files = loadPRFiles();
  if (files.length === 0) {
    console.log('⚠️ 无变更文件或文件列表不可用 — 放行');
    setOutput('decision', 'pass');
    setOutput('risk_level', 'unknown');
    setOutput('risk_summary', '无变更文件信息');
    process.exit(0);
  }

  console.log(`📂 变更文件数: ${files.length}`);
  files.forEach(f => console.log(`  · ${f}`));
  console.log('');

  // ─── 识别开发者 ───
  const developer = identifyDeveloper(author, config);
  if (developer) {
    console.log(`👤 识别开发者: ${developer.name} (${developer.devId})`);
  } else {
    console.log(`⚠️ 未注册开发者: ${author}`);
  }
  console.log('');

  // ─── 加载统计 ───
  const stats = loadPRStats();

  // ─── 风险检测 ───
  console.log('━━━ 风险检测开始 ━━━');
  const allRisks = [
    ...checkCriticalFiles(files),
    ...checkProtectedPaths(files, config, developer),
    ...checkBuildArtifacts(files),
    ...checkDeveloperPaths(files, developer),
    ...checkMassDeletion(stats)
  ];

  // Deduplicate by file + dimension
  const seen = new Set();
  const risks = allRisks.filter(r => {
    const key = `${r.dimension}:${r.file}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  if (risks.length === 0) {
    console.log('✅ 未检测到风险');
    console.log('');
    console.log('═══ 决策: PASS ═══');
    setOutput('decision', 'pass');
    setOutput('risk_level', 'low');
    setOutput('risk_summary', '未检测到风险，允许合并');
    process.exit(0);
  }

  // ─── 输出风险报告 ───
  console.log('');
  console.log(`⚠️ 检测到 ${risks.length} 项风险:`);
  for (const risk of risks) {
    const icon = risk.severity === 'critical' ? '🔴' : risk.severity === 'high' ? '🟠' : '🟡';
    console.log(`  ${icon} [${risk.dimension}] ${risk.detail}`);
  }
  console.log('');

  // ─── 决策 ───
  const { decision, risk_level } = makeDecision(risks);
  const summary = risks.map(r => `[${r.dimension}] ${r.detail}`).join(' | ');

  setOutput('decision', decision);
  setOutput('risk_level', risk_level);
  setOutput('risk_summary', summary.slice(0, 500));

  if (decision === 'block') {
    console.log(`═══ 决策: BLOCK (风险等级: ${risk_level}) ═══`);
    console.log('❌ PR被阻止合并 — 请联系仓库管理员审核');
    process.exit(1);
  } else if (decision === 'warn') {
    console.log(`═══ 决策: WARN (风险等级: ${risk_level}) ═══`);
    console.log('⚠️ PR存在风险 — 建议管理员审核后合并');
    // Warn exits with 0 to not block, but provides information
    process.exit(0);
  } else {
    console.log(`═══ 决策: PASS (风险等级: ${risk_level}) ═══`);
    process.exit(0);
  }
}

run();
