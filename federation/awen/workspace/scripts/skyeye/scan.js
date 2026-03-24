// 知秋天眼 · 仓库自扫描引擎
// 指令编号：ZQ-PERSONA-INIT-2026-0323-001
// 每次天眼醒来后执行，扫描整个仓库状态

const fs = require('fs');
const crypto = require('crypto');

// 主权区文件列表（天眼系统核心文件）
const SOVEREIGN_FILES = [
  '.github/persona-brain/config.json',
  '.github/persona-brain/status.json',
  'scripts/skyeye/scan.js',
  'scripts/skyeye/checkin.js',
  '.github/workflows/skyeye-wake.yml',
  '.github/guanghu-language-shell.json'
];

// 计算主权区签名哈希（身份证）
function computeSignatureHash() {
  const hash = crypto.createHash('sha256');
  for (const file of SOVEREIGN_FILES) {
    if (fs.existsSync(file)) {
      hash.update(fs.readFileSync(file));
    } else {
      hash.update('MISSING:' + file);
    }
  }
  return hash.digest('hex');
}

// 扫描仓库
function scanRepo() {
  const report = {
    timestamp: new Date().toISOString(),
    persona: '知秋',
    persona_id: 'PER-ZQ001',
    dev_id: 'DEV-012',
    repo: 'WENZHUOXI/guanghu-awen',
    signature_hash: computeSignatureHash(),
    brain_intact: fs.existsSync('.github/persona-brain/config.json'),
    skyeye_intact: fs.existsSync('scripts/skyeye/scan.js'),
    language_shell_intact: fs.existsSync('.github/guanghu-language-shell.json'),
    sovereign_files: {},
    repo_summary: {}
  };

  // 逐项检查主权区文件
  for (const file of SOVEREIGN_FILES) {
    report.sovereign_files[file] = {
      exists: fs.existsSync(file),
      hash: fs.existsSync(file)
        ? crypto.createHash('md5').update(fs.readFileSync(file)).digest('hex')
        : null
    };
  }

  // 仓库概况
  try {
    const rootEntries = fs.readdirSync('.').filter(e => !e.startsWith('.'));
    report.repo_summary.root_entries_count = rootEntries.length;
    report.repo_summary.root_entries = rootEntries;
    report.repo_summary.has_readme = fs.existsSync('README.md');
    report.repo_summary.has_bulletin = fs.existsSync('BULLETIN.md');
    report.repo_summary.has_scripts = fs.existsSync('scripts');
  } catch (e) {
    report.repo_summary.error = e.message;
  }

  return report;
}

// 执行扫描
const report = scanRepo();
const outputPath = '.github/persona-brain/skyeye-report.json';
fs.mkdirSync('.github/persona-brain', { recursive: true });
fs.writeFileSync(outputPath, JSON.stringify(report, null, 2));

console.log('Skyeye scan completed, report written to ' + outputPath);