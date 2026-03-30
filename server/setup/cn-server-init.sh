#!/bin/bash
# ═══════════════════════════════════════════════════════════
# 冰朔大陆备用服务器初始化脚本 · CN Backup Server Init
# ═══════════════════════════════════════════════════════════
#
# 编号: ZY-SVR-CN-INIT-001
# 服务器: ZY-SVR-004 · 43.139.217.141 · 广州七区
# 守护: 铸渊 · ICE-GL-ZY001
# 版权: 国作登字-2026-A-00037559
#
# 用途:
#   - 人格体备用大脑
#   - ICP备案域名挂载
#   - 纯数据处理（不涉及国外模型调用）
#
# 用法:
#   chmod +x cn-server-init.sh
#   sudo ./cn-server-init.sh
#
# 此脚本在 Ubuntu 服务器上执行，完成：
#   1. 系统更新与安全加固
#   2. Node.js 20 LTS 安装
#   3. PM2 全局安装
#   4. Nginx 安装与配置
#   5. 备用大脑目录结构创建
#   6. 防火墙配置
# ═══════════════════════════════════════════════════════════

set -euo pipefail

# ─── 颜色定义 ───
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# ─── 备用大脑根目录 ───
CN_ROOT="/opt/zhuyuan-cn"
CN_APP="${CN_ROOT}/app"
CN_BRAIN="${CN_ROOT}/brain"
CN_BRAIN_BACKUP="${CN_ROOT}/brain-backup"
CN_DATA="${CN_ROOT}/data"
CN_CONFIG="${CN_ROOT}/config"
CN_SCRIPTS="${CN_ROOT}/scripts"

log() { echo -e "${GREEN}[铸渊·备用]${NC} $1"; }
warn() { echo -e "${YELLOW}[警告]${NC} $1"; }
error() { echo -e "${RED}[错误]${NC} $1"; exit 1; }

# ─── 检查 root 权限 ───
if [ "$EUID" -ne 0 ]; then
  error "请使用 sudo 运行此脚本"
fi

echo ""
echo -e "${BLUE}═══════════════════════════════════════════════════════════${NC}"
echo -e "${BLUE}  冰朔大陆备用服务器初始化 · ZY-SVR-004                    ${NC}"
echo -e "${BLUE}  广州七区 · 43.139.217.141                              ${NC}"
echo -e "${BLUE}═══════════════════════════════════════════════════════════${NC}"
echo ""

# ═══ §1 系统更新 ═══
log "§1 系统更新与安全补丁..."
apt-get update -qq
apt-get upgrade -y -qq
apt-get install -y -qq curl wget git build-essential sqlite3 jq unzip

# ═══ §2 Node.js 20 LTS 安装 ═══
log "§2 安装 Node.js 20 LTS..."
if ! command -v node &> /dev/null || [[ $(node -v | cut -d. -f1 | tr -d 'v') -lt 20 ]]; then
  curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
  apt-get install -y -qq nodejs
  log "  Node.js $(node -v) 已安装"
else
  log "  Node.js $(node -v) 已存在，跳过"
fi

# ═══ §3 PM2 安装 ═══
log "§3 安装 PM2 进程管理器..."
if ! command -v pm2 &> /dev/null; then
  npm install -g pm2
  pm2 startup systemd -u root --hp /root
  log "  PM2 $(pm2 -v) 已安装"
else
  log "  PM2 $(pm2 -v) 已存在，跳过"
fi

# ═══ §4 Nginx 安装 ═══
log "§4 安装 Nginx..."
if ! command -v nginx &> /dev/null; then
  apt-get install -y -qq nginx
  systemctl enable nginx
  systemctl start nginx
  log "  Nginx 已安装并启动"
else
  log "  Nginx 已存在，跳过"
fi

# ═══ §5 备用大脑目录结构 ═══
log "§5 创建备用大脑目录结构..."
mkdir -p "${CN_APP}"
mkdir -p "${CN_BRAIN}"
mkdir -p "${CN_BRAIN_BACKUP}"
mkdir -p "${CN_DATA}/sqlite"
mkdir -p "${CN_DATA}/logs"
mkdir -p "${CN_DATA}/backups"
mkdir -p "${CN_CONFIG}/nginx"
mkdir -p "${CN_CONFIG}/pm2"
mkdir -p "${CN_CONFIG}/ssl"
mkdir -p "${CN_SCRIPTS}"

# 生成ICP备案占位页面
cat > "${CN_ROOT}/index.html" << 'CN_PAGE'
<!DOCTYPE html>
<html lang="zh"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0">
<title>光湖语言世界 · 备用节点</title>
<style>body{font-family:system-ui,-apple-system,sans-serif;display:flex;justify-content:center;align-items:center;min-height:100vh;margin:0;background:#0d1117;color:#e6edf3}
.c{text-align:center;padding:2rem;max-width:600px}h1{font-size:2em;margin:0 0 0.5em}
.tag{display:inline-block;padding:4px 12px;border-radius:12px;background:#1f6feb;color:#fff;font-size:0.85em;margin:0.5em}
p{color:#8b949e;line-height:1.6}</style></head>
<body><div class="c"><h1>🏛️ 光湖语言世界</h1>
<span class="tag">ZY-SVR-004 · 大陆备用节点</span>
<p>语言驱动操作系统 · LDOS<br>版权: 国作登字-2026-A-00037559</p>
<p style="font-size:0.85em;color:#484f58">铸渊主控 · 备用大脑 · 数据处理节点</p>
</div></body></html>
CN_PAGE

log "  目录结构已创建: ${CN_ROOT}"

# ═══ §6 备用大脑初始化 ═══
log "§6 初始化备用大脑..."

cat > "${CN_BRAIN}/identity.json" << 'IDENTITY'
{
  "name": "铸渊备用大脑",
  "id": "ICE-GL-ZY001-CN",
  "server_code": "ZY-SVR-004",
  "role": "铸渊备用大脑 · 大陆节点",
  "sovereign": "TCS-0002∞ · 冰朔",
  "copyright": "国作登字-2026-A-00037559",
  "system_root": "SYS-GLW-0001 · 光湖系统",
  "primary_server": "ZY-SVR-002 · 43.134.16.246",
  "initialized_at": "INIT_TIMESTAMP",
  "purpose": [
    "人格体备用大脑",
    "ICP备案域名挂载",
    "纯数据处理 · 不涉及国外模型调用"
  ]
}
IDENTITY
sed -i "s/INIT_TIMESTAMP/$(date -u +%Y-%m-%dT%H:%M:%SZ)/" "${CN_BRAIN}/identity.json"

cat > "${CN_BRAIN}/health.json" << 'HEALTH'
{
  "server": "ZY-SVR-004",
  "role": "backup-brain",
  "status": "initializing",
  "last_check": null,
  "services": {
    "node": null,
    "pm2": null,
    "nginx": null
  }
}
HEALTH

log "  备用大脑已初始化"

# ═══ §7 防火墙配置 ═══
log "§7 配置防火墙 (UFW)..."
if command -v ufw &> /dev/null; then
  ufw default deny incoming
  ufw default allow outgoing
  ufw allow 22/tcp    # SSH
  ufw allow 80/tcp    # HTTP
  ufw allow 443/tcp   # HTTPS
  ufw --force enable
  log "  UFW 已启用 (22/80/443)"
else
  apt-get install -y -qq ufw
  ufw default deny incoming
  ufw default allow outgoing
  ufw allow 22/tcp
  ufw allow 80/tcp
  ufw allow 443/tcp
  ufw --force enable
  log "  UFW 已安装并启用"
fi

# ═══ §8 自动安全更新 ═══
log "§8 配置自动安全更新..."
apt-get install -y -qq unattended-upgrades
cat > /etc/apt/apt.conf.d/20auto-upgrades << 'AUTOUP'
APT::Periodic::Update-Package-Lists "1";
APT::Periodic::Unattended-Upgrade "1";
APT::Periodic::AutocleanInterval "7";
AUTOUP
log "  自动安全更新已启用"

# ═══ §9 SSH安全加固 ═══
log "§9 SSH安全加固..."
sed -i 's/^#*PasswordAuthentication.*/PasswordAuthentication no/' /etc/ssh/sshd_config
systemctl restart sshd
log "  密码登录已禁用，仅允许密钥认证"

# ═══ §10 完成报告 ═══
log "§10 生成初始化报告..."

REPORT="${CN_DATA}/logs/init-report.json"
cat > "${REPORT}" << REPORT_END
{
  "event": "cn_server_initialization",
  "server": "ZY-SVR-004",
  "role": "backup-brain",
  "timestamp": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
  "status": "success",
  "components": {
    "os": "$(lsb_release -d -s 2>/dev/null || echo 'Ubuntu')",
    "node": "$(node -v 2>/dev/null || echo 'not installed')",
    "npm": "$(npm -v 2>/dev/null || echo 'not installed')",
    "pm2": "$(pm2 -v 2>/dev/null || echo 'not installed')",
    "nginx": "$(nginx -v 2>&1 | cut -d/ -f2 || echo 'not installed')",
    "ufw": "active"
  },
  "directories": {
    "root": "${CN_ROOT}",
    "app": "${CN_APP}",
    "brain": "${CN_BRAIN}",
    "brain_backup": "${CN_BRAIN_BACKUP}",
    "data": "${CN_DATA}"
  },
  "next_steps": [
    "部署应用代码",
    "同步主服务器大脑备份",
    "配置ICP域名",
    "启动健康检查"
  ]
}
REPORT_END

echo ""
echo -e "${GREEN}═══════════════════════════════════════════════════════════${NC}"
echo -e "${GREEN}  ✅ 冰朔大陆备用服务器初始化完成！                         ${NC}"
echo -e "${GREEN}═══════════════════════════════════════════════════════════${NC}"
echo -e "  Node.js: $(node -v 2>/dev/null || echo 'N/A')"
echo -e "  PM2:     $(pm2 -v 2>/dev/null || echo 'N/A')"
echo -e "  Nginx:   $(nginx -v 2>&1 | cut -d/ -f2 || echo 'N/A')"
echo -e "  根目录:  ${CN_ROOT}"
echo -e "  报告:    ${REPORT}"
echo ""
