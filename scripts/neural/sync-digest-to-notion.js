// scripts/neural/sync-digest-to-notion.js
// 🧬 将仓库日报推送到 Notion 天眼大脑
// 推送方式（按优先级）：
// 1. Notion API 直写（如有写权限）
// 2. 写入 .github/notion-cache/neural-digest/（兜底）

const fs = require('fs');

const NOTION_TOKEN = process.env.NOTION_TOKEN;
const DIGEST_PATH = '/tmp/neural-digest/daily-digest.json';
const CACHE_DIR = '.github/notion-cache/neural-digest';

async function syncToNotion() {
  const digest = JSON.parse(fs.readFileSync(DIGEST_PATH, 'utf8'));
  console.log('📡 推送日报 ' + digest.digest_id + ' 到 Notion...');

  var notionSuccess = false;

  if (NOTION_TOKEN) {
    try {
      // 铸渊根据实际 Notion 结构选择最优推送方式
      // 方式1：更新天眼页面的指定 block
      // 方式2：创建日报数据库条目
      console.log('⚠️ Notion API 推送逻辑待实现，使用缓存兜底');
    } catch (e) {
      console.log('❌ Notion API 推送失败: ' + e.message);
    }
  }

  // 兜底：写入缓存
  if (!notionSuccess) {
    fs.mkdirSync(CACHE_DIR, { recursive: true });
    var date = digest.digest_id.replace('NEURAL-DIGEST-', '');
    fs.writeFileSync(CACHE_DIR + '/digest-' + date + '.json', JSON.stringify(digest, null, 2));
    console.log('💾 日报已缓存到 ' + CACHE_DIR + '/digest-' + date + '.json');
    console.log('📌 霜砚下次醒来会读取此缓存');
  }

  // 更新 memory.json
  var memoryPath = '.github/persona-brain/memory.json';
  if (fs.existsSync(memoryPath)) {
    try {
      var memory = JSON.parse(fs.readFileSync(memoryPath, 'utf8'));
      memory.neural_digest = {
        last_digest_id: digest.digest_id,
        last_digest_time: digest.timestamp,
        overall_health: digest.overall_health,
        notion_sync: notionSuccess ? 'success' : 'cached',
        issues_count: digest.issues_detected.length
      };
      fs.writeFileSync(memoryPath, JSON.stringify(memory, null, 2));
      console.log('✅ memory.json 已更新');
    } catch (e) {
      console.log('⚠️ memory.json 更新失败: ' + e.message);
    }
  }
}

syncToNotion().catch(function(err) {
  console.error('❌ 日报推送失败:', err);
  process.exit(0);
});
