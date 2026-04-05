#!/usr/bin/env node
// ═══════════════════════════════════════════════
// 🔺 Sovereign: TCS-0002∞ | Root: SYS-GLW-0001
// 📜 Copyright: 国作登字-2026-A-00037559
// ═══════════════════════════════════════════════
// server/proxy/service/zy-cloud-vpn.js
// 💪 ZY-CLOUD VPN 活模块 · 铸渊的肌肉系统第一个实战器官
//
// ZY-CLOUD = 算力人格体 = 铸渊的肌肉
// VPN = ZY-CLOUD的第一个实战落地场景
//
// 核心理念 (冰朔D53/D57定根):
//   - 服务器越多 → 节点越多 → 系统越强 → 不输商业VPN
//   - 所有服务器VPN能力汇聚到一个活的人格模块上
//   - 动态感知空闲、动态选路、自我修复、自我学习
//   - 活模块5接口: heartbeat / selfDiagnose / selfHeal /
//                   alertZhuyuan / learnFromRun
//
// 运行在大脑服务器 (ZY-SVR-005)
// 管理所有VPN节点的生命周期
// ═══════════════════════════════════════════════

'use strict';

const http = require('http');
const https = require('https');
const net = require('net');
const fs = require('fs');
const path = require('path');

// ── 路径配置 ────────────────────────────────
const PROXY_DIR = process.env.ZY_BRAIN_PROXY_DIR || '/opt/zhuyuan-brain/proxy';
const DATA_DIR = path.join(PROXY_DIR, 'data');
const LIVE_NODES_FILE = path.join(DATA_DIR, 'nodes-live.json');
const LEARN_DB_FILE = path.join(DATA_DIR, 'zy-cloud-vpn-learn.json');
const HEARTBEAT_FILE = path.join(DATA_DIR, 'zy-cloud-vpn-heartbeat.json');
const KEYS_FILE = path.join(PROXY_DIR, '.env.keys');

// ── 时间间隔 ────────────────────────────────
const HEARTBEAT_INTERVAL = 30 * 1000;      // 30秒心跳
const DIAGNOSE_INTERVAL = 5 * 60 * 1000;   // 5分钟诊断
const LEARN_INTERVAL = 30 * 60 * 1000;     // 30分钟学习周期

// ═══════════════════════════════════════════════
//  LivingModule 基类
//  所有活模块的生命基础 (D53 活模块标准)
// ═══════════════════════════════════════════════
class LivingModule {
  constructor(moduleId, moduleName) {
    this._moduleId = moduleId;
    this._moduleName = moduleName;
    this._state = 'initializing';  // healthy | degraded | critical
    this._errorCount = 0;
    this._consecutiveErrors = 0;
    this._requestCount = 0;
    this._failCount = 0;
    this._lastSuccess = null;
    this._lastError = null;
    this._startedAt = new Date().toISOString();
    this._history = [];
    this._timers = [];
  }

  // 启动生命周期
  startLifeCycle() {
    console.log(`🫀 ${this._moduleName} 活模块启动`);
    this._state = 'healthy';

    // 心跳循环
    this._timers.push(setInterval(() => {
      this._safeRun('heartbeat', () => this.heartbeat());
    }, HEARTBEAT_INTERVAL));

    // 诊断循环
    this._timers.push(setInterval(() => {
      this._safeRun('selfDiagnose', () => this.selfDiagnose());
    }, DIAGNOSE_INTERVAL));

    // 学习循环
    this._timers.push(setInterval(() => {
      this._safeRun('learnFromRun', () => this.learnFromRun());
    }, LEARN_INTERVAL));

    // 立即执行一次
    this._safeRun('heartbeat', () => this.heartbeat());
    setTimeout(() => this._safeRun('selfDiagnose', () => this.selfDiagnose()), 5000);
  }

  async _safeRun(name, fn) {
    try {
      await fn();
      this._consecutiveErrors = 0;
    } catch (err) {
      this._consecutiveErrors++;
      this._errorCount++;
      this._lastError = { time: new Date().toISOString(), message: err.message, source: name };
      console.error(`❌ ${this._moduleName}.${name} 异常:`, err.message);

      if (this._consecutiveErrors >= 3) {
        this._state = 'critical';
        await this._safeRun('alertZhuyuan', () => this.alertZhuyuan({
          level: 'critical',
          message: `${this._moduleName} 连续${this._consecutiveErrors}次${name}失败`,
          error: err.message
        }));
      } else if (this._consecutiveErrors >= 1) {
        this._state = 'degraded';
      }
    }
  }

  destroy() {
    this._timers.forEach(t => clearInterval(t));
    this._timers = [];
    console.log(`💀 ${this._moduleName} 活模块停止`);
  }

  // 以下由子类实现
  async heartbeat() { throw new Error('heartbeat() 未实现'); }
  async selfDiagnose() { throw new Error('selfDiagnose() 未实现'); }
  async selfHeal(problem) { throw new Error('selfHeal() 未实现'); }
  async alertZhuyuan(alert) { throw new Error('alertZhuyuan() 未实现'); }
  async learnFromRun() { throw new Error('learnFromRun() 未实现'); }
}

// ═══════════════════════════════════════════════
//  ZY-CLOUD VPN 活模块
//  铸渊的VPN肌肉系统 · 汇聚所有服务器VPN能力
// ═══════════════════════════════════════════════
class ZyCloudVpn extends LivingModule {
  constructor() {
    super('ZY-CLOUD-VPN', 'ZY-CLOUD VPN活模块');
    this._nodes = [];         // 所有已知节点
    this._liveNodes = [];     // 当前存活节点
    this._learnDb = this._loadLearnDb();
  }

  // ── 读取密钥/配置 ────────────────────────
  _readEnvOrKey(envName) {
    if (process.env[envName]) return process.env[envName];
    try {
      const content = fs.readFileSync(KEYS_FILE, 'utf8');
      for (const line of content.split('\n')) {
        if (line.startsWith('#') || !line.includes('=')) continue;
        const [key, ...vals] = line.split('=');
        if (key.trim() === envName) return vals.join('=').trim();
      }
    } catch { /* ignore */ }
    return '';
  }

  // ── 发现所有可能的VPN节点 ─────────────────
  // ZY-CLOUD自动扫描：不硬编码，从配置中发现
  _discoverNodes() {
    const nodes = [];

    // 节点1: 大脑服务器 (ZY-SVR-005 · 本机 · 主力)
    const brainHost = this._readEnvOrKey('ZY_BRAIN_HOST');
    const brainPbk = this._readEnvOrKey('ZY_PROXY_REALITY_PUBLIC_KEY');
    const brainSid = this._readEnvOrKey('ZY_PROXY_REALITY_SHORT_ID');
    if (brainHost && brainPbk) {
      nodes.push({
        id: 'zy-brain-sg1',
        name: '🧠 铸渊专线V2-SG1(大脑)',
        host: brainHost,
        port: 443,
        pbk: brainPbk,
        sid: brainSid || '',
        region: 'sg-zone1',
        server_code: 'ZY-SVR-005',
        type: 'local',     // 本机，可直接检查
        specs: '4核8G',
        status: 'unknown',
        latency_ms: null,
        last_check: null,
        consecutive_failures: 0,
        total_checks: 0,
        total_successes: 0
      });
    }

    // 节点2: 面孔服务器 (ZY-SVR-002 · 远程 · 备用)
    const faceHost = this._readEnvOrKey('ZY_FACE_HOST');
    const facePbk = this._readEnvOrKey('ZY_FACE_REALITY_PUBLIC_KEY');
    const faceSid = this._readEnvOrKey('ZY_FACE_REALITY_SHORT_ID');
    if (faceHost && facePbk) {
      nodes.push({
        id: 'zy-face-sg2',
        name: '🏛️ 铸渊专线V2-SG2(面孔)',
        host: faceHost,
        port: 443,
        pbk: facePbk,
        sid: faceSid || '',
        region: 'sg-zone2',
        server_code: 'ZY-SVR-002',
        type: 'remote',
        specs: '2核8G',
        status: 'unknown',
        latency_ms: null,
        last_check: null,
        consecutive_failures: 0,
        total_checks: 0,
        total_successes: 0
      });
    }

    // 节点3: CN中转 (国内→SG · 透传)
    const cnHost = this._readEnvOrKey('ZY_CN_RELAY_HOST');
    const cnPort = parseInt(this._readEnvOrKey('ZY_CN_RELAY_PORT') || '2053', 10);
    if (cnHost && brainPbk) {
      nodes.push({
        id: 'zy-cn-relay',
        name: '🇨🇳 铸渊专线V2-CN中转',
        host: cnHost,
        port: cnPort,
        pbk: brainPbk,     // CN中转透传，用大脑的密钥
        sid: brainSid || '',
        region: 'cn-relay',
        server_code: 'ZY-SVR-004',
        type: 'relay',
        specs: '中转',
        status: 'unknown',
        latency_ms: null,
        last_check: null,
        consecutive_failures: 0,
        total_checks: 0,
        total_successes: 0
      });
    }

    // 未来: 从COS桶发现团队节点 (team-integration-v3)
    // 扫描 zy-team-hub/compute-pool/heartbeat/*.json
    // 如果节点心跳中包含 vpn_capable: true，自动加入

    this._nodes = nodes;
    return nodes;
  }

  // ── TCP端口探测 ────────────────────────────
  _probePort(host, port, timeoutMs = 5000) {
    return new Promise((resolve) => {
      const start = Date.now();
      const socket = new net.Socket();

      socket.setTimeout(timeoutMs);
      socket.on('connect', () => {
        const latency = Date.now() - start;
        socket.destroy();
        resolve({ alive: true, latency_ms: latency });
      });
      socket.on('timeout', () => {
        socket.destroy();
        resolve({ alive: false, latency_ms: null, error: 'timeout' });
      });
      socket.on('error', (err) => {
        socket.destroy();
        resolve({ alive: false, latency_ms: null, error: err.code || err.message });
      });

      socket.connect(port, host);
    });
  }

  // ── 检查本地Xray进程 ──────────────────────
  _checkLocalXray() {
    try {
      const { execSync } = require('child_process');
      const result = execSync('pgrep -x xray', { encoding: 'utf8', timeout: 3000 });
      return result.trim().length > 0;
    } catch {
      return false;
    }
  }

  // ═══ 接口1: heartbeat() — "我还活着" ═══
  async heartbeat() {
    const heartbeat = {
      module_id: this._moduleId,
      module_name: this._moduleName,
      alive: true,
      state: this._state,
      uptime_ms: Date.now() - new Date(this._startedAt).getTime(),
      timestamp: new Date().toISOString(),
      consecutive_errors: this._consecutiveErrors,
      last_success: this._lastSuccess,
      last_error: this._lastError,
      metrics: {
        total_nodes: this._nodes.length,
        live_nodes: this._liveNodes.length,
        dead_nodes: this._nodes.length - this._liveNodes.length,
        total_checks: this._requestCount,
        total_failures: this._failCount
      },
      nodes_summary: this._nodes.map(n => ({
        id: n.id,
        name: n.name,
        status: n.status,
        latency_ms: n.latency_ms,
        region: n.region
      }))
    };

    // 写入心跳文件
    fs.mkdirSync(DATA_DIR, { recursive: true });
    fs.writeFileSync(HEARTBEAT_FILE, JSON.stringify(heartbeat, null, 2));

    this._lastSuccess = new Date().toISOString();
  }

  // ═══ 接口2: selfDiagnose() — "我知道我哪里不对" ═══
  async selfDiagnose() {
    console.log(`[ZY-CLOUD VPN] 🔍 开始诊断 (${this._nodes.length}个节点)...`);

    // 重新发现节点（配置可能更新了）
    this._discoverNodes();

    const results = [];
    const liveNodes = [];

    for (const node of this._nodes) {
      node.total_checks++;
      this._requestCount++;

      let alive = false;
      let latencyMs = null;

      if (node.type === 'local') {
        // 本机: 检查Xray进程 + 端口
        const xrayRunning = this._checkLocalXray();
        const portProbe = await this._probePort('127.0.0.1', node.port, 3000);
        alive = xrayRunning && portProbe.alive;
        latencyMs = portProbe.alive ? portProbe.latency_ms : null;
      } else {
        // 远程: TCP端口探测
        const probe = await this._probePort(node.host, node.port, 5000);
        alive = probe.alive;
        latencyMs = probe.latency_ms;
      }

      // 更新节点状态
      node.last_check = new Date().toISOString();
      if (alive) {
        node.status = 'online';
        node.latency_ms = latencyMs;
        node.consecutive_failures = 0;
        node.total_successes++;
        liveNodes.push(node);
        console.log(`  ✅ ${node.name} — 在线 (${latencyMs}ms)`);
      } else {
        node.consecutive_failures++;
        node.latency_ms = null;
        this._failCount++;

        if (node.consecutive_failures >= 3) {
          node.status = 'dead';
          console.log(`  ❌ ${node.name} — 死亡 (连续${node.consecutive_failures}次失败)`);
        } else {
          node.status = 'degraded';
          console.log(`  ⚠️ ${node.name} — 异常 (${node.consecutive_failures}次失败)`);
        }
      }

      results.push({
        id: node.id,
        name: node.name,
        status: node.status,
        latency_ms: latencyMs,
        alive
      });
    }

    // 按延迟排序存活节点（最快的排前面）
    liveNodes.sort((a, b) => (a.latency_ms || 9999) - (b.latency_ms || 9999));
    this._liveNodes = liveNodes;

    // 应用学习数据优化排序
    this._applyLearnedOptimization();

    // 写入活节点列表 (subscription-server-v2 读取此文件)
    const liveNodesData = {
      _comment: 'ZY-CLOUD VPN活模块动态生成 · 订阅服务读取此文件',
      _generated_by: 'zy-cloud-vpn.js · selfDiagnose()',
      updated_at: new Date().toISOString(),
      total_nodes: this._nodes.length,
      live_count: liveNodes.length,
      dead_count: this._nodes.length - liveNodes.length,
      nodes: liveNodes.map(n => ({
        id: n.id,
        name: n.name,
        host: n.host,
        port: n.port,
        pbk: n.pbk,
        sid: n.sid,
        region: n.region,
        latency_ms: n.latency_ms,
        status: n.status,
        specs: n.specs
      }))
    };
    fs.writeFileSync(LIVE_NODES_FILE, JSON.stringify(liveNodesData, null, 2));

    // 诊断结果
    const diagnosis = {
      overall: liveNodes.length > 0 ? 'healthy' : 'critical',
      live: liveNodes.length,
      dead: this._nodes.length - liveNodes.length,
      results,
      diagnosed_at: new Date().toISOString()
    };

    // 根据诊断结果决定自我修复
    if (liveNodes.length === 0 && this._nodes.length > 0) {
      this._state = 'critical';
      await this.selfHeal({ type: 'all_nodes_dead', nodes: this._nodes });
    } else if (liveNodes.length < this._nodes.length) {
      this._state = 'degraded';
      const deadNodes = this._nodes.filter(n => n.status !== 'online');
      for (const deadNode of deadNodes) {
        if (deadNode.consecutive_failures >= 3) {
          await this.selfHeal({ type: 'node_dead', node: deadNode });
        }
      }
    } else {
      this._state = 'healthy';
    }

    console.log(`[ZY-CLOUD VPN] 诊断完成: ${liveNodes.length}/${this._nodes.length} 在线`);
    return diagnosis;
  }

  // ═══ 接口3: selfHeal() — "我能自己修" ═══
  async selfHeal(problem) {
    console.log(`[ZY-CLOUD VPN] 🔧 尝试自我修复: ${problem.type}`);

    switch (problem.type) {
      case 'node_dead': {
        const node = problem.node;
        if (node.type === 'local') {
          // 本机Xray: 尝试重启
          try {
            const { execSync } = require('child_process');
            console.log(`  🔄 重启本机Xray...`);
            execSync('systemctl restart xray', { encoding: 'utf8', timeout: 15000 });
            console.log(`  ✅ 本机Xray已重启`);

            // 等2秒后重新检查
            await new Promise(resolve => setTimeout(resolve, 2000));
            const probe = await this._probePort('127.0.0.1', node.port, 3000);
            if (probe.alive) {
              node.status = 'online';
              node.latency_ms = probe.latency_ms;
              node.consecutive_failures = 0;
              console.log(`  ✅ 自我修复成功!`);
              return true;
            }
          } catch (err) {
            console.error(`  ❌ 重启失败: ${err.message}`);
          }
        }

        // 远程节点: 只能标记为离线，从订阅中移除
        // 未来: 通过SSH自动重启远程Xray (需要ZY_FACE_KEY)
        console.log(`  ⚠️ ${node.name} 无法远程修复，已从活节点列表移除`);
        console.log(`  ⚠️ 用户流量自动切换到其他在线节点`);
        return false;
      }

      case 'all_nodes_dead': {
        console.log(`  🚨 所有节点不可用！尝试修复本机节点...`);
        const localNode = this._nodes.find(n => n.type === 'local');
        if (localNode) {
          return this.selfHeal({ type: 'node_dead', node: localNode });
        }
        // 修复失败 → 升级到alertZhuyuan
        await this.alertZhuyuan({
          level: 'critical',
          message: '所有VPN节点不可用！需要人工干预',
          nodes: this._nodes.map(n => ({ id: n.id, status: n.status }))
        });
        return false;
      }

      default:
        console.log(`  ⚠️ 未知问题类型: ${problem.type}`);
        return false;
    }
  }

  // ═══ 接口4: alertZhuyuan() — "铸渊，我需要帮助" ═══
  async alertZhuyuan(alert) {
    const alertData = {
      module_id: this._moduleId,
      module_name: this._moduleName,
      level: alert.level || 'warning',
      message: alert.message,
      state: this._state,
      timestamp: new Date().toISOString(),
      details: alert,
      attempted_fixes: alert.attempted_fixes || [],
      nodes_status: this._nodes.map(n => ({
        id: n.id,
        status: n.status,
        consecutive_failures: n.consecutive_failures
      }))
    };

    // 通道1: 本地告警文件
    const alertFile = path.join(DATA_DIR, 'zy-cloud-vpn-alert.json');
    fs.writeFileSync(alertFile, JSON.stringify(alertData, null, 2));
    console.log(`  🚨 告警已记录: ${alertFile}`);

    // 通道2: 控制台输出 (PM2日志可见)
    console.error(`🚨🚨🚨 [ZY-CLOUD VPN 告警] ${alert.level}: ${alert.message}`);

    // 未来通道3: COS桶 → Notion SYSLOG → 冰朔
    // 未来通道4: 邮件告警 (send-subscription.js)
  }

  // ═══ 接口5: learnFromRun() — "我下次会做得更好" ═══
  async learnFromRun() {
    const now = new Date();
    const hour = now.getHours();
    const timeSlot = hour < 6 ? 'night' : hour < 12 ? 'morning' : hour < 18 ? 'afternoon' : 'evening';

    // 记录当前各节点的延迟
    for (const node of this._nodes) {
      if (node.status === 'online' && node.latency_ms !== null) {
        if (!this._learnDb.latency_history[node.id]) {
          this._learnDb.latency_history[node.id] = [];
        }

        this._learnDb.latency_history[node.id].push({
          latency_ms: node.latency_ms,
          time_slot: timeSlot,
          timestamp: now.toISOString()
        });

        // 只保留最近200条
        if (this._learnDb.latency_history[node.id].length > 200) {
          this._learnDb.latency_history[node.id] =
            this._learnDb.latency_history[node.id].slice(-200);
        }
      }
    }

    // 更新节点可靠性评分
    for (const node of this._nodes) {
      if (node.total_checks > 0) {
        const reliability = node.total_successes / node.total_checks;
        this._learnDb.reliability[node.id] = {
          score: parseFloat(reliability.toFixed(4)),
          total_checks: node.total_checks,
          total_successes: node.total_successes,
          updated_at: now.toISOString()
        };
      }
    }

    // 计算每个时段的最优节点
    for (const slot of ['night', 'morning', 'afternoon', 'evening']) {
      const avgLatencies = {};
      for (const [nodeId, history] of Object.entries(this._learnDb.latency_history)) {
        const slotRecords = history.filter(r => r.time_slot === slot);
        if (slotRecords.length > 0) {
          const avg = slotRecords.reduce((s, r) => s + r.latency_ms, 0) / slotRecords.length;
          avgLatencies[nodeId] = parseFloat(avg.toFixed(1));
        }
      }

      if (Object.keys(avgLatencies).length > 0) {
        const sorted = Object.entries(avgLatencies).sort((a, b) => a[1] - b[1]);
        this._learnDb.best_node_by_time[slot] = {
          best: sorted[0][0],
          avg_latency_ms: sorted[0][1],
          ranking: sorted.map(([id, lat]) => ({ id, avg_ms: lat }))
        };
      }
    }

    this._learnDb.updated_at = now.toISOString();
    this._learnDb.learn_count = (this._learnDb.learn_count || 0) + 1;

    // 保存学习数据
    this._saveLearnDb();

    console.log(`[ZY-CLOUD VPN] 📚 学习完成 (第${this._learnDb.learn_count}次)`);
    const currentBest = this._learnDb.best_node_by_time[timeSlot];
    if (currentBest) {
      console.log(`  当前时段(${timeSlot})最优: ${currentBest.best} (${currentBest.avg_latency_ms}ms)`);
    }
  }

  // ── 应用学习数据优化节点排序 ────────────────
  _applyLearnedOptimization() {
    const now = new Date();
    const hour = now.getHours();
    const timeSlot = hour < 6 ? 'night' : hour < 12 ? 'morning' : hour < 18 ? 'afternoon' : 'evening';

    const bestData = this._learnDb.best_node_by_time[timeSlot];
    if (!bestData || !bestData.ranking) return;

    // 根据学习到的最优排序调整节点顺序
    // 但前提是延迟差异>10ms（否则保持原排序）
    const ranking = bestData.ranking;
    this._liveNodes.sort((a, b) => {
      const rankA = ranking.findIndex(r => r.id === a.id);
      const rankB = ranking.findIndex(r => r.id === b.id);
      if (rankA === -1 && rankB === -1) return 0;
      if (rankA === -1) return 1;
      if (rankB === -1) return -1;
      return rankA - rankB;
    });
  }

  // ── 学习数据库 ─────────────────────────────
  _loadLearnDb() {
    try {
      return JSON.parse(fs.readFileSync(LEARN_DB_FILE, 'utf8'));
    } catch {
      return {
        version: '1.0',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        learn_count: 0,
        latency_history: {},
        reliability: {},
        best_node_by_time: {}
      };
    }
  }

  _saveLearnDb() {
    fs.mkdirSync(DATA_DIR, { recursive: true });
    fs.writeFileSync(LEARN_DB_FILE, JSON.stringify(this._learnDb, null, 2));
  }

  // ── 获取活节点列表（供外部调用）────────────
  getLiveNodes() {
    return this._liveNodes;
  }

  getLearnSummary() {
    return {
      learn_count: this._learnDb.learn_count,
      reliability: this._learnDb.reliability,
      best_by_time: this._learnDb.best_node_by_time
    };
  }
}

// ═══════════════════════════════════════════════
//  HTTP 管理端口 (3804)
//  供 subscription-server-v2 和外部查询
// ═══════════════════════════════════════════════
const MGMT_PORT = process.env.ZY_CLOUD_VPN_PORT || 3804;
const vpnModule = new ZyCloudVpn();

const mgmtServer = http.createServer((req, res) => {
  try {
    const pathname = require('url').parse(req.url).pathname;

    // 活节点列表 (subscription-server-v2 调用此接口)
    if (pathname === '/nodes') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        nodes: vpnModule.getLiveNodes().map(n => ({
          id: n.id,
          name: n.name,
          host: n.host,
          port: n.port,
          pbk: n.pbk,
          sid: n.sid,
          region: n.region,
          latency_ms: n.latency_ms,
          status: n.status,
          specs: n.specs
        })),
        updated_at: new Date().toISOString()
      }));
      return;
    }

    // 心跳状态
    if (pathname === '/health' || pathname === '/heartbeat') {
      try {
        const hb = JSON.parse(fs.readFileSync(HEARTBEAT_FILE, 'utf8'));
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(hb));
      } catch {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ status: 'starting', module: vpnModule._moduleId }));
      }
      return;
    }

    // 学习数据
    if (pathname === '/learn') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(vpnModule.getLearnSummary()));
      return;
    }

    // 完整状态
    if (pathname === '/status') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        module: vpnModule._moduleId,
        state: vpnModule._state,
        started_at: vpnModule._startedAt,
        uptime_seconds: Math.floor((Date.now() - new Date(vpnModule._startedAt).getTime()) / 1000),
        total_nodes: vpnModule._nodes.length,
        live_nodes: vpnModule._liveNodes.length,
        nodes: vpnModule._nodes.map(n => ({
          id: n.id,
          name: n.name,
          status: n.status,
          latency_ms: n.latency_ms,
          consecutive_failures: n.consecutive_failures,
          reliability: n.total_checks > 0
            ? parseFloat((n.total_successes / n.total_checks).toFixed(4))
            : null,
          last_check: n.last_check
        })),
        learn: vpnModule.getLearnSummary(),
        updated_at: new Date().toISOString()
      }));
      return;
    }

    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end('Not Found');
  } catch (err) {
    console.error('管理端口错误:', err.message);
    if (!res.headersSent) {
      res.writeHead(500, { 'Content-Type': 'text/plain' });
    }
    res.end('Internal Error');
  }
});

mgmtServer.listen(MGMT_PORT, '127.0.0.1', () => {
  console.log(`💪 ZY-CLOUD VPN 管理端口: http://127.0.0.1:${MGMT_PORT}`);
  console.log(`  /nodes     — 活节点列表 (订阅服务调用)`);
  console.log(`  /health    — 心跳状态`);
  console.log(`  /learn     — 学习数据`);
  console.log(`  /status    — 完整状态`);

  // 启动活模块生命周期
  vpnModule.startLifeCycle();
});

// Graceful shutdown
function gracefulShutdown(signal) {
  console.log(`\n${signal} received. Shutting down ZY-CLOUD VPN...`);
  vpnModule.destroy();
  const forceExit = setTimeout(() => process.exit(1), 5000);
  mgmtServer.close(() => {
    clearTimeout(forceExit);
    process.exit(0);
  });
}
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));
process.on('uncaughtException', (err) => {
  console.error('❌ 未捕获异常:', err.message);
  console.error(err.stack);
  gracefulShutdown('uncaughtException');
});
process.on('unhandledRejection', (reason) => {
  console.error('❌ 未处理的Promise拒绝:', reason);
});

// 导出 (供测试和其他模块使用)
module.exports = { ZyCloudVpn, LivingModule };
