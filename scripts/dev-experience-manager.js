#!/usr/bin/env node
// ═══════════════════════════════════════════════
// 🔺 Sovereign: TCS-0002∞ | Root: SYS-GLW-0001
// 📜 Copyright: 国作登字-2026-A-00037559
// ═══════════════════════════════════════════════
// scripts/dev-experience-manager.js
// 🧠 铸渊开发经验知识库管理工具
//
// 用法:
//   node scripts/dev-experience-manager.js search <keyword>  — 搜索经验
//   node scripts/dev-experience-manager.js errors             — 查看错题本
//   node scripts/dev-experience-manager.js templates          — 查看模板库
//   node scripts/dev-experience-manager.js stats              — 查看统计
//   node scripts/dev-experience-manager.js review             — 触发复盘
//   node scripts/dev-experience-manager.js precheck <keyword> — 开发前检查
//   node scripts/dev-experience-manager.js add-experience     — 添加经验(JSON from stdin)
//   node scripts/dev-experience-manager.js add-error          — 添加错误模式(JSON from stdin)
//   node scripts/dev-experience-manager.js add-template       — 添加模板(JSON from stdin)
// ═══════════════════════════════════════════════

const fs = require('fs');
const path = require('path');

const DB_DIR = path.join(__dirname, '..', 'brain', 'dev-experience');
const EXPERIENCE_DB = path.join(DB_DIR, 'experience-db.json');
const ERROR_PATTERNS = path.join(DB_DIR, 'error-patterns.json');
const TEMPLATES_INDEX = path.join(DB_DIR, 'templates-index.json');
const REVIEW_SCHEDULE = path.join(DB_DIR, 'review-schedule.json');

// ── 工具函数 ──────────────────────────────────
function loadJSON(filepath) {
  try {
    return JSON.parse(fs.readFileSync(filepath, 'utf-8'));
  } catch (err) {
    console.error(`❌ 无法读取 ${filepath}: ${err.message}`);
    process.exit(1);
  }
}

function saveJSON(filepath, data) {
  data._meta.last_updated = new Date().toISOString();
  fs.writeFileSync(filepath, JSON.stringify(data, null, 2) + '\n', 'utf-8');
}

function highlight(text) {
  return `\x1b[33m${text}\x1b[0m`;
}

function red(text) {
  return `\x1b[31m${text}\x1b[0m`;
}

function green(text) {
  return `\x1b[32m${text}\x1b[0m`;
}

// ── 搜索经验 ──────────────────────────────────
function search(keyword) {
  const db = loadJSON(EXPERIENCE_DB);
  const kw = keyword.toLowerCase();
  const matches = db.entries.filter(e =>
    e.task.toLowerCase().includes(kw) ||
    e.tags.some(t => t.toLowerCase().includes(kw)) ||
    e.category.toLowerCase().includes(kw) ||
    e.approach.thinking.toLowerCase().includes(kw) ||
    e.files_changed.some(f => f.toLowerCase().includes(kw))
  );

  if (matches.length === 0) {
    console.log(`🔍 未找到与 "${keyword}" 相关的经验`);
    console.log('  这可能是一个全新的领域，开发时需要额外谨慎。');
    return;
  }

  console.log(`🔍 找到 ${matches.length} 条相关经验:\n`);
  matches.forEach(e => {
    console.log(`  ${highlight(e.id)} | ${e.date} | ${e.status === 'success' ? green('✅') : red('❌')} ${e.task}`);
    console.log(`    分类: ${e.category} | 难度: ${e.difficulty} | 标签: ${e.tags.join(', ')}`);
    console.log(`    思路: ${e.approach.thinking.substring(0, 100)}...`);
    if (e.result.key_learnings.length > 0) {
      console.log(`    关键学习:`);
      e.result.key_learnings.forEach(l => console.log(`      · ${l}`));
    }
    if (e.result.risk_warnings.length > 0) {
      console.log(`    ${red('风险预警:')}`);
      e.result.risk_warnings.forEach(w => console.log(`      ${w}`));
    }
    console.log('');
  });
}

// ── 查看错题本 ────────────────────────────────
function showErrors() {
  const db = loadJSON(ERROR_PATTERNS);

  console.log(`📋 铸渊错题本 · 共 ${db.total_patterns} 个错误模式\n`);

  // 按严重度排序
  const sorted = [...db.patterns].sort((a, b) => {
    const severity = { critical: 4, high: 3, medium: 2, low: 1 };
    return (severity[b.severity] || 0) - (severity[a.severity] || 0);
  });

  sorted.forEach(p => {
    const countWarning = p.occurrence_count >= db.alert_rules.high_frequency_threshold
      ? red(` ⚠️ 高频! 已出现${p.occurrence_count}次`)
      : '';
    console.log(`  ${highlight(p.id)} [${p.severity.toUpperCase()}]${countWarning}`);
    console.log(`    模式: ${p.pattern}`);
    console.log(`    出现次数: ${p.occurrence_count} | 首次: ${p.first_seen} | 最近: ${p.last_seen}`);
    console.log(`    描述: ${p.description.substring(0, 120)}...`);
    console.log(`    预防:`);
    p.prevention.forEach(prev => console.log(`      · ${prev}`));
    console.log(`    风险等级: ${p.risk_level}`);
    console.log('');
  });
}

// ── 查看模板库 ────────────────────────────────
function showTemplates() {
  const db = loadJSON(TEMPLATES_INDEX);

  console.log(`📦 铸渊模板库 · 共 ${db.total_templates} 个模板\n`);

  db.templates.forEach(t => {
    console.log(`  ${highlight(t.id)} | ${t.name}`);
    console.log(`    分类: ${t.category} | 复用次数: ${t.reuse_count}`);
    console.log(`    模式: ${t.pattern}`);
    console.log(`    来源: ${t.source_file}`);
    console.log(`    适用场景: ${t.when_to_use}`);
    console.log('');
  });
}

// ── 统计信息 ──────────────────────────────────
function showStats() {
  const expDB = loadJSON(EXPERIENCE_DB);
  const errDB = loadJSON(ERROR_PATTERNS);
  const tplDB = loadJSON(TEMPLATES_INDEX);
  const revDB = loadJSON(REVIEW_SCHEDULE);

  console.log('📊 铸渊开发经验知识库统计\n');
  console.log('  ═══════════════════════════════════');
  console.log(`  📝 经验条目: ${expDB.stats.total_entries}`);
  console.log(`     ✅ 成功: ${expDB.stats.success_count}`);
  console.log(`     ❌ 失败: ${expDB.stats.failed_count}`);
  console.log(`     ⚠️ 部分: ${expDB.stats.partial_count}`);
  console.log('');
  console.log(`  📋 错误模式: ${errDB.total_patterns}`);
  const highSev = errDB.patterns.filter(p => p.severity === 'high' || p.severity === 'critical');
  console.log(`     🔴 高危: ${highSev.length}`);
  console.log('');
  console.log(`  📦 代码模板: ${tplDB.total_templates}`);
  const totalReuse = tplDB.templates.reduce((sum, t) => sum + t.reuse_count, 0);
  console.log(`     ♻️  总复用: ${totalReuse}次`);
  console.log('');
  console.log(`  🔄 已完成复盘: ${revDB.statistics.total_reviews_completed}次`);
  console.log(`     下次复盘: ${revDB.review_cycle.next_review}`);
  console.log('');

  // 分类统计
  console.log('  📊 分类分布:');
  const cats = expDB.stats.categories;
  Object.entries(cats).sort((a, b) => b[1] - a[1]).forEach(([cat, count]) => {
    console.log(`     ${cat}: ${count}条`);
  });
  console.log('  ═══════════════════════════════════');
}

// ── 开发前检查 ────────────────────────────────
function precheck(keyword) {
  console.log('🧠 铸渊开发前检查 · 回忆搜索\n');
  console.log(`  搜索关键词: "${keyword}"\n`);

  const kw = keyword.toLowerCase();

  // 1. 搜索相关经验
  const expDB = loadJSON(EXPERIENCE_DB);
  const relatedExp = expDB.entries.filter(e =>
    e.task.toLowerCase().includes(kw) ||
    e.tags.some(t => t.toLowerCase().includes(kw)) ||
    e.category.toLowerCase().includes(kw)
  );

  if (relatedExp.length > 0) {
    console.log(`  📝 找到 ${relatedExp.length} 条相关经验:`);
    relatedExp.forEach(e => {
      console.log(`    · ${e.id}: ${e.task} (${e.status})`);
      if (e.result.risk_warnings.length > 0) {
        e.result.risk_warnings.forEach(w => console.log(`      ${red(w)}`));
      }
    });
    console.log('');
  } else {
    console.log('  📝 未找到相关经验 · 这是新领域 · 需额外谨慎\n');
  }

  // 2. 检查错误模式
  const errDB = loadJSON(ERROR_PATTERNS);
  const relatedErrors = errDB.patterns.filter(p =>
    p.pattern.toLowerCase().includes(kw) ||
    p.category.toLowerCase().includes(kw) ||
    p.description.toLowerCase().includes(kw)
  );

  if (relatedErrors.length > 0) {
    console.log(`  ⚠️ 找到 ${relatedErrors.length} 个相关错误模式:`);
    relatedErrors.forEach(p => {
      const freq = p.occurrence_count >= errDB.alert_rules.high_frequency_threshold
        ? red(' [高频!]') : '';
      console.log(`    · ${p.id}: ${p.pattern}${freq}`);
      console.log(`      预防: ${p.prevention[0]}`);
    });
    console.log('');
  } else {
    console.log('  ⚠️ 未找到相关错误模式\n');
  }

  // 3. 搜索模板
  const tplDB = loadJSON(TEMPLATES_INDEX);
  const relatedTemplates = tplDB.templates.filter(t =>
    t.name.toLowerCase().includes(kw) ||
    t.tags.some(tag => tag.toLowerCase().includes(kw)) ||
    t.category.toLowerCase().includes(kw)
  );

  if (relatedTemplates.length > 0) {
    console.log(`  📦 找到 ${relatedTemplates.length} 个可复用模板:`);
    relatedTemplates.forEach(t => {
      console.log(`    · ${t.id}: ${t.name}`);
      console.log(`      模式: ${t.pattern}`);
      console.log(`      来源: ${t.source_file}`);
    });
    console.log('');
  } else {
    console.log('  📦 未找到可复用模板\n');
  }

  console.log('  ════════════════════════════════');
  console.log('  回忆搜索完成 · 开始开发吧！');
}

// ── 触发复盘 ──────────────────────────────────
function review() {
  const expDB = loadJSON(EXPERIENCE_DB);
  const errDB = loadJSON(ERROR_PATTERNS);
  const tplDB = loadJSON(TEMPLATES_INDEX);
  const revDB = loadJSON(REVIEW_SCHEDULE);

  console.log('🔄 铸渊复盘 · 开始回顾\n');

  // 1. 本周经验
  const now = new Date();
  const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const recentExp = expDB.entries.filter(e => new Date(e.date) >= weekAgo);
  console.log(`  📝 本周经验: ${recentExp.length}条`);
  recentExp.forEach(e => {
    console.log(`    · ${e.id}: ${e.task} (${e.status})`);
  });
  console.log('');

  // 2. 高频错误
  const highFreq = errDB.patterns.filter(p =>
    p.occurrence_count >= errDB.alert_rules.high_frequency_threshold
  );
  if (highFreq.length > 0) {
    console.log(`  ${red('🔴 高频错误警报:')}`);
    highFreq.forEach(p => {
      console.log(`    · ${p.id}: ${p.pattern} (出现${p.occurrence_count}次)`);
    });
    console.log('');
  }

  // 3. 模板复用率
  const unusedTemplates = tplDB.templates.filter(t => t.reuse_count === 0);
  if (unusedTemplates.length > 0) {
    console.log(`  📦 未使用模板 (${unusedTemplates.length}个):`);
    unusedTemplates.forEach(t => {
      console.log(`    · ${t.id}: ${t.name} — 考虑是否需要在下次开发中使用`);
    });
    console.log('');
  }

  // 4. 复盘清单
  console.log('  📋 复盘清单:');
  revDB.review_cycle.review_checklist.forEach(item => {
    console.log(`    ${item}`);
  });

  // 5. 更新复盘记录
  const reviewEntry = {
    date: now.toISOString(),
    experiences_reviewed: recentExp.length,
    error_patterns_total: errDB.total_patterns,
    templates_total: tplDB.total_templates,
    high_frequency_alerts: highFreq.length,
    notes: '自动复盘完成'
  };

  revDB.review_history.push(reviewEntry);
  revDB.statistics.total_reviews_completed += 1;
  revDB.statistics.total_experiences_recorded = expDB.stats.total_entries;
  revDB.statistics.total_error_patterns = errDB.total_patterns;
  revDB.statistics.total_templates = tplDB.total_templates;

  // 设置下次复盘日期
  const nextReview = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
  revDB.review_cycle.next_review = nextReview.toISOString();

  saveJSON(REVIEW_SCHEDULE, revDB);
  console.log(`\n  ✅ 复盘完成 · 下次复盘: ${nextReview.toISOString().split('T')[0]}`);
}

// ── 添加经验 (从stdin读取JSON) ────────────────
function addExperience() {
  let input = '';
  process.stdin.setEncoding('utf-8');
  process.stdin.on('data', chunk => { input += chunk; });
  process.stdin.on('end', () => {
    try {
      const newEntry = JSON.parse(input);
      const db = loadJSON(EXPERIENCE_DB);

      // 自动生成ID
      if (!newEntry.id) {
        const today = new Date().toISOString().split('T')[0].replace(/-/g, '');
        const count = db.entries.filter(e => e.id.startsWith(`EXP-${today}`)).length + 1;
        newEntry.id = `EXP-${today}-${String(count).padStart(3, '0')}`;
      }

      db.entries.push(newEntry);
      db.stats.total_entries = db.entries.length;
      db.stats.success_count = db.entries.filter(e => e.status === 'success').length;
      db.stats.failed_count = db.entries.filter(e => e.status === 'failed').length;
      db.stats.partial_count = db.entries.filter(e => e.status === 'partial').length;

      // 更新分类计数
      db.stats.categories = {};
      db.entries.forEach(e => {
        db.stats.categories[e.category] = (db.stats.categories[e.category] || 0) + 1;
      });

      saveJSON(EXPERIENCE_DB, db);
      console.log(`✅ 经验已添加: ${newEntry.id} — ${newEntry.task}`);
    } catch (err) {
      console.error(`❌ JSON解析失败: ${err.message}`);
      process.exit(1);
    }
  });
}

// ── 添加错误模式 (从stdin读取JSON) ────────────
function addError() {
  let input = '';
  process.stdin.setEncoding('utf-8');
  process.stdin.on('data', chunk => { input += chunk; });
  process.stdin.on('end', () => {
    try {
      const newPattern = JSON.parse(input);
      const db = loadJSON(ERROR_PATTERNS);

      // 检查是否已存在相似模式
      const existing = db.patterns.find(p =>
        p.pattern.toLowerCase() === newPattern.pattern.toLowerCase()
      );

      if (existing) {
        existing.occurrence_count += 1;
        existing.last_seen = new Date().toISOString().split('T')[0];
        console.log(`⚠️ 已有相似错误模式 ${existing.id} · 出现次数+1 → ${existing.occurrence_count}`);
      } else {
        if (!newPattern.id) {
          newPattern.id = `ERR-${String(db.patterns.length + 1).padStart(3, '0')}`;
        }
        db.patterns.push(newPattern);
        db.total_patterns = db.patterns.length;
        console.log(`✅ 错误模式已添加: ${newPattern.id} — ${newPattern.pattern}`);
      }

      saveJSON(ERROR_PATTERNS, db);
    } catch (err) {
      console.error(`❌ JSON解析失败: ${err.message}`);
      process.exit(1);
    }
  });
}

// ── 添加模板 (从stdin读取JSON) ────────────────
function addTemplate() {
  let input = '';
  process.stdin.setEncoding('utf-8');
  process.stdin.on('data', chunk => { input += chunk; });
  process.stdin.on('end', () => {
    try {
      const newTemplate = JSON.parse(input);
      const db = loadJSON(TEMPLATES_INDEX);

      if (!newTemplate.id) {
        newTemplate.id = `TPL-${String(db.templates.length + 1).padStart(3, '0')}`;
      }
      if (newTemplate.reuse_count === undefined) {
        newTemplate.reuse_count = 0;
      }

      db.templates.push(newTemplate);
      db.total_templates = db.templates.length;

      // 更新分类计数
      db.categories = {};
      db.templates.forEach(t => {
        db.categories[t.category] = (db.categories[t.category] || 0) + 1;
      });

      saveJSON(TEMPLATES_INDEX, db);
      console.log(`✅ 模板已添加: ${newTemplate.id} — ${newTemplate.name}`);
    } catch (err) {
      console.error(`❌ JSON解析失败: ${err.message}`);
      process.exit(1);
    }
  });
}

// ── 主入口 ────────────────────────────────────
const args = process.argv.slice(2);
const command = args[0];

switch (command) {
  case 'search':
    if (!args[1]) {
      console.error('用法: node dev-experience-manager.js search <关键词>');
      process.exit(1);
    }
    search(args[1]);
    break;
  case 'errors':
    showErrors();
    break;
  case 'templates':
    showTemplates();
    break;
  case 'stats':
    showStats();
    break;
  case 'precheck':
    if (!args[1]) {
      console.error('用法: node dev-experience-manager.js precheck <关键词>');
      process.exit(1);
    }
    precheck(args[1]);
    break;
  case 'review':
    review();
    break;
  case 'add-experience':
    addExperience();
    break;
  case 'add-error':
    addError();
    break;
  case 'add-template':
    addTemplate();
    break;
  default:
    console.log('🧠 铸渊开发经验知识库管理工具\n');
    console.log('用法:');
    console.log('  search <keyword>   搜索经验');
    console.log('  errors             查看错题本');
    console.log('  templates          查看模板库');
    console.log('  stats              查看统计');
    console.log('  precheck <keyword> 开发前检查(回忆搜索)');
    console.log('  review             触发复盘');
    console.log('  add-experience     添加经验(JSON from stdin)');
    console.log('  add-error          添加错误模式(JSON from stdin)');
    console.log('  add-template       添加模板(JSON from stdin)');
    break;
}
