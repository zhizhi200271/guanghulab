// exe-engine/src/router/stubs/ticket-stub.js
// HLI 存根路由 · TICKET 域
// 501 占位 — Phase 0 骨架，P2 实现
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

const ticketStubs = [
  {
    routeId: 'HLI-TICKET-001',
    path: '/hli/ticket/create',
    phase: 'P2',
    handler: createStubHandler('HLI-TICKET-001', '/hli/ticket/create', 'P2')
  },
  {
    routeId: 'HLI-TICKET-002',
    path: '/hli/ticket/query',
    phase: 'P2',
    handler: createStubHandler('HLI-TICKET-002', '/hli/ticket/query', 'P2')
  },
  {
    routeId: 'HLI-TICKET-003',
    path: '/hli/ticket/status',
    phase: 'P2',
    handler: createStubHandler('HLI-TICKET-003', '/hli/ticket/status', 'P2')
  }
];

module.exports = { ticketStubs, createStubHandler };
