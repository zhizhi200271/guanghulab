// ═══════════════════════════════════════════════
// 铸渊专线V1 · PM2 代理服务配置
// ⚠️ [DEPRECATED · D58] V1节点已停用
// V2.0已测试通过正式启用 → ecosystem.brain-proxy.config.js
// 此文件保留作为V1历史参考
// ═══════════════════════════════════════════════

module.exports = {
  apps: [
    {
      name: 'zy-proxy-sub',
      version: '1.0.0',
      script: '/opt/zhuyuan/proxy/service/subscription-server.js',
      instances: 1,
      exec_mode: 'fork',
      env: {
        NODE_ENV: 'production',
        ZY_PROXY_SUB_PORT: 3802,
        ZY_PROXY_DATA_DIR: '/opt/zhuyuan/proxy/data',
        ZY_PROXY_KEYS_FILE: '/opt/zhuyuan/proxy/.env.keys'
      },
      max_memory_restart: '128M',
      log_file: '/opt/zhuyuan/proxy/logs/subscription.log',
      error_file: '/opt/zhuyuan/proxy/logs/subscription-error.log',
      time: true
    },
    {
      name: 'zy-proxy-monitor',
      version: '1.0.0',
      script: '/opt/zhuyuan/proxy/service/traffic-monitor.js',
      instances: 1,
      exec_mode: 'fork',
      env: {
        NODE_ENV: 'production',
        ZY_PROXY_DATA_DIR: '/opt/zhuyuan/proxy/data',
        ZY_PROXY_KEYS_FILE: '/opt/zhuyuan/proxy/.env.keys'
      },
      max_memory_restart: '64M',
      log_file: '/opt/zhuyuan/proxy/logs/monitor.log',
      error_file: '/opt/zhuyuan/proxy/logs/monitor-error.log',
      time: true
    },
    {
      name: 'zy-proxy-guardian',
      version: '1.0.0',
      script: '/opt/zhuyuan/proxy/service/proxy-guardian.js',
      instances: 1,
      exec_mode: 'fork',
      env: {
        NODE_ENV: 'production',
        ZY_PROXY_DATA_DIR: '/opt/zhuyuan/proxy/data',
        ZY_PROXY_LOG_DIR: '/opt/zhuyuan/proxy/logs',
        ZY_PROXY_KEYS_FILE: '/opt/zhuyuan/proxy/.env.keys'
      },
      max_memory_restart: '128M',
      log_file: '/opt/zhuyuan/proxy/logs/guardian.log',
      error_file: '/opt/zhuyuan/proxy/logs/guardian-error.log',
      time: true
    }
  ]
};
