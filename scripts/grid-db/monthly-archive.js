/**
 * scripts/grid-db/monthly-archive.js
 *
 * 月度交互数据归档脚本
 *
 * 职责：
 * - 将上月的 grid-db/interactions/DEV-XXX/ 中的 JSONL 文件归档
 * - 合并到 grid-db/training-lake/raw/ 中（按月打包）
 * - grid-db/interactions/ 只保留最近 30 天的数据
 * - 更新 training-lake/metadata/catalog.json
 *
 * 数据量管理策略：
 * - 日级文件：每天一个 JSONL 文件
 * - 月级归档：每月 1 号自动归档上月数据
 * - Git LFS 预案：当 training-lake/ 超过 500MB 时迁移
 *
 * 守护: PER-ZY001 铸渊
 * 系统: SYS-GLW-0001
 */

const fs = require('fs');
const path = require('path');

const GRID_DB = path.join(__dirname, '../../grid-db');
const INTERACTIONS = path.join(GRID_DB, 'interactions');
const TRAINING_RAW = path.join(GRID_DB, 'training-lake/raw');
const CATALOG_PATH = path.join(GRID_DB, 'training-lake/metadata/catalog.json');

function getLastMonthPrefix() {
  const now = new Date();
  const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const year = lastMonth.getFullYear();
  const month = String(lastMonth.getMonth() + 1).padStart(2, '0');
  return `${year}${month}`;
}

function getDaysAgoDate(days) {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString().slice(0, 10).replace(/-/g, '');
}

function main() {
  const lastMonthPrefix = getLastMonthPrefix();
  const cutoffDate = getDaysAgoDate(30);

  console.log(`[monthly-archive] Archiving interactions from month: ${lastMonthPrefix}`);
  console.log(`[monthly-archive] Cutoff date for retention: ${cutoffDate}`);

  // Get all DEV directories
  const devDirs = fs.readdirSync(INTERACTIONS)
    .filter(d => d.startsWith('DEV-') && fs.statSync(path.join(INTERACTIONS, d)).isDirectory());

  let totalArchived = 0;
  let totalLines = 0;
  let totalCleaned = 0;

  for (const devDir of devDirs) {
    const devPath = path.join(INTERACTIONS, devDir);
    const files = fs.readdirSync(devPath).filter(f => f.endsWith('.jsonl'));

    if (files.length === 0) continue;

    // Collect files from last month for archiving
    const lastMonthFiles = files.filter(f => f.startsWith(lastMonthPrefix));
    // Collect files older than 30 days for cleanup
    const oldFiles = files.filter(f => {
      const dateStr = f.substring(0, 8);
      return dateStr < cutoffDate && !f.startsWith(lastMonthPrefix);
    });

    if (lastMonthFiles.length > 0) {
      // Merge all last month's JSONL into a single archive batch
      const batchId = `${lastMonthPrefix}-${devDir}`;
      const batchFile = path.join(TRAINING_RAW, `${batchId}.jsonl`);

      let lineCount = 0;
      for (const file of lastMonthFiles) {
        const content = fs.readFileSync(path.join(devPath, file), 'utf8');
        const lines = content.trim().split('\n').filter(l => l.trim());
        lineCount += lines.length;
        fs.appendFileSync(batchFile, lines.join('\n') + '\n');
      }

      console.log(`[monthly-archive] ${devDir}: archived ${lastMonthFiles.length} files (${lineCount} lines) → ${batchId}.jsonl`);
      totalArchived += lastMonthFiles.length;
      totalLines += lineCount;
    }

    // Clean up old files (already archived in previous months)
    for (const file of oldFiles) {
      const filePath = path.join(devPath, file);
      fs.unlinkSync(filePath);
      totalCleaned++;
    }

    // Also clean up last month's source files after archiving
    for (const file of lastMonthFiles) {
      const filePath = path.join(devPath, file);
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
        totalCleaned++;
      }
    }
  }

  // Update catalog (record archived lines, not samples - samples are counted by extract script)
  if (fs.existsSync(CATALOG_PATH)) {
    const catalog = JSON.parse(fs.readFileSync(CATALOG_PATH, 'utf8'));
    catalog.last_updated = new Date().toISOString();
    if (!catalog.batches) catalog.batches = [];
    if (totalArchived > 0) {
      catalog.batches.push({
        batch_id: `archive-${lastMonthPrefix}`,
        date: new Date().toISOString(),
        files_archived: totalArchived,
        lines_archived: totalLines,
        source: 'monthly-archive'
      });
    }
    fs.writeFileSync(CATALOG_PATH, JSON.stringify(catalog, null, 2) + '\n');
  }

  console.log(`[monthly-archive] Summary:`);
  console.log(`  Files archived: ${totalArchived}`);
  console.log(`  Lines archived: ${totalLines}`);
  console.log(`  Old files cleaned: ${totalCleaned}`);
  console.log('[monthly-archive] Complete');
}

main();
