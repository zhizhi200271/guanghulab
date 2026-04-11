/**
 * CN LLM Relay · PM2 配置
 *
 * 编号: ZY-SVR-PM2-003
 * 服务器: ZY-SVR-003 · 43.138.243.30 · 广州
 * 守护: 铸渊 · ICE-GL-ZY001
 */
const fs = require('fs');
const path = require('path');

function loadEnvFile(filePath) {
  const env = {};
  try {
    if (fs.existsSync(filePath)) {
      const lines = fs.readFileSync(filePath, 'utf-8').split('\n');
      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('#')) continue;
        const idx = trimmed.indexOf('=');
        if (idx > 0) {
          env[trimmed.substring(0, idx).trim()] = trimmed.substring(idx + 1).trim();
        }
      }
    }
  } catch (e) {
    console.error(`加载环境变量失败: ${e.message}`);
  }
  return env;
}

const relayEnv = loadEnvFile(path.join(__dirname, '.env.relay'));

module.exports = {
  apps: [
    {
      name: 'cn-llm-relay',
      script: 'relay-server.js',
      cwd: '/opt/cn-llm-relay',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '128M',
      env: {
        NODE_ENV: 'production',
        RELAY_PORT: 3900,
        ...relayEnv
      },
      log_file: '/opt/cn-llm-relay/logs/relay-combined.log',
      error_file: '/opt/cn-llm-relay/logs/relay-error.log',
      out_file: '/opt/cn-llm-relay/logs/relay-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      merge_logs: true,
      time: true
    }
  ]
};
