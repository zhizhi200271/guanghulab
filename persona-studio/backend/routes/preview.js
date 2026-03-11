/**
 * persona-studio · 预览 API
 * GET /api/ps/preview/:devId/:project  提供 iframe 实时预览
 */
const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs');

const WORKSPACE_DIR = path.join(__dirname, '..', '..', 'workspace');

// GET /api/ps/preview/:devId/:project
router.get('/:devId/:project', (req, res) => {
  const { devId, project } = req.params;

  if (!devId || !project) {
    return res.status(400).json({
      error: true,
      code: 'MISSING_PARAMS',
      message: '缺少必要参数'
    });
  }

  // 安全校验：确保 devId 和 project 匹配预期格式（防止路径遍历）
  const safeDevId = path.basename(devId);
  const safeProject = path.basename(project);

  if (!/^[a-zA-Z0-9_-]+$/.test(safeDevId) || !/^[a-zA-Z0-9_.-]+$/.test(safeProject)) {
    return res.status(400).json({
      error: true,
      code: 'INVALID_PARAMS',
      message: '参数格式无效'
    });
  }

  const previewDir = path.join(WORKSPACE_DIR, safeDevId, safeProject, 'preview');
  const projectDir = path.join(WORKSPACE_DIR, safeDevId, safeProject);

  // 优先从 preview/ 子目录查找
  let targetDir = previewDir;
  if (!fs.existsSync(previewDir)) {
    targetDir = projectDir;
  }

  const indexPath = path.join(targetDir, 'index.html');
  if (!fs.existsSync(indexPath)) {
    return res.status(404).send(
      '<html><body style="background:#0a0e1a;color:#94a3b8;display:flex;align-items:center;justify-content:center;height:100vh;font-family:sans-serif">' +
      '<div style="text-align:center"><p style="font-size:2rem">🌊</p><p>预览正在准备中…</p></div>' +
      '</body></html>'
    );
  }

  res.sendFile(indexPath);
});

// GET /api/ps/preview/:devId/:project/:file (sub-resources like CSS/JS)
router.get('/:devId/:project/:file', (req, res) => {
  const { devId, project, file } = req.params;

  const safeDevId = path.basename(devId);
  const safeProject = path.basename(project);
  const safeFile = path.basename(file);

  if (!/^[a-zA-Z0-9_-]+$/.test(safeDevId) || !/^[a-zA-Z0-9_.-]+$/.test(safeProject) || !/^[a-zA-Z0-9_.-]+$/.test(safeFile)) {
    return res.status(400).send('Invalid parameters');
  }

  const previewDir = path.join(WORKSPACE_DIR, safeDevId, safeProject, 'preview');
  const projectDir = path.join(WORKSPACE_DIR, safeDevId, safeProject);

  let targetDir = previewDir;
  if (!fs.existsSync(previewDir)) {
    targetDir = projectDir;
  }

  const filePath = path.join(targetDir, safeFile);
  if (!fs.existsSync(filePath)) {
    return res.status(404).send('File not found');
  }

  res.sendFile(filePath);
});

module.exports = router;
