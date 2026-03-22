/**
 * scripts/grid-db/write-code-check-result.js
 *
 * 代码校验结果写入 Grid-DB
 *
 * 用途：在 CI 代码校验完成后，自动向 grid-db 写入进度消息。
 * 被现有 contract-check workflow 的末尾 step 调用。
 *
 * 参数：
 * --dev-id=DEV-XXX    开发者编号
 * --result=pass|fail  校验结果
 * --files-checked=N   检查的文件数
 *
 * 守护: PER-ZY001 铸渊
 * 系统: SYS-GLW-0001
 */

const fs = require('fs');
const path = require('path');

const INBOX = path.join(__dirname, '../../grid-db/inbox');

function parseArgs() {
  const args = {};
  process.argv.slice(2).forEach(arg => {
    const [key, value] = arg.replace(/^--/, '').split('=');
    if (key && value) {
      args[key] = value;
    }
  });
  return args;
}

function getDateStr() {
  return new Date().toISOString().slice(0, 10).replace(/-/g, '');
}

function getTimeStr() {
  return new Date().toISOString().slice(11, 19).replace(/:/g, '');
}

function main() {
  const args = parseArgs();
  const devId = args['dev-id'];
  const result = args['result'] || 'unknown';
  const filesChecked = args['files-checked'] || '0';

  if (!devId || !/^DEV-\d{3}$/.test(devId)) {
    console.error('[write-code-check-result] Invalid or missing --dev-id');
    process.exit(1);
  }

  const dateStr = getDateStr();
  const timeStr = getTimeStr();
  const messageId = `${dateStr}-${timeStr}-${devId}-code-check`;

  const message = {
    schema_version: '1.0',
    message_id: messageId,
    timestamp: new Date().toISOString(),
    source: 'workflow',
    dev_id: devId,
    persona_id: 'PER-ZY001',
    type: 'progress-update',
    priority: result === 'fail' ? 'P1' : 'info',
    payload: {
      summary: `Code check ${result}: ${filesChecked} files checked for ${devId}`,
      detail: {
        result: result,
        files_checked: parseInt(filesChecked, 10),
        triggered_by: 'contract-check-workflow'
      },
      code_refs: [],
      broadcast_ref: null,
      emotion_markers: {}
    },
    context: {
      session_id: `ci-${dateStr}-${timeStr}`,
      interaction_count: 0,
      persona_state: {
        engagement_level: 'automated',
        teaching_mode: 'code-review'
      }
    }
  };

  const filename = `${messageId}.json`;
  const filePath = path.join(INBOX, filename);

  fs.writeFileSync(filePath, JSON.stringify(message, null, 2) + '\n');
  console.log(`[write-code-check-result] Written ${filename} to inbox`);
}

main();
