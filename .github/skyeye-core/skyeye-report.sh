#!/usr/bin/env bash
# ━━━ 天眼状态报告脚本 · SkyEye Report v4.0 ━━━
# 每个 workflow 结束时调用（if: always()）
# 更新地球健康状态文件
# 版权：国作登字-2026-A-00037559 · 冰朔（ICE-GL∞）
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

set -euo pipefail

AGENT_NAME=""
STATUS=""
REPO_ROOT="$(git rev-parse --show-toplevel 2>/dev/null || echo '.')"
HEARTBEAT_FILE="${REPO_ROOT}/signal-log/skyeye-heartbeat.json"
EARTH_STATUS_FILE="${REPO_ROOT}/signal-log/skyeye-earth-status.json"

while [[ $# -gt 0 ]]; do
  case $1 in
    --agent) AGENT_NAME="$2"; shift 2 ;;
    --status) STATUS="$2"; shift 2 ;;
    *) shift ;;
  esac
done

if [[ -z "$AGENT_NAME" ]]; then
  AGENT_NAME="${GITHUB_WORKFLOW:-unknown}"
fi

if [[ -z "$STATUS" ]]; then
  STATUS="${JOB_STATUS:-unknown}"
fi

NOW="$(date -u +%Y-%m-%dT%H:%M:%SZ)"

# Map job status to skyeye status
case "$STATUS" in
  success|Success) SKYEYE_STATUS="healthy" ;;
  failure|Failure) SKYEYE_STATUS="degraded" ;;
  cancelled|Cancelled) SKYEYE_STATUS="degraded" ;;
  *) SKYEYE_STATUS="unknown" ;;
esac

echo "👁️ 天眼报告 · ${AGENT_NAME} · 状态: ${STATUS} → ${SKYEYE_STATUS}"

mkdir -p "$(dirname "$HEARTBEAT_FILE")"

# Update heartbeat with final status
if command -v node &>/dev/null; then
  node -e "
    const fs = require('fs');
    let data;
    try {
      data = JSON.parse(fs.readFileSync('${HEARTBEAT_FILE}', 'utf8'));
    } catch(e) {
      data = { version: '4.0', heartbeats: [] };
    }
    if (!data.heartbeats) data.heartbeats = [];

    const idx = data.heartbeats.findIndex(h => h.agent_name === '${AGENT_NAME}');
    const entry = {
      agent_name: '${AGENT_NAME}',
      last_alive: '${NOW}',
      run_id: ${GITHUB_RUN_ID:-0},
      status: '${SKYEYE_STATUS}',
      job_status: '${STATUS}',
      reported_at: '${NOW}'
    };

    if (idx >= 0) {
      data.heartbeats[idx] = entry;
    } else {
      data.heartbeats.push(entry);
    }

    data.last_updated = '${NOW}';
    data.total_eyes = data.heartbeats.length;

    // Calculate earth health
    const alive = data.heartbeats.filter(h => h.status === 'healthy').length;
    const total = data.heartbeats.length;
    data.alive_eyes = alive;
    data.dead_eyes = total - alive;
    data.coverage = total > 0 ? Math.round(alive * 100 / total) + '%' : '0%';

    fs.writeFileSync('${HEARTBEAT_FILE}', JSON.stringify(data, null, 2));
    console.log('📊 地球状态: ' + alive + '/' + total + ' 存活 (' + data.coverage + ')');
  " 2>/dev/null || echo "⚠️ 心跳更新失败（node 不可用）"
fi

echo "👁️ 天眼报告完成 · ${NOW}"
