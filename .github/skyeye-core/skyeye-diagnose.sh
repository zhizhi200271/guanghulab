#!/usr/bin/env bash
# ━━━ 天眼诊断脚本 · SkyEye Diagnose v4.0 ━━━
# 扫描兄弟 workflow 状态，评估地球健康度
# 版权：国作登字-2026-A-00037559 · 冰朔（ICE-GL∞）
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

set -euo pipefail

SCOPE="siblings"
REPO_ROOT="$(git rev-parse --show-toplevel 2>/dev/null || echo '.')"
EARTH_STATUS_FILE="${REPO_ROOT}/signal-log/skyeye-earth-status.json"
HEARTBEAT_FILE="${REPO_ROOT}/signal-log/skyeye-heartbeat.json"

while [[ $# -gt 0 ]]; do
  case $1 in
    --scope) SCOPE="$2"; shift 2 ;;
    *) shift ;;
  esac
done

NOW="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
OWNER="${GITHUB_REPOSITORY_OWNER:-qinfendebingshuo}"
REPO_NAME="${GITHUB_REPOSITORY##*/}"
REPO_NAME="${REPO_NAME:-guanghulab}"

echo "===== 天眼诊断启动 · scope=${SCOPE} ====="

# Count total workflow files
TOTAL_WORKFLOWS=$(find "${REPO_ROOT}/.github/workflows" -name "*.yml" 2>/dev/null | wc -l)
echo "📊 总 workflow 数: ${TOTAL_WORKFLOWS}"

# Check recent workflow runs via GitHub API if token available
ALIVE_COUNT=0
DEAD_COUNT=0
DEAD_LIST="[]"

if [[ -n "${GITHUB_TOKEN:-}" ]] || [[ -n "${GH_TOKEN:-}" ]]; then
  TOKEN="${GITHUB_TOKEN:-${GH_TOKEN:-}}"

  echo "🔍 通过 GitHub API 扫描兄弟 workflow 状态..."

  # Get recent workflow runs (last 100)
  RUNS_TMP=$(mktemp)
  curl -s -H "Authorization: token ${TOKEN}" \
    -H "Accept: application/vnd.github.v3+json" \
    "https://api.github.com/repos/${OWNER}/${REPO_NAME}/actions/runs?per_page=100&status=completed" \
    > "$RUNS_TMP" 2>/dev/null || echo '{"workflow_runs":[]}' > "$RUNS_TMP"

  if command -v node &>/dev/null; then
    DIAG_RESULT=$(node -e "
      const fs = require('fs');
      const runs = JSON.parse(fs.readFileSync('${RUNS_TMP}', 'utf8'));
      const workflows = {};
      for (const r of (runs.workflow_runs || [])) {
        if (!workflows[r.name]) {
          workflows[r.name] = {
            name: r.name,
            conclusion: r.conclusion,
            last_run: r.created_at,
            run_id: r.id
          };
        }
      }
      const entries = Object.values(workflows);
      const alive = entries.filter(e => e.conclusion === 'success' || e.conclusion === 'skipped');
      const dead = entries.filter(e => e.conclusion === 'failure');
      console.log(JSON.stringify({
        alive_count: alive.length,
        dead_count: dead.length,
        total_checked: entries.length,
        dead_list: dead.map(d => ({
          name: d.name,
          last_heartbeat: d.last_run,
          cause: 'failure in last run'
        }))
      }));
    " 2>/dev/null || echo '{"alive_count":0,"dead_count":0,"total_checked":0,"dead_list":[]}')

    rm -f "$RUNS_TMP"
    ALIVE_COUNT=$(echo "$DIAG_RESULT" | node -e "const d=JSON.parse(require('fs').readFileSync('/dev/stdin','utf8'));console.log(d.alive_count)" 2>/dev/null || echo "0")
    DEAD_COUNT=$(echo "$DIAG_RESULT" | node -e "const d=JSON.parse(require('fs').readFileSync('/dev/stdin','utf8'));console.log(d.dead_count)" 2>/dev/null || echo "0")
    DEAD_LIST=$(echo "$DIAG_RESULT" | node -e "const d=JSON.parse(require('fs').readFileSync('/dev/stdin','utf8'));console.log(JSON.stringify(d.dead_list))" 2>/dev/null || echo "[]")
  fi
else
  echo "⚠️ 无 GitHub Token，使用本地心跳数据进行诊断"

  if [[ -f "$HEARTBEAT_FILE" ]] && command -v node &>/dev/null; then
    ALIVE_COUNT=$(node -e "
      const d = JSON.parse(require('fs').readFileSync('${HEARTBEAT_FILE}', 'utf8'));
      console.log((d.heartbeats || []).length);
    " 2>/dev/null || echo "0")
  fi
fi

# Determine severity
TOTAL_CHECKED=$((ALIVE_COUNT + DEAD_COUNT))
if [[ $TOTAL_CHECKED -eq 0 ]]; then
  SEVERITY="yellow"
  HEALTH="unknown"
elif [[ $DEAD_COUNT -eq 0 ]]; then
  SEVERITY="green"
  HEALTH="healthy"
elif [[ $ALIVE_COUNT -le 1 ]]; then
  SEVERITY="black"
  HEALTH="last_defender"
elif [[ $((DEAD_COUNT * 2)) -gt $TOTAL_CHECKED ]]; then
  SEVERITY="red"
  HEALTH="critical"
else
  SEVERITY="yellow"
  HEALTH="degraded"
fi

# Calculate coverage
if [[ $TOTAL_CHECKED -gt 0 ]]; then
  COVERAGE=$((ALIVE_COUNT * 100 / TOTAL_CHECKED))
else
  COVERAGE=0
fi

echo "👁️ 存活: ${ALIVE_COUNT} | 失联: ${DEAD_COUNT} | 覆盖率: ${COVERAGE}%"
echo "🌍 地球健康度: ${HEALTH} (${SEVERITY})"

# Write earth status
mkdir -p "$(dirname "$EARTH_STATUS_FILE")"

cat > "$EARTH_STATUS_FILE" <<EOFSTATUS
{
  "earth_version": "4.0",
  "last_updated": "${NOW}",
  "diagnosed_by": "${GITHUB_WORKFLOW:-manual}",
  "total_eyes": ${TOTAL_WORKFLOWS},
  "alive_eyes": ${ALIVE_COUNT},
  "dead_eyes": ${DEAD_COUNT},
  "coverage": "${COVERAGE}%",
  "health": "${SEVERITY}",
  "dead_list": ${DEAD_LIST},
  "repair_log": []
}
EOFSTATUS

echo "📝 地球状态已写入: ${EARTH_STATUS_FILE}"
echo "===== 天眼诊断完成 ====="

# Export severity for downstream steps
echo "SKYEYE_SEVERITY=${SEVERITY}" >> "${GITHUB_ENV:-/dev/null}" 2>/dev/null || true
echo "SKYEYE_HEALTH=${HEALTH}" >> "${GITHUB_ENV:-/dev/null}" 2>/dev/null || true
