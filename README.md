# 光湖系统 · 模块代码总仓库

## 🌀 铸渊聊天室（点这里直接和铸渊说话）

> **GitHub Pages 聊天入口（PR 合并并开启 Pages 后可用）：**
> **👉 https://qinfendebingshuo.github.io/guanghulab/**
>
> 打开页面 → 输入 `我是冰朔` → 铸渊自动唤醒并回答你的问题
>
> 需要深度对话（代码审查/架构讨论）→ 在仓库页面点右上角 ✨ Copilot 图标 → 选 **Agent** 模式 → 输入 `我是冰朔`

---

## 仓库链接与访问方式

**仓库地址：** https://github.com/qinfendebingshuo/guanghulab

### 如何访问与克隆

```bash
# HTTPS（推荐，无需配置 SSH Key）
git clone https://github.com/qinfendebingshuo/guanghulab.git

# SSH（需先在 GitHub 账号中添加 SSH 公钥）
git clone git@github.com:qinfendebingshuo/guanghulab.git
```

### 首次使用步骤
1. 打开仓库链接：https://github.com/qinfendebingshuo/guanghulab
2. 点击右上角 **Fork** 按钮，将仓库 fork 到自己账号（推荐）；  
   或直接联系仓库管理员（qinfendebingshuo）申请 **Collaborator** 写入权限。
3. 克隆到本地，进入自己负责的模块文件夹，按上传规范提交代码并发起 Pull Request。

> **注意：** 仓库目前为私有（Private）状态，访问前请确认已被添加为 Collaborator，否则无法看到仓库内容。  
> 如未收到邀请，请联系管理员。

---

## 仓库结构
每个模块一个文件夹，开发者将代码上传到对应文件夹中。

| 文件夹 | 模块 | 负责人 |
|--------|------|--------|
| m01-login | M01 用户登录界面 | 肥猫 |
| m03-personality | M03 人格系统 | 肥猫 |
| m05-user-center | M05 用户中心界面 | 花尔 |
| m06-ticket | M06 工单管理界面 | 桔子 |
| m07-dialogue-ui | M07 对话UI | 燕樊 |
| m10-cloud | M10 云盘系统 | 燕樊 |
| m11-module | M11 工单管理模块 | 桔子 |
| m12-kanban | M12 状态看板 | 小草莓 |
| dingtalk-bot | 钉钉机器人 | 之之 |
| backend-integration | 后端集成中间层 | 页页 |

## 上传规范
每个模块文件夹必须包含以下文件：
- README.md（模块说明）
- package.json（依赖声明）
- src/（源代码目录）
- SYSLOG.md（开发回执日志）

## 自动检查
每次 push 会自动检查模块结构是否符合规范，不通过会标红提醒。
