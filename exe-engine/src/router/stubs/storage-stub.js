// exe-engine/src/router/stubs/storage-stub.js
// HLI 存根路由 · STORAGE 域
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

const storageStubs = [
  {
    routeId: 'HLI-STORAGE-001',
    path: '/hli/storage/upload',
    phase: 'P2',
    handler: createStubHandler('HLI-STORAGE-001', '/hli/storage/upload', 'P2')
  },
  {
    routeId: 'HLI-STORAGE-002',
    path: '/hli/storage/download',
    phase: 'P2',
    handler: createStubHandler('HLI-STORAGE-002', '/hli/storage/download', 'P2')
  }
];

module.exports = { storageStubs, createStubHandler };
