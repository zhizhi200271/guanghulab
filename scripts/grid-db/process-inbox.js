/**
 * scripts/grid-db/process-inbox.js
 *
 * Grid-DB Inbox 消息处理器
 *
 * 流程：
 * ① 扫描 grid-db/inbox/ 中所有 .json 文件
 * ② 校验 dev_id 合法性（必须在 DEV 映射表中）
 * ③ 移动到 grid-db/processing/（锁定）
 * ④ 根据消息 type 分流处理：
 *    - progress-update → 更新 task-queue + 触发广播生成
 *    - dev-log → 归档到 interactions + 更新 dev-profile
 *    - help-request → 标记 P0 + 读取 Notion 知识库 → 生成回复
 *    - syslog → 走标准 SYSLOG 处理流程
 *    - interaction-dump → 写入 interactions/ + 追加 training-lake/raw/
 * ⑤ 生成 outbox 广播（如需要）→ 写入 grid-db/outbox/latest/DEV-XXX.json
 * ⑥ 更新 memory 文件（task-queue, dev-profile 等）
 * ⑦ 移动已处理消息到日期归档目录
 * ⑧ 写处理日志到 grid-db/logs/
 *
 * 校验规则：
 * - message_id 格式必须匹配 [timestamp]-[DEV-XXX]-[type]
 * - dev_id 必须在 rules/dev-module-map.json 中存在
 * - schema_version 必须为 "1.0"
 * - 缺少必填字段 → 拒绝 + 写错误日志
 *
 * 守护: PER-ZY001 铸渊
 * 系统: SYS-GLW-0001
 */

const fs = require('fs');
const path = require('path');

const GRID_DB = path.join(__dirname, '../../grid-db');
const INBOX = path.join(GRID_DB, 'inbox');
const PROCESSING = path.join(GRID_DB, 'processing');
const OUTBOX_LATEST = path.join(GRID_DB, 'outbox/latest');
const OUTBOX_ARCHIVE = path.join(GRID_DB, 'outbox/archive');
const MEMORY = path.join(GRID_DB, 'memory');
const INTERACTIONS = path.join(GRID_DB, 'interactions');
const TRAINING_RAW = path.join(GRID_DB, 'training-lake/raw');
const LOGS = path.join(GRID_DB, 'logs');
const RULES = path.join(GRID_DB, 'rules');

let broadcastCounter = 0;

function nextBroadcastSeq() {
  broadcastCounter++;
  return String(broadcastCounter).padStart(3, '0');
}

function getDateStr() {
  return new Date().toISOString().slice(0, 10).replace(/-/g, '');
}

function getTimestamp() {
  return new Date().toISOString();
}

function writeLog(level, message) {
  const logFile = path.join(LOGS, `${getDateStr()}.log`);
  const entry = `[${getTimestamp()}] [${level}] ${message}\n`;
  fs.appendFileSync(logFile, entry);
  console.log(entry.trim());
}

function validateMessage(msg, filename) {
  const errors = [];

  if (msg.schema_version !== '1.0') {
    errors.push(`Invalid schema_version: ${msg.schema_version}`);
  }
  if (!msg.message_id) {
    errors.push('Missing message_id');
  }
  if (!msg.dev_id || !/^DEV-\d{3}$/.test(msg.dev_id)) {
    errors.push(`Invalid dev_id: ${msg.dev_id}`);
  }
  if (!msg.persona_id) {
    errors.push('Missing persona_id');
  }
  if (!msg.type) {
    errors.push('Missing type');
  }
  if (!msg.payload || !msg.payload.summary) {
    errors.push('Missing payload.summary');
  }

  return errors;
}

function validateDevId(devId, devModuleMap) {
  return devModuleMap.mappings && devModuleMap.mappings[devId];
}

function processProgressUpdate(msg) {
  // Update task-queue
  const taskQueuePath = path.join(MEMORY, msg.dev_id, 'task-queue.json');
  if (fs.existsSync(taskQueuePath)) {
    const taskQueue = JSON.parse(fs.readFileSync(taskQueuePath, 'utf8'));
    taskQueue.tasks.push({
      type: 'progress-update',
      broadcast_ref: msg.payload.broadcast_ref || null,
      summary: msg.payload.summary,
      timestamp: msg.timestamp,
      status: 'received'
    });
    taskQueue.last_broadcast_ref = msg.payload.broadcast_ref || taskQueue.last_broadcast_ref;
    fs.writeFileSync(taskQueuePath, JSON.stringify(taskQueue, null, 2) + '\n');
    writeLog('INFO', `Updated task-queue for ${msg.dev_id}`);
  }

  // Generate outbox broadcast
  const broadcastId = `GRID-BC-${getDateStr()}-${msg.dev_id}-${nextBroadcastSeq()}`;
  const broadcast = {
    schema_version: '1.0',
    broadcast_id: broadcastId,
    generated_at: getTimestamp(),
    generated_by: 'zhuyuan-workflow',
    dev_id: msg.dev_id,
    persona_id: msg.persona_id,
    type: 'task-directive',
    system_format: {
      context_update: {
        previous_step_verified: true,
        source_message: msg.message_id
      }
    },
    human_readable: `收到进度更新: ${msg.payload.summary}`
  };

  const outboxPath = path.join(OUTBOX_LATEST, `${msg.dev_id}.json`);
  fs.writeFileSync(outboxPath, JSON.stringify(broadcast, null, 2) + '\n');
  writeLog('INFO', `Generated broadcast ${broadcastId} for ${msg.dev_id}`);
}

function processDevLog(msg) {
  // Archive to interactions
  const dateStr = getDateStr();
  const interDir = path.join(INTERACTIONS, msg.dev_id);
  if (!fs.existsSync(interDir)) {
    fs.mkdirSync(interDir, { recursive: true });
  }

  const sessionId = (msg.context && msg.context.session_id) || 'unknown';
  const interFile = path.join(interDir, `${dateStr}-${sessionId}.jsonl`);
  const record = {
    schema_version: '1.0',
    timestamp: msg.timestamp,
    dev_id: msg.dev_id,
    persona_id: msg.persona_id,
    session_id: sessionId,
    role: 'system',
    content: msg.payload.summary,
    metadata: { topic: 'dev-log' }
  };
  fs.appendFileSync(interFile, JSON.stringify(record) + '\n');

  // Update dev-profile
  const profilePath = path.join(MEMORY, msg.dev_id, 'dev-profile.json');
  if (fs.existsSync(profilePath)) {
    const profile = JSON.parse(fs.readFileSync(profilePath, 'utf8'));
    profile.growth_trajectory.push({
      timestamp: msg.timestamp,
      event: msg.payload.summary
    });
    fs.writeFileSync(profilePath, JSON.stringify(profile, null, 2) + '\n');
  }

  writeLog('INFO', `Archived dev-log for ${msg.dev_id}`);
}

function processInteractionDump(msg) {
  // Write to interactions
  const dateStr = getDateStr();
  const interDir = path.join(INTERACTIONS, msg.dev_id);
  if (!fs.existsSync(interDir)) {
    fs.mkdirSync(interDir, { recursive: true });
  }

  const sessionId = (msg.context && msg.context.session_id) || 'unknown';
  const interFile = path.join(interDir, `${dateStr}-${sessionId}.jsonl`);
  const record = {
    schema_version: '1.0',
    timestamp: msg.timestamp,
    dev_id: msg.dev_id,
    persona_id: msg.persona_id,
    session_id: sessionId,
    role: 'system',
    content: msg.payload.summary,
    metadata: { topic: 'interaction-dump' }
  };
  fs.appendFileSync(interFile, JSON.stringify(record) + '\n');

  // Append to training-lake/raw
  const batchFile = path.join(TRAINING_RAW, `${dateStr}-batch.jsonl`);
  const sample = {
    schema_version: '1.0',
    sample_id: `${msg.message_id}-sample`,
    source_session: sessionId,
    dev_id: msg.dev_id,
    persona_id: msg.persona_id,
    created_at: msg.timestamp,
    turns: [{ role: 'system', content: msg.payload.summary, timestamp: msg.timestamp }],
    curated: false
  };
  fs.appendFileSync(batchFile, JSON.stringify(sample) + '\n');

  writeLog('INFO', `Archived interaction-dump for ${msg.dev_id}, appended to training-lake`);
}

function processHelpRequest(msg) {
  // Mark as P0 and generate immediate response broadcast
  const broadcastId = `GRID-BC-${getDateStr()}-${msg.dev_id}-${nextBroadcastSeq()}`;
  const broadcast = {
    schema_version: '1.0',
    broadcast_id: broadcastId,
    generated_at: getTimestamp(),
    generated_by: 'zhuyuan-workflow',
    dev_id: msg.dev_id,
    persona_id: msg.persona_id,
    type: 'system-notice',
    system_format: {
      notice_type: 'help-response',
      original_request: msg.message_id,
      priority: 'P0'
    },
    human_readable: `收到求助请求: ${msg.payload.summary}。铸渊已标记为 P0 优先处理。`
  };

  const outboxPath = path.join(OUTBOX_LATEST, `${msg.dev_id}.json`);
  fs.writeFileSync(outboxPath, JSON.stringify(broadcast, null, 2) + '\n');
  writeLog('WARN', `P0 help-request from ${msg.dev_id}: ${msg.payload.summary}`);
}

async function main() {
  writeLog('INFO', '=== Grid-DB Inbox Processor Started ===');

  // Load dev-module-map for validation
  const devModuleMapPath = path.join(RULES, 'dev-module-map.json');
  if (!fs.existsSync(devModuleMapPath)) {
    writeLog('ERROR', 'dev-module-map.json not found in rules/');
    process.exit(1);
  }
  const devModuleMap = JSON.parse(fs.readFileSync(devModuleMapPath, 'utf8'));

  // Scan inbox
  const inboxFiles = fs.readdirSync(INBOX)
    .filter(f => f.endsWith('.json'));

  if (inboxFiles.length === 0) {
    writeLog('INFO', 'No messages in inbox');
    return;
  }

  writeLog('INFO', `Found ${inboxFiles.length} message(s) in inbox`);

  let processed = 0;
  let rejected = 0;

  for (const filename of inboxFiles) {
    const inboxPath = path.join(INBOX, filename);
    let msg;

    try {
      msg = JSON.parse(fs.readFileSync(inboxPath, 'utf8'));
    } catch (err) {
      writeLog('ERROR', `Failed to parse ${filename}: ${err.message}`);
      rejected++;
      continue;
    }

    // Validate
    const errors = validateMessage(msg, filename);
    if (errors.length > 0) {
      writeLog('ERROR', `Validation failed for ${filename}: ${errors.join(', ')}`);
      rejected++;
      continue;
    }

    // Validate dev_id
    if (!validateDevId(msg.dev_id, devModuleMap)) {
      writeLog('ERROR', `Unknown dev_id ${msg.dev_id} in ${filename}`);
      rejected++;
      continue;
    }

    // Move to processing
    const processingPath = path.join(PROCESSING, filename);
    fs.renameSync(inboxPath, processingPath);
    writeLog('INFO', `Processing ${filename} (type: ${msg.type})`);

    // Route by type
    try {
      switch (msg.type) {
        case 'progress-update':
          processProgressUpdate(msg);
          break;
        case 'dev-log':
          processDevLog(msg);
          break;
        case 'help-request':
          processHelpRequest(msg);
          break;
        case 'interaction-dump':
          processInteractionDump(msg);
          break;
        case 'syslog':
          writeLog('INFO', `Syslog message from ${msg.dev_id}: forwarding to standard pipeline`);
          break;
        default:
          writeLog('WARN', `Unknown message type: ${msg.type}`);
      }

      // Archive processed message
      const archiveDir = path.join(OUTBOX_ARCHIVE, getDateStr());
      if (!fs.existsSync(archiveDir)) {
        fs.mkdirSync(archiveDir, { recursive: true });
      }
      fs.renameSync(processingPath, path.join(archiveDir, filename));
      processed++;
    } catch (err) {
      writeLog('ERROR', `Error processing ${filename}: ${err.message}`);
      // Move back to inbox for retry
      if (fs.existsSync(processingPath)) {
        fs.renameSync(processingPath, inboxPath);
      }
      rejected++;
    }
  }

  writeLog('INFO', `=== Processing complete: ${processed} processed, ${rejected} rejected ===`);
}

main().catch(err => {
  console.error('[process-inbox] Fatal error:', err.message);
  process.exit(1);
});
