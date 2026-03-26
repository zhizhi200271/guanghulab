#!/usr/bin/env bash
# ━━━ 天眼自修复脚本 · SkyEye Repair v4.0 ━━━
# 尝试修复失联的兄弟 workflow
# 修复失败达到阈值时自动升级到创建 Issue 告警
# 版权：国作登字-2026-A-00037559 · 冰朔（ICE-GL∞）
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

set -euo pipefail

AUTO_FIX="false"
MAX_RETRIES=3
REPO_ROOT="$(git rev-parse --show-toplevel 2>/dev/null || echo '.')"
EARTH_STATUS_FILE="${REPO_ROOT}/signal-log/skyeye-earth-status.json"

while [[ $# -gt 0 ]]; do
  case $1 in
    --auto-fix) AUTO_FIX="$2"; shift 2 ;;
    --max-retries) MAX_RETRIES="$2"; shift 2 ;;
    *) shift ;;
  esac
done

NOW="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
OWNER="${GITHUB_REPOSITORY_OWNER:-qinfendebingshuo}"
REPO_NAME="${GITHUB_REPOSITORY##*/}"
REPO_NAME="${REPO_NAME:-guanghulab}"
CURRENT_AGENT="${GITHUB_WORKFLOW:-unknown}"

echo "===== 天眼自修复启动 · auto_fix=${AUTO_FIX} · max_retries=${MAX_RETRIES} ====="

if [[ "$AUTO_FIX" != "true" ]]; then
  echo "ℹ️ 自动修复未启用，跳过"
  exit 0
fi

# Read earth status to find dead workflows
if [[ ! -f "$EARTH_STATUS_FILE" ]]; then
  echo "⚠️ 地球状态文件不存在，跳过修复"
  exit 0
fi

TOKEN="${GITHUB_TOKEN:-${GH_TOKEN:-}}"

if [[ -z "$TOKEN" ]]; then
  echo "⚠️ 无 GitHub Token，无法执行自动修复"
  exit 0
fi

SEVERITY=$(node -e "
  const d = JSON.parse(require('fs').readFileSync('${EARTH_STATUS_FILE}', 'utf8'));
  console.log(d.health || 'unknown');
" 2>/dev/null || echo "unknown")

DEAD_COUNT=$(node -e "
  const d = JSON.parse(require('fs').readFileSync('${EARTH_STATUS_FILE}', 'utf8'));
  console.log(d.dead_eyes || 0);
" 2>/dev/null || echo "0")

echo "🔍 当前地球状态: ${SEVERITY} | 失联: ${DEAD_COUNT}"

REPAIR_LOG="[]"
REPAIR_COUNT=0
REPAIR_SUCCESS=0
REPAIR_FAILED=0

# Level 1: Try to re-run failed workflows
if [[ "$DEAD_COUNT" -gt 0 ]] && command -v node &>/dev/null; then
  echo "🔧 Level 1: 尝试重新触发失败的 workflow..."

  DEAD_LIST=$(node -e "
    const d = JSON.parse(require('fs').readFileSync('${EARTH_STATUS_FILE}', 'utf8'));
    console.log(JSON.stringify(d.dead_list || []));
  " 2>/dev/null || echo "[]")

  # Note: Re-running workflows requires specific run IDs and permissions
  # This is a best-effort attempt
  echo "📋 失联列表: ${DEAD_LIST}"
  echo "ℹ️ Level 1 修复需要人工介入（重新运行失败的 workflow）"
  REPAIR_COUNT=$((REPAIR_COUNT + 1))
fi

# Level 3: Create GitHub Issue for critical/black severity
if [[ "$SEVERITY" == "red" ]] || [[ "$SEVERITY" == "black" ]]; then
  echo "🚨 Level 3: 严重告警 → 创建 GitHub Issue"

  ISSUE_TITLE="🚨 天眼地球层告警：${SEVERITY} 级别 · 需要人类介入"
  ISSUE_BODY="## 天眼地球层 v4.0 自动告警

**告警时间**: ${NOW}
**告警级别**: ${SEVERITY}
**发现者**: ${CURRENT_AGENT}
**失联 workflow 数**: ${DEAD_COUNT}

### 失联列表

\`\`\`json
${DEAD_LIST:-[]}
\`\`\`

### 可能原因

- Secret/Token 过期（GUANGHU_TOKEN、NOTION_TOKEN、PAT_TOKEN）
- 分支保护规则阻止直接推送（GH006）
- Google Drive OAuth Token 过期
- API 配额耗尽

### 需要冰朔操作

1. 检查 Settings → Secrets and variables → Actions
2. 更新过期的 Secret/Token
3. 检查分支保护规则是否正确
4. 手动重新运行失败的 workflow

---
*此 Issue 由天眼地球层 v4.0 自动创建 · ${CURRENT_AGENT}*"

  # Create issue via GitHub API
  ISSUE_RESULT=$(curl -s -X POST \
    -H "Authorization: token ${TOKEN}" \
    -H "Accept: application/vnd.github.v3+json" \
    "https://api.github.com/repos/${OWNER}/${REPO_NAME}/issues" \
    -d "$(node -e "console.log(JSON.stringify({
      title: '${ISSUE_TITLE}',
      body: $(node -e "console.log(JSON.stringify(\`${ISSUE_BODY}\`))" 2>/dev/null || echo '""'),
      labels: ['skyeye-alert', 'urgent']
    }))" 2>/dev/null || echo '{}')" 2>/dev/null || echo '{"message":"failed"}')

  ISSUE_URL=$(echo "$ISSUE_RESULT" | node -e "
    const d = JSON.parse(require('fs').readFileSync('/dev/stdin','utf8'));
    console.log(d.html_url || 'creation failed');
  " 2>/dev/null || echo "creation failed")

  echo "📝 Issue 已创建: ${ISSUE_URL}"

  REPAIR_LOG="[{\"time\":\"${NOW}\",\"repairer\":\"${CURRENT_AGENT}\",\"action\":\"create-issue\",\"result\":\"${ISSUE_URL}\"}]"
fi

# Update earth status with repair log
if [[ -f "$EARTH_STATUS_FILE" ]] && command -v node &>/dev/null; then
  node -e "
    const fs = require('fs');
    const d = JSON.parse(fs.readFileSync('${EARTH_STATUS_FILE}', 'utf8'));
    d.repair_log = ${REPAIR_LOG};
    d.last_repair = '${NOW}';
    d.last_repairer = '${CURRENT_AGENT}';
    fs.writeFileSync('${EARTH_STATUS_FILE}', JSON.stringify(d, null, 2));
  " 2>/dev/null || true
fi

echo "===== 天眼自修复完成 · 修复尝试: ${REPAIR_COUNT} ====="
