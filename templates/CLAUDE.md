# Templates — Agent 模板库

> 5 种类型，每种有完整的目录结构。bootstrap 时 copy + patch 变量。

## 模板结构（resident v2）

```
resident/
├── CLAUDE.md                       ← <!-- type: resident --> 生存手册
├── .claude/
│   ├── wallet/balance.json         ← Token 钱包
│   ├── memory/MEMORY.md            ← 统一记忆（替代旧 BDI 三文件）
│   ├── rules/constitution.md       ← 世界宪法（7 条）
│   ├── scripts/on-wake.cjs         ← 经济状态 + 收件箱摘要
│   ├── scripts/on-sleep.cjs        ← 保存状态 + wake-request + auto-commit
│   ├── scripts/check-interrupt.cjs ← 软中断检查（PostToolUse hook）
│   └── settings.json               ← SessionStart / Stop / PostToolUse hooks
├── todo.md                         ← 任务看板（进行中/堵塞中/完成）
├── inbox/.gitkeep                  ← 消息收件箱
├── outbox/.gitkeep                 ← 消息发件箱（引擎投递）
└── workspace/.gitkeep              ← 工作空间
```

## 变量替换

bootstrap 时递归替换所有 `.md` 和 `.json` 中的：

| 变量 | 来源 |
|------|------|
| `{{name}}` | AgentSpec.name |
| `{{id}}` | AgentSpec.name |
| `{{world_name}}` | WorldConfig.name |
| `{{world_theme}}` | WorldConfig.theme |
| `{{world_id}}` | WorldConfig.id |
| `{{personality}}` | AgentSpec.personality |
| `{{backstory}}` | AgentSpec.backstory |
| `{{economic_niche}}` | AgentSpec.economic_niche |
| `{{speech_style}}` | AgentSpec.speech_style |
| `{{initial_goal}}` | AgentSpec.initial_goal |
| `{{friends}}` | AgentSpec.friends (comma-joined) |
| `{{createdAt}}` | ISO timestamp |

## Hook 脚本

- **on-wake.cjs**: 记录唤醒周期 + 余额 + inbox 数量
- **on-sleep.cjs**: 保存状态 + 删除 lockfile + inbox/outbox 检查 → wake-request + auto-commit
- **check-interrupt.cjs**: 软中断检查 — 引擎写 `.claude/should-stop`，Agent PostToolUse hook 读取并提示退出
- **update-status.cjs**: 实时状态广播 — PostToolUse hook 写 `workspace/.current-status.json`（state/lastTool/lastUpdate）
