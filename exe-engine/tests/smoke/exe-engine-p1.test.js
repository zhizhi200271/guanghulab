// exe-engine/tests/smoke/exe-engine-p1.test.js
// EXE-Engine · Phase 1 冒烟测试
// PRJ-EXE-001 · Phase 1 · ZY-EXE-P1
// 版权：国作登字-2026-A-00037559

'use strict';

const {
  createEngine,
  ContextManager,
  Session,
  MultiModelExecutor,
  SchedulerV2,
  MonitorDashboard,
  QwenAdapter
} = require('../../src/index');

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
console.log('🔧 EXE-Engine Phase 1 冒烟测试\n');

const engine = createEngine();

// ── 测试 1: Phase 1 模块导出 ──
// eslint-disable-next-line no-console
console.log('── 测试 1: Phase 1 模块导出 ──');
assert(typeof ContextManager === 'function', 'ContextManager 是构造函数');
assert(typeof Session === 'function', 'Session 是构造函数');
assert(typeof MultiModelExecutor === 'function', 'MultiModelExecutor 是构造函数');
assert(typeof SchedulerV2 === 'function', 'SchedulerV2 是构造函数');
assert(typeof MonitorDashboard === 'function', 'MonitorDashboard 是构造函数');
assert(engine.contextManager instanceof ContextManager, 'engine.contextManager 已创建');
assert(engine.session instanceof Session, 'engine.session 已创建');
assert(engine.multiModelExecutor instanceof MultiModelExecutor, 'engine.multiModelExecutor 已创建');
assert(engine.scheduler instanceof SchedulerV2, 'engine.scheduler 已创建');
assert(engine.monitor instanceof MonitorDashboard, 'engine.monitor 已创建');

// ── 测试 2: ContextManager ──
// eslint-disable-next-line no-console
console.log('\n── 测试 2: ContextManager 上下文管理 ──');
const cm = engine.contextManager;
const ctxId = cm.createContext('AG-ZY-01', 'sess-test-001', { repo: 'guanghulab' });
assert(typeof ctxId === 'string' && ctxId.startsWith('ctx-'), `创建上下文返回 ID: ${ctxId}`);

const ctx = cm.getContext(ctxId);
assert(ctx !== null, '获取上下文成功');
assert(ctx.agentId === 'AG-ZY-01', '上下文 agentId 正确');
assert(ctx.sessionId === 'sess-test-001', '上下文 sessionId 正确');
assert(ctx.data.repo === 'guanghulab', '上下文初始数据正确');
assert(ctx.status === 'active', '上下文初始状态为 active');
assert(Array.isArray(ctx.messages), '上下文 messages 是数组');

const updateOk = cm.updateContext(ctxId, { branch: 'main' });
assert(updateOk === true, '更新上下文成功');
assert(cm.getContext(ctxId).data.branch === 'main', '更新后数据正确');

const addMsgOk = cm.addMessage(ctxId, 'user', '你好');
assert(addMsgOk === true, '添加消息成功');
assert(cm.getContext(ctxId).messages.length === 1, '消息数量正确');
assert(cm.getContext(ctxId).messages[0].role === 'user', '消息角色正确');

const expireOk = cm.expireContext(ctxId);
assert(expireOk === true, '过期上下文成功');
assert(cm.getContext(ctxId).status === 'expired', '过期后状态正确');

const contexts = cm.listContexts('AG-ZY-01');
assert(contexts.length >= 1, 'listContexts 返回结果');

cm.setGridDBPersistence({ mock: true });
assert(cm._gridDB !== null, 'Grid-DB 预留接口设置成功');

const notFoundCtx = cm.getContext('ctx-nonexistent');
assert(notFoundCtx === null, '不存在的上下文返回 null');

// ── 测试 3: Session 会话管理 ──
// eslint-disable-next-line no-console
console.log('\n── 测试 3: Session 会话管理 ──');
const sess = engine.session;
const { sessionId, contextId } = sess.createSession('AG-ZY-01', { topic: '代码审查' });
assert(typeof sessionId === 'string' && sessionId.startsWith('sess-'), `创建会话: ${sessionId}`);
assert(typeof contextId === 'string' && contextId.startsWith('ctx-'), `关联上下文: ${contextId}`);

const sessObj = sess.getSession(sessionId);
assert(sessObj !== null, '获取会话成功');
assert(sessObj.agentId === 'AG-ZY-01', '会话 agentId 正确');
assert(sessObj.status === 'active', '会话初始状态 active');
assert(sessObj.metadata.topic === '代码审查', '会话元数据正确');

const turnOk = sess.addTurn(sessionId, '帮我看看这段代码', '代码看起来没问题');
assert(turnOk === true, '添加轮次成功');

sess.addTurn(sessionId, '还有优化建议吗', '建议使用 const 替代 let');
const history = sess.getHistory(sessionId, 1);
assert(history.length === 1, 'getHistory limit=1 返回 1 条');
assert(history[0].user === '还有优化建议吗', '历史最后一条消息正确');

const fullHistory = sess.getHistory(sessionId);
assert(fullHistory.length === 2, '完整历史 2 条');

const endOk = sess.endSession(sessionId);
assert(endOk === true, '结束会话成功');
assert(sess.getSession(sessionId).status === 'ended', '结束后状态为 ended');

const addAfterEnd = sess.addTurn(sessionId, 'test', 'test');
assert(addAfterEnd === false, '结束后不能添加轮次');

const sessions = sess.listSessions('AG-ZY-01');
assert(sessions.length >= 1, 'listSessions 返回结果');

// ── 测试 4: MultiModelExecutor ──
// eslint-disable-next-line no-console
console.log('\n── 测试 4: MultiModelExecutor 多模型执行器 ──');
const mme = engine.multiModelExecutor;
const availModels = mme.getAvailableModels();
assert(Array.isArray(availModels), 'getAvailableModels 返回数组');
assert(availModels.length === 4, `可用模型 4 个 (实际: ${availModels.length})`);
assert(availModels.includes('deepseek-v3'), '包含 deepseek-v3');
assert(availModels.includes('qwen-max'), '包含 qwen-max');

// ── 测试 5: SchedulerV2 ──
// eslint-disable-next-line no-console
console.log('\n── 测试 5: SchedulerV2 调度器 ──');
const sched = engine.scheduler;

const t1 = sched.enqueue({ agentId: 'AG-ZY-01', priority: 'high', payload: { action: 'build' } });
assert(typeof t1 === 'string', `入队高优先级任务: ${t1}`);

const t2 = sched.enqueue({ agentId: 'AG-ZY-01', priority: 'low', payload: { action: 'lint' } });
const t3 = sched.enqueue({ agentId: 'AG-SY-01', priority: 'normal', payload: { action: 'review' } });

const queue = sched.getQueue();
assert(queue.length === 3, '队列中 3 个任务');
assert(queue[0].priority === 'high', '高优先级排在前面');

const dequeued = sched.dequeue();
assert(dequeued !== null, '出队成功');
assert(dequeued.priority === 'high', '出队的是高优先级任务');

sched.complete(dequeued.taskId, { success: true });
const status = sched.getStatus();
assert(status.completed === 1, '已完成 1 个');
assert(status.pending === 2, '待处理 2 个');

// 依赖测试
const t4 = sched.enqueue({
  taskId: 'task-dep-1',
  agentId: 'AG-ZY-01',
  priority: 'high',
  dependsOn: ['task-not-done'],
  payload: { action: 'deploy' }
});
const depDequeue = sched.dequeue();
assert(depDequeue?.taskId !== 'task-dep-1', '依赖未满足的任务不出队');

// 标记失败测试
sched.fail('task-fail-test', '测试失败');
assert(sched.getStatus().failed === 1, 'fail 记录成功');

// ── 测试 6: MonitorDashboard ──
// eslint-disable-next-line no-console
console.log('\n── 测试 6: MonitorDashboard 监控仪表盘 ──');
const mon = engine.monitor;

mon.recordMetric('request_count', 1, { model: 'deepseek-v3' });
mon.recordMetric('request_count', 1, { model: 'qwen-max' });
mon.recordMetric('latency_ms', 150, { model: 'deepseek-v3' });
mon.recordMetric('latency_ms', 200, { model: 'qwen-max' });
mon.recordMetric('tokens_used', 1500, {});
mon.recordMetric('error_count', 0, {});

const reqMetrics = mon.getMetrics('request_count');
assert(reqMetrics.length === 2, '获取 request_count 指标 2 条');

const latMetrics = mon.getMetrics('latency_ms');
assert(latMetrics.length === 2, '获取 latency_ms 指标 2 条');

const snapshot = mon.getSnapshot();
assert(typeof snapshot.qps === 'number', 'snapshot 包含 qps');
assert(typeof snapshot.avgLatency === 'number', 'snapshot 包含 avgLatency');
assert(typeof snapshot.totalTokens === 'number', 'snapshot 包含 totalTokens');
assert(typeof snapshot.errorRate === 'number', 'snapshot 包含 errorRate');
assert(snapshot.totalTokens === 1500, `totalTokens = 1500 (实际: ${snapshot.totalTokens})`);
assert(snapshot.metricsCount === 6, `metricsCount = 6 (实际: ${snapshot.metricsCount})`);

mon.resetMetrics();
assert(mon.getMetrics('request_count').length === 0, 'resetMetrics 清除成功');

// ── 测试 7: HLI Persona 路由 ──
// eslint-disable-next-line no-console
console.log('\n── 测试 7: HLI Persona 路由（Phase 1 实装） ──');
(async () => {
  const loadResult = await engine.router.handleStubRoute('/hli/persona/load');
  assert(loadResult.statusCode === 200 || loadResult.statusCode === 400,
    `persona/load 返回 ${loadResult.statusCode}`);

  // 带参数调用
  const personaStubs = engine.router.getHLIStubs().filter(s => s.path === '/hli/persona/load');
  const loadHandler = personaStubs[0].handler;
  const loadRes = await loadHandler({ body: { persona_id: 'PER-ZY-01' } });
  assert(loadRes.statusCode === 200, 'persona/load 加载铸渊成功');
  assert(loadRes.body.persona_id === 'PER-ZY-01', '返回正确的 persona_id');
  assert(loadRes.body.status === 'loaded', '状态为 loaded');
  assert(loadRes.body.name === '铸渊', '人格体名称正确');

  const switchStubs = engine.router.getHLIStubs().filter(s => s.path === '/hli/persona/switch');
  const switchHandler = switchStubs[0].handler;
  const switchRes = await switchHandler({ body: { from_persona_id: 'PER-ZY-01', to_persona_id: 'PER-SY-01' } });
  assert(switchRes.statusCode === 200, 'persona/switch 切换成功');
  assert(switchRes.body.active_persona_id === 'PER-SY-01', '活跃人格体切换正确');
  assert(switchRes.body.status === 'switched', '状态为 switched');

  // ── 测试 8: HLI Dialogue 路由 ──
  // eslint-disable-next-line no-console
  console.log('\n── 测试 8: HLI Dialogue 路由（Phase 1 实装） ──');

  const dialogueStubs = engine.router.getHLIStubs();
  const sendHandler = dialogueStubs.find(s => s.path === '/hli/dialogue/send').handler;
  const sendRes = await sendHandler({ body: { session_id: 'test-sess', message: '你好', persona_id: 'PER-ZY-01' } });
  assert(sendRes.statusCode === 200, 'dialogue/send 发送成功');
  assert(typeof sendRes.body.reply === 'string', '返回 reply 字符串');
  assert(sendRes.body.session_id === 'test-sess', '返回正确的 session_id');
  assert(typeof sendRes.body.turn_id === 'string', '返回 turn_id');

  const histHandler = dialogueStubs.find(s => s.path === '/hli/dialogue/history').handler;
  const histRes = await histHandler({ body: { session_id: 'test-sess' } });
  assert(histRes.statusCode === 200, 'dialogue/history 查询成功');
  assert(Array.isArray(histRes.body.turns), '返回 turns 数组');
  assert(histRes.body.total >= 1, `历史记录 total >= 1 (实际: ${histRes.body.total})`);

  const streamHandler = dialogueStubs.find(s => s.path === '/hli/dialogue/stream').handler;
  const streamRes = await streamHandler({ body: { session_id: 'test-sess' } });
  assert(streamRes.statusCode === 200, 'dialogue/stream 返回 200');
  assert(streamRes.body.type === 'stream', 'stream 类型正确');

  // ── 测试 9: HLI User 路由 ──
  // eslint-disable-next-line no-console
  console.log('\n── 测试 9: HLI User 路由（Phase 1 实装） ──');

  const profileHandler = dialogueStubs.find(s => s.path === '/hli/user/profile').handler;
  const profileRes = await profileHandler({ body: { user_id: 'USR-001' } });
  assert(profileRes.statusCode === 200, 'user/profile 查询成功');
  assert(profileRes.body.user_id === 'USR-001', '返回正确的 user_id');
  assert(profileRes.body.name === '冰朔', '用户名正确');

  const updateHandler = dialogueStubs.find(s => s.path === '/hli/user/profile/update').handler;
  const updateRes = await updateHandler({ body: { user_id: 'USR-001', updates: { role: 'superadmin' } } });
  assert(updateRes.statusCode === 200, 'user/profile/update 更新成功');
  assert(updateRes.body.role === 'superadmin', '角色更新正确');

  const notFoundRes = await profileHandler({ body: { user_id: 'USR-NONEXIST' } });
  assert(notFoundRes.statusCode === 404, '不存在的用户返回 404');

  const newUserRes = await updateHandler({ body: { user_id: 'USR-NEW', updates: { name: '新用户' } } });
  assert(newUserRes.statusCode === 200, '更新不存在的用户自动创建');
  assert(newUserRes.body.name === '新用户', '新用户名称正确');

  // ── 测试 10: Qwen Adapter executeStream ──
  // eslint-disable-next-line no-console
  console.log('\n── 测试 10: QwenAdapter executeStream ──');
  const qwAdapter = engine.adapters.get('qwen-max');
  assert(typeof qwAdapter.executeStream === 'function', 'executeStream 方法存在');

  // 验证 _resolveModel 增强
  assert(qwAdapter._resolveModel('code_generation') === 'qwen-coder-plus-latest', '_resolveModel code_generation 正确');
  assert(qwAdapter._resolveModel('text_processing') === 'qwen-max-latest', '_resolveModel text_processing 正确');
  assert(qwAdapter._resolveModel('reasoning') === 'qwen-max', '_resolveModel reasoning 正确');

  // ── 测试结果汇总 ──
  // eslint-disable-next-line no-console
  console.log('\n══════════════════════════════════════');
  // eslint-disable-next-line no-console
  console.log(`🔧 EXE-Engine Phase 1 冒烟测试完成`);
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
})();
