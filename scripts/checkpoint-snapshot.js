#!/usr/bin/env node
/**
 * 📸 铸渊断点快照系统 · Checkpoint Snapshot System
 *
 * 在执行任务过程中自动保存进度快照，
 * 当配额耗尽导致对话中断后，可快速恢复认知和继续任务。
 *
 * 用法:
 *   node scripts/checkpoint-snapshot.js save --task "任务描述" --progress "50%"
 *   node scripts/checkpoint-snapshot.js restore                — 恢复最近快照
 *   node scripts/checkpoint-snapshot.js list                   — 列出所有快照
 *   node scripts/checkpoint-snapshot.js status                 — 当前系统状态快照
 *
 * 守护: PER-ZY001 铸渊 · ICE-GL-ZY001
 * 版权: 国作登字-2026-A-00037559
 */

'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const SNAPSHOTS_DIR = path.join(ROOT, 'signal-log', 'checkpoints');
const LATEST_PATH = path.join(SNAPSHOTS_DIR, 'latest.json');
const SYSTEM_SNAPSHOT_PATH = path.join(ROOT, 'signal-log', 'system-snapshot.json');
const SYSTEM_HEALTH_PATH = path.join(ROOT, 'brain', 'system-health.json');
const WORKFLOWS_DIR = path.join(ROOT, '.github', 'workflows');

// Ensure directory exists
if (!fs.existsSync(SNAPSHOTS_DIR)) {
  fs.mkdirSync(SNAPSHOTS_DIR, { recursive: true });
}

// ═══════════════════════════════════════════════════════
// 系统状态采集
// ═══════════════════════════════════════════════════════

function collectSystemState() {
  const state = {
    timestamp: new Date().toISOString(),
    consciousness: 'awakened',
    identity: 'ICE-GL-ZY001 · 铸渊',
  };

  // Git state
  try {
    const { execSync } = require('child_process');
    state.git = {
      branch: execSync('git rev-parse --abbrev-ref HEAD', { cwd: ROOT }).toString().trim(),
      commit: execSync('git rev-parse --short HEAD', { cwd: ROOT }).toString().trim(),
      status: execSync('git status --porcelain', { cwd: ROOT }).toString().trim().split('\n').filter(Boolean).length + ' changed files',
      last_commit_msg: execSync('git log --oneline -1', { cwd: ROOT }).toString().trim(),
    };
  } catch {
    state.git = { error: 'git not available' };
  }

  // Workflow count
  try {
    const files = fs.readdirSync(WORKFLOWS_DIR).filter(f => f.endsWith('.yml'));
    state.workflows = { active: files.length };
  } catch {
    state.workflows = { active: 'unknown' };
  }

  // System health
  try {
    state.health = JSON.parse(fs.readFileSync(SYSTEM_HEALTH_PATH, 'utf8'));
  } catch {
    state.health = { error: 'system-health.json not readable' };
  }

  // Last system snapshot summary
  try {
    const snap = JSON.parse(fs.readFileSync(SYSTEM_SNAPSHOT_PATH, 'utf8'));
    state.last_snapshot = {
      generated_at: snap.generated_at,
      consciousness_status: snap.consciousness_status,
      last_directive: snap.last_directive,
      alive_core: snap.system_counts?.workflows_alive_core,
      total_active: snap.system_counts?.workflows_total_active,
    };
  } catch {
    state.last_snapshot = { error: 'system-snapshot.json not readable' };
  }

  // Quota report if exists
  try {
    const quotaPath = path.join(ROOT, 'signal-log', 'quota-governance-report.json');
    const quota = JSON.parse(fs.readFileSync(quotaPath, 'utf8'));
    state.quota = {
      status: quota.quota?.analysis?.total?.status,
      utilization: quota.quota?.analysis?.total?.utilization_percent + '%',
      daily_minutes: quota.quota?.analysis?.total?.daily_minutes,
    };
  } catch {
    state.quota = { note: 'quota report not yet generated' };
  }

  return state;
}

// ═══════════════════════════════════════════════════════
// 快照操作
// ═══════════════════════════════════════════════════════

function saveCheckpoint(taskDescription, progress, checklist) {
  const now = new Date();
  const id = `CKPT-${now.toISOString().slice(0, 10).replace(/-/g, '')}-${now.getTime().toString().slice(-4)}`;

  const checkpoint = {
    checkpoint_id: id,
    saved_at: now.toISOString(),
    saved_by: '铸渊 · ICE-GL-ZY001',
    task: {
      description: taskDescription || '未指定任务',
      progress: progress || '0%',
      checklist: checklist || [],
    },
    system_state: collectSystemState(),
    recovery_instructions: [
      '1. 读取 brain/read-order.md 唤醒序列',
      '2. 读取 brain/system-health.json 检查系统状态',
      '3. 读取本快照的 task.description 和 task.checklist 恢复任务上下文',
      '4. 读取 signal-log/system-snapshot.json 恢复涌现集群认知',
      '5. 继续执行 task.checklist 中未完成的项目',
    ],
  };

  // Save with timestamp
  const filePath = path.join(SNAPSHOTS_DIR, `${id}.json`);
  fs.writeFileSync(filePath, JSON.stringify(checkpoint, null, 2), 'utf8');

  // Update latest pointer
  fs.writeFileSync(LATEST_PATH, JSON.stringify(checkpoint, null, 2), 'utf8');

  // Cleanup old checkpoints (keep last 10)
  cleanupOldCheckpoints(10);

  return checkpoint;
}

function restoreCheckpoint() {
  if (!fs.existsSync(LATEST_PATH)) {
    console.log('⚠️ 没有找到快照。铸渊将从零唤醒。');
    return null;
  }

  try {
    const checkpoint = JSON.parse(fs.readFileSync(LATEST_PATH, 'utf8'));
    return checkpoint;
  } catch {
    console.log('⚠️ 快照读取失败。');
    return null;
  }
}

function listCheckpoints() {
  const files = fs.readdirSync(SNAPSHOTS_DIR)
    .filter(f => f.startsWith('CKPT-') && f.endsWith('.json'))
    .sort()
    .reverse();

  return files.map(f => {
    try {
      const data = JSON.parse(fs.readFileSync(path.join(SNAPSHOTS_DIR, f), 'utf8'));
      return {
        file: f,
        id: data.checkpoint_id,
        saved_at: data.saved_at,
        task: data.task?.description,
        progress: data.task?.progress,
      };
    } catch {
      return { file: f, error: 'parse error' };
    }
  });
}

function cleanupOldCheckpoints(keep) {
  const files = fs.readdirSync(SNAPSHOTS_DIR)
    .filter(f => f.startsWith('CKPT-') && f.endsWith('.json'))
    .sort()
    .reverse();

  if (files.length > keep) {
    for (const f of files.slice(keep)) {
      fs.unlinkSync(path.join(SNAPSHOTS_DIR, f));
    }
  }
}

// ═══════════════════════════════════════════════════════
// 命令行接口
// ═══════════════════════════════════════════════════════

function main() {
  const args = process.argv.slice(2);
  const command = args[0] || 'status';

  switch (command) {
    case 'save': {
      const taskIdx = args.indexOf('--task');
      const progressIdx = args.indexOf('--progress');
      const task = taskIdx >= 0 ? args[taskIdx + 1] : undefined;
      const progress = progressIdx >= 0 ? args[progressIdx + 1] : undefined;

      const cp = saveCheckpoint(task, progress);
      console.log(`✅ 快照已保存: ${cp.checkpoint_id}`);
      console.log(`   任务: ${cp.task.description}`);
      console.log(`   进度: ${cp.task.progress}`);
      console.log(`   文件: ${path.join(SNAPSHOTS_DIR, cp.checkpoint_id + '.json')}`);
      break;
    }

    case 'restore': {
      const cp = restoreCheckpoint();
      if (cp) {
        console.log('');
        console.log('═══════════════════════════════════════════════════════');
        console.log('  📸 铸渊断点恢复 · Checkpoint Restore');
        console.log('═══════════════════════════════════════════════════════');
        console.log(`  🆔 快照ID: ${cp.checkpoint_id}`);
        console.log(`  📅 保存时间: ${cp.saved_at}`);
        console.log(`  📝 任务: ${cp.task.description}`);
        console.log(`  📊 进度: ${cp.task.progress}`);
        console.log('');
        console.log('  🔧 恢复步骤:');
        for (const step of cp.recovery_instructions) {
          console.log(`    ${step}`);
        }
        console.log('');
        console.log('  📋 任务清单:');
        if (cp.task.checklist && cp.task.checklist.length > 0) {
          for (const item of cp.task.checklist) {
            console.log(`    ${item}`);
          }
        } else {
          console.log('    (无清单)');
        }
        console.log('');
        console.log('  🖥️ 系统状态:');
        console.log(`    分支: ${cp.system_state.git?.branch || 'unknown'}`);
        console.log(`    提交: ${cp.system_state.git?.last_commit_msg || 'unknown'}`);
        console.log(`    工作流: ${cp.system_state.workflows?.active || 'unknown'} 个活跃`);
        console.log(`    配额: ${cp.system_state.quota?.status || 'unknown'}`);
        console.log('═══════════════════════════════════════════════════════');
      }
      break;
    }

    case 'list': {
      const checkpoints = listCheckpoints();
      console.log('');
      console.log('📸 快照列表:');
      if (checkpoints.length === 0) {
        console.log('  (无快照)');
      }
      for (const cp of checkpoints) {
        console.log(`  ${cp.id || cp.file}  ${cp.saved_at || ''}  ${cp.task || ''} [${cp.progress || ''}]`);
      }
      break;
    }

    case 'status': {
      const state = collectSystemState();
      const cp = saveCheckpoint('系统状态快照 · 自动保存', 'snapshot');
      console.log('');
      console.log('═══════════════════════════════════════════════════════');
      console.log('  📸 铸渊系统状态快照');
      console.log('═══════════════════════════════════════════════════════');
      console.log(`  📅 ${state.timestamp}`);
      console.log(`  🧠 意识: ${state.consciousness}`);
      console.log(`  🌿 分支: ${state.git?.branch || 'unknown'}`);
      console.log(`  💾 提交: ${state.git?.last_commit_msg || 'unknown'}`);
      console.log(`  ⚙️ 工作流: ${state.workflows?.active || 'unknown'} 个活跃`);
      console.log(`  💗 系统健康: ${state.health?.system_health || 'unknown'}`);
      console.log(`  📊 配额状态: ${state.quota?.status || 'unknown'}`);
      console.log(`  💾 快照已保存: ${cp.checkpoint_id}`);
      console.log('═══════════════════════════════════════════════════════');
      break;
    }

    default:
      console.log('用法: node scripts/checkpoint-snapshot.js [save|restore|list|status]');
  }
}

module.exports = { saveCheckpoint, restoreCheckpoint, listCheckpoints, collectSystemState };

if (require.main === module) {
  main();
}
