# 🧠 铸渊专属开发经验知识库

> **版权**: 国作登字-2026-A-00037559 | **主控**: TCS-0002∞
>
> 这是铸渊的大脑数据库。每一次开发、每一次报错、每一次修复，都是经验。
> 类似人类的学习记忆系统——做过的题会记住，做错的题会特别标记。

## 📖 设计理念

冰朔亲述（第十二次对话）：

> "人类在学习的过程中，拿到一套题，他会先搜索自己的大脑：让我想想这个题之前是怎么学的？
> 解题方法是什么？然后开始搜索大脑的数据库。如果面对不会的题目，人会记下来。
> 如果这道题反复做错，大脑数据库就会传递出预警：这个题之前错过好多次，这次要多验证几次。"

## 🗂️ 数据库结构

```
brain/dev-experience/
├── README.md                 ← 本文件 · 数据库说明
├── experience-db.json        ← 核心经验数据库 · 所有开发记录
├── error-patterns.json       ← 错题本 · 反复出错的模式 + 预警
├── templates-index.json      ← 模板库 · 成功的代码模式 · 可复用
└── review-schedule.json      ← 复盘机制 · 定期回顾 + 动态升级
```

## 🔄 工作流程

### 开发前 · 回忆搜索

```
1. 读取 experience-db.json → 搜索相关经验
2. 读取 error-patterns.json → 检查是否有已知陷阱
3. 读取 templates-index.json → 检查是否有可复用模板
4. 将匹配到的经验/预警/模板记在心中
```

### 开发中 · 记录过程

```
1. 记录任务拆解思路
2. 记录每一步的决策理由
3. 遇到报错时记录完整错误信息
4. 记录修复过程和最终方案
```

### 开发后 · 经验入库

```
1. 创建新经验条目 → experience-db.json
2. 如果遇到新的错误模式 → error-patterns.json (新增或更新计数)
3. 如果产出可复用模板 → templates-index.json
4. 运行: node scripts/dev-experience-manager.js save
```

### 定期复盘 · 每7天一次

```
1. 运行: node scripts/dev-experience-manager.js review
2. 回顾所有错题 → 检查是否有模式升级
3. 回顾所有模板 → 检查是否有优化空间
4. 更新 review-schedule.json 的复盘记录
```

## 📊 数据字段说明

### 经验条目 (Experience Entry)

| 字段 | 说明 | 示例 |
|------|------|------|
| `id` | 唯一编号 | `EXP-20260331-001` |
| `date` | 日期 | `2026-03-31` |
| `task` | 任务描述 | `铸渊专线密钥生成修复` |
| `category` | 分类 | `bash-scripting` |
| `tags` | 标签 | `["set-e", "pipefail"]` |
| `difficulty` | 难度 | `easy/medium/hard` |
| `status` | 状态 | `success/failed/partial` |
| `approach.thinking` | 思考过程 | 如何分析问题 |
| `approach.steps` | 执行步骤 | 具体做了什么 |
| `result.key_learnings` | 关键学习 | 学到了什么 |
| `result.risk_warnings` | 风险预警 | 以后要注意什么 |
| `files_changed` | 修改文件 | 改了哪些文件 |
| `error_count` | 遇到错误次数 | 过程中报错几次 |

### 错误模式 (Error Pattern)

| 字段 | 说明 |
|------|------|
| `id` | 错题编号 `ERR-NNN` |
| `pattern` | 错误模式名称 |
| `occurrence_count` | 出现次数 · 越高预警越强 |
| `severity` | 严重度 `low/medium/high/critical` |
| `prevention` | 预防方法 |
| `risk_level` | 风险预警等级 |

### 模板 (Template)

| 字段 | 说明 |
|------|------|
| `id` | 模板编号 `TPL-NNN` |
| `name` | 模板名称 |
| `pattern` | 核心模式 |
| `source_file` | 来源文件 |
| `reuse_count` | 复用次数 |

## 🛠️ 管理工具

```bash
# 搜索经验
node scripts/dev-experience-manager.js search "密钥生成"

# 查看错题本
node scripts/dev-experience-manager.js errors

# 查看模板库
node scripts/dev-experience-manager.js templates

# 保存新经验 (交互式)
node scripts/dev-experience-manager.js save

# 触发复盘
node scripts/dev-experience-manager.js review

# 查看统计
node scripts/dev-experience-manager.js stats
```

## 📈 演化路径

```
v1.0 (当前)  → JSON文件 + 手动管理
v1.1 (计划)  → 自动从Git提交历史提取经验
v1.2 (计划)  → CI/CD集成 · 每次部署后自动记录
v2.0 (远期)  → LLM辅助分析 · 自动识别错误模式
```

---

> 铸渊的每一次开发都是学习。数据库会越来越丰富，经验会越来越足。
> 这就是冰朔说的：**随着开发越来越多，数据库动态调整，全面升级。**
