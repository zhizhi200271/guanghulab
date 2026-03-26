// exe-engine/src/router/stubs/dialogue-stub.js
// HLI 存根路由 · DIALOGUE 域
// 501 占位 — Phase 0 骨架，P1 实现
// PRJ-EXE-001 · 版权：国作登字-2026-A-00037559

'use strict';

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

const dialogueStubs = [
  {
    routeId: 'HLI-DIALOGUE-001',
    path: '/hli/dialogue/send',
    phase: 'P1',
    handler: createStubHandler('HLI-DIALOGUE-001', '/hli/dialogue/send', 'P1')
  },
  {
    routeId: 'HLI-DIALOGUE-002',
    path: '/hli/dialogue/stream',
    phase: 'P1',
    handler: createStubHandler('HLI-DIALOGUE-002', '/hli/dialogue/stream', 'P1')
  },
  {
    routeId: 'HLI-DIALOGUE-003',
    path: '/hli/dialogue/history',
    phase: 'P1',
    handler: createStubHandler('HLI-DIALOGUE-003', '/hli/dialogue/history', 'P1')
  }
];

module.exports = { dialogueStubs, createStubHandler };
