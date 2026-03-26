#!/usr/bin/env bash
# ━━━ 天眼心跳脚本 · SkyEye Heartbeat v4.0 ━━━
# 每个 workflow 启动时自动调用
# 记录心跳到 signal-log/skyeye-heartbeat.json
# 版权：国作登字-2026-A-00037559 · 冰朔（ICE-GL∞）
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

set -euo pipefail

AGENT_NAME=""
RUN_ID=""
REPO_ROOT="$(git rev-parse --show-toplevel 2>/dev/null || echo '.')"
HEARTBEAT_FILE="${REPO_ROOT}/signal-log/skyeye-heartbeat.json"

while [[ $# -gt 0 ]]; do
  case $1 in
    --agent) AGENT_NAME="$2"; shift 2 ;;
    --run-id) RUN_ID="$2"; shift 2 ;;
    *) shift ;;
  esac
done

if [[ -z "$AGENT_NAME" ]]; then
  AGENT_NAME="${GITHUB_WORKFLOW:-unknown}"
fi

if [[ -z "$RUN_ID" ]]; then
  RUN_ID="${GITHUB_RUN_ID:-0}"
fi

NOW="$(date -u +%Y-%m-%dT%H:%M:%SZ)"

mkdir -p "$(dirname "$HEARTBEAT_FILE")"

# Read existing heartbeat file or create empty
if [[ -f "$HEARTBEAT_FILE" ]]; then
  EXISTING=$(cat "$HEARTBEAT_FILE")
else
  EXISTING='{"version":"4.0","heartbeats":[]}'
fi

# Create new heartbeat entry
NEW_ENTRY=$(cat <<EOF
{
  "agent_name": "${AGENT_NAME}",
  "last_alive": "${NOW}",
  "run_id": ${RUN_ID},
  "status": "healthy"
}
EOF
)

# Update heartbeat file using node if available, otherwise use simple append
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

    const entry = ${NEW_ENTRY};

    // Update existing entry or add new
    const idx = data.heartbeats.findIndex(h => h.agent_name === entry.agent_name);
    if (idx >= 0) {
      data.heartbeats[idx] = entry;
    } else {
      data.heartbeats.push(entry);
    }

    data.last_updated = '${NOW}';
    data.total_eyes = data.heartbeats.length;

    fs.writeFileSync('${HEARTBEAT_FILE}', JSON.stringify(data, null, 2));
  "
else
  echo "$EXISTING" | python3 -c "
import json, sys
try:
    data = json.load(sys.stdin)
except:
    data = {'version': '4.0', 'heartbeats': []}
if 'heartbeats' not in data:
    data['heartbeats'] = []
entry = json.loads('${NEW_ENTRY}')
found = False
for i, h in enumerate(data['heartbeats']):
    if h.get('agent_name') == entry['agent_name']:
        data['heartbeats'][i] = entry
        found = True
        break
if not found:
    data['heartbeats'].append(entry)
data['last_updated'] = '${NOW}'
data['total_eyes'] = len(data['heartbeats'])
print(json.dumps(data, indent=2, ensure_ascii=False))
" > "${HEARTBEAT_FILE}.tmp" && mv "${HEARTBEAT_FILE}.tmp" "$HEARTBEAT_FILE"
fi

echo "👁️ 天眼心跳已记录 · ${AGENT_NAME} · ${NOW}"
