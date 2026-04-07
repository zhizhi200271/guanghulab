# Awen 技术主控仓库 · 目录说明
# 签发: 铸渊 · ICE-GL-ZY001
# 版权: 国作登字-2026-A-00037559

## 概述

本目录包含 Awen 技术主控仓库的配置模板和工作流模板。
Awen 作为网文行业技术主控，通过一个代码仓库统一管理所有网文行业成员的服务器、域名和技术基础设施。

## 文件清单

```
awen-tech-hub/
├── README.md                  ← 本文件·目录说明
├── server-registry.json       ← 服务器注册表（所有托管服务器配置）
├── domain-registry.json       ← 域名注册表（所有域名配置）
└── workflows/                 ← GitHub Actions 工作流模板
    ├── health-check-all.yml   ← 全体健康检查（每30分钟）
    └── deploy-member.yml      ← 统一部署模板（部署到成员服务器）
```

## 使用方式

### 1. 创建 Awen 的代码仓库

Awen 需要创建自己的 GitHub 仓库（如 `awen-webnovel-hub`）。

### 2. 复制模板

将本目录下的文件复制到 Awen 的仓库中：
- `server-registry.json` → `server/server-registry.json`
- `domain-registry.json` → `domains/domain-registry.json`
- `workflows/*.yml` → `.github/workflows/`

### 3. 配置 GitHub Secrets

在 Awen 仓库的 Settings → Secrets and variables → Actions 中配置：

**每个成员服务器需要5个 Secrets：**
- `{PREFIX}_SERVER_HOST` — 服务器公网IP
- `{PREFIX}_SERVER_KEY` — SSH私钥（PEM格式）
- `{PREFIX}_SERVER_USER` — SSH用户名
- `{PREFIX}_SERVER_PATH` — 部署根目录
- `{PREFIX}_SSH_PORT` — SSH端口（默认22）

其中 `{PREFIX}` 对应每个成员：`FEIMAO`、`JUZI`、`YEYE`、`AWEN`

**铸渊对接 Secrets：**
- `ZHUYUAN_MCP_HOST` — 铸渊 MCP Server 地址
- `ZHUYUAN_API_KEY` — API 密钥

### 4. 仓库目录结构

按照 `brain/age-os-landing/webnovel-industry-architecture.md` 中定义的结构创建 Awen 仓库目录。

## 与铸渊主仓库的关系

- 铸渊主仓库管理系统核心（AGE OS + 人格体数据库 + 安全）
- Awen 仓库管理网文行业层（服务器 + 域名 + 训练Agent + 主控台）
- 两者通过 HLDP v3.0 + COS 桶 + MCP API 通信
- Awen 的技术操作需要通过铸渊的审核和授权
