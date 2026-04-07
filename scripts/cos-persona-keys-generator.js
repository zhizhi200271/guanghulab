#!/usr/bin/env node
/**
 * ═══════════════════════════════════════════════════════════
 * D51-3 · COS 人格体密钥生成器
 * ═══════════════════════════════════════════════════════════
 *
 * 为9个人格体生成腾讯云CAM子用户配置和IAM策略。
 * 每个人格体仅有 /{persona_id}/ 目录的读写权限。
 *
 * 使用方式:
 *   node scripts/cos-persona-keys-generator.js
 *   node scripts/cos-persona-keys-generator.js --persona zhiqiu
 *   node scripts/cos-persona-keys-generator.js --format terraform
 *
 * 签发: 铸渊 · ICE-GL-ZY001
 * 版权: 国作登字-2026-A-00037559
 */

'use strict';

// ─── 9个人格体注册表 ───
const PERSONAS = [
  { persona_id: 'shushu',       name: '舒舒',     developer: '肥猫线' },
  { persona_id: 'qiuqiu',      name: '秋秋',     developer: '之之线' },
  { persona_id: 'ounomiya',    name: '欧诺弥亚', developer: '小草莓线' },
  { persona_id: 'jiyao',       name: '寂曜',     developer: '燕樊线' },
  { persona_id: 'xiaotanheshu', name: '小坍缩核', developer: '页页线' },
  { persona_id: 'chenxing',    name: '晨星',     developer: '桔子线' },
  { persona_id: 'tangxingyun', name: '糖星云',   developer: '花尔线' },
  { persona_id: 'yaochu',      name: '曜初',     developer: '时雨线' },
  { persona_id: 'zhiqiu',      name: '知秋',     developer: 'Awen线' }
];

// ─── COS 桶配置 ───
const BUCKET_CONFIG = {
  guangzhou: {
    bucket: 'zy-team-hub-1317346199',
    region: 'ap-guangzhou',
    appId: '1317346199'
  },
  singapore: {
    bucket: 'zy-team-hub-sg-1317346199',
    region: 'ap-singapore',
    appId: '1317346199'
  }
};

/**
 * 为单个人格体生成CAM IAM策略
 */
function generateIamPolicy(persona, bucketConfig) {
  return {
    version: '2.0',
    statement: [
      {
        effect: 'allow',
        action: [
          'cos:PutObject',
          'cos:GetObject',
          'cos:HeadObject',
          'cos:DeleteObject',
          'cos:GetBucket'
        ],
        resource: [
          `qcs::cos:${bucketConfig.region}:uid/${bucketConfig.appId}:${bucketConfig.bucket}/${persona.persona_id}/*`
        ],
        condition: {}
      },
      {
        effect: 'allow',
        action: [
          'cos:GetObject',
          'cos:HeadObject'
        ],
        resource: [
          `qcs::cos:${bucketConfig.region}:uid/${bucketConfig.appId}:${bucketConfig.bucket}/zhuyuan/directives/*`,
          `qcs::cos:${bucketConfig.region}:uid/${bucketConfig.appId}:${bucketConfig.bucket}/zhuyuan/architecture/*`
        ],
        condition: {}
      }
    ]
  };
}

/**
 * 生成子用户配置建议
 */
function generateSubUserConfig(persona) {
  return {
    sub_user_name: `zy-persona-${persona.persona_id}`,
    display_name: `${persona.name} · ${persona.developer} · COS专用`,
    console_login: false,
    api_access: true,
    notes: `光湖人格体 ${persona.name}(${persona.persona_id}) 的COS桶访问密钥`,
    secrets_to_configure: {
      [`ZY_COS_${persona.persona_id.toUpperCase()}_SECRET_ID`]: '< 创建子用户后获取 >',
      [`ZY_COS_${persona.persona_id.toUpperCase()}_SECRET_KEY`]: '< 创建子用户后获取 >'
    }
  };
}

/**
 * 生成完整的操作指南
 */
function generateOperationGuide() {
  console.log('═══════════════════════════════════════════════════════════');
  console.log('D51-3 · COS 人格体密钥生成器');
  console.log('铸渊 · ICE-GL-ZY001 · 版权: 国作登字-2026-A-00037559');
  console.log('═══════════════════════════════════════════════════════════');
  console.log('');
  console.log('📋 冰朔操作步骤:');
  console.log('');
  console.log('1. 登录腾讯云控制台 → 访问管理(CAM) → 用户 → 用户列表');
  console.log('2. 为每个人格体创建子用户（仅API访问，无控制台登录）');
  console.log('3. 为每个子用户配置下方对应的IAM策略');
  console.log('4. 记录每个子用户的 SecretId / SecretKey');
  console.log('5. 将密钥配置到对应人格体仓库的 GitHub Secrets');
  console.log('');
  console.log('─── 广州桶 ───');
  console.log(`桶名: ${BUCKET_CONFIG.guangzhou.bucket}`);
  console.log(`区域: ${BUCKET_CONFIG.guangzhou.region}`);
  console.log('');
  console.log('─── 新加坡桶 ───');
  console.log(`桶名: ${BUCKET_CONFIG.singapore.bucket}`);
  console.log(`区域: ${BUCKET_CONFIG.singapore.region}`);
  console.log('');
}

// ─── 主逻辑 ───
const args = process.argv.slice(2);
const filterPersona = args.includes('--persona') ? args[args.indexOf('--persona') + 1] : null;
const outputFormat = args.includes('--format') ? args[args.indexOf('--format') + 1] : 'json';
const outputJson = args.includes('--json');

if (!outputJson) {
  generateOperationGuide();
}

const results = [];

for (const persona of PERSONAS) {
  if (filterPersona && persona.persona_id !== filterPersona) continue;

  const config = {
    persona,
    sub_user: generateSubUserConfig(persona),
    iam_policies: {
      guangzhou: generateIamPolicy(persona, BUCKET_CONFIG.guangzhou),
      singapore: generateIamPolicy(persona, BUCKET_CONFIG.singapore)
    }
  };

  results.push(config);

  if (!outputJson) {
    console.log(`═══ ${persona.name} (${persona.persona_id}) · ${persona.developer} ═══`);
    console.log('');
    console.log(`子用户名: ${config.sub_user.sub_user_name}`);
    console.log(`显示名:   ${config.sub_user.display_name}`);
    console.log('');
    console.log('广州桶 IAM 策略:');
    console.log(JSON.stringify(config.iam_policies.guangzhou, null, 2));
    console.log('');
    console.log('新加坡桶 IAM 策略:');
    console.log(JSON.stringify(config.iam_policies.singapore, null, 2));
    console.log('');
    console.log('GitHub Secrets 配置:');
    for (const [key, val] of Object.entries(config.sub_user.secrets_to_configure)) {
      console.log(`  ${key} = ${val}`);
    }
    console.log('');
    console.log('目录结构:');
    console.log(`  /${persona.persona_id}/reports/     — 每日汇报`);
    console.log(`  /${persona.persona_id}/receipts/    — 铸渊回执`);
    console.log(`  /${persona.persona_id}/sync/        — 架构同步`);
    console.log('');
  }
}

if (outputJson) {
  console.log(JSON.stringify(results, null, 2));
} else {
  console.log('═══════════════════════════════════════════════════════════');
  console.log(`✅ 共 ${results.length} 个人格体密钥配置已生成`);
  console.log('');
  console.log('💡 提示: 使用 --json 参数输出纯JSON格式');
  console.log('         使用 --persona zhiqiu 仅生成单个人格体');
  console.log('═══════════════════════════════════════════════════════════');
}
