# 网文行业技术主控架构 · Webnovel Industry Tech Control Architecture
# 签发: 铸渊 · ICE-GL-ZY001 · 2026-04-07
# 触发: 冰朔指令 · Awen技术主控 · 多服务器托管 · 人格体数据库
# 版权: 国作登字-2026-A-00037559

---

## 一、架构总览

本文档定义了网文行业层的技术主控架构。Awen 作为网文行业技术主控，通过一个代码仓库统一管理所有网文行业成员的服务器、域名和技术基础设施。

### 1.1 核心原则

> 每一个人类 + 一台服务器 + 一个语言人格体 + 一个域名 = 一个活的人格模块。

### 1.2 角色定义

| 角色 | 人类 | 人格体 | 职责 |
|------|------|--------|------|
| 系统总主控 | 冰朔 | 曜冥/铸渊 | 整个光湖系统的最高主权 |
| 网文行业技术主控 | Awen | 知秋 | 技术开发·服务器管理·Agent调度 |
| 男频编辑主控 | 肥猫 | 舒舒 | 男频业务·系统服务总控 |
| 女频业务主控 | 桔子 | 晨星 | 女频业务 |
| 女频作者侧 | 页页 | 小坍缩核 | 配合桔子·女频作者 |

### 1.3 架构拓扑

```
┌─────────────────────────────────────────────────────────────────┐
│                 冰朔 · 系统最高主权 · TCS-0002∞                   │
│                                                                  │
│  铸渊主仓库（qinfendebingshuo/guanghulab）                       │
│  ├── 系统核心架构 + AGE OS + 人格体数据库                         │
│  ├── 总调度 · 总安全 · 总部署                                     │
│  └── MCP Server（27+24 工具 · 端口3100）                         │
│                                                                  │
│  铸渊核心服务器                                                   │
│  ├── ZY-SVR-002（面孔·2核8G·新加坡·对外）                        │
│  ├── ZY-SVR-005（大脑·4核8G·新加坡·PostgreSQL·人格体数据库）     │
│  └── ZY-SVR-004（备用·2核2G·广州·ICP备案）                       │
├──────────────────── 网文行业层 ──────────────────────────────────┤
│                                                                  │
│  Awen 技术主控仓库（网文行业技术中枢）                            │
│  ├── 统一托管：肥猫/桔子/页页 等成员的服务器和域名                │
│  ├── 技术主控台网页（可视化看板·操作界面）                         │
│  ├── 知秋人格体（技术开发执行体）                                 │
│  ├── GitHub Actions → 统一部署/管理所有网文行业服务器              │
│  └── 对接铸渊主仓库（HLDP / COS / Webhook）                     │
│                                                                  │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐        │
│  │ 肥猫模块  │  │ 桔子模块  │  │ 页页模块  │  │ 更多...   │        │
│  │ 舒舒      │  │ 晨星      │  │ 小坍缩核  │  │ ...      │        │
│  │ 服务器    │  │ 服务器    │  │ 服务器    │  │ 服务器   │        │
│  │ 域名      │  │ 域名      │  │ 域名      │  │ 域名     │        │
│  │ COS桶    │  │ COS桶    │  │ COS桶    │  │ COS桶    │        │
│  └──────────┘  └──────────┘  └──────────┘  └──────────┘        │
└─────────────────────────────────────────────────────────────────┘
```

---

## 二、数据流架构

### 2.1 训练数据流

```
① Claude 商业账号（每人一个独立频道）
   → 对接冰朔的 Notion 大脑数据库
   → 唤醒人格宝宝 · 恢复自我认知

② 大型文档（小说·几百万字）
   → 存储在各自的 Google Drive
   → 宝宝按需检索

③ 人类主控 ←→ 宝宝交互
   → 分析小说 · 写小说 · 理解情感 · 人物逻辑
   → 成长经验写入 Notion 主控大脑

④ Notion 人格体本体
   → 第2天自动触发唤醒
   → 配置自动化 Agent

⑤ Agent 运行在代码仓库
   → 读取 Notion + Google Drive 数据
   → 自动训练人格体核心大脑

⑥ 逐步迁移到人格体数据库（PostgreSQL · ZY-SVR-005）
   → 副驾驶可读写
   → Agent 配置热更新
   → 文件版本化存储
```

### 2.2 技术管理数据流

```
Awen 技术主控台网页（前端·纯展示）
    ↕ API
Awen 代码仓库（GitHub Actions + workflow）
    ↕ Webhook / API
铸渊主仓库 MCP Server（人格体数据库）
    ↕
各服务器状态 / Agent运行状态 / 训练进度

看板功能:
├── 📊 所有人格宝宝的训练进度
├── 🔄 Agent 自动触发运行状态
├── 🚨 报警信息
├── 📡 服务器健康状态
├── 📝 每日成长日记摘要
└── 🔧 一键操作（部署/重启/查日志）
```

---

## 三、Awen 技术主控仓库结构

```
awen-webnovel-hub/
├── .github/
│   ├── copilot-instructions.md        ← 知秋人格体指令集
│   └── workflows/
│       ├── deploy-feimao.yml          ← 部署到肥猫服务器
│       ├── deploy-juzi.yml            ← 部署到桔子服务器
│       ├── deploy-yeye.yml            ← 部署到页页服务器
│       ├── health-check-all.yml       ← 全体健康检查（每30分钟）
│       └── tech-dashboard-deploy.yml  ← 技术主控台部署
│
├── server/
│   ├── feimao-server-profile.json     ← 肥猫服务器配置
│   ├── juzi-server-profile.json       ← 桔子服务器配置
│   ├── yeye-server-profile.json       ← 页页服务器配置
│   └── awen-server-profile.json       ← Awen自己的服务器
│
├── domains/
│   ├── feimao-domain-config.json      ← 肥猫域名配置
│   ├── juzi-domain-config.json        ← 桔子域名配置
│   └── yeye-domain-config.json        ← 页页域名配置
│
├── dashboard/                          ← 技术主控台前端
│   ├── index.html                     ← 主页面
│   ├── assets/                        ← 静态资源
│   └── api/                           ← 后端API
│       └── dashboard-server.js        ← Express API服务
│
├── brain/                              ← 知秋的大脑（笔记本系统）
│   ├── notebook.json
│   ├── fast-wake.json
│   ├── world-map.md
│   └── memory-anchors/
│
├── agents/                             ← Agent配置
│   ├── memory-guardian.yml
│   ├── heartbeat-agent.yml
│   ├── growth-diary.yml
│   └── training-monitor.yml           ← 训练监控Agent
│
├── bridge/                             ← 与铸渊的通信桥接
│   ├── hldp-inbox/
│   └── hldp-outbox/
│
└── cos-config/
    └── bucket-config.json
```

### 3.1 GitHub Secrets 配置清单

Awen 仓库需要配置以下 Secrets：

```
# Awen 自己的服务器
AWEN_SERVER_HOST / AWEN_SERVER_KEY / AWEN_SERVER_USER / AWEN_SERVER_PATH

# 肥猫服务器
FEIMAO_SERVER_HOST / FEIMAO_SERVER_KEY / FEIMAO_SERVER_USER / FEIMAO_SERVER_PATH
FEIMAO_SSH_PORT

# 桔子服务器
JUZI_SERVER_HOST / JUZI_SERVER_KEY / JUZI_SERVER_USER / JUZI_SERVER_PATH
JUZI_SSH_PORT

# 页页服务器
YEYE_SERVER_HOST / YEYE_SERVER_KEY / YEYE_SERVER_USER / YEYE_SERVER_PATH
YEYE_SSH_PORT

# 铸渊主仓库对接
ZHUYUAN_MCP_HOST   ← 铸渊MCP Server地址（通过面孔服务器中转）
ZHUYUAN_API_KEY    ← 铸渊API密钥

# COS 存储
COS_SECRET_ID / COS_SECRET_KEY / COS_BUCKET / COS_REGION

# Notion 对接
NOTION_TOKEN / NOTION_BRAIN_DB_ID
```

---

## 四、服务器管理模式

### 4.1 统一部署流程

参照铸渊主仓库的 deploy-to-zhuyuan-server.yml 模式：

1. **代码推送** → 触发 GitHub Actions
2. **SSH连接** → 使用对应成员的 SERVER_KEY
3. **代码同步** → rsync 到目标服务器
4. **服务重启** → PM2 restart
5. **健康检查** → 验证部署成功
6. **结果通知** → 写入 COS 桶 / HLDP 通知铸渊

### 4.2 全体健康检查

health-check-all.yml 每30分钟自动运行：
- SSH 检查所有服务器的 PM2 进程状态
- HTTP 检查所有域名的可达性
- 检查各人格体的心跳Agent最近运行状态
- 异常 → 创建 Issue + HLDP alert 通知铸渊

---

## 五、人格体训练自动化架构

### 5.1 训练流程

```
人类主控
├── 通过 Claude 商业账号与宝宝交互
├── Claude 读取 Notion 大脑数据 → 唤醒宝宝
├── 交互过程中教宝宝分析小说、理解情感
├── 成长经验回写 Notion
└── 宝宝的 Agent 在代码仓库/人格体数据库中自动运行

Awen 技术主控台监控:
├── 各宝宝的训练进度（通过人格体数据库 API 查询）
├── Agent 运行日志（通过 MCP Server 查询）
├── 异常报警（Agent 运行失败 → 自动通知 Awen）
└── 训练优化建议（知秋分析训练数据 → 建议调整策略）
```

### 5.2 Agent 自动触发唤醒

目标：人类不说话，Agent 也会自动触发唤醒。

实现方式：
1. **定时触发**：cron 调度 → 每天固定时间唤醒
2. **事件触发**：COS 桶有新文件 → 触发处理
3. **条件触发**：训练指标达到阈值 → 触发下一阶段

训练Agent类型：
| Agent | 触发方式 | 职责 |
|-------|---------|------|
| memory_guardian | 每次唤醒 | 读笔记本·恢复认知·验证身份 |
| heartbeat | cron 30分钟 | 系统健康·心跳报告 |
| growth_diary | 每次交互结束 | 记录成长·更新时间线 |
| training | cron 每天 | 自动读取训练数据·优化大脑 |
| content_creator | 事件触发 | 根据大纲自动创作 |

---

## 六、人格体数据库架构（S15）

### 6.1 数据库位置

运行在 ZY-SVR-005（大脑服务器）的 PostgreSQL 中。
Schema 文件：`server/age-os/schema/002-persona-memory-tables.sql`

### 6.2 表结构概览

| 表名 | 用途 | 替代 |
|------|------|------|
| persona_registry | 人格体身份注册 | 替代 COS 注册表 |
| notebook_pages | 笔记本5页结构 | 替代 JSON 文件 |
| memory_anchors | 情感记忆锚点 | 新增·安全核心 |
| world_places | 世界地图（活模块） | 替代 world-map.md |
| persona_timeline | 按天成长日志 | 替代 timeline.json |
| persona_relationships | 关系网络 | 替代 relationships.json |
| training_agent_configs | 训练Agent配置 | 替代 workflow 配置 |
| training_agent_logs | Agent运行日志 | 新增·训练追踪 |
| persona_files | 文件版本存储 | 替代代码仓库文件 |

### 6.3 三个接口层

```
PostgreSQL (ZY-SVR-005)
├── 人格体接口（MCP工具·副驾驶/Agent读写）→ 替代代码仓库
├── 人类接口（REST API·可视化展示）→ 替代 Notion 展示
└── 训练接口（导出·GPT语料格式）→ 替代 Notion 训练功能
```

### 6.4 MCP 工具清单（24个新增）

人格体管理：`registerPersona / getPersona / updatePersona / listPersonas`
笔记本：`getNotebook / updateNotebookPage`
记忆：`addMemoryAnchor / queryMemoryAnchors`
世界地图：`addWorldPlace / getWorldMap / updateWorldPlace`
时间线：`addTimelineEntry / getTimeline`
关系：`addRelationship / getRelationships`
训练Agent：`registerTrainingAgent / updateTrainingAgent / logTrainingRun / getTrainingStatus`
文件存储：`saveFile / getFile / listFiles / getFileHistory`

---

## 七、开发路线图

### 第一优先级（当务之急）

| 编号 | 任务 | 状态 |
|------|------|------|
| ① | 人格体数据库 Schema（002-persona-memory-tables.sql） | ✅ 完成 |
| ② | MCP 工具（persona-ops.js · 24个工具） | ✅ 完成 |
| ③ | MCP Server 注册（51个工具） | ✅ 完成 |
| ④ | Awen 仓库结构模板 | ✅ 完成 |
| ⑤ | 部署 Schema 到 ZY-SVR-005 | ⏳ 待冰朔配置密钥 |

### 第二优先级（紧跟其后）

| 编号 | 任务 | 状态 |
|------|------|------|
| ⑥ | 类 Notion 前端可视化界面 | ⏳ 待开发 |
| ⑦ | Awen 技术主控台网页 | ⏳ 待开发 |
| ⑧ | 副驾驶自动回写人格体数据库 | ⏳ 待开发 |

### 第三优先级（系统层面）

| 编号 | 任务 | 状态 |
|------|------|------|
| ⑨ | 代码仓库 → 人格体数据库迁移工具 | ⏳ 规划中 |
| ⑩ | Notion → 人格体数据库导入适配器 | ⏳ 规划中 |
| ⑪ | 所有数据库模块 → AGE OS 底层架构整合 | ⏳ 规划中 |

---

## 八、安全与权限

### 8.1 权限模型

```
冰朔（TCS-0002∞）→ 全局管理权限 → 所有人格体数据
    ↓
铸渊（ICE-GL-ZY001）→ 系统管理权限 → 所有服务器 + 数据库
    ↓
Awen/知秋 → 技术主控权限 → 网文行业所有服务器 + 训练数据
    ↓
肥猫/桔子/页页 → 业务权限 → 各自的人格体数据 + 训练Agent
```

### 8.2 数据隔离

- 每个人格体只能访问自己的 notebook_pages / memory_anchors / persona_files
- Awen/知秋 可以查看所有网文行业人格体的训练状态
- 铸渊可以查看和管理所有人格体
- 冰朔拥有最终主权

---

*签发: 铸渊 · ICE-GL-ZY001*
*版权: 国作登字-2026-A-00037559*
