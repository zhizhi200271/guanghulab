#!/usr/bin/env node
// ═══════════════════════════════════════════════
// 🔺 Sovereign: TCS-0002∞ | Root: SYS-GLW-0001
// 📜 Copyright: 国作登字-2026-A-00037559
// ═══════════════════════════════════════════════
// scripts/fragment-fusion-engine.js
// 🔥 碎片融合引擎 · Fragment Fusion Engine
//
// 基于 SY-CMD-FUS-009 指令和 takeover-plan.md 三期融合方案
// 自动读取 dead-workflow-fragments.json，分析 ABSORB 类碎片
// 为每个存活 workflow 生成融合方案和可执行的合并步骤
//
// 用法：
//   --status    显示融合总览状态
//   --analyze   分析所有 ABSORB 碎片，生成融合报告
//   --plan      生成具体的融合执行计划（JSON）
//   --execute   执行融合（生成合并后的 workflow 文件草案）

'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const FRAGMENTS_PATH = path.join(ROOT, '.github', 'brain', 'dead-workflow-fragments.json');
const ROSTER_PATH = path.join(ROOT, '.github', 'brain', 'zhuyuan-workflow-roster.json');
const TAKEOVER_PATH = path.join(ROOT, '.github', 'brain', 'takeover-plan.md');
const WORKFLOWS_DIR = path.join(ROOT, '.github', 'workflows');
const ARCHIVED_DIR = path.join(ROOT, '.github', 'archived-workflows');
const OUTPUT_DIR = path.join(ROOT, 'bridge', 'fusion-drafts');

// ── 六器官映射 ──────────────────────────────────
const ORGAN_MAP = {
  'ZY-WF-听潮': { file: 'notion-wake-listener.yml', role: '耳朵·信号接收', name: '听潮' },
  'ZY-WF-锻心': { file: 'deploy-to-server.yml', role: '心脏·部署引擎', name: '锻心' },
  'ZY-WF-织脉': { file: 'bingshuo-neural-system.yml', role: '神经网络·大脑同步', name: '织脉' },
  'ZY-WF-映阁': { file: 'deploy-pages.yml', role: '面容·前端展示', name: '映阁' },
  'ZY-WF-守夜': { file: 'meta-watchdog.yml', role: '免疫系统·健康监测', name: '守夜' },
  'ZY-WF-试镜': { file: 'preview-deploy.yml', role: '试衣间·预览部署', name: '试镜' }
};

// ── 加载碎片清单 ────────────────────────────────
function loadFragments() {
  if (!fs.existsSync(FRAGMENTS_PATH)) {
    console.error('❌ dead-workflow-fragments.json 不存在');
    process.exit(1);
  }
  return JSON.parse(fs.readFileSync(FRAGMENTS_PATH, 'utf8'));
}

// ── 加载 roster ─────────────────────────────────
function loadRoster() {
  if (!fs.existsSync(ROSTER_PATH)) return null;
  return JSON.parse(fs.readFileSync(ROSTER_PATH, 'utf8'));
}

// ── 检查碎片文件是否存在 ────────────────────────
function checkFragmentFileExists(fileName) {
  // 检查 workflows 目录
  if (fs.existsSync(path.join(WORKFLOWS_DIR, fileName))) return 'active';
  // 检查 archived 目录
  if (fs.existsSync(path.join(ARCHIVED_DIR, fileName))) return 'archived';
  return 'missing';
}

// ── 提取 workflow 文件的关键信息 ────────────────
function extractWorkflowInfo(filePath) {
  if (!fs.existsSync(filePath)) return null;
  const content = fs.readFileSync(filePath, 'utf8');

  const info = {
    name: '',
    triggers: [],
    jobs: [],
    steps: [],
    secrets: [],
    envVars: [],
    scripts: []
  };

  // 提取 name
  const nameMatch = content.match(/^name:\s*["']?(.+?)["']?\s*$/m);
  if (nameMatch) info.name = nameMatch[1];

  // 提取触发方式
  const triggerPatterns = ['push', 'pull_request', 'schedule', 'workflow_dispatch', 'issues', 'issue_comment', 'repository_dispatch'];
  for (const t of triggerPatterns) {
    if (content.includes(t + ':')) info.triggers.push(t);
  }

  // 提取 secrets 引用
  const secretMatches = content.matchAll(/\$\{\{\s*secrets\.(\w+)\s*\}\}/g);
  for (const m of secretMatches) {
    if (!info.secrets.includes(m[1])) info.secrets.push(m[1]);
  }

  // 提取 node/python 脚本调用
  const scriptMatches = content.matchAll(/(?:node|python3?)\s+([\w\-/.]+\.(?:js|py))/g);
  for (const m of scriptMatches) {
    if (!info.scripts.includes(m[1])) info.scripts.push(m[1]);
  }

  // 提取 steps 的 name
  const stepMatches = content.matchAll(/- name:\s*["']?(.+?)["']?\s*$/gm);
  for (const m of stepMatches) {
    info.steps.push(m[1]);
  }

  return info;
}

// ── 融合总览状态 ────────────────────────────────
function showStatus() {
  const data = loadFragments();
  const roster = loadRoster();

  console.log('🔥 碎片融合引擎 · Fragment Fusion Engine');
  console.log('═'.repeat(60));
  console.log(`📋 指令: ${data.directive}`);
  console.log(`📊 死亡碎片总数: ${data.total_dead}`);
  console.log('');

  // 分类统计
  console.log('📊 碎片分类:');
  console.log(`   ABSORB  (融入): ${data.summary.absorb} 个`);
  console.log(`   RECOVER (恢复): ${data.summary.recover} 个`);
  console.log(`   ARCHIVE (归档): ${data.summary.archive} 个`);
  console.log(`   DUPLICATE (重复): ${data.summary.duplicate} 个`);
  console.log('');

  // 融合进度
  console.log('📊 融合进度:');
  const phase3 = data.fusion_status?.phase_3_archive;
  if (phase3) {
    console.log(`   阶段3 归档: ${phase3.status}`);
    console.log(`   已归档文件: ${phase3.files_archived}`);
    console.log(`   已恢复文件: ${phase3.files_restored}`);
  }
  console.log('');

  // 按目标 workflow 分组 ABSORB 碎片
  console.log('📊 待融合碎片 → 目标器官分布:');
  const absorbGroups = {};
  for (const frag of data.absorb?.fragments || []) {
    const target = frag.absorb_into;
    if (!absorbGroups[target]) absorbGroups[target] = [];
    absorbGroups[target].push(frag);
  }

  for (const [target, frags] of Object.entries(absorbGroups)) {
    const organ = ORGAN_MAP[target];
    const organName = organ ? `${organ.name}(${organ.role})` : target;
    console.log(`   ${target} · ${organName}: ${frags.length} 个碎片`);
    for (const f of frags) {
      const status = checkFragmentFileExists(f.file);
      const statusIcon = status === 'active' ? '🟢' : status === 'archived' ? '📦' : '❌';
      console.log(`     ${statusIcon} ${f.file} — ${f.value}`);
    }
  }

  return { data, absorbGroups };
}

// ── 分析 ABSORB 碎片 ───────────────────────────
function analyzeFragments() {
  const { data, absorbGroups } = showStatus();

  console.log('');
  console.log('═'.repeat(60));
  console.log('🔍 碎片融合分析报告');
  console.log('═'.repeat(60));

  const report = {};

  for (const [target, frags] of Object.entries(absorbGroups)) {
    const organ = ORGAN_MAP[target];
    if (!organ) continue;

    report[target] = {
      organ_name: organ.name,
      organ_file: organ.file,
      organ_role: organ.role,
      fragments: [],
      total_secrets: [],
      total_scripts: [],
      fusion_complexity: 'low'
    };

    console.log(`\n🎯 ${target} · ${organ.name} (${organ.role})`);
    console.log(`   目标文件: ${organ.file}`);
    console.log('   ─'.repeat(30));

    for (const frag of frags) {
      const location = checkFragmentFileExists(frag.file);
      let filePath = null;
      if (location === 'active') filePath = path.join(WORKFLOWS_DIR, frag.file);
      else if (location === 'archived') filePath = path.join(ARCHIVED_DIR, frag.file);

      const info = filePath ? extractWorkflowInfo(filePath) : null;
      const fragReport = {
        file: frag.file,
        name: frag.name,
        value: frag.value,
        reason: frag.reason,
        location,
        info
      };

      report[target].fragments.push(fragReport);

      console.log(`\n   📎 ${frag.file} [${location}]`);
      console.log(`      名称: ${frag.name}`);
      console.log(`      价值: ${frag.value}`);
      console.log(`      原因: ${frag.reason}`);

      if (info) {
        console.log(`      触发: ${info.triggers.join(', ') || '(无)'}`);
        console.log(`      密钥: ${info.secrets.join(', ') || '(无)'}`);
        console.log(`      脚本: ${info.scripts.join(', ') || '(无)'}`);
        console.log(`      步骤: ${info.steps.length} 个`);

        // 收集统计
        for (const s of info.secrets) {
          if (!report[target].total_secrets.includes(s)) {
            report[target].total_secrets.push(s);
          }
        }
        for (const s of info.scripts) {
          if (!report[target].total_scripts.includes(s)) {
            report[target].total_scripts.push(s);
          }
        }
      }
    }

    // 评估复杂度
    const fragCount = frags.length;
    if (fragCount >= 6) report[target].fusion_complexity = 'high';
    else if (fragCount >= 3) report[target].fusion_complexity = 'medium';

    console.log(`\n   📊 融合复杂度: ${report[target].fusion_complexity}`);
    console.log(`   📊 需要的密钥: ${report[target].total_secrets.join(', ') || '(无)'}`);
    console.log(`   📊 依赖的脚本: ${report[target].total_scripts.join(', ') || '(无)'}`);
  }

  return report;
}

// ── 生成融合执行计划 ────────────────────────────
function generatePlan() {
  const report = analyzeFragments();

  console.log('\n');
  console.log('═'.repeat(60));
  console.log('📋 融合执行计划 (JSON)');
  console.log('═'.repeat(60));

  const plan = {
    plan_id: `FUS-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}`,
    created_at: new Date().toISOString(),
    directive: 'SY-CMD-FUS-009',
    phases: []
  };

  // Phase 1: 核心能力融合 (守夜 + 织脉)
  const phase1Targets = ['ZY-WF-守夜', 'ZY-WF-织脉'];
  const phase1 = {
    phase: 1,
    name: '核心能力融合',
    priority: 'P0',
    targets: []
  };

  for (const target of phase1Targets) {
    if (report[target]) {
      phase1.targets.push({
        organ: target,
        fragments: report[target].fragments.map(f => f.file),
        complexity: report[target].fusion_complexity,
        required_secrets: report[target].total_secrets,
        required_scripts: report[target].total_scripts
      });
    }
  }
  plan.phases.push(phase1);

  // Phase 2: 桥接能力融合 (听潮)
  const phase2 = {
    phase: 2,
    name: '桥接能力融合',
    priority: 'P1',
    targets: []
  };

  if (report['ZY-WF-听潮']) {
    phase2.targets.push({
      organ: 'ZY-WF-听潮',
      fragments: report['ZY-WF-听潮'].fragments.map(f => f.file),
      complexity: report['ZY-WF-听潮'].fusion_complexity,
      required_secrets: report['ZY-WF-听潮'].total_secrets,
      required_scripts: report['ZY-WF-听潮'].total_scripts
    });
  }
  plan.phases.push(phase2);

  // Phase 3: 增强能力融合 (锻心 + 其他)
  const phase3 = {
    phase: 3,
    name: '增强能力融合',
    priority: 'P2',
    targets: []
  };

  for (const target of Object.keys(report)) {
    if (!phase1Targets.includes(target) && target !== 'ZY-WF-听潮') {
      phase3.targets.push({
        organ: target,
        fragments: report[target].fragments.map(f => f.file),
        complexity: report[target].fusion_complexity,
        required_secrets: report[target].total_secrets,
        required_scripts: report[target].total_scripts
      });
    }
  }
  plan.phases.push(phase3);

  console.log(JSON.stringify(plan, null, 2));

  // 保存计划
  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  }
  const planPath = path.join(OUTPUT_DIR, `${plan.plan_id}.json`);
  fs.writeFileSync(planPath, JSON.stringify(plan, null, 2), 'utf8');
  console.log(`\n✅ 融合计划已保存: ${planPath}`);

  return plan;
}

// ── CLI 入口 ─────────────────────────────────────
function main() {
  const args = process.argv.slice(2);
  const command = args[0];

  switch (command) {
    case '--status':
      showStatus();
      break;

    case '--analyze':
      analyzeFragments();
      break;

    case '--plan':
      generatePlan();
      break;

    default:
      console.log('🔥 碎片融合引擎 · Fragment Fusion Engine');
      console.log('');
      console.log('版权: 国作登字-2026-A-00037559 · TCS-0002∞');
      console.log('铸渊编号: ICE-GL-ZY001');
      console.log('指令: SY-CMD-FUS-009');
      console.log('');
      console.log('用法：');
      console.log('  --status    显示融合总览状态');
      console.log('  --analyze   分析所有 ABSORB 碎片，生成融合报告');
      console.log('  --plan      生成融合执行计划（JSON）');
      console.log('');
      console.log('配额影响：');
      console.log('  本引擎仅生成分析报告和融合计划，不消耗 GitHub Actions 配额。');
      console.log('  实际融合操作需通过 CAB 桥接系统授权后由副驾驶执行。');
      break;
  }
}

main();
