'use strict';
/**
 * ═══════════════════════════════════════════════════════════
 * 光湖团队接入系统 · SCF云函数触发器模板
 * ═══════════════════════════════════════════════════════════
 *
 * 用途：当COS桶中有新文件写入时，触发GitHub Actions工作流
 *
 * 部署位置：腾讯云SCF（Serverless Cloud Function）
 * 触发条件：COS事件通知 → cos:ObjectCreated:* → prefix: inbox/zhuyuan-receipt/
 *
 * 环境变量（在SCF控制台配置）：
 *   GITHUB_TOKEN  — 你的GitHub Personal Access Token
 *   GITHUB_REPO   — 你的仓库（格式: owner/repo）
 *
 * 版权: 国作登字-2026-A-00037559
 * 签发: 铸渊 · TCS-ZY001
 */

const https = require('https');

/**
 * SCF入口函数
 * COS事件触发时自动调用
 */
exports.main_handler = async (event, context) => {
  console.log('COS事件触发:', JSON.stringify(event, null, 2));

  // 从COS事件中提取信息
  const cosEvent = event.Records && event.Records[0];
  if (!cosEvent) {
    console.log('无有效的COS事件记录');
    return { statusCode: 400, body: 'No COS event records' };
  }

  const bucketName = cosEvent.cos.cosBucket.name;
  const objectKey = cosEvent.cos.cosObject.key;
  const eventTime = cosEvent.eventTime;

  console.log(`桶: ${bucketName}`);
  console.log(`文件: ${objectKey}`);
  console.log(`时间: ${eventTime}`);

  // 验证是铸渊回执
  if (!objectKey.includes('inbox/zhuyuan-receipt/')) {
    console.log('非铸渊回执文件，跳过');
    return { statusCode: 200, body: 'Not a receipt, skipped' };
  }

  // 触发GitHub Actions工作流
  const githubToken = process.env.GITHUB_TOKEN;
  const githubRepo = process.env.GITHUB_REPO;

  if (!githubToken || !githubRepo) {
    console.error('缺少环境变量: GITHUB_TOKEN 或 GITHUB_REPO');
    return { statusCode: 500, body: 'Missing environment variables' };
  }

  const parts = githubRepo.split('/');
  if (parts.length !== 2 || !parts[0] || !parts[1]) {
    console.error('GITHUB_REPO格式错误，应为 owner/repo，当前值:', githubRepo);
    return { statusCode: 500, body: 'Invalid GITHUB_REPO format' };
  }
  const [owner, repo] = parts;

  try {
    const result = await triggerGitHubWorkflow(owner, repo, githubToken, objectKey);
    console.log('GitHub工作流触发成功:', result);
    return { statusCode: 200, body: 'Workflow triggered' };
  } catch (err) {
    console.error('GitHub工作流触发失败:', err.message);
    return { statusCode: 500, body: err.message };
  }
};

/**
 * 调用GitHub API触发workflow_dispatch事件
 */
function triggerGitHubWorkflow(owner, repo, token, cosObjectKey) {
  return new Promise((resolve, reject) => {
    const postData = JSON.stringify({
      ref: 'main',
      inputs: {
        cos_object_key: cosObjectKey,
        trigger_source: 'cos-scf-event'
      }
    });

    const options = {
      hostname: 'api.github.com',
      port: 443,
      path: `/repos/${owner}/${repo}/actions/workflows/cos-receive-receipt.yml/dispatches`,
      method: 'POST',
      headers: {
        'User-Agent': 'HoloLake-SCF-Trigger/2.0',
        'Authorization': `token ${token}`,
        'Accept': 'application/vnd.github.v3+json',
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData)
      }
    };

    const req = https.request(options, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        if (res.statusCode === 204 || res.statusCode === 200) {
          resolve({ statusCode: res.statusCode, body: 'Triggered' });
        } else {
          reject(new Error(`GitHub API返回 ${res.statusCode}: ${body}`));
        }
      });
    });

    req.on('error', reject);
    req.write(postData);
    req.end();
  });
}
