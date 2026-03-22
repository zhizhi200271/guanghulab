/**
 * scripts/grid-db/extract-training-samples.js
 *
 * 交互记录 → 训练样本提取脚本
 *
 * 职责：
 * - 扫描 grid-db/interactions/ 和 grid-db/training-lake/raw/ 中的 JSONL 文件
 * - 按 quality_score 分级提取训练样本：
 *   - quality_score >= 7 → curated/（高质量 A 级）
 *   - quality_score 4-6  → raw/ 保留（B 级，需复审）
 *   - quality_score < 4   → 不提取（C 级，低质量/无关闲聊）
 * - 将合格交互转换为标准训练样本格式
 * - 按 session 分组，生成多轮对话训练样本
 *
 * 训练样本格式：
 * {
 *   "sample_id": "TS-YYYYMMDD-NNN",
 *   "source_session": "sess-XXX",
 *   "source_dev": "DEV-XXX",
 *   "source_persona": "PER-XXXXXX",
 *   "sample_type": "coding-guidance",
 *   "quality_tier": "A|B|C",
 *   "turns": [...],
 *   "metadata": { topic_tags, emotion_arc, persona_adaptation, outcome, total_turns, duration_minutes }
 * }
 *
 * 守护: PER-ZY001 铸渊
 * 系统: SYS-GLW-0001
 */

const fs = require('fs');
const path = require('path');

const GRID_DB = path.join(__dirname, '../../grid-db');
const INTERACTIONS = path.join(GRID_DB, 'interactions');
const TRAINING_RAW = path.join(GRID_DB, 'training-lake/raw');
const TRAINING_CURATED = path.join(GRID_DB, 'training-lake/curated');
const CATALOG_PATH = path.join(GRID_DB, 'training-lake/metadata/catalog.json');

function getDateStr() {
  return new Date().toISOString().slice(0, 10).replace(/-/g, '');
}

function parseJsonlFile(filePath) {
  if (!fs.existsSync(filePath)) return [];
  const content = fs.readFileSync(filePath, 'utf8');
  return content.trim().split('\n')
    .filter(line => line.trim())
    .map(line => {
      try {
        return JSON.parse(line);
      } catch {
        return null;
      }
    })
    .filter(Boolean);
}

function groupBySession(records) {
  const sessions = {};
  for (const record of records) {
    const sid = record.session_id || record.source_session || 'unknown';
    if (!sessions[sid]) {
      sessions[sid] = [];
    }
    sessions[sid].push(record);
  }
  return sessions;
}

function assessQuality(turns) {
  // Calculate average quality score from turns that have one
  const scores = turns
    .map(t => (t.metadata && t.metadata.quality_score) || (t.quality_score) || null)
    .filter(s => s !== null);

  if (scores.length === 0) return 5; // Default to medium if no scores
  return Math.round(scores.reduce((a, b) => a + b, 0) / scores.length);
}

function getQualityTier(score) {
  if (score >= 7) return 'A';
  if (score >= 4) return 'B';
  return 'C';
}

function extractEmotionArc(turns) {
  return turns
    .map(t => (t.metadata && t.metadata.emotion) || t.emotion || null)
    .filter(Boolean);
}

function extractTopicTags(turns) {
  const tags = new Set();
  for (const t of turns) {
    if (t.tags) t.tags.forEach(tag => tags.add(tag));
    if (t.metadata && t.metadata.topic) tags.add(t.metadata.topic);
  }
  return [...tags];
}

function generateSampleId(dateStr, counter) {
  const timeStr = Date.now().toString(36);
  return `TS-${dateStr}-${timeStr}-${String(counter).padStart(3, '0')}`;
}

function main() {
  const dateStr = getDateStr();
  console.log(`[extract-training-samples] Starting extraction: ${dateStr}`);

  // Collect all JSONL files from interactions/
  const devDirs = fs.readdirSync(INTERACTIONS)
    .filter(d => d.startsWith('DEV-') && fs.statSync(path.join(INTERACTIONS, d)).isDirectory());

  let allRecords = [];
  for (const devDir of devDirs) {
    const devPath = path.join(INTERACTIONS, devDir);
    const jsonlFiles = fs.readdirSync(devPath).filter(f => f.endsWith('.jsonl'));

    for (const file of jsonlFiles) {
      const records = parseJsonlFile(path.join(devPath, file));
      allRecords = allRecords.concat(records);
    }
  }

  // Also scan training-lake/raw/ for unprocessed batches
  const rawFiles = fs.readdirSync(TRAINING_RAW).filter(f => f.endsWith('.jsonl'));
  for (const file of rawFiles) {
    const records = parseJsonlFile(path.join(TRAINING_RAW, file));
    // These may already be in sample format; check and add raw interaction records
    for (const r of records) {
      if (r.turns) {
        // Already a sample, skip
        continue;
      }
      allRecords.push(r);
    }
  }

  if (allRecords.length === 0) {
    console.log('[extract-training-samples] No interaction records found');
    return;
  }

  console.log(`[extract-training-samples] Found ${allRecords.length} total records`);

  // Group by session
  const sessions = groupBySession(allRecords);
  const sessionIds = Object.keys(sessions);
  console.log(`[extract-training-samples] Found ${sessionIds.length} sessions`);

  let sampleCount = 0;
  let curatedCount = 0;
  let rawCount = 0;
  let skippedCount = 0;

  for (const sid of sessionIds) {
    const turns = sessions[sid];
    if (turns.length < 2) continue; // Need at least 2 turns for a training sample

    const qualityScore = assessQuality(turns);
    const tier = getQualityTier(qualityScore);

    if (tier === 'C') {
      skippedCount++;
      continue;
    }

    sampleCount++;
    const sampleId = generateSampleId(dateStr, sampleCount);

    const devId = turns[0].dev_id || 'unknown';
    const personaId = turns[0].persona_id || 'unknown';

    const sample = {
      schema_version: '1.0',
      sample_id: sampleId,
      source_session: sid,
      source_dev: devId,
      source_persona: personaId,
      sample_type: 'coding-guidance',
      quality_tier: tier,
      turns: turns.map(t => ({
        role: t.role || 'system',
        text: t.content || t.text || '',
        timestamp: t.timestamp || t.ts || null,
        strategy: t.strategy || null
      })),
      metadata: {
        topic_tags: extractTopicTags(turns),
        emotion_arc: extractEmotionArc(turns),
        persona_adaptation: null,
        outcome: null,
        total_turns: turns.length,
        duration_minutes: null
      }
    };

    const sampleLine = JSON.stringify(sample);

    if (tier === 'A') {
      const curatedFile = path.join(TRAINING_CURATED, `${dateStr}-curated.jsonl`);
      fs.appendFileSync(curatedFile, sampleLine + '\n');
      curatedCount++;
    } else {
      const rawFile = path.join(TRAINING_RAW, `${dateStr}-extracted.jsonl`);
      fs.appendFileSync(rawFile, sampleLine + '\n');
      rawCount++;
    }
  }

  console.log(`[extract-training-samples] Extraction complete:`);
  console.log(`  Total samples: ${sampleCount}`);
  console.log(`  Curated (A): ${curatedCount}`);
  console.log(`  Raw (B): ${rawCount}`);
  console.log(`  Skipped (C): ${skippedCount}`);
}

main();
