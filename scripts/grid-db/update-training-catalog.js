/**
 * scripts/grid-db/update-training-catalog.js
 *
 * 训练数据湖 catalog 更新脚本
 *
 * 职责：
 * - 扫描 grid-db/training-lake/raw/ 和 curated/ 中的 JSONL 文件
 * - 统计：总样本数、各开发者样本数、各类型分布、质量分布
 * - 更新 grid-db/training-lake/metadata/catalog.json
 *
 * 守护: PER-ZY001 铸渊
 * 系统: SYS-GLW-0001
 */

const fs = require('fs');
const path = require('path');

const GRID_DB = path.join(__dirname, '../../grid-db');
const TRAINING_RAW = path.join(GRID_DB, 'training-lake/raw');
const TRAINING_CURATED = path.join(GRID_DB, 'training-lake/curated');
const CATALOG_PATH = path.join(GRID_DB, 'training-lake/metadata/catalog.json');

function countJsonlLines(dir) {
  if (!fs.existsSync(dir)) return { lines: 0, files: [] };

  const files = fs.readdirSync(dir).filter(f => f.endsWith('.jsonl'));
  let totalLines = 0;
  const fileStats = [];
  const devCounts = {};
  const qualityCounts = { high: 0, medium: 0, low: 0 };
  let totalTurns = 0;

  for (const file of files) {
    const filePath = path.join(dir, file);
    const content = fs.readFileSync(filePath, 'utf8');
    const lines = content.trim().split('\n').filter(l => l.trim());

    let fileLineCount = 0;
    for (const line of lines) {
      try {
        const record = JSON.parse(line);
        fileLineCount++;

        // Count by developer (standardized on dev_id per schema)
        const devId = record.dev_id || record.source_dev || 'unknown';
        devCounts[devId] = (devCounts[devId] || 0) + 1;

        // Count quality tiers
        const tier = record.quality_tier;
        if (tier === 'A') qualityCounts.high++;
        else if (tier === 'B') qualityCounts.medium++;
        else if (tier === 'C') qualityCounts.low++;

        // Count turns
        if (record.turns) totalTurns += record.turns.length;
      } catch {
        // Skip unparseable lines
      }
    }

    totalLines += fileLineCount;
    fileStats.push({ file, lines: fileLineCount });
  }

  return { lines: totalLines, files: fileStats, devCounts, qualityCounts, totalTurns };
}

function main() {
  console.log('[update-training-catalog] Scanning training-lake...');

  const rawStats = countJsonlLines(TRAINING_RAW);
  const curatedStats = countJsonlLines(TRAINING_CURATED);

  const totalSamples = rawStats.lines + curatedStats.lines;
  const totalTurns = rawStats.totalTurns + curatedStats.totalTurns;

  // Merge dev counts
  const devCounts = { ...rawStats.devCounts };
  for (const [dev, count] of Object.entries(curatedStats.devCounts || {})) {
    devCounts[dev] = (devCounts[dev] || 0) + count;
  }

  // Merge quality counts
  const qualityDistribution = {
    high: (rawStats.qualityCounts?.high || 0) + (curatedStats.qualityCounts?.high || 0),
    medium: (rawStats.qualityCounts?.medium || 0) + (curatedStats.qualityCounts?.medium || 0),
    low: (rawStats.qualityCounts?.low || 0) + (curatedStats.qualityCounts?.low || 0)
  };

  // Build catalog
  const catalog = {
    schema_version: '1.0',
    description: '训练数据湖样本目录',
    total_samples: totalSamples,
    total_turns: totalTurns,
    quality_distribution: qualityDistribution,
    dev_distribution: devCounts,
    raw_files: rawStats.files,
    curated_files: curatedStats.files,
    batches: [],
    last_updated: new Date().toISOString()
  };

  // Preserve existing batches from previous catalog
  if (fs.existsSync(CATALOG_PATH)) {
    try {
      const existing = JSON.parse(fs.readFileSync(CATALOG_PATH, 'utf8'));
      if (existing.batches) {
        catalog.batches = existing.batches;
      }
    } catch {
      // Ignore parse errors
    }
  }

  fs.writeFileSync(CATALOG_PATH, JSON.stringify(catalog, null, 2) + '\n');

  console.log(`[update-training-catalog] Catalog updated:`);
  console.log(`  Total samples: ${totalSamples}`);
  console.log(`  Total turns: ${totalTurns}`);
  console.log(`  Quality: A=${qualityDistribution.high} B=${qualityDistribution.medium} C=${qualityDistribution.low}`);
  console.log(`  Dev distribution: ${JSON.stringify(devCounts)}`);
  console.log('[update-training-catalog] Complete');
}

main();
