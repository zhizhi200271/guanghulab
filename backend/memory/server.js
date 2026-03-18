const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');

const app = express();
const PORT = 3020;

// ========== 配置加载 ==========
const configPath = path.join(__dirname, 'config.json');
let config = {};

function loadConfig() {
  try {
    const data = fs.readFileSync(configPath, 'utf8');
    config = JSON.parse(data);
  } catch (err) {
    // 默认配置
    config = {
      port: 3020,
      maxFileSizeMB: 50,
      allowedTypes: ['json', 'txt', 'md', 'csv', 'log', 'png', 'jpg'],
      quotaGB: 1,
      autoCleanDays: 30,
      checkIntervalHours: 1
    };
    fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
  }
}
loadConfig();

const MAX_SIZE = config.maxFileSizeMB * 1024 * 1024;
const QUOTA_BYTES = config.quotaGB * 1024 * 1024 * 1024;
const ALLOWED_EXTENSIONS = config.allowedTypes;

// ========== 目录初始化 ==========
const UPLOAD_DIR = path.join(__dirname, 'uploads');
const CATEGORIES = ['persona-growth', 'user-memory', 'system-log', 'knowledge-base'];

if (!fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR);
}
CATEGORIES.forEach(cat => {
  const catPath = path.join(UPLOAD_DIR, cat);
  if (!fs.existsSync(catPath)) {
    fs.mkdirSync(catPath);
  }
});

const INDEX_PATH = path.join(__dirname, 'memory-index.json');

let fileIndex = [];
if (fs.existsSync(INDEX_PATH)) {
  try {
    fileIndex = JSON.parse(fs.readFileSync(INDEX_PATH, 'utf8'));
  } catch (err) {
    fileIndex = [];
  }
} else {
  fs.writeFileSync(INDEX_PATH, JSON.stringify([], null, 2));
}

// ========== 辅助函数 ==========
function saveIndex() {
  fs.writeFileSync(INDEX_PATH, JSON.stringify(fileIndex, null, 2));
}

function getUsedSpace() {
  let total = 0;
  fileIndex.forEach(item => {
    total += item.size || 0;
  });
  return total;
}

function checkQuota(newFileSize) {
  const used = getUsedSpace();
  return (used + newFileSize) <= QUOTA_BYTES;
}

// ========== multer 配置 ==========
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const category = req.body.category;
    console.log('storage category:', category);
    
    if (!category || !CATEGORIES.includes(category)) {
      return cb(new Error('分类必须是 persona-growth / user-memory / system-log / knowledge-base'));
    }
    const dest = path.join(UPLOAD_DIR, category);
    cb(null, dest);
  },
  filename: function (req, file, cb) {
    const ext = path.extname(file.originalname);
    const storedName = uuidv4() + ext;
    cb(null, storedName);
  }
});

const fileFilter = (req, file, cb) => {
  const ext = path.extname(file.originalname).toLowerCase().replace('.', '');
  if (ALLOWED_EXTENSIONS.includes(ext)) {
    cb(null, true);
  } else {
    cb(new Error(`不允许的文件类型，允许的类型: ${ALLOWED_EXTENSIONS.join(', ')}`));
  }
};

const upload = multer({
  storage: storage,
  limits: { fileSize: MAX_SIZE },
  fileFilter: fileFilter
});

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ========== API 路由 ==========

app.post('/api/memory/upload', upload.single('file'), (req, res) => {
  console.log('req.body:', req.body);
  
  if (!req.file) {
    return res.status(400).json({ error: '没有上传文件' });
  }

  const { category, description = '', tags = '' } = req.body;

  // 分类强制校验
  if (!category || !CATEGORIES.includes(category)) {
    // 删除已上传的文件
    fs.unlinkSync(req.file.path);
    return res.status(400).json({ error: '必须指定有效分类: persona-growth / user-memory / system-log / knowledge-base' });
  }

  // 配额检查
  if (!checkQuota(req.file.size)) {
    fs.unlinkSync(req.file.path);
    return res.status(507).json({ error: '存储配额已满，无法上传' });
  }

  const fileRecord = {
    id: uuidv4(),
    filename: req.file.originalname,
    storedName: req.file.filename,
    category: category,
    size: req.file.size,
    mimeType: req.file.mimetype,
    description: description,
    tags: tags ? tags.split(',').map(t => t.trim()) : [],
    uploadedAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };

  fileIndex.push(fileRecord);
  saveIndex();

  res.status(201).json(fileRecord);
});

app.get('/api/memory/files', (req, res) => {
  res.json(fileIndex);
});

app.get('/api/memory/files/:id', (req, res) => {
  const file = fileIndex.find(f => f.id === req.params.id);
  if (!file) {
    return res.status(404).json({ error: '文件不存在' });
  }
  res.json(file);
});

app.get('/api/memory/files/:id/download', (req, res) => {
  const file = fileIndex.find(f => f.id === req.params.id);
  if (!file) {
    return res.status(404).json({ error: '文件不存在' });
  }

  const filePath = path.join(UPLOAD_DIR, file.category, file.storedName);
  if (!fs.existsSync(filePath)) {
    return res.status(404).json({ error: '物理文件不存在' });
  }

  res.download(filePath, file.filename);
});

app.delete('/api/memory/files/:id', (req, res) => {
  const index = fileIndex.findIndex(f => f.id === req.params.id);
  if (index === -1) {
    return res.status(404).json({ error: '文件不存在' });
  }

  const file = fileIndex[index];
  const filePath = path.join(UPLOAD_DIR, file.category, file.storedName);
  
  try {
    fs.unlinkSync(filePath);
  } catch (err) {}

  fileIndex.splice(index, 1);
  saveIndex();
  res.json({ message: '删除成功' });
});

// ========== 环节1 接口 ==========

app.get('/api/memory/categories', (req, res) => {
  const stats = {};
  CATEGORIES.forEach(cat => {
    const files = fileIndex.filter(f => f.category === cat);
    const count = files.length;
    const totalSize = files.reduce((sum, f) => sum + (f.size || 0), 0);
    stats[cat] = { count, totalSize };
  });
  res.json(stats);
});

app.get('/api/memory/categories/:category', (req, res) => {
  const category = req.params.category;
  if (!CATEGORIES.includes(category)) {
    return res.status(400).json({ error: '分类不存在' });
  }
  const files = fileIndex.filter(f => f.category === category);
  res.json(files);
});

app.get('/api/memory/search', (req, res) => {
  const q = req.query.q;
  if (!q) {
    return res.status(400).json({ error: '请提供搜索关键词' });
  }

  const keyword = q.toLowerCase();
  const results = fileIndex.filter(f => {
    return (
      f.filename.toLowerCase().includes(keyword) ||
      f.description.toLowerCase().includes(keyword) ||
      f.tags.some(tag => tag.toLowerCase().includes(keyword))
    );
  });

  res.json(results);
});

app.put('/api/memory/files/:id/meta', (req, res) => {
  const { description, tags } = req.body;
  const file = fileIndex.find(f => f.id === req.params.id);
  if (!file) {
    return res.status(404).json({ error: '文件不存在' });
  }

  if (description !== undefined) file.description = description;
  if (tags !== undefined) {
    file.tags = Array.isArray(tags) ? tags : tags.split(',').map(t => t.trim());
  }
  file.updatedAt = new Date().toISOString();

  saveIndex();
  res.json(file);
});

app.get('/api/memory/quota', (req, res) => {
  const used = getUsedSpace();
  res.json({
    quotaGB: config.quotaGB,
    quotaBytes: QUOTA_BYTES,
    usedBytes: used,
    usedGB: (used / (1024*1024*1024)).toFixed(3),
    remainingBytes: QUOTA_BYTES - used,
    remainingGB: ((QUOTA_BYTES - used) / (1024*1024*1024)).toFixed(3),
    totalFiles: fileIndex.length
  });
});

// ========== 自动清理 ==========
function autoClean() {
  console.log('执行自动清理检查...');
  const now = Date.now();
  const maxAge = config.autoCleanDays * 24 * 60 * 60 * 1000;
  let cleaned = 0;
  
  fileIndex = fileIndex.filter(item => {
    if (item.category === 'system-log') {
      const uploadedAt = new Date(item.uploadedAt).getTime();
      if (now - uploadedAt > maxAge) {
        const filePath = path.join(UPLOAD_DIR, item.category, item.storedName);
        try {
          fs.unlinkSync(filePath);
          cleaned++;
        } catch (err) {}
        return false;
      }
    }
    return true;
  });
  
  if (cleaned > 0) {
    saveIndex();
    console.log(`自动清理完成，删除了 ${cleaned} 个旧日志文件`);
  }
}

const checkIntervalMs = (config.checkIntervalHours || 1) * 60 * 60 * 1000;
setInterval(autoClean, checkIntervalMs);
autoClean();

// 错误处理
app.use((err, req, res, next) => {
  console.log('错误:', err.message);
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(413).json({ error: `文件大小超过限制 (最大 ${config.maxFileSizeMB}MB)` });
    }
    return res.status(400).json({ error: err.message });
  }
  if (err) {
    return res.status(400).json({ error: err.message });
  }
  next();
});

app.listen(PORT, () => {
  console.log(`M-MEMORY 服务运行在端口 ${PORT}`);
});