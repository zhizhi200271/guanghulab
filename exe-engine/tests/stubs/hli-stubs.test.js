// exe-engine/tests/stubs/hli-stubs.test.js
// HLI 存根路由测试
// PRJ-EXE-001 · 501 stub coverage · AG-ZY-095 修复
// 版权：国作登字-2026-A-00037559

'use strict';

const { personaStubs } = require('../../src/router/stubs/persona-stub');
const { userStubs } = require('../../src/router/stubs/user-stub');
const { ticketStubs } = require('../../src/router/stubs/ticket-stub');
const { dialogueStubs } = require('../../src/router/stubs/dialogue-stub');
const { storageStubs } = require('../../src/router/stubs/storage-stub');
const { dashboardStubs } = require('../../src/router/stubs/dashboard-stub');

let passed = 0;
let failed = 0;

function assert(condition, message) {
  if (condition) {
    passed++;
    // eslint-disable-next-line no-console
    console.log(`  ✅ ${message}`);
  } else {
    failed++;
    // eslint-disable-next-line no-console
    console.error(`  ❌ ${message}`);
  }
}

// eslint-disable-next-line no-console
console.log('🔌 HLI 存根路由测试 · 501 Coverage Fix\n');

// 所有 14 个存根路由定义
const ALL_STUBS = [
  ...personaStubs,
  ...userStubs,
  ...ticketStubs,
  ...dialogueStubs,
  ...storageStubs,
  ...dashboardStubs
];

// 期望的路由表
const EXPECTED_ROUTES = {
  'HLI-PERSONA-001': { path: '/hli/persona/load', phase: 'P1' },
  'HLI-PERSONA-002': { path: '/hli/persona/switch', phase: 'P1' },
  'HLI-USER-001': { path: '/hli/user/profile', phase: 'P1' },
  'HLI-USER-002': { path: '/hli/user/profile/update', phase: 'P1' },
  'HLI-TICKET-001': { path: '/hli/ticket/create', phase: 'P2' },
  'HLI-TICKET-002': { path: '/hli/ticket/query', phase: 'P2' },
  'HLI-TICKET-003': { path: '/hli/ticket/status', phase: 'P2' },
  'HLI-DIALOGUE-001': { path: '/hli/dialogue/send', phase: 'P1' },
  'HLI-DIALOGUE-002': { path: '/hli/dialogue/stream', phase: 'P1' },
  'HLI-DIALOGUE-003': { path: '/hli/dialogue/history', phase: 'P1' },
  'HLI-STORAGE-001': { path: '/hli/storage/upload', phase: 'P2' },
  'HLI-STORAGE-002': { path: '/hli/storage/download', phase: 'P2' },
  'HLI-DASHBOARD-001': { path: '/hli/dashboard/status', phase: 'P3' },
  'HLI-DASHBOARD-002': { path: '/hli/dashboard/realtime', phase: 'P3' }
};

// ── 测试 1: 存根数量 ──
// eslint-disable-next-line no-console
console.log('── 测试 1: 存根数量完整性 ──');
assert(ALL_STUBS.length === 14, `14 个存根路由已注册 (实际: ${ALL_STUBS.length})`);
assert(personaStubs.length === 2, 'PERSONA 域 2 个存根');
assert(userStubs.length === 2, 'USER 域 2 个存根');
assert(ticketStubs.length === 3, 'TICKET 域 3 个存根');
assert(dialogueStubs.length === 3, 'DIALOGUE 域 3 个存根');
assert(storageStubs.length === 2, 'STORAGE 域 2 个存根');
assert(dashboardStubs.length === 2, 'DASHBOARD 域 2 个存根');

// ── 测试 2: 路由 ID 和路径匹配 ──
// eslint-disable-next-line no-console
console.log('\n── 测试 2: 路由 ID 和路径匹配 ──');
for (const stub of ALL_STUBS) {
  const expected = EXPECTED_ROUTES[stub.routeId];
  assert(expected !== undefined, `${stub.routeId} 在期望路由表中`);
  if (expected) {
    assert(stub.path === expected.path, `${stub.routeId} 路径正确: ${stub.path}`);
    assert(stub.phase === expected.phase, `${stub.routeId} 阶段正确: ${stub.phase}`);
  }
}

// ── 测试 3: 每个存根返回 501 + 正确 JSON ──
// eslint-disable-next-line no-console
console.log('\n── 测试 3: 每个存根返回 501 + 正确 JSON ──');
async function testStubResponses() {
  for (const stub of ALL_STUBS) {
    const result = await stub.handler({});
    assert(result.statusCode === 501, `${stub.routeId} 返回 501`);
    assert(result.body.status === 'not_implemented', `${stub.routeId} status = not_implemented`);
    assert(result.body.routeId === stub.routeId, `${stub.routeId} routeId 正确`);
    assert(result.body.path === stub.path, `${stub.routeId} path 正确`);
    assert(result.body.phase === stub.phase, `${stub.routeId} phase 正确`);
    assert(typeof result.body.message === 'string', `${stub.routeId} 有 message`);
    assert(result.body.message.includes(stub.phase), `${stub.routeId} message 包含目标阶段`);
  }
}

// ── 测试 4: AGE-Router 集成 ──
// eslint-disable-next-line no-console
console.log('\n── 测试 4: AGE-Router 集成 ──');
async function testRouterIntegration() {
  const { createEngine } = require('../../src/index');
  const engine = createEngine();

  // 检查 getHLIStubs 方法存在
  assert(typeof engine.router.getHLIStubs === 'function', 'router.getHLIStubs() 方法存在');

  const stubs = engine.router.getHLIStubs();
  assert(stubs.length === 14, `router 注册了 14 个存根 (实际: ${stubs.length})`);

  // 检查 handleStubRoute 方法
  assert(typeof engine.router.handleStubRoute === 'function', 'router.handleStubRoute() 方法存在');

  const result = await engine.router.handleStubRoute('/hli/persona/load');
  assert(result !== null, 'handleStubRoute 找到匹配路由');
  assert(result.statusCode === 501, 'handleStubRoute 返回 501');
  assert(result.body.routeId === 'HLI-PERSONA-001', 'handleStubRoute routeId 正确');

  const noMatch = await engine.router.handleStubRoute('/hli/nonexistent');
  assert(noMatch === null, 'handleStubRoute 不匹配返回 null');

  // 检查 getStatus 包含 hliStubs
  const status = engine.router.getStatus();
  assert(Array.isArray(status.hliStubs), 'getStatus 包含 hliStubs');
  assert(status.hliStubs.length === 14, `getStatus.hliStubs 有 14 项 (实际: ${status.hliStubs.length})`);
  assert(status.hliStubs[0].status === 'stub_501', 'hliStubs 项包含 status: stub_501');
}

async function runAll() {
  await testStubResponses();
  await testRouterIntegration();

  // eslint-disable-next-line no-console
  console.log('\n══════════════════════════════════════');
  // eslint-disable-next-line no-console
  console.log('🔌 HLI 存根路由测试完成');
  // eslint-disable-next-line no-console
  console.log(`   ✅ 通过: ${passed}`);
  // eslint-disable-next-line no-console
  console.log(`   ❌ 失败: ${failed}`);
  // eslint-disable-next-line no-console
  console.log(`   📊 总计: ${passed + failed}`);
  // eslint-disable-next-line no-console
  console.log('══════════════════════════════════════\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runAll();
