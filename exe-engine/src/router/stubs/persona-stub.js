// exe-engine/src/router/stubs/persona-stub.js
// HLI 存根路由 · PERSONA 域
// 501 占位 — Phase 0 骨架，P1 实现
// PRJ-EXE-001 · 版权：国作登字-2026-A-00037559

'use strict';

/**
 * 创建 501 存根处理器
 * @param {string} routeId     HLI 路由 ID
 * @param {string} routePath   路由路径
 * @param {string} targetPhase 目标实现阶段
 * @returns {Function} 处理器函数
 */
function createStubHandler(routeId, routePath, targetPhase) {
  return async (req) => {
    return {
      statusCode: 501,
      body: {
        status: 'not_implemented',
        routeId,
        path: routePath,
        phase: targetPhase,
        message: `Route ${routePath} is planned for ${targetPhase}. Current: Phase 0.`
      }
    };
  };
}

const personaStubs = [
  {
    routeId: 'HLI-PERSONA-001',
    path: '/hli/persona/load',
    phase: 'P1',
    handler: createStubHandler('HLI-PERSONA-001', '/hli/persona/load', 'P1')
  },
  {
    routeId: 'HLI-PERSONA-002',
    path: '/hli/persona/switch',
    phase: 'P1',
    handler: createStubHandler('HLI-PERSONA-002', '/hli/persona/switch', 'P1')
  }
];

module.exports = { personaStubs, createStubHandler };
