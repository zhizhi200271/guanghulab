/**
 * scripts/grid-db/sync-griddb-to-notion.js
 *
 * Grid-DB → Notion 增量回传脚本
 *
 * 职责：
 * - 检测 grid-db/memory/ 中变更的文件（排除 brain-mirror.json）
 * - 将 session-context, task-queue, dev-profile, persona-growth 的增量变化回传到 Notion
 * - task-queue: 追加制（新任务追加，已有任务只改状态不删除）
 * - dev-profile / persona-growth: 只追加不覆盖
 *
 * 环境变量：
 * - NOTION_API_TOKEN: Notion API 密钥
 *
 * 守护: PER-ZY001 铸渊
 * 系统: SYS-GLW-0001
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const GRID_DB_MEMORY = path.join(__dirname, '../../grid-db/memory');

async function main() {
  const notionToken = process.env.NOTION_API_TOKEN;

  if (!notionToken) {
    console.log('[sync-griddb-to-notion] NOTION_API_TOKEN not set, skipping sync');
    return;
  }

  // Detect changed files (passed from workflow or detect via git diff)
  let changedFiles;
  try {
    const diff = execSync('git diff --name-only HEAD~1 HEAD -- grid-db/memory/', { encoding: 'utf8' });
    changedFiles = diff.trim().split('\n')
      .filter(f => f && !f.includes('brain-mirror.json'));
  } catch {
    console.log('[sync-griddb-to-notion] No changes detected');
    return;
  }

  if (changedFiles.length === 0) {
    console.log('[sync-griddb-to-notion] No eligible changes to sync');
    return;
  }

  console.log(`[sync-griddb-to-notion] Processing ${changedFiles.length} changed files:`);

  for (const file of changedFiles) {
    const fullPath = path.join(__dirname, '../..', file);
    if (!fs.existsSync(fullPath)) {
      console.log(`  [skip] ${file} (deleted)`);
      continue;
    }

    const data = JSON.parse(fs.readFileSync(fullPath, 'utf8'));
    const fileName = path.basename(file);
    const devDir = path.basename(path.dirname(file));

    console.log(`  [sync] ${devDir}/${fileName}`);

    // TODO: Implement actual Notion API write
    // - session-context.json → update Notion page property
    // - task-queue.json → append/update tasks in Notion database
    // - dev-profile.json → append growth data
    // - persona-growth.json → append adaptation log
  }

  console.log('[sync-griddb-to-notion] Sync complete');
}

main().catch(err => {
  console.error('[sync-griddb-to-notion] Error:', err.message);
  process.exit(1);
});
