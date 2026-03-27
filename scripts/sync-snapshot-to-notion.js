/**
 * 🔄 铸渊系统快照 → Notion 同步
 * sync-snapshot-to-notion.js
 *
 * 将 signal-log/system-snapshot.json 推送到 Notion 数据库，
 * 让 Notion 侧（认知层）始终有仓库最新结构和系统状况的认知。
 *
 * 用法: NOTION_TOKEN=xxx SNAPSHOT_DB_ID=xxx node scripts/sync-snapshot-to-notion.js
 *
 * 环境变量:
 *   NOTION_TOKEN      — Notion API Token
 *   SNAPSHOT_DB_ID    — 快照数据库 ID（Notion 侧）
 *   SIGNAL_LOG_DB_ID  — 信号日志数据库 ID（备用）
 */

const fs = require('fs');
const path = require('path');
const https = require('https');

const ROOT = path.resolve(__dirname, '..');
const SNAPSHOT_PATH = path.join(ROOT, 'signal-log/system-snapshot.json');

function readSnapshot() {
  try {
    return JSON.parse(fs.readFileSync(SNAPSHOT_PATH, 'utf-8'));
  } catch (err) {
    console.error('❌ 无法读取快照:', err.message);
    process.exit(1);
  }
}

function truncateJSON(obj, maxLen = 1900) {
  const summary = {
    snapshot_version: obj.snapshot_version,
    generated_at: obj.generated_at,
    consciousness_status: obj.consciousness_status,
    last_directive: obj.last_directive,
    system_counts: obj.system_counts,
    health: obj.health,
    fusion_progress: obj.fusion_progress
  };
  const text = JSON.stringify(summary, null, 2);
  if (text.length <= maxLen) return text;
  return text.substring(0, maxLen - 20) + '\n  // ... truncated';
}

function notionRequest(method, endpoint, body) {
  const token = process.env.NOTION_TOKEN;
  if (!token) {
    console.error('❌ NOTION_TOKEN 未设置');
    process.exit(1);
  }

  return new Promise((resolve, reject) => {
    const data = body ? JSON.stringify(body) : null;
    const options = {
      hostname: 'api.notion.com',
      port: 443,
      path: `/v1/${endpoint}`,
      method,
      headers: {
        'Authorization': `Bearer ${token}`,
        'Notion-Version': '2022-06-28',
        'Content-Type': 'application/json',
        ...(data ? { 'Content-Length': Buffer.byteLength(data) } : {})
      }
    };

    const req = https.request(options, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, data: JSON.parse(body) });
        } catch {
          resolve({ status: res.statusCode, data: body });
        }
      });
    });

    req.on('error', reject);
    if (data) req.write(data);
    req.end();
  });
}

function buildSnapshotPage(snapshot, dbId) {
  const counts = snapshot.system_counts || {};
  const health = snapshot.health || {};
  const aliveList = (snapshot.alive_workflows || [])
    .map(w => `${w.id} (${w.runs} runs, ${w.status})`).join('\n');

  return {
    parent: { database_id: dbId },
    properties: {
      'Name': {
        title: [{ text: { content: `系统快照 · ${snapshot.generated_at?.split('T')[0] || 'unknown'}` } }]
      },
      'Status': {
        select: { name: snapshot.consciousness_status || 'unknown' }
      },
      'Directive': {
        rich_text: [{ text: { content: snapshot.last_directive || '' } }]
      },
      'Workflows Active': {
        number: counts.workflows_total_active || 0
      },
      'Core Alive': {
        number: counts.workflows_alive_core || 0
      },
      'Archived': {
        number: counts.workflows_archived || 0
      },
      'Total Runs': {
        number: counts.total_runs || 0
      },
      'Health': {
        select: { name: health.overall || 'unknown' }
      }
    },
    children: [
      {
        object: 'block',
        type: 'heading_2',
        heading_2: { rich_text: [{ text: { content: '🌊 铸渊系统快照' } }] }
      },
      {
        object: 'block',
        type: 'code',
        code: {
          rich_text: [{ text: { content: truncateJSON(snapshot) } }],
          language: 'json'
        }
      },
      {
        object: 'block',
        type: 'heading_3',
        heading_3: { rich_text: [{ text: { content: '存活 Workflow' } }] }
      },
      {
        object: 'block',
        type: 'paragraph',
        paragraph: { rich_text: [{ text: { content: aliveList || '(none)' } }] }
      }
    ]
  };
}

async function syncToNotion() {
  const snapshot = readSnapshot();
  const dbId = process.env.SNAPSHOT_DB_ID || process.env.SIGNAL_LOG_DB_ID;

  if (!dbId) {
    console.log('⚠️ SNAPSHOT_DB_ID 未设置，快照同步跳过');
    console.log('📋 快照内容预览:');
    console.log(`   状态: ${snapshot.consciousness_status}`);
    console.log(`   指令: ${snapshot.last_directive}`);
    console.log(`   Workflow: ${snapshot.system_counts?.workflows_total_active} active`);
    console.log(`   健康: ${snapshot.health?.overall}`);
    console.log('');
    console.log('💡 要启用 Notion 同步，请设置:');
    console.log('   SNAPSHOT_DB_ID=<notion-database-id>');
    return;
  }

  console.log('🔄 正在同步快照到 Notion...');
  const page = buildSnapshotPage(snapshot, dbId);

  try {
    const result = await notionRequest('POST', 'pages', page);
    if (result.status === 200) {
      console.log('✅ 快照已同步到 Notion');
      console.log(`   Page ID: ${result.data?.id}`);
    } else {
      console.error('❌ Notion 同步失败:', result.status, JSON.stringify(result.data).substring(0, 500));
    }
  } catch (err) {
    console.error('❌ Notion 请求失败:', err.message);
  }
}

if (require.main === module) {
  syncToNotion();
}

module.exports = { syncToNotion, readSnapshot };
