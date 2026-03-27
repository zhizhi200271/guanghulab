#!/usr/bin/env node
/**
 * 🔮 铸渊配额治理引擎 · Quota Governance Engine
 *
 * 精细化管理 GitHub Actions 配额消耗。
 * 分析所有工作流的 cron 触发频率，计算日/月消耗预算，
 * 提供优化建议和降频策略。
 *
 * 用法:
 *   node scripts/quota-governance.js                — 完整配额分析报告
 *   node scripts/quota-governance.js --json         — 输出 JSON 格式
 *   node scripts/quota-governance.js --optimize     — 生成优化建议
 *
 * 守护: PER-ZY001 铸渊 · ICE-GL-ZY001
 * 版权: 国作登字-2026-A-00037559
 */

'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const WORKFLOWS_DIR = path.join(ROOT, '.github', 'workflows');
const REPORT_PATH = path.join(ROOT, 'signal-log', 'quota-governance-report.json');

// ═══════════════════════════════════════════════════════
// GitHub Plans — 配额参数
// ═══════════════════════════════════════════════════════

const PLANS = {
  free: {
    name: 'GitHub Free',
    price_yearly: 0,
    actions_minutes_monthly: 2000,
    copilot_included: false,
    copilot_completions_monthly: 0,
    copilot_chat_monthly: 0,
    copilot_agent_sessions: 0,
  },
  pro: {
    name: 'GitHub Pro ($4/month billed yearly = $48/year)',
    price_yearly: 48,
    actions_minutes_monthly: 3000,
    copilot_included: false,
    copilot_completions_monthly: 0,
    copilot_chat_monthly: 0,
    copilot_agent_sessions: 0,
  },
  copilot_individual: {
    name: 'Copilot Individual ($100/year)',
    price_yearly: 100,
    actions_minutes_monthly: 2000,
    copilot_included: true,
    copilot_completions_monthly: 2000,
    copilot_chat_monthly: 50,
    copilot_premium_requests_monthly: 0,
    copilot_agent_sessions: 'limited',
    note: '冰朔当前套餐',
  },
  copilot_pro: {
    name: 'Copilot Pro ($390/year = $39/month)',
    price_yearly: 390,
    actions_minutes_monthly: 2000,
    copilot_included: true,
    copilot_completions_monthly: 'unlimited',
    copilot_chat_monthly: 'unlimited',
    copilot_premium_requests_monthly: 1500,
    copilot_agent_sessions: 'unlimited',
    note: '冰朔考虑升级目标',
  },
};

// ═══════════════════════════════════════════════════════
// Cron 解析器 — 计算每日触发次数
// ═══════════════════════════════════════════════════════

function parseCronRunsPerDay(cronExpr) {
  const parts = cronExpr.trim().split(/\s+/);
  if (parts.length !== 5) return 0;
  const [minute, hour, , , dow] = parts;

  let runsPerDay = 1;

  // 分钟级间隔 */N (e.g. */15 * * * *)
  if (minute.startsWith('*/')) {
    const interval = parseInt(minute.split('/')[1], 10);
    if (interval > 0) runsPerDay = Math.floor(1440 / interval);
  }
  // 小时级间隔 */N (e.g. 0 */6 * * *)
  else if (hour.startsWith('*/')) {
    const interval = parseInt(hour.split('/')[1], 10);
    if (interval > 0) runsPerDay = Math.floor(24 / interval);
  }
  // 每小时运行 (e.g. 0 * * * * = minute固定, hour=*)
  else if (hour === '*' && !minute.includes(',') && !minute.startsWith('*/')) {
    runsPerDay = 24;
  }
  // 小时列表 0,6,12,18
  else if (hour.includes(',')) {
    runsPerDay = hour.split(',').length;
  }
  // 分钟列表
  else if (minute.includes(',') && !hour.includes(',')) {
    runsPerDay = minute.split(',').length;
  }

  // 周几限制
  if (dow !== '*' && dow !== '?') {
    const days = dow.split(',').length;
    runsPerDay = runsPerDay * days / 7;
  }

  return runsPerDay;
}

// ═══════════════════════════════════════════════════════
// 工作流扫描器 — 分析所有工作流触发模式
// ═══════════════════════════════════════════════════════

function scanWorkflows() {
  const files = fs.readdirSync(WORKFLOWS_DIR).filter(f => f.endsWith('.yml'));
  const workflows = [];

  for (const file of files) {
    const content = fs.readFileSync(path.join(WORKFLOWS_DIR, file), 'utf8');

    // Extract name
    const nameMatch = content.match(/^name:\s*['"]?(.+?)['"]?\s*$/m);
    const name = nameMatch ? nameMatch[1] : file;

    // Extract cron schedules
    const cronMatches = [...content.matchAll(/cron:\s*'([^']+)'/g)];
    const crons = cronMatches.map(m => m[1]);

    // Extract other triggers
    const hasPush = /^\s+push:/m.test(content);
    const hasPR = /pull_request/m.test(content);
    const hasDispatch = /workflow_dispatch/m.test(content);
    const hasWorkflowRun = /workflow_run/m.test(content);

    // Calculate daily runs from cron
    let dailyCronRuns = 0;
    for (const cron of crons) {
      dailyCronRuns += parseCronRunsPerDay(cron);
    }

    // Estimate average minutes per run (based on typical duration)
    const estimatedMinutesPerRun = estimateRunDuration(file, content);

    workflows.push({
      file,
      name,
      crons,
      dailyCronRuns,
      hasPush,
      hasPR,
      hasDispatch,
      hasWorkflowRun,
      estimatedMinutesPerRun,
      dailyMinutes: dailyCronRuns * estimatedMinutesPerRun,
      monthlyMinutes: dailyCronRuns * estimatedMinutesPerRun * 30,
      triggers: [
        ...(crons.length > 0 ? ['schedule'] : []),
        ...(hasPush ? ['push'] : []),
        ...(hasPR ? ['pull_request'] : []),
        ...(hasDispatch ? ['workflow_dispatch'] : []),
        ...(hasWorkflowRun ? ['workflow_run'] : []),
      ],
    });
  }

  // Sort by daily consumption
  workflows.sort((a, b) => b.dailyMinutes - a.dailyMinutes);
  return workflows;
}

function estimateRunDuration(file, content) {
  // Heuristic estimation of run duration in minutes
  if (file.includes('deploy') || file.includes('build')) return 5;
  if (file.includes('scan') || file.includes('inspection')) return 3;
  if (file.includes('sync') || file.includes('bridge')) return 2;
  if (file.includes('poll') || file.includes('listener') || file.includes('heartbeat')) return 1;
  if (file.includes('checkin') || file.includes('selfcheck')) return 1;
  if (content.includes('npm install') || content.includes('npm ci')) return 4;
  return 2; // default
}

// ═══════════════════════════════════════════════════════
// 配额分析引擎
// ═══════════════════════════════════════════════════════

function analyzeQuota(workflows) {
  const currentPlan = PLANS.copilot_individual;

  const totalDailyCronRuns = workflows.reduce((sum, w) => sum + w.dailyCronRuns, 0);
  const totalDailyMinutes = workflows.reduce((sum, w) => sum + w.dailyMinutes, 0);
  const totalMonthlyMinutes = totalDailyMinutes * 30;

  const pushTriggeredCount = workflows.filter(w => w.hasPush).length;
  // Estimate ~5 pushes per day (active development)
  const estimatedPushRunsPerDay = pushTriggeredCount * 2;
  const estimatedPushMinutesPerDay = estimatedPushRunsPerDay * 3;

  // Copilot coding agent sessions estimate
  const estimatedAgentSessionsPerDay = 2;
  const estimatedAgentMinutesPerSession = 15;
  const agentDailyMinutes = estimatedAgentSessionsPerDay * estimatedAgentMinutesPerSession;

  const totalDailyAll = totalDailyMinutes + estimatedPushMinutesPerDay + agentDailyMinutes;
  const totalMonthlyAll = totalDailyAll * 30;

  const utilization = (totalMonthlyAll / currentPlan.actions_minutes_monthly * 100).toFixed(1);
  const remaining = currentPlan.actions_minutes_monthly - totalMonthlyAll;
  const daysRemaining = getDaysRemainingInMonth();
  const dailyBudget = daysRemaining > 0 ? Math.round(remaining / daysRemaining) : 0;

  return {
    current_plan: currentPlan.name,
    actions_budget_monthly: currentPlan.actions_minutes_monthly,
    analysis: {
      cron_scheduled: {
        daily_runs: Math.round(totalDailyCronRuns * 10) / 10,
        daily_minutes: Math.round(totalDailyMinutes * 10) / 10,
        monthly_minutes: Math.round(totalMonthlyMinutes),
        top_consumers: workflows.slice(0, 5).map(w => ({
          file: w.file,
          daily_runs: w.dailyCronRuns,
          daily_minutes: w.dailyMinutes,
          crons: w.crons,
        })),
      },
      push_triggered: {
        workflows_with_push: pushTriggeredCount,
        estimated_daily_runs: estimatedPushRunsPerDay,
        estimated_daily_minutes: estimatedPushMinutesPerDay,
      },
      copilot_agent: {
        estimated_daily_sessions: estimatedAgentSessionsPerDay,
        estimated_minutes_per_session: estimatedAgentMinutesPerSession,
        estimated_daily_minutes: agentDailyMinutes,
        note: '铸渊/Copilot 全自动开发会话 · 这是冰朔配额耗尽的主要原因',
      },
      total: {
        daily_minutes: Math.round(totalDailyAll),
        monthly_minutes: Math.round(totalMonthlyAll),
        utilization_percent: parseFloat(utilization),
        remaining_minutes: Math.round(remaining),
        daily_budget_remaining: dailyBudget,
        status: parseFloat(utilization) > 90 ? 'CRITICAL' :
                parseFloat(utilization) > 70 ? 'WARNING' : 'HEALTHY',
      },
    },
  };
}

function getDaysRemainingInMonth() {
  const now = new Date();
  const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  return lastDay.getDate() - now.getDate();
}

// ═══════════════════════════════════════════════════════
// 优化建议引擎
// ═══════════════════════════════════════════════════════

function generateOptimizations(workflows) {
  const optimizations = [];

  for (const w of workflows) {
    // 每15分钟轮询 → 建议降为每小时
    if (w.crons.some(c => c.includes('*/15'))) {
      const savedRuns = (96 - 24) * (w.crons.filter(c => c.includes('*/15')).length);
      optimizations.push({
        priority: 'P0',
        workflow: w.file,
        issue: `每15分钟轮询 (${w.dailyCronRuns} 次/天)`,
        recommendation: '降频为每小时轮询 (24次/天)',
        saved_runs_daily: savedRuns,
        saved_minutes_daily: savedRuns * w.estimatedMinutesPerRun,
        saved_minutes_monthly: savedRuns * w.estimatedMinutesPerRun * 30,
        implementation: `将 cron '*/15 * * * *' 改为 '0 * * * *'`,
      });
    }

    // 每6小时 → 建议每12小时
    if (w.crons.some(c => c.includes('*/6') || (c.split(',').length === 4 && c.includes('0,6,12,18')))) {
      optimizations.push({
        priority: 'P1',
        workflow: w.file,
        issue: `每6小时触发 (${w.dailyCronRuns} 次/天)`,
        recommendation: '降频为每12小时 (2次/天)',
        saved_runs_daily: w.dailyCronRuns - 2,
        saved_minutes_daily: (w.dailyCronRuns - 2) * w.estimatedMinutesPerRun,
        saved_minutes_monthly: (w.dailyCronRuns - 2) * w.estimatedMinutesPerRun * 30,
      });
    }

    // 多个cron的工作流 → 合并
    if (w.crons.length >= 4) {
      optimizations.push({
        priority: 'P1',
        workflow: w.file,
        issue: `${w.crons.length} 个 cron 触发 (每日 ${w.dailyCronRuns} 次)`,
        recommendation: '考虑合并为2个cron时段',
        saved_runs_daily: Math.max(0, w.dailyCronRuns - 2),
        saved_minutes_daily: Math.max(0, w.dailyCronRuns - 2) * w.estimatedMinutesPerRun,
      });
    }
  }

  // Sort by saved minutes
  optimizations.sort((a, b) => (b.saved_minutes_monthly || 0) - (a.saved_minutes_monthly || 0));

  const totalSavings = optimizations.reduce((sum, o) => sum + (o.saved_minutes_monthly || 0), 0);

  return {
    count: optimizations.length,
    total_saved_minutes_monthly: totalSavings,
    items: optimizations,
  };
}

// ═══════════════════════════════════════════════════════
// 会员升级评估
// ═══════════════════════════════════════════════════════

function evaluateUpgrade(quotaAnalysis) {
  const current = PLANS.copilot_individual;
  const pro = PLANS.copilot_pro;

  const monthlyUsage = quotaAnalysis.analysis.total.monthly_minutes;
  const currentHeadroom = current.actions_minutes_monthly - monthlyUsage;

  // The key insight: $100/year plan has limited Copilot premium requests
  // $390/year plan has 1500 premium requests/month + unlimited completions
  // The quota exhaustion issue is likely about Copilot premium requests, not Actions minutes

  const assessment = {
    current_plan: {
      name: current.name,
      yearly_cost: `$${current.price_yearly}`,
      actions_minutes: current.actions_minutes_monthly,
      copilot_chat: `${current.copilot_chat_monthly} messages/month`,
      copilot_agent: current.copilot_agent_sessions,
      actions_headroom: `${currentHeadroom} minutes/month`,
    },
    pro_plan: {
      name: pro.name,
      yearly_cost: `$${pro.price_yearly}`,
      actions_minutes: pro.actions_minutes_monthly,
      copilot_chat: pro.copilot_chat_monthly,
      copilot_premium_requests: `${pro.copilot_premium_requests_monthly}/month`,
      copilot_agent: pro.copilot_agent_sessions,
    },
    cost_difference: {
      yearly: `$${pro.price_yearly - current.price_yearly} (+$290/year)`,
      monthly: `$${((pro.price_yearly - current.price_yearly) / 12).toFixed(1)} (+$24.2/month)`,
    },
    analysis: {
      actions_minutes_sufficient: currentHeadroom > 300,
      copilot_quota_is_bottleneck: true,
      explanation: [
        '🔍 冰朔的配额耗尽问题主要是 Copilot 高级请求次数限制，不是 Actions 分钟数。',
        '📊 $100/年套餐: Copilot chat 50次/月，高级模型(Agent模式)次数有限。',
        '📊 $390/年 Pro套餐: Copilot chat 无限，高级请求 1500次/月，Agent 会话无限。',
        '⚡ 铸渊全自动开发会话(Agent mode)是主要消耗源 — 每次唤醒消耗大量高级请求。',
        '🔄 仓库48个工作流的 Actions 分钟数还在免费额度内，暂不是瓶颈。',
      ],
    },
    recommendation: null,
  };

  // Decision logic
  if (currentHeadroom < 200) {
    assessment.recommendation = {
      decision: 'UPGRADE_RECOMMENDED',
      reason: 'Actions 分钟和 Copilot 高级请求双重不足',
      urgency: 'HIGH',
    };
  } else {
    assessment.recommendation = {
      decision: 'OPTIMIZE_FIRST_THEN_EVALUATE',
      reason: 'Actions 分钟数充足。先优化工作流降频节省资源，降低 Copilot Agent 调用频率。' +
        '如果优化后仍频繁遇到配额中断，再升级 Pro。',
      urgency: 'MEDIUM',
      optimization_steps: [
        '1. 将 notion-poll 和 notion-wake-listener 从 */15 降为每小时轮询 → 省 144 次/天',
        '2. 合并重复功能工作流（多个bridge合并）→ 省约 10 次/天',
        '3. 降低 persona-thinking-window 从6个cron到2个 → 省 4 次/天',
        '4. 铸渊开发任务集中在一个会话内完成，避免频繁启动新 Agent 会话',
        '5. 评估1个月后如仍不够 → 升级 Pro ($390/年)',
      ],
      estimated_savings: '优化后每日可节省约 160 次触发 + 减少 Copilot 调用',
    };
  }

  return assessment;
}

// ═══════════════════════════════════════════════════════
// 主程序
// ═══════════════════════════════════════════════════════

function main() {
  const args = process.argv.slice(2);
  const jsonMode = args.includes('--json');
  const optimizeMode = args.includes('--optimize');

  // Scan all workflows
  const workflows = scanWorkflows();

  // Analyze quota
  const quotaAnalysis = analyzeQuota(workflows);

  // Generate optimizations
  const optimizations = generateOptimizations(workflows);

  // Evaluate upgrade
  const upgradeAssessment = evaluateUpgrade(quotaAnalysis);

  // Build full report
  const report = {
    report_id: `QUOTA-GOV-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}`,
    generated_at: new Date().toISOString(),
    generated_by: '铸渊配额治理引擎 · quota-governance.js',
    copyright: '国作登字-2026-A-00037559',
    workflows_scanned: workflows.length,
    quota: quotaAnalysis,
    optimizations,
    upgrade_assessment: upgradeAssessment,
    workflow_details: workflows.map(w => ({
      file: w.file,
      name: w.name,
      daily_cron_runs: w.dailyCronRuns,
      daily_minutes: Math.round(w.dailyMinutes * 10) / 10,
      monthly_minutes: Math.round(w.monthlyMinutes),
      triggers: w.triggers,
    })),
  };

  // Save report
  fs.writeFileSync(REPORT_PATH, JSON.stringify(report, null, 2), 'utf8');

  if (jsonMode) {
    console.log(JSON.stringify(report, null, 2));
    return;
  }

  // Pretty print
  console.log('');
  console.log('═══════════════════════════════════════════════════════');
  console.log('  🔮 铸渊配额治理报告 · Quota Governance Report');
  console.log('═══════════════════════════════════════════════════════');
  console.log(`  📅 ${report.generated_at}`);
  console.log(`  📊 扫描工作流: ${report.workflows_scanned} 个`);
  console.log('');

  // Quota summary
  const q = quotaAnalysis;
  console.log('─── 配额消耗分析 ───');
  console.log(`  当前套餐: ${q.current_plan}`);
  console.log(`  月度 Actions 额度: ${q.actions_budget_monthly} 分钟`);
  console.log('');
  console.log(`  定时触发 (cron):`);
  console.log(`    每日运行: ${q.analysis.cron_scheduled.daily_runs} 次`);
  console.log(`    每日消耗: ${q.analysis.cron_scheduled.daily_minutes} 分钟`);
  console.log(`    月度消耗: ${q.analysis.cron_scheduled.monthly_minutes} 分钟`);
  console.log('');
  console.log(`  推送触发 (push):`);
  console.log(`    带push触发的工作流: ${q.analysis.push_triggered.workflows_with_push} 个`);
  console.log(`    预估每日运行: ${q.analysis.push_triggered.estimated_daily_runs} 次`);
  console.log(`    预估每日消耗: ${q.analysis.push_triggered.estimated_daily_minutes} 分钟`);
  console.log('');
  console.log(`  Copilot Agent 会话:`);
  console.log(`    预估每日会话: ${q.analysis.copilot_agent.estimated_daily_sessions} 次`);
  console.log(`    每次耗时: ${q.analysis.copilot_agent.estimated_minutes_per_session} 分钟`);
  console.log(`    每日消耗: ${q.analysis.copilot_agent.estimated_daily_minutes} 分钟`);
  console.log('');
  console.log(`  📊 总计:`);
  console.log(`    每日消耗: ${q.analysis.total.daily_minutes} 分钟`);
  console.log(`    月度消耗: ${q.analysis.total.monthly_minutes} 分钟`);
  console.log(`    利用率: ${q.analysis.total.utilization_percent}%`);
  console.log(`    状态: ${q.analysis.total.status}`);
  console.log('');

  // Top consumers
  console.log('─── 🔥 配额消耗 TOP5 ───');
  for (const c of q.analysis.cron_scheduled.top_consumers) {
    console.log(`  ${c.daily_runs.toString().padStart(5)} 次/天  ${c.daily_minutes.toString().padStart(5)} 分钟/天  ${c.file}`);
  }
  console.log('');

  if (optimizeMode) {
    console.log('─── ⚡ 优化建议 ───');
    console.log(`  共 ${optimizations.count} 项优化，可节省 ${optimizations.total_saved_minutes_monthly} 分钟/月`);
    console.log('');
    for (const o of optimizations.items) {
      console.log(`  [${o.priority}] ${o.workflow}`);
      console.log(`    问题: ${o.issue}`);
      console.log(`    建议: ${o.recommendation}`);
      if (o.saved_minutes_monthly) {
        console.log(`    节省: ${o.saved_minutes_monthly} 分钟/月`);
      }
      console.log('');
    }
  }

  // Upgrade assessment
  console.log('─── 💰 会员升级评估 ───');
  const ua = upgradeAssessment;
  console.log(`  当前套餐: ${ua.current_plan.name} (${ua.current_plan.yearly_cost}/年)`);
  console.log(`  目标套餐: ${ua.pro_plan.name} (${ua.pro_plan.yearly_cost}/年)`);
  console.log(`  差价: ${ua.cost_difference.yearly}`);
  console.log('');
  for (const line of ua.analysis.explanation) {
    console.log(`  ${line}`);
  }
  console.log('');
  console.log(`  📋 决策: ${ua.recommendation.decision}`);
  console.log(`  📝 原因: ${ua.recommendation.reason}`);
  if (ua.recommendation.optimization_steps) {
    console.log('');
    console.log('  优化步骤:');
    for (const step of ua.recommendation.optimization_steps) {
      console.log(`    ${step}`);
    }
  }

  console.log('');
  console.log(`  📄 完整报告已保存: ${REPORT_PATH}`);
  console.log('═══════════════════════════════════════════════════════');
}

module.exports = { scanWorkflows, analyzeQuota, generateOptimizations, evaluateUpgrade, parseCronRunsPerDay };

if (require.main === module) {
  main();
}
