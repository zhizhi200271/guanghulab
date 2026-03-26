// exe-engine/src/router/stubs/user-stub.js
// HLI 存根路由 · USER 域
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

const userStubs = [
  {
    routeId: 'HLI-USER-001',
    path: '/hli/user/profile',
    phase: 'P1',
    handler: createStubHandler('HLI-USER-001', '/hli/user/profile', 'P1')
  },
  {
    routeId: 'HLI-USER-002',
    path: '/hli/user/profile/update',
    phase: 'P1',
    handler: createStubHandler('HLI-USER-002', '/hli/user/profile/update', 'P1')
  }
];

module.exports = { userStubs, createStubHandler };
