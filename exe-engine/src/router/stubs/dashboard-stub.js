// exe-engine/src/router/stubs/dashboard-stub.js
// HLI 存根路由 · DASHBOARD 域
// 501 占位 — Phase 0 骨架，P3 实现
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

const dashboardStubs = [
  {
    routeId: 'HLI-DASHBOARD-001',
    path: '/hli/dashboard/status',
    phase: 'P3',
    handler: createStubHandler('HLI-DASHBOARD-001', '/hli/dashboard/status', 'P3')
  },
  {
    routeId: 'HLI-DASHBOARD-002',
    path: '/hli/dashboard/realtime',
    phase: 'P3',
    handler: createStubHandler('HLI-DASHBOARD-002', '/hli/dashboard/realtime', 'P3')
  }
];

module.exports = { dashboardStubs, createStubHandler };
