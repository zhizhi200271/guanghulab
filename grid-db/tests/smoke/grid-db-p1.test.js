// grid-db/tests/smoke/grid-db-p1.test.js
// Grid-DB · Phase 1 冒烟测试
// PRJ-GDB-001 · Phase 1 · ZY-GDB-P1-TEST
// 版权：国作登字-2026-A-00037559

'use strict';

const path = require('path');
const fs = require('fs');
const os = require('os');

const {
  open,
  GridAPI,
  GridCell,
  WAL,
  PageManager,
  EventLog,
  BTree,
  NamespaceManager,
  RangeScanner,
  NearbyQuery,
  SecondaryIndex
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

/**
 * 创建临时测试目录
 * @param {string} suffix
 * @returns {string}
 */
function makeTempDir(suffix) {
  const { randomUUID } = require('crypto');
  const dir = path.join(os.tmpdir(), `griddb-p1-test-${suffix}-${randomUUID().slice(0, 8)}`);
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

/**
 * 递归删除目录
 * @param {string} dir
 */
function cleanDir(dir) {
  try {
    fs.rmSync(dir, { recursive: true, force: true });
  } catch {
    // 忽略清理错误
  }
}

// eslint-disable-next-line no-console
console.log('🗄️ Grid-DB Phase 1 冒烟测试\n');

// ── 测试 1: Phase 1 模块导出完整性 ──
// eslint-disable-next-line no-console
console.log('── 测试 1: Phase 1 模块导出完整性 ──');
assert(typeof BTree === 'function', 'BTree 是构造函数');
assert(typeof NamespaceManager === 'function', 'NamespaceManager 是构造函数');
assert(typeof RangeScanner === 'function', 'RangeScanner 是构造函数');
assert(typeof NearbyQuery === 'function', 'NearbyQuery 是构造函数');
assert(typeof SecondaryIndex === 'function', 'SecondaryIndex 是构造函数');

// Phase 0 模块仍然存在
assert(typeof open === 'function', 'open 仍然导出');
assert(typeof GridAPI === 'function', 'GridAPI 仍然导出');
assert(typeof GridCell === 'function', 'GridCell 仍然导出');
assert(typeof EventLog === 'function', 'EventLog 仍然导出');

// ── 测试 2: B+Tree 基础功能 ──
// eslint-disable-next-line no-console
console.log('\n── 测试 2: B+Tree 基础功能 ──');
const tree = new BTree(4); // 小阶数方便测试分裂

// 插入
tree.insert('c', 3);
tree.insert('a', 1);
tree.insert('b', 2);
tree.insert('e', 5);
tree.insert('d', 4);
assert(tree.size === 5, '插入 5 条后 size = 5');

// 查找
assert(tree.find('a') === 1, 'find("a") = 1');
assert(tree.find('c') === 3, 'find("c") = 3');
assert(tree.find('e') === 5, 'find("e") = 5');
assert(tree.find('z') === undefined, 'find("z") = undefined');

// 更新
tree.insert('a', 100);
assert(tree.find('a') === 100, '更新后 find("a") = 100');
assert(tree.size === 5, '更新不增加 size');

// 删除
const delOk = tree.delete('c');
assert(delOk === true, 'delete("c") 返回 true');
assert(tree.find('c') === undefined, '删除后 find("c") = undefined');
assert(tree.size === 4, '删除后 size = 4');

const delFail = tree.delete('z');
assert(delFail === false, 'delete 不存在的键返回 false');

// 范围查询
tree.insert('c', 3); // 重新插入
const rangeResult = tree.range('b', 'd');
assert(rangeResult.length === 3, 'range("b","d") 返回 3 条');
assert(rangeResult[0].key === 'b', 'range 第一条 key = "b"');
assert(rangeResult[1].key === 'c', 'range 第二条 key = "c"');
assert(rangeResult[2].key === 'd', 'range 第三条 key = "d"');

// 序列化 / 反序列化
const json = tree.toJSON();
assert(json.order === 4, 'toJSON 包含 order');
assert(json.entries.length === 5, 'toJSON 包含 5 个条目');

const tree2 = BTree.fromJSON(json);
assert(tree2.size === 5, 'fromJSON 还原 size = 5');
assert(tree2.find('a') === 100, 'fromJSON 还原后 find("a") = 100');
assert(tree2.find('e') === 5, 'fromJSON 还原后 find("e") = 5');

// clear
tree.clear();
assert(tree.size === 0, 'clear 后 size = 0');
assert(tree.find('a') === undefined, 'clear 后 find 返回 undefined');

// 大量插入测试分裂逻辑
const treeLarge = new BTree(4);
for (let i = 0; i < 50; i++) {
  treeLarge.insert(`key-${String(i).padStart(3, '0')}`, i);
}
assert(treeLarge.size === 50, '大量插入后 size = 50');
assert(treeLarge.find('key-025') === 25, '大量插入后查找正确');
const largeRange = treeLarge.range('key-010', 'key-019');
assert(largeRange.length === 10, '大量数据范围查询返回 10 条');

// 无效参数
let errThrown = false;
try { new BTree(1); } catch { errThrown = true; }
assert(errThrown, 'order < 3 抛出错误');

// ── 测试 3: NamespaceManager ──
// eslint-disable-next-line no-console
console.log('\n── 测试 3: NamespaceManager ──');
const nsManager = new NamespaceManager();

// 创建
const ns1 = nsManager.create('agent-zy', { desc: '铸渊代理' });
assert(ns1.name === 'agent-zy', '创建命名空间 name 正确');
assert(ns1.metadata.desc === '铸渊代理', '创建命名空间 metadata 正确');
assert(ns1.cellCount === 0, '新命名空间 cellCount = 0');
assert(typeof ns1.createdAt === 'string', '包含 createdAt');

// exists
assert(nsManager.exists('agent-zy') === true, 'exists 已存在返回 true');
assert(nsManager.exists('not-exist') === false, 'exists 不存在返回 false');

// get
const got = nsManager.get('agent-zy');
assert(got !== null, 'get 返回非 null');
assert(got.name === 'agent-zy', 'get name 正确');

// 创建多个
nsManager.create('dc-v1');
nsManager.create('exe_engine');
const all = nsManager.list();
assert(all.length === 3, 'list 返回 3 个命名空间');

// incrementCellCount / decrementCellCount
nsManager.incrementCellCount('agent-zy');
nsManager.incrementCellCount('agent-zy');
assert(nsManager.get('agent-zy').cellCount === 2, 'increment 后 cellCount = 2');

nsManager.decrementCellCount('agent-zy');
assert(nsManager.get('agent-zy').cellCount === 1, 'decrement 后 cellCount = 1');

// 删除
const delNs = nsManager.delete('dc-v1');
assert(delNs === true, 'delete 返回 true');
assert(nsManager.exists('dc-v1') === false, '删除后不存在');

const delNs2 = nsManager.delete('not-exist');
assert(delNs2 === false, 'delete 不存在返回 false');

// 验证：无效名称
errThrown = false;
try { nsManager.create(''); } catch { errThrown = true; }
assert(errThrown, '空名称抛出错误');

errThrown = false;
try { nsManager.create('invalid name!'); } catch { errThrown = true; }
assert(errThrown, '含特殊字符的名称抛出错误');

// 重复创建
errThrown = false;
try { nsManager.create('agent-zy'); } catch { errThrown = true; }
assert(errThrown, '重复创建抛出错误');

// ── 测试 4: RangeScanner ──
// eslint-disable-next-line no-console
console.log('\n── 测试 4: RangeScanner ──');
const scanDir = makeTempDir('scan');
const scanDb = open({ dataDir: scanDir });

// 插入测试数据
scanDb.put('scan-test', { gridX: 1, gridY: 1, layer: 'raw' }, { id: 'a' });
scanDb.put('scan-test', { gridX: 2, gridY: 3, layer: 'raw' }, { id: 'b' });
scanDb.put('scan-test', { gridX: 4, gridY: 2, layer: 'raw' }, { id: 'c' });
scanDb.put('scan-test', { gridX: 5, gridY: 5, layer: 'indexed' }, { id: 'd' });
scanDb.put('other-ns', { gridX: 1, gridY: 1, layer: 'raw' }, { id: 'e' });

const scanner = new RangeScanner({
  index: scanDb._index,
  pageManager: scanDb._pageManager
});

// 全命名空间扫描
const scanAll = scanner.scan('scan-test');
assert(scanAll.length === 4, 'RangeScanner 全扫描 = 4');

// X/Y 范围过滤
const scanXY = scanner.scan('scan-test', { xRange: [1, 3], yRange: [1, 3] });
assert(scanXY.length === 2, 'X/Y 范围过滤 = 2');

// 层级过滤
const scanLayer = scanner.scan('scan-test', { layer: 'indexed' });
assert(scanLayer.length === 1, 'layer 过滤 = 1');
assert(scanLayer[0].data.id === 'd', 'layer 过滤结果正确');

// 排序验证：按 gridX, gridY
const sorted = scanner.scan('scan-test');
assert(sorted[0].cell.gridX <= sorted[1].cell.gridX, '结果按 gridX 升序');

// limit
const scanLimited = scanner.scan('scan-test', { limit: 2 });
assert(scanLimited.length === 2, 'limit = 2 返回 2 条');

// offset
const scanOffset = scanner.scan('scan-test', { offset: 2 });
assert(scanOffset.length === 2, 'offset = 2 跳过 2 条');

// 命名空间隔离
const scanOther = scanner.scan('other-ns');
assert(scanOther.length === 1, '不同命名空间隔离');

scanDb.close();
cleanDir(scanDir);

// ── 测试 5: NearbyQuery ──
// eslint-disable-next-line no-console
console.log('\n── 测试 5: NearbyQuery ──');
const nearDir = makeTempDir('nearby');
const nearDb = open({ dataDir: nearDir });

nearDb.put('near-ns', { gridX: 0, gridY: 0, layer: 'raw' }, { id: 'origin' });
nearDb.put('near-ns', { gridX: 1, gridY: 1, layer: 'raw' }, { id: 'close' });
nearDb.put('near-ns', { gridX: 3, gridY: 4, layer: 'raw' }, { id: 'mid' });
nearDb.put('near-ns', { gridX: 10, gridY: 10, layer: 'raw' }, { id: 'far' });
nearDb.put('near-ns', { gridX: 2, gridY: 0, layer: 'indexed' }, { id: 'layer-diff' });

const nearQuery = new NearbyQuery({
  index: nearDb._index,
  pageManager: nearDb._pageManager
});

// 半径 2 内：(0,0)=0, (1,1)=√2≈1.414, (2,0)=2.0
const near2 = nearQuery.nearby('near-ns', 0, 0, 2);
assert(near2.length === 3, '半径 2 内 = 3 个点');
assert(near2[0].distance === 0, '最近点距离 = 0');
assert(near2[0].data.id === 'origin', '最近点是 origin');

// 半径 6 内
const near6 = nearQuery.nearby('near-ns', 0, 0, 6);
assert(near6.length === 4, '半径 6 内 = 4 个点');

// 距离排序验证
assert(near6[0].distance <= near6[1].distance, '结果按距离升序');
assert(near6[1].distance <= near6[2].distance, '第二条 ≤ 第三条');

// layer 过滤
const nearLayer = nearQuery.nearby('near-ns', 0, 0, 6, { layer: 'indexed' });
assert(nearLayer.length === 1, 'layer 过滤 = 1');
assert(nearLayer[0].data.id === 'layer-diff', 'layer 过滤结果正确');

// limit
const nearLimit = nearQuery.nearby('near-ns', 0, 0, 100, { limit: 2 });
assert(nearLimit.length === 2, 'limit = 2 返回 2 条');

// 距离正确性验证
const sqrt2 = Math.sqrt(2);
assert(Math.abs(near2[1].distance - sqrt2) < 0.001, '(1,1) 距离 = √2');

nearDb.close();
cleanDir(nearDir);

// ── 测试 6: EventLog 增强功能 ──
// eslint-disable-next-line no-console
console.log('\n── 测试 6: EventLog 增强功能 ──');
const elog = new EventLog({ maxEvents: 100 });

// 插入一些事件，带时间间隔
const t0 = new Date().toISOString();
elog.append('ns-a', 'put', 'ns-a:1:1:raw', { size: 10 });
elog.append('ns-a', 'put', 'ns-a:2:2:raw', { size: 20 });
elog.append('ns-a', 'delete', 'ns-a:1:1:raw');
elog.append('ns-b', 'put', 'ns-b:1:1:raw', { size: 30 });
elog.append('ns-b', 'scan', 'scan:ns-b', { count: 5 });

// replay — 从 t0 开始应返回所有 5 条
const replayed = elog.replay(t0);
assert(replayed.length === 5, 'replay 从 t0 返回 5 条');

// replayFromSeqNo
const fromSeq3 = elog.replayFromSeqNo(3);
assert(fromSeq3.length === 3, 'replayFromSeqNo(3) 返回 3 条');
assert(fromSeq3[0].seqNo === 3, '第一条 seqNo = 3');

// getByOperation
const puts = elog.getByOperation('put');
assert(puts.length === 3, 'getByOperation("put") = 3');

const deletes = elog.getByOperation('delete');
assert(deletes.length === 1, 'getByOperation("delete") = 1');

// getByOperation with limit
const putsLimited = elog.getByOperation('put', 2);
assert(putsLimited.length === 2, 'getByOperation 带 limit = 2');

// 天眼钩子
let tianyanReceived = null;
elog.setTianyanHook((evt) => { tianyanReceived = evt; });
elog.append('ns-a', 'put', 'ns-a:3:3:raw');
assert(tianyanReceived !== null, '天眼钩子收到事件');
assert(tianyanReceived.namespace === 'ns-a', '天眼事件 namespace 正确');
assert(tianyanReceived.operation === 'put', '天眼事件 operation 正确');

// 既有功能不受影响
const recent = elog.getRecent(3);
assert(recent.length === 3, 'getRecent 仍然正常工作');

const byNs = elog.getByNamespace('ns-b');
assert(byNs.length === 2, 'getByNamespace 仍然正常工作');

// ── 测试 7: SecondaryIndex ──
// eslint-disable-next-line no-console
console.log('\n── 测试 7: SecondaryIndex ──');
const secIdx = new SecondaryIndex('layer');

// add
secIdx.add('raw', 'ns:1:1:raw');
secIdx.add('raw', 'ns:2:2:raw');
secIdx.add('indexed', 'ns:3:3:indexed');
secIdx.add('semantic', 'ns:4:4:semantic');
assert(secIdx.size === 4, '添加 4 条后 size = 4');

// find
const rawKeys = secIdx.find('raw');
assert(rawKeys.length === 2, 'find("raw") = 2');
assert(rawKeys.includes('ns:1:1:raw'), 'find 包含 ns:1:1:raw');
assert(rawKeys.includes('ns:2:2:raw'), 'find 包含 ns:2:2:raw');

const indexedKeys = secIdx.find('indexed');
assert(indexedKeys.length === 1, 'find("indexed") = 1');

const noKeys = secIdx.find('cleaned');
assert(noKeys.length === 0, 'find 不存在值 = 空数组');

// remove
const removed = secIdx.remove('raw', 'ns:1:1:raw');
assert(removed === true, 'remove 返回 true');
assert(secIdx.size === 3, 'remove 后 size = 3');
assert(secIdx.find('raw').length === 1, 'remove 后 find("raw") = 1');

const removeFail = secIdx.remove('raw', 'not:exist');
assert(removeFail === false, 'remove 不存在的主键返回 false');

// 重复 add 不增加计数
secIdx.add('raw', 'ns:2:2:raw');
assert(secIdx.size === 3, '重复 add 不增加 size');

// range
secIdx.add('cleaned', 'ns:5:5:cleaned');
const rangeKeys = secIdx.range('indexed', 'semantic');
assert(rangeKeys.length >= 2, 'range("indexed","semantic") >= 2');
assert(rangeKeys.includes('ns:3:3:indexed'), 'range 包含 indexed 条目');
assert(rangeKeys.includes('ns:4:4:semantic'), 'range 包含 semantic 条目');

// clear
secIdx.clear();
assert(secIdx.size === 0, 'clear 后 size = 0');
assert(secIdx.find('raw').length === 0, 'clear 后 find 返回空');

// 无效参数
errThrown = false;
try { new SecondaryIndex(''); } catch { errThrown = true; }
assert(errThrown, '空 fieldName 抛出错误');

// ── 测试 8: 集成验证 — Phase 0 功能仍正常 ──
// eslint-disable-next-line no-console
console.log('\n── 测试 8: 集成验证 — Phase 0 功能仍正常 ──');
const intDir = makeTempDir('integration');
const intDb = open({ dataDir: intDir });

intDb.put('int-ns', { gridX: 1, gridY: 2, layer: 'raw' }, { val: 'hello' });
const intResult = intDb.get('int-ns', { gridX: 1, gridY: 2, layer: 'raw' });
assert(intResult !== null, 'Phase 0 put/get 仍然正常');
assert(intResult.val === 'hello', 'Phase 0 数据正确');

const intScan = intDb.scan('int-ns');
assert(intScan.length === 1, 'Phase 0 scan 仍然正常');

intDb.close();
cleanDir(intDir);

// ── 测试结果汇总 ──
// eslint-disable-next-line no-console
console.log('\n══════════════════════════════════════');
// eslint-disable-next-line no-console
console.log('🗄️ Grid-DB Phase 1 冒烟测试完成');
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
