# 🌉 双端神经系统 · 桥接协议 v3.0

> 版权：国作登字-2026-A-00037559 · TCS-0002∞ 冰朔
> 创建：ZY-NEURAL-UPGRADE-2026-0325-R2-003
> 版本：v3.0.0

## 1. 协议概述

桥接协议 v3.0 是 Notion 和 GitHub 之间的标准通信语言。所有跨端通信必须遵循此协议。

## 2. 通信类型

| 类型 | 方向 | 说明 | 格式 |
|------|------|------|------|
| Type A · 上行日报 | GitHub → Notion | 每日 21:00 CST 汇总 | `daily-digest.json` |
| Type B · 下行指令 | Notion → GitHub | 按需下发 | `CMD-{date}-{seq}.json` |
| Type C · 执行回执 | GitHub → Notion | 每条指令执行后 | `CMD-{id}-receipt.json` |
| Type D · 工单 | 天眼内部 | 分析后按需 | `WO-{id}.json` |
| Type E · 紧急通知 | 双向 | P0 事件时 | `ALERT-{id}.json` |

## 3. 下行指令格式（Notion → GitHub）

文件路径：`data/deploy-queue/pending/CMD-{YYYYMMDD}-{SEQ}.json`

```json
{
  "_protocol": "neural-bridge-v3.0",
  "_type": "downstream_command",
  "command_id": "CMD-20260325-001",
  "parent_work_order": "WO-xxxx",
  "source": {
    "agent_id": "AG-TY-01",
    "agent_name": "天眼 Notion 大脑",
    "issued_at": "ISO-8601",
    "issued_reason": "说明"
  },
  "target": {
    "workflow_id": "workflow-id",
    "workflow_file": ".github/workflows/xxx.yml",
    "brain": "AG-XX-01"
  },
  "instruction": {
    "type": "trigger_workflow | run_script | modify_config",
    "params": {}
  },
  "constraints": {
    "priority": "P0 | P1 | P2",
    "timeout_hours": 24,
    "max_retries": 2,
    "requires_human_approval": false,
    "execution_window": { "start": "06:00 CST", "end": "23:00 CST" }
  },
  "expected_outcome": {
    "description": "预期结果",
    "verification": { "type": "check_workflow_status", "expected_conclusion": "success" }
  },
  "security": {
    "sfp": "⌜SFP::...⌝",
    "signature_chain": ["agent_id", "铸渊桥接层"]
  }
}
```

## 4. 执行回执格式（GitHub → Notion）

文件路径：`data/deploy-queue/completed/CMD-{id}-receipt.json`

```json
{
  "_protocol": "neural-bridge-v3.0",
  "_type": "execution_receipt",
  "receipt_id": "RCT-{date}-{seq}",
  "command_id": "CMD-对应指令ID",
  "executor": {
    "id": "ICE-GL-ZY001",
    "name": "铸渊",
    "started_at": "ISO-8601",
    "completed_at": "ISO-8601",
    "duration_seconds": 420
  },
  "result": {
    "status": "success | failure | partial",
    "summary": "执行摘要"
  },
  "security": { "sfp": "⌜SFP::AG-ZY::...⌝" }
}
```

## 5. 紧急通知格式

```json
{
  "_protocol": "neural-bridge-v3.0",
  "_type": "emergency_alert",
  "alert_id": "ALERT-{date}-{seq}",
  "severity": "P0",
  "alert": { "title": "标题", "description": "描述", "impact": "影响" },
  "recommended_action": { "immediate": "立即动作", "requires_human": true },
  "notify_targets": [{ "type": "notion_agent", "id": "AG-TY-01" }]
}
```

## 6. 安全校验流程

所有跨端通信必须携带 SFP 指纹。铸渊处理下行指令时执行：

1. **SFP 指纹校验** — 格式正确 + 签发者在 neural-map.json 中 + 时间戳 < 48h
2. **权限校验** — source.agent_id 有权管辖 target.workflow_id（查 neural-map.json）
3. **约束校验** — 当前时间在 execution_window 内 + 人工审批检查
4. **全部通过** → 执行

## 7. 超时 / 重试 / 降级策略

| 场景 | 超时 | 重试 | 降级 |
|------|------|------|------|
| 下行指令执行 | 按 timeout_hours | max_retries 次 | 移到 failed/ + 通知 |
| 上行日报推送 | 5 分钟 | 3 次 | 写入 .github/notion-cache/ |
| 紧急通知送达 | 2 分钟 | 5 次 | 缓存 + 下次巡检补送 |
| 工单下发 | 12 小时 | 2 次 | 标记 stuck + 通知霜砚 |
| 回执推送 | 5 分钟 | 3 次 | 缓存 + 下次同步补送 |

**降级铁律**：任何跨端通信失败都不能阻断本端的正常运行。桥断了，两端各自活着。桥修好了，自动同步。

## 8. 工单生命周期（7 状态机）

```
CREATED → ASSIGNED → COMMAND_ISSUED → EXECUTING → RECEIPT_RECEIVED → VERIFIED → CLOSED
                                                                    ↘ FAILED → ESCALATED
```

## 9. 文件目录

| 路径 | 说明 |
|------|------|
| `skyeye/neural-map.json` | 双端 Agent 映射表 |
| `skyeye/neural-analysis-rules.json` | 日报分析规则 |
| `data/deploy-queue/pending/` | 待执行的下行指令 |
| `data/deploy-queue/executing/` | 执行中的指令 |
| `data/deploy-queue/completed/` | 已完成（含回执） |
| `data/deploy-queue/failed/` | 执行失败 |
| `data/neural-reports/daily-digest/` | 每日汇总日报 |
| `data/neural-reports/work-orders/` | 天眼工单 |
| `scripts/neural/generate-daily-digest.js` | 日报生成器 |
| `scripts/neural/analyze-digest.js` | 日报分析引擎 |
| `scripts/neural/sync-digest-to-notion.js` | 日报推送 Notion |
| `scripts/neural/convert-workorder-to-command.js` | 工单→指令转化器 |
| `scripts/neural/track-work-orders.js` | 工单追踪器 |
