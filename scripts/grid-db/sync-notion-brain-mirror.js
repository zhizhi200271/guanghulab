/**
 * scripts/grid-db/sync-notion-brain-mirror.js
 *
 * Notion → Grid-DB brain-mirror.json 同步脚本
 *
 * 职责：
 * - 从 Notion 天眼注册表拉取每个活跃人格体的核心大脑数据
 * - 写入对应的 grid-db/memory/DEV-XXX/brain-mirror.json
 * - Notion 永远覆盖仓库（单向同步）
 *
 * 环境变量：
 * - NOTION_API_TOKEN: Notion API 密钥
 *
 * 守护: PER-ZY001 铸渊
 * 系统: SYS-GLW-0001
 */

const fs = require('fs');
const path = require('path');

const GRID_DB_MEMORY = path.join(__dirname, '../../grid-db/memory');
const DEV_MODULE_MAP = path.join(__dirname, '../../grid-db/rules/dev-module-map.json');

async function main() {
  const notionToken = process.env.NOTION_API_TOKEN;

  if (!notionToken) {
    console.log('[sync-notion-brain-mirror] NOTION_API_TOKEN not set, skipping sync');
    return;
  }

  // Load dev-module-map to know which DEVs are active
  const devMap = JSON.parse(fs.readFileSync(DEV_MODULE_MAP, 'utf8'));
  const activeDev = Object.entries(devMap.mappings)
    .filter(([, info]) => info.active && info.persona_id);

  console.log(`[sync-notion-brain-mirror] Found ${activeDev.length} active developers`);

  for (const [devId, info] of activeDev) {
    const mirrorPath = path.join(GRID_DB_MEMORY, devId, 'brain-mirror.json');

    if (!fs.existsSync(mirrorPath)) {
      console.log(`[sync-notion-brain-mirror] Skipping ${devId}: no memory directory`);
      continue;
    }

    // TODO: Replace with actual Notion API call when NOTION_API_TOKEN is configured
    // For now, update the sync status timestamp
    const existing = JSON.parse(fs.readFileSync(mirrorPath, 'utf8'));

    // Only update if we got actual data from Notion (placeholder for real API)
    console.log(`[sync-notion-brain-mirror] ${devId} (${info.persona_name}): ready for Notion sync`);
  }

  console.log('[sync-notion-brain-mirror] Sync complete');
}

main().catch(err => {
  console.error('[sync-notion-brain-mirror] Error:', err.message);
  process.exit(1);
});
