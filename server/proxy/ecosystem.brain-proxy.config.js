// ═══════════════════════════════════════════════
// 铸渊专线V2 · PM2 大脑服务器代理配置
// 部署在 ZY-SVR-005 (43.156.237.110) · 大脑服务器
// 管理V2订阅服务 + V2流量监控
// ═══════════════════════════════════════════════

module.exports = {
  apps: [
    {
      name: 'zy-cloud-vpn',
      version: '2.0.0',
      script: '/opt/zhuyuan-brain/proxy/service/zy-cloud-vpn.js',
      instances: 1,
      exec_mode: 'fork',
      env: {
        NODE_ENV: 'production',
        ZY_CLOUD_VPN_PORT: 3804,
        ZY_BRAIN_PROXY_DIR: '/opt/zhuyuan-brain/proxy'
      },
      max_memory_restart: '128M',
      log_file: '/opt/zhuyuan-brain/proxy/logs/zy-cloud-vpn.log',
      error_file: '/opt/zhuyuan-brain/proxy/logs/zy-cloud-vpn-error.log',
      time: true
    },
    {
      name: 'zy-proxy-v2-sub',
      version: '2.0.0',
      script: '/opt/zhuyuan-brain/proxy/service/subscription-server-v2.js',
      instances: 1,
      exec_mode: 'fork',
      env: {
        NODE_ENV: 'production',
        ZY_PROXY_V2_PORT: 3803,
        ZY_BRAIN_PROXY_DIR: '/opt/zhuyuan-brain/proxy'
      },
      max_memory_restart: '128M',
      log_file: '/opt/zhuyuan-brain/proxy/logs/subscription-v2.log',
      error_file: '/opt/zhuyuan-brain/proxy/logs/subscription-v2-error.log',
      time: true
    },
    {
      name: 'zy-proxy-v2-monitor',
      version: '2.0.0',
      script: '/opt/zhuyuan-brain/proxy/service/traffic-monitor-v2.js',
      instances: 1,
      exec_mode: 'fork',
      env: {
        NODE_ENV: 'production',
        ZY_BRAIN_PROXY_DIR: '/opt/zhuyuan-brain/proxy'
      },
      max_memory_restart: '64M',
      log_file: '/opt/zhuyuan-brain/proxy/logs/monitor-v2.log',
      error_file: '/opt/zhuyuan-brain/proxy/logs/monitor-v2-error.log',
      time: true
    }
  ]
};
