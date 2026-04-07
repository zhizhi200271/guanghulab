/**
 * ═══════════════════════════════════════════════════════════
 * MCP 工具 · COS 双桶操作（cosWrite / cosRead / cosDelete / cosList / cosArchive）
 *            + 人格体COS隔离路径操作（personaCosWrite / personaCosRead / personaCosList）
 * ═══════════════════════════════════════════════════════════
 *
 * 签发: 铸渊 · ICE-GL-ZY001
 * 版权: 国作登字-2026-A-00037559
 */

'use strict';

const cos = require('../cos');

async function cosWrite(input) {
  const { bucket, key, content, content_type } = input;
  return cos.write(bucket, key, content, content_type);
}

async function cosRead(input) {
  const { bucket, key } = input;
  return cos.read(bucket, key);
}

async function cosDelete(input) {
  const { bucket, key } = input;
  return cos.del(bucket, key);
}

async function cosList(input) {
  const { bucket, prefix, limit } = input;
  return cos.list(bucket, prefix, limit);
}

async function cosArchive(input) {
  const { source_key, version_tag } = input;
  return cos.archive(source_key, version_tag);
}

// ─── 人格体 COS 隔离路径操作 ───
// 每个人格体只能访问 /{persona_id}/ 目录下的对象

async function personaCosWrite(input) {
  const { persona_id, key, content, content_type } = input;
  if (!persona_id) throw new Error('缺少 persona_id');
  if (!key) throw new Error('缺少 key');
  if (!content) throw new Error('缺少 content');
  return cos.personaWrite(persona_id, key, content, content_type);
}

async function personaCosRead(input) {
  const { persona_id, key } = input;
  if (!persona_id) throw new Error('缺少 persona_id');
  if (!key) throw new Error('缺少 key');
  return cos.personaRead(persona_id, key);
}

async function personaCosList(input) {
  const { persona_id, prefix, limit } = input;
  if (!persona_id) throw new Error('缺少 persona_id');
  return cos.personaList(persona_id, prefix, limit);
}

module.exports = {
  cosWrite, cosRead, cosDelete, cosList, cosArchive,
  personaCosWrite, personaCosRead, personaCosList
};
