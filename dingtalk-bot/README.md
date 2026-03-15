# 钉钉AI人格体「秋秋」· HoloLake dingtalk-bot

## 📋 项目简介

钉钉AI人格体「秋秋」，运行于钉钉 Stream 模式。在钉钉群内被 @秋秋 时，接收消息并调用 LLM 生成人格化回复，同时将消息记录写入 Notion SYSLOG 数据库。

## 🏗️ 系统架构

- **运行模式**：钉钉 Stream 模式（dingtalk-stream SDK，长连接）
- **进程管理**：pm2，进程名 `dingtalk-stream`
- **入口文件**：`index-stream.js`
- **错误处理**：LLM/Notion 调用失败时降级为固定回复，不影响消息接收主流程

## 📁 文件结构

| 文件 | 作用 |
|------|------|
| index-stream.js | Stream 模式主入口（接收消息 → AI回复 → Notion写入） |
| package.json | 依赖声明 |
| ecosystem.config.js | pm2 进程配置 |
| .env.example | 环境变量模板（不含真实值） |
| .gitignore | Git 忽略规则 |
| README.md | 本说明文档 |

## 🚀 快速开始

### 1. 安装依赖
```bash
cd dingtalk-bot
npm install
```

### 2. 配置环境变量
```bash
cp .env.example .env
# 编辑 .env 填入真实密钥
```

### 3. 启动（开发）
```bash
node index-stream.js
```

### 4. 启动（生产 · pm2）
```bash
pm2 start ecosystem.config.js --env production
pm2 logs dingtalk-stream -f --lines 0
```

## 🔄 部署流程

```bash
cd /opt/guanghulab-dingtalk/dingtalk-bot
git pull origin main
npm install
pm2 restart dingtalk-stream
pm2 logs dingtalk-stream -f --lines 0
```

## 🔑 环境变量说明

参见 `.env.example` 文件，真实密钥存储于服务器 `/opt/guanghulab-dingtalk/dingtalk-bot/.env`。