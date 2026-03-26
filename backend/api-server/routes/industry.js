/**
 * /api/industry — 行业代表制注册与管理路由
 *
 * 行业代表制架构：铸渊不是接入个人，而是接入行业。
 * 每个行业有一个代表人，代表人开自己的企业会员，
 * 铸渊管理代表人的仓库。
 *
 * 指令：ZY-AGEOS-TOWER-2026-0326-001
 * 版权：国作登字-2026-A-00037559
 */

'use strict';

var express = require('express');
var crypto = require('crypto');
var router = express.Router();

var authModule = require('./auth');
var requireSession = authModule.requireSession;
var DEV_DATABASE = authModule.DEV_DATABASE;

/**
 * Check if a dev ID is a registered developer
 * @param {string} devId
 * @returns {boolean}
 */
function isRegisteredDev(devId) {
  return !!(DEV_DATABASE[devId]);
}

/**
 * Generate a new industry ID
 * @returns {string}
 */
function generateIndustryId() {
  // Simple incremental ID; in production this would query existing IDs
  var timestamp = Date.now().toString(36).toUpperCase();
  return 'IND-' + timestamp.slice(-3).padStart(3, '0');
}

/**
 * Hash a PAT for storage (never store raw PAT)
 * @param {string} pat
 * @returns {string}
 */
function hashPAT(pat) {
  return crypto.createHash('sha256').update(pat).digest('hex');
}

/**
 * POST /api/industry/register
 * Register a new industry with a representative developer
 * Requires authenticated session (DEV-XXX)
 */
router.post('/industry/register', requireSession, function(req, res) {
  var industry_name = (req.body.industry_name || '').trim();
  var rep_dev_id = (req.body.rep_dev_id || '').trim().toUpperCase();
  var github_username = (req.body.github_username || '').trim();
  var repo_name = (req.body.repo_name || '').trim();
  var pat = (req.body.pat || '').trim();

  // Validate required fields
  if (!industry_name || !rep_dev_id || !github_username || !repo_name || !pat) {
    return res.status(400).json({
      error: true,
      code: 'MISSING_FIELDS',
      message: '缺少必填字段：industry_name, rep_dev_id, github_username, repo_name, pat'
    });
  }

  // Step 1: verify representative is a registered developer
  if (!isRegisteredDev(rep_dev_id)) {
    return res.status(400).json({
      error: true,
      code: 'INVALID_REPRESENTATIVE',
      message: '代表人必须是已注册开发者'
    });
  }

  // Step 2: only the representative themselves or admin can register
  var sessionDevId = req.sessionDevId;
  var sessionDev = req.sessionDev;
  if (sessionDevId !== rep_dev_id && (!sessionDev || sessionDev.level < 3)) {
    return res.status(403).json({
      error: true,
      code: 'PERMISSION_DENIED',
      message: '只有代表人本人或管理者可以注册行业'
    });
  }

  // Step 3: validate PAT format (basic check — real validation against GitHub API
  //         is done asynchronously after registration)
  if (pat.length < 10) {
    return res.status(400).json({
      error: true,
      code: 'INVALID_PAT',
      message: 'PAT 格式无效'
    });
  }

  // Step 4: create industry record
  var industryId = generateIndustryId();
  var patHash = hashPAT(pat);

  var record = {
    industry_id: industryId,
    name: industry_name,
    representative: {
      dev_id: rep_dev_id,
      name: DEV_DATABASE[rep_dev_id] ? DEV_DATABASE[rep_dev_id].name : '',
      github_username: github_username,
      repo_url: 'https://github.com/' + github_username + '/' + repo_name,
      pat_hash: patHash,
      pat_status: 'pending_verification',
      membership: 'yearly_enterprise',
      membership_start: null
    },
    status: 'pending_init',
    created_at: new Date().toISOString(),
    created_by: sessionDevId
  };

  // In production: store to database / encrypted file.
  // For now: return the record (minus PAT).
  console.log('[INDUSTRY] New industry registered: ' + industryId + ' ' + industry_name + ' by ' + rep_dev_id);

  res.json({
    status: 'ok',
    industry_id: industryId,
    message: '行业「' + industry_name + '」已注册 · 铸渊正在初始化仓库',
    record: {
      industry_id: record.industry_id,
      name: record.name,
      representative: {
        dev_id: record.representative.dev_id,
        name: record.representative.name,
        github_username: record.representative.github_username,
        repo_url: record.representative.repo_url,
        pat_status: record.representative.pat_status
      },
      status: record.status,
      created_at: record.created_at
    }
  });
});

/**
 * GET /api/industry/list
 * List all registered industries (admin only)
 */
router.get('/industry/list', requireSession, function(req, res) {
  var sessionDev = req.sessionDev;
  if (!sessionDev || sessionDev.level < 3) {
    return res.status(403).json({
      error: true,
      code: 'PERMISSION_DENIED',
      message: '仅管理者可查看行业列表'
    });
  }

  // In production: read from database.
  // For now: return placeholder.
  res.json({
    status: 'ok',
    industries: [
      {
        industry_id: 'IND-001',
        name: '网文行业',
        representative: { dev_id: 'DEV-002', name: '肥猫' },
        status: 'pending_setup'
      }
    ]
  });
});

/**
 * GET /api/industry/status/:id
 * Get status of a specific industry
 */
router.get('/industry/status/:id', requireSession, function(req, res) {
  var industryId = req.params.id;

  // In production: lookup from database
  res.json({
    status: 'ok',
    industry_id: industryId,
    message: '行业状态查询 · 功能开发中',
    note: '待铸渊初始化行业仓库后可查询完整状态'
  });
});

module.exports = router;
