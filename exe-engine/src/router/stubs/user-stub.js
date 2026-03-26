// exe-engine/src/router/stubs/user-stub.js
// HLI 路由 · USER 域
// Phase 1 实装 — 用户资料查询与更新
// PRJ-EXE-001 · 版权：国作登字-2026-A-00037559

'use strict';

// 用户内存存储
const _userStore = new Map();

// 预加载默认用户
_userStore.set('USR-001', {
  user_id: 'USR-001',
  name: '冰朔',
  role: 'admin',
  email: 'ice@guanghulab.com',
  createdAt: '2026-01-01T00:00:00.000Z'
});
_userStore.set('USR-002', {
  user_id: 'USR-002',
  name: '测试用户',
  role: 'user',
  email: 'test@guanghulab.com',
  createdAt: '2026-03-01T00:00:00.000Z'
});

const userStubs = [
  {
    routeId: 'HLI-USER-001',
    path: '/hli/user/profile',
    phase: 'P1',
    handler: async (req) => {
      const body = req.body || req;
      const userId = body.user_id;

      if (!userId) {
        return {
          statusCode: 400,
          body: { error: true, code: 'MISSING_USER_ID', message: '缺少 user_id' }
        };
      }

      const user = _userStore.get(userId);
      if (!user) {
        return {
          statusCode: 404,
          body: { error: true, code: 'USER_NOT_FOUND', message: `用户 ${userId} 不存在` }
        };
      }

      return { statusCode: 200, body: { ...user } };
    }
  },
  {
    routeId: 'HLI-USER-002',
    path: '/hli/user/profile/update',
    phase: 'P1',
    handler: async (req) => {
      const body = req.body || req;
      const { user_id, updates } = body;

      if (!user_id) {
        return {
          statusCode: 400,
          body: { error: true, code: 'MISSING_USER_ID', message: '缺少 user_id' }
        };
      }

      // 不存在则创建
      if (!_userStore.has(user_id)) {
        _userStore.set(user_id, {
          user_id,
          name: 'Unknown',
          role: 'user',
          createdAt: new Date().toISOString()
        });
      }

      const user = _userStore.get(user_id);
      if (updates && typeof updates === 'object') {
        Object.assign(user, updates);
      }
      user.updatedAt = new Date().toISOString();

      return { statusCode: 200, body: { ...user } };
    }
  }
];

module.exports = { userStubs };
