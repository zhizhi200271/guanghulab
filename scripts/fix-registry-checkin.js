/**
 * scripts/fix-registry-checkin.js
 * 铸渊修复脚本：给所有 Agent 补上 daily_checkin_required 字段
 *
 * 根因：agent-registry.json 中 62 个 Agent 均缺少 daily_checkin_required 字段，
 * 签到系统将所有 Agent 视为需要签到，导致事件触发型 Agent 被误报为缺席。
 *
 * 修复策略：只有定时运行的核心系统 Agent 标记为 true，其余标记为 false。
 */

'use strict';

const fs = require('fs');
const path = require('path');

const REGISTRY_PATH = path.resolve(__dirname, '..', '.github/persona-brain/agent-registry.json');

const registry = JSON.parse(fs.readFileSync(REGISTRY_PATH, 'utf8'));

// 真正需要每日签到的 Agent 列表（核心系统 Agent，具备定时触发能力）
const MUST_CHECKIN = [
  'AG-ZY-004', // 冰朔主控神经系统
  'AG-ZY-007', // Bridge E · GitHub→Notion
  'AG-ZY-008', // 桥接心跳检测
  'AG-ZY-013', // Daily Maintenance
  'AG-ZY-014', // 光湖开发日报
  'AG-ZY-016', // CD 自动部署
  'AG-ZY-017', // 广播分发
  'AG-ZY-023', // 元看门狗
  'AG-ZY-026', // Heartbeat Monitor
  'AG-ZY-028', // 工单轮询
  'AG-ZY-029', // Agent 唤醒监听
  'AG-ZY-053', // 更新系统公告区
  'AG-ZY-054', // 图书馆目录更新
  'AG-ZY-058', // 每日自检
];

let fixed = 0;
registry.agents.forEach(agent => {
  if (agent.daily_checkin_required === undefined) {
    agent.daily_checkin_required = MUST_CHECKIN.includes(agent.id);
    fixed++;
  }
});

fs.writeFileSync(REGISTRY_PATH, JSON.stringify(registry, null, 2) + '\n');
console.log(`✅ 修复完成：${fixed} 个 Agent 已补上 daily_checkin_required 字段`);
console.log(`📊 需要签到: ${registry.agents.filter(a => a.daily_checkin_required).length}`);
console.log(`📊 无需签到: ${registry.agents.filter(a => !a.daily_checkin_required).length}`);
