#!/usr/bin/env node
// ═══════════════════════════════════════════════
// 🔺 Sovereign: TCS-0002∞ | Root: SYS-GLW-0001
// 📜 Copyright: 国作登字-2026-A-00037559
// ═══════════════════════════════════════════════
// server/proxy/service/subscription-server-v2.js
// 🌐 铸渊专线V2 · 多用户订阅服务
//
// 部署在大脑服务器 (ZY-SVR-005 · 43.156.237.110)
// 每个邮箱一条独立专线，Token认证隔离
//
// 与V1的区别:
//   V1: 单UUID · 单Token · 共享线路
//   V2: 每人独立UUID · 独立Token · 独立流量统计
//
// 端口: 3803 (绑定127.0.0.1，通过Nginx反代访问)
// ═══════════════════════════════════════════════

'use strict';

const http = require('http');
const fs = require('fs');
const path = require('path');
const url = require('url');

const PORT = process.env.ZY_PROXY_V2_PORT || 3803;
const PROXY_DIR = process.env.ZY_BRAIN_PROXY_DIR || '/opt/zhuyuan-brain/proxy';
const DATA_DIR = path.join(PROXY_DIR, 'data');
const KEYS_FILE = path.join(PROXY_DIR, '.env.keys');

// 引入用户管理器
const userManager = require('./user-manager');

// ── 加载密钥 ────────────────────────────────
function loadKeys() {
  const keys = {};
  try {
    const content = fs.readFileSync(KEYS_FILE, 'utf8');
    for (const line of content.split('\n')) {
      if (line.startsWith('#') || !line.includes('=')) continue;
      const [key, ...vals] = line.split('=');
      keys[key.trim()] = vals.join('=').trim();
    }
  } catch (err) {
    keys.ZY_PROXY_REALITY_PUBLIC_KEY = process.env.ZY_PROXY_REALITY_PUBLIC_KEY || '';
    keys.ZY_PROXY_REALITY_SHORT_ID = process.env.ZY_PROXY_REALITY_SHORT_ID || '';
  }
  return keys;
}

// ── 获取服务器IP ────────────────────────────
function getServerHost() {
  if (process.env.ZY_BRAIN_HOST) return process.env.ZY_BRAIN_HOST;
  if (process.env.ZY_SERVER_HOST) return process.env.ZY_SERVER_HOST;

  try {
    const content = fs.readFileSync(KEYS_FILE, 'utf8');
    for (const line of content.split('\n')) {
      if (line.startsWith('#') || !line.includes('=')) continue;
      const [key, ...vals] = line.split('=');
      const k = key.trim();
      if (k === 'ZY_BRAIN_HOST' || k === 'ZY_SERVER_HOST') {
        const val = vals.join('=').trim();
        if (val) return val;
      }
    }
  } catch { /* ignore */ }

  return '0.0.0.0';
}

// ── 生成subscription-userinfo头 ──────────────
function generateUserInfoHeader(user) {
  const nextMonth = new Date();
  nextMonth.setMonth(nextMonth.getMonth() + 1);
  nextMonth.setDate(1);
  nextMonth.setHours(0, 0, 0, 0);

  return `upload=${user.traffic.upload_bytes}; download=${user.traffic.download_bytes}; total=${user.quota_bytes}; expire=${Math.floor(nextMonth.getTime() / 1000)}`;
}

// ── 生成VLESS URI (Shadowrocket) ─────────────
function generateVlessUri(user, keys, serverHost) {
  const params = new URLSearchParams({
    encryption: 'none',
    flow: 'xtls-rprx-vision',
    security: 'reality',
    sni: 'www.microsoft.com',
    fp: 'chrome',
    pbk: keys.ZY_PROXY_REALITY_PUBLIC_KEY,
    sid: keys.ZY_PROXY_REALITY_SHORT_ID,
    type: 'tcp',
    headerType: 'none'
  });

  const label = encodeURIComponent(`ZY-V2-${user.label}`);
  return `vless://${user.uuid}@${serverHost}:443?${params.toString()}#${label}`;
}

// ── 生成Clash YAML配置 (用户专属) ────────────
function generateClashYaml(user, keys, serverHost) {
  return `# 铸渊专线V2 · ${user.label} 的独立专线
# 自动生成 · ${new Date().toISOString()}
# ⚠️ 此配置为 ${user.email} 专属，请勿分享
# 每人一条独立线路，流量独立计算

# ── 全局设置 ──────────────────────────────
mixed-port: 7890
allow-lan: false
mode: rule
log-level: info
ipv6: false
unified-delay: true
tcp-concurrent: true
find-process-mode: strict
geodata-mode: true
geodata-loader: standard
global-client-fingerprint: chrome
keep-alive-interval: 30
external-controller: 127.0.0.1:9090

# ── GeoData 数据源 ────────────────────────
geox-url:
  geoip: "https://cdn.jsdelivr.net/gh/MetaCubeX/meta-rules-dat@release/geoip.dat"
  geosite: "https://cdn.jsdelivr.net/gh/MetaCubeX/meta-rules-dat@release/geosite.dat"
  mmdb: "https://cdn.jsdelivr.net/gh/MetaCubeX/meta-rules-dat@release/country.mmdb"

# ── DNS 设置 (fake-ip模式) ────────────────
dns:
  enable: true
  listen: 0.0.0.0:1053
  ipv6: false
  enhanced-mode: fake-ip
  fake-ip-range: 198.18.0.1/16
  fake-ip-filter:
    - "*.lan"
    - "*.local"
    - "*.direct"
    - "localhost.ptlogin2.qq.com"
    - "dns.msftncsi.com"
    - "*.msftconnecttest.com"
    - "*.msftncsi.com"
    - "+.stun.*.*"
    - "+.stun.*.*.*"
    - "lens.l.google.com"
    - "stun.l.google.com"
    - "time.*.com"
    - "time.*.gov"
    - "time.*.edu.cn"
    - "time.*.apple.com"
    - "time-ios.apple.com"
    - "time-macos.apple.com"
    - "ntp.*.com"
    - "+.pool.ntp.org"
    - "music.163.com"
    - "*.music.163.com"
    - "*.126.net"
  default-nameserver:
    - 223.5.5.5
    - 119.29.29.29
    - 1.0.0.1
  nameserver:
    - https://dns.alidns.com/dns-query
    - https://doh.pub/dns-query
  fallback:
    - https://1.0.0.1/dns-query
    - https://dns.google/dns-query
    - tls://8.8.4.4:853
  fallback-filter:
    geoip: true
    geoip-code: CN
    geosite:
      - gfw
    ipcidr:
      - 240.0.0.0/4
    domain:
      - "+.google.com"
      - "+.facebook.com"
      - "+.youtube.com"
      - "+.github.com"
      - "+.googleapis.com"
      - "+.openai.com"
      - "+.anthropic.com"

# ── 域名嗅探 ──────────────────────────────
sniffer:
  enable: true
  force-dns-mapping: true
  parse-pure-ip: true
  override-destination: true
  sniff:
    HTTP:
      ports: [80, 8080-8880]
      override-destination: true
    TLS:
      ports: [443, 8443]
    QUIC:
      ports: [443, 8443]
  skip-domain:
    - "Mijia Cloud"
    - "+.push.apple.com"

# ── 代理节点 (${user.label} 专属) ─────────
proxies:
  - name: "🏛️ 铸渊专线V2-${user.label}"
    type: vless
    server: ${serverHost}
    port: 443
    uuid: ${user.uuid}
    network: tcp
    tls: true
    udp: true
    flow: xtls-rprx-vision
    skip-cert-verify: false
    servername: www.microsoft.com
    reality-opts:
      public-key: ${keys.ZY_PROXY_REALITY_PUBLIC_KEY}
      short-id: ${keys.ZY_PROXY_REALITY_SHORT_ID}
    client-fingerprint: chrome

# ── 代理组 ────────────────────────────────
proxy-groups:
  - name: "🌐 铸渊专线"
    type: select
    proxies:
      - "🏛️ 铸渊专线V2-${user.label}"
      - DIRECT

  - name: "🤖 AI服务"
    type: select
    proxies:
      - "🏛️ 铸渊专线V2-${user.label}"

  - name: "💻 开发工具"
    type: select
    proxies:
      - "🏛️ 铸渊专线V2-${user.label}"

# ── 路由规则 ──────────────────────────────
rules:
  # AI服务
  - DOMAIN-SUFFIX,openai.com,🤖 AI服务
  - DOMAIN-SUFFIX,anthropic.com,🤖 AI服务
  - DOMAIN-SUFFIX,claude.ai,🤖 AI服务
  - DOMAIN-SUFFIX,chatgpt.com,🤖 AI服务
  - DOMAIN-SUFFIX,gemini.google.com,🤖 AI服务
  - DOMAIN-SUFFIX,perplexity.ai,🤖 AI服务
  - DOMAIN-SUFFIX,poe.com,🤖 AI服务

  # 开发工具
  - DOMAIN-SUFFIX,github.com,💻 开发工具
  - DOMAIN-SUFFIX,githubusercontent.com,💻 开发工具
  - DOMAIN-SUFFIX,github.io,💻 开发工具
  - DOMAIN-SUFFIX,githubassets.com,💻 开发工具
  - DOMAIN-SUFFIX,copilot.microsoft.com,💻 开发工具
  - DOMAIN-SUFFIX,npmjs.com,💻 开发工具
  - DOMAIN-SUFFIX,docker.com,💻 开发工具
  - DOMAIN-SUFFIX,docker.io,💻 开发工具
  - DOMAIN-SUFFIX,stackoverflow.com,💻 开发工具
  - DOMAIN-SUFFIX,pypi.org,💻 开发工具

  # 社交媒体 & 流媒体
  - DOMAIN-SUFFIX,tiktok.com,🌐 铸渊专线
  - DOMAIN-SUFFIX,twitter.com,🌐 铸渊专线
  - DOMAIN-SUFFIX,x.com,🌐 铸渊专线
  - DOMAIN-SUFFIX,youtube.com,🌐 铸渊专线
  - DOMAIN-SUFFIX,googlevideo.com,🌐 铸渊专线
  - DOMAIN-SUFFIX,google.com,🌐 铸渊专线
  - DOMAIN-SUFFIX,googleapis.com,🌐 铸渊专线
  - DOMAIN-SUFFIX,telegram.org,🌐 铸渊专线
  - DOMAIN-SUFFIX,t.me,🌐 铸渊专线
  - DOMAIN-SUFFIX,instagram.com,🌐 铸渊专线
  - DOMAIN-SUFFIX,facebook.com,🌐 铸渊专线
  - DOMAIN-SUFFIX,whatsapp.com,🌐 铸渊专线
  - DOMAIN-SUFFIX,wikipedia.org,🌐 铸渊专线
  - DOMAIN-SUFFIX,reddit.com,🌐 铸渊专线
  - DOMAIN-SUFFIX,netflix.com,🌐 铸渊专线
  - DOMAIN-SUFFIX,spotify.com,🌐 铸渊专线
  - DOMAIN-SUFFIX,discord.com,🌐 铸渊专线

  # Apple
  - DOMAIN-SUFFIX,apple.com,DIRECT
  - DOMAIN-SUFFIX,icloud.com,DIRECT

  # 国内直连
  - DOMAIN-SUFFIX,cn,DIRECT
  - DOMAIN-SUFFIX,taobao.com,DIRECT
  - DOMAIN-SUFFIX,tmall.com,DIRECT
  - DOMAIN-SUFFIX,alipay.com,DIRECT
  - DOMAIN-SUFFIX,aliyun.com,DIRECT
  - DOMAIN-SUFFIX,jd.com,DIRECT
  - DOMAIN-SUFFIX,qq.com,DIRECT
  - DOMAIN-SUFFIX,tencent.com,DIRECT
  - DOMAIN-SUFFIX,bilibili.com,DIRECT
  - DOMAIN-SUFFIX,baidu.com,DIRECT
  - DOMAIN-SUFFIX,zhihu.com,DIRECT
  - DOMAIN-SUFFIX,douyin.com,DIRECT
  - DOMAIN-SUFFIX,weibo.com,DIRECT

  # 局域网直连
  - IP-CIDR,192.168.0.0/16,DIRECT
  - IP-CIDR,10.0.0.0/8,DIRECT
  - IP-CIDR,172.16.0.0/12,DIRECT
  - IP-CIDR,127.0.0.0/8,DIRECT

  # GeoIP中国直连
  - GEOIP,CN,DIRECT

  # 默认走代理
  - MATCH,🌐 铸渊专线
`;
}

// ── 检测客户端类型 ───────────────────────────
function detectClientType(userAgent) {
  const ua = (userAgent || '').toLowerCase();
  if (ua.includes('clash') || ua.includes('mihomo') || ua.includes('stash')) return 'clash';
  if (ua.includes('shadowrocket') || ua.includes('quantumult') || ua.includes('surge')) return 'base64';
  return 'clash';
}

// ── HTTP服务器 ───────────────────────────────
const server = http.createServer((req, res) => {
  try {
    const parsedUrl = url.parse(req.url, true);
    const pathname = parsedUrl.pathname;

    // 健康检查
    if (pathname === '/health') {
      const users = userManager.getEnabledUsers();
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        status: 'ok',
        service: 'zy-proxy-v2-subscription',
        version: '2.0.0',
        users_count: users.length,
        server: 'ZY-SVR-005 · Brain'
      }));
      return;
    }

    // V2订阅端点: /sub/{token}
    // token是每个用户独立的，不会串线
    const subMatch = pathname.match(/^\/sub\/([a-f0-9]+)$/);
    if (subMatch) {
      const token = subMatch[1];
      const user = userManager.findUserByToken(token);

      if (!user) {
        res.writeHead(403, { 'Content-Type': 'text/plain' });
        res.end('Forbidden');
        return;
      }

      const keys = loadKeys();
      const serverHost = getServerHost();
      const clientType = detectClientType(req.headers['user-agent']);
      const userInfoHeader = generateUserInfoHeader(user);

      if (clientType === 'clash') {
        const yaml = generateClashYaml(user, keys, serverHost);
        res.writeHead(200, {
          'Content-Type': 'text/yaml; charset=utf-8',
          'Content-Disposition': `attachment; filename="zy-proxy-v2-${user.label}.yaml"`,
          'subscription-userinfo': userInfoHeader,
          'profile-update-interval': '6',
          'profile-title': 'base64:' + Buffer.from(`铸渊专线V2·${user.label}`).toString('base64'),
        });
        res.end(yaml);
      } else {
        const vlessUri = generateVlessUri(user, keys, serverHost);
        const encoded = Buffer.from(vlessUri).toString('base64');
        res.writeHead(200, {
          'Content-Type': 'text/plain; charset=utf-8',
          'subscription-userinfo': userInfoHeader,
          'profile-update-interval': '6',
        });
        res.end(encoded);
      }
      return;
    }

    // 用户配额查询: /quota/{token}
    const quotaMatch = pathname.match(/^\/quota\/([a-f0-9]+)$/);
    if (quotaMatch) {
      const token = quotaMatch[1];
      const user = userManager.findUserByToken(token);

      if (!user) {
        res.writeHead(403, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: true, code: 'FORBIDDEN', message: '认证失败' }));
        return;
      }

      const totalGB = user.quota_bytes / (1024 ** 3);
      const usedGB = (user.traffic.upload_bytes + user.traffic.download_bytes) / (1024 ** 3);

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        email: user.email,
        label: user.label,
        total_gb: parseFloat(totalGB.toFixed(1)),
        used_gb: parseFloat(usedGB.toFixed(2)),
        remaining_gb: parseFloat((totalGB - usedGB).toFixed(2)),
        percentage_used: parseFloat(((usedGB / totalGB) * 100).toFixed(1)),
        period: user.traffic.period,
        updated_at: new Date().toISOString()
      }));
      return;
    }

    // 用户状态: /status/{token}
    const statusMatch = pathname.match(/^\/status\/([a-f0-9]+)$/);
    if (statusMatch) {
      const token = statusMatch[1];
      const user = userManager.findUserByToken(token);

      if (!user) {
        res.writeHead(403, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: true, code: 'FORBIDDEN', message: '认证失败' }));
        return;
      }

      const totalGB = user.quota_bytes / (1024 ** 3);
      const usedGB = (user.traffic.upload_bytes + user.traffic.download_bytes) / (1024 ** 3);
      const serverHost = getServerHost();

      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({
        user: {
          email: user.email,
          label: user.label,
          enabled: user.enabled
        },
        server: {
          status: 'online',
          version: '2.0.0',
          uptime_seconds: Math.floor(process.uptime()),
          region: 'sg',
          region_name: 'Singapore Zone 1',
          server_code: 'ZY-SVR-005'
        },
        node: {
          id: 'zy-brain-direct',
          name: `🏛️ 铸渊专线V2-${user.label}`,
          server: serverHost,
          port: 443,
          protocol: 'vless',
          security: 'reality'
        },
        quota: {
          total_gb: parseFloat(totalGB.toFixed(1)),
          used_gb: parseFloat(usedGB.toFixed(2)),
          remaining_gb: parseFloat((totalGB - usedGB).toFixed(2)),
          percentage_used: parseFloat(((usedGB / totalGB) * 100).toFixed(1)),
          period: user.traffic.period
        },
        updated_at: new Date().toISOString()
      }));
      return;
    }

    // 404
    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end('Not Found');
  } catch (err) {
    console.error('❌ 请求处理错误 [%s %s]:', req.method, req.url, err.message || err);
    try {
      if (!res.headersSent) {
        res.writeHead(500, { 'Content-Type': 'text/plain' });
      }
      res.end('Internal Server Error');
    } catch (writeErr) {
      console.error('  ⚠️ 响应写入失败:', writeErr.message);
    }
  }
});

server.on('error', (err) => {
  console.error('❌ 服务器错误:', err.message);
  if (err.code === 'EADDRINUSE') {
    console.error('  端口 %d 已被占用', PORT);
    process.exit(1);
  }
});

server.on('clientError', (err, socket) => {
  console.error('⚠️ 客户端连接错误:', err.code || err.message);
  if (socket.writable) {
    socket.end('HTTP/1.1 400 Bad Request\r\n\r\n');
  }
});

server.listen(PORT, '127.0.0.1', () => {
  const users = userManager.getEnabledUsers();
  console.log(`🌐 铸渊专线V2订阅服务已启动: http://127.0.0.1:${PORT}`);
  console.log(`  版本:    V2.0 (多用户独立专线)`);
  console.log(`  用户数:  ${users.length}`);
  console.log(`  服务器:  ZY-SVR-005 · Brain`);
  console.log(`  ──────────────────────────`);
  console.log(`  订阅端点: /sub/{user_token}`);
  console.log(`  配额查询: /quota/{user_token}`);
  console.log(`  服务状态: /status/{user_token}`);
  console.log(`  健康检查: /health`);
});

// Graceful shutdown
function gracefulShutdown(signal) {
  console.log(`\n${signal} received. Shutting down gracefully...`);
  const forceExit = setTimeout(() => { process.exit(1); }, 5000);
  server.close(() => {
    clearTimeout(forceExit);
    console.log('Server closed.');
    process.exit(0);
  });
}
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

process.on('uncaughtException', (err) => {
  console.error('❌ 未捕获的异常:', err.message);
  console.error(err.stack);
  gracefulShutdown('uncaughtException');
});
process.on('unhandledRejection', (reason) => {
  console.error('❌ 未处理的Promise拒绝:', reason);
});
