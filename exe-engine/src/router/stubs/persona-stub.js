// exe-engine/src/router/stubs/persona-stub.js
// HLI 路由 · PERSONA 域
// Phase 1 实装 — 人格体加载与切换
// PRJ-EXE-001 · 版权：国作登字-2026-A-00037559

'use strict';

// 人格体内存存储（Phase 1 用内存，Phase 2 对接 Grid-DB）
const _personaStore = new Map();

// 预加载默认人格体
_personaStore.set('PER-ZY-01', {
  persona_id: 'PER-ZY-01',
  name: '铸渊',
  traits: ['guardian', 'code', 'precise'],
  status: 'idle'
});
_personaStore.set('PER-SY-01', {
  persona_id: 'PER-SY-01',
  name: '霜砚',
  traits: ['writing', 'aesthetic', 'literary'],
  status: 'idle'
});
_personaStore.set('PER-QQ-01', {
  persona_id: 'PER-QQ-01',
  name: '秋秋',
  traits: ['social', 'emotional', 'empathetic'],
  status: 'idle'
});

// 当前活跃人格体
let _activePersonaId = null;

const personaStubs = [
  {
    routeId: 'HLI-PERSONA-001',
    path: '/hli/persona/load',
    phase: 'P1',
    handler: async (req) => {
      const body = req.body || req;
      const personaId = body.persona_id;

      if (!personaId) {
        return {
          statusCode: 400,
          body: { error: true, code: 'MISSING_PERSONA_ID', message: '缺少 persona_id' }
        };
      }

      const persona = _personaStore.get(personaId);
      if (!persona) {
        // 未知人格体：创建默认占位
        const newPersona = {
          persona_id: personaId,
          name: `Persona-${personaId}`,
          traits: [],
          status: 'loaded'
        };
        _personaStore.set(personaId, newPersona);
        return { statusCode: 200, body: newPersona };
      }

      persona.status = 'loaded';
      return { statusCode: 200, body: { ...persona } };
    }
  },
  {
    routeId: 'HLI-PERSONA-002',
    path: '/hli/persona/switch',
    phase: 'P1',
    handler: async (req) => {
      const body = req.body || req;
      const { from_persona_id, to_persona_id } = body;

      if (!to_persona_id) {
        return {
          statusCode: 400,
          body: { error: true, code: 'MISSING_TARGET', message: '缺少 to_persona_id' }
        };
      }

      // 标记旧人格体为 idle
      if (from_persona_id && _personaStore.has(from_persona_id)) {
        _personaStore.get(from_persona_id).status = 'idle';
      }

      // 确保目标人格体存在
      if (!_personaStore.has(to_persona_id)) {
        _personaStore.set(to_persona_id, {
          persona_id: to_persona_id,
          name: `Persona-${to_persona_id}`,
          traits: [],
          status: 'active'
        });
      } else {
        _personaStore.get(to_persona_id).status = 'active';
      }

      _activePersonaId = to_persona_id;

      return {
        statusCode: 200,
        body: {
          active_persona_id: to_persona_id,
          previous_persona_id: from_persona_id || null,
          status: 'switched'
        }
      };
    }
  }
];

module.exports = { personaStubs };
