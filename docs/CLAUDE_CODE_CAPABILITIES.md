# Claude Code 能力边界报告

> 调研日期：2026-02-11
> Claude Code 版本：2.1.37
> 调研方法：CLI 实测 (`claude --help`) + 配置文件分析 + 文档检索

---

## 1. CLI 进程模型

### 已确认能力

- **版本**: 2.1.37
- **交互模式**: `claude` — 启动交互式会话
- **非交互模式**: `claude -p "prompt"` — 打印输出后退出，适用于管道
- **模型选择**: `--model <model>` — 支持别名 (`sonnet`, `opus`, `haiku`) 或完整名称 (`claude-sonnet-4-5-20250929`)
- **回合限制**: `--max-turns <n>` — 限制 agentic 回合数
- **预算控制**: `--max-budget-usd <amount>` — 限制 API 消费金额（仅 `--print` 模式）
- **会话恢复**:
  - `-c, --continue` — 继续当前目录最近的会话
  - `-r, --resume [id]` — 按 session ID 恢复，或交互式选择
  - `--session-id <uuid>` — 指定固定 session ID
  - `--fork-session` — 恢复时创建新 session ID（分叉）
- **权限模式**:
  - `--dangerously-skip-permissions` — 跳过所有权限检查
  - `--allow-dangerously-skip-permissions` — 允许但不默认跳过
  - `--permission-mode <mode>` — 可选：`acceptEdits`, `bypassPermissions`, `default`, `delegate`, `dontAsk`, `plan`
- **工具控制**:
  - `--allowedTools <tools...>` — 白名单，如 `"Bash(git:*) Edit"`
  - `--disallowedTools <tools...>` — 黑名单
  - `--tools <tools...>` — 指定可用工具列表，`""` 禁用全部，`default` 全部启用
- **输出格式**: `--output-format <format>` — `text`（默认）、`json`（单结果）、`stream-json`（流式）
- **输入格式**: `--input-format <format>` — `text`（默认）、`stream-json`（流式输入）
- **JSON Schema**: `--json-schema <schema>` — 结构化输出验证
- **系统提示**:
  - `--system-prompt <prompt>` — 替换默认系统提示
  - `--append-system-prompt <prompt>` — 追加到默认系统提示
- **Agent 定义**:
  - `--agent <agent>` — 使用指定 agent
  - `--agents <json>` — 内联 JSON 定义自定义 agents
- **多目录访问**: `--add-dir <dirs...>` — 添加额外允许访问的目录
- **MCP 配置**:
  - `--mcp-config <configs...>` — 从 JSON 文件加载 MCP 服务器
  - `--strict-mcp-config` — 仅使用指定的 MCP，忽略其他配置
- **调试**:
  - `-d, --debug [filter]` — 启用调试模式，可按类别过滤
  - `--debug-file <path>` — 调试日志写入文件
  - `--verbose` — 详细模式
- **设置源**: `--setting-sources <sources>` — 选择加载哪些设置（user, project, local）
- **会话持久化**: `--no-session-persistence` — 禁用会话持久化（仅 `--print` 模式）
- **Skill 控制**: `--disable-slash-commands` — 禁用所有 skills
- **插件**: `--plugin-dir <paths...>` — 加载插件目录
- **Chrome 集成**: `--chrome` / `--no-chrome`
- **IDE 集成**: `--ide` — 自动连接 IDE
- **PR 关联**: `--from-pr [value]` — 从 PR 恢复会话
- **文件资源**: `--file <specs...>` — 启动时下载文件资源
- **备用模型**: `--fallback-model <model>` — 主模型过载时自动切换（仅 `--print` 模式）
- **Beta**: `--betas <betas...>` — API 请求附加 beta header

### 已确认限制

- **无内置锁机制**: 多个 claude 进程可以并发运行在同一目录，无进程锁
- **`-p` 模式跳过信任对话**: `--print` 模式不显示工作区信任确认
- **`--max-budget-usd` 仅 print 模式**: 交互模式不支持预算限制
- **`--fallback-model` 仅 print 模式**: 交互模式不支持备用模型
- **无 cwd 参数**: 没有直接的 `--cwd` 参数，必须在 spawn 时通过进程的 cwd 设置
- **session 持久化默认开启**: 所有交互式会话自动保存到 `~/.claude/projects/`

### 对 Digital Utopia 的影响

- **唤醒实现**: `spawn('claude', ['-p', prompt, '--dangerously-skip-permissions', '--model', model, '--max-turns', N], { cwd: agentDir })`
- **并发安全**: 无内置锁 → 引擎必须自己实现进程池/信号量
- **预算控制**: 可用 `--max-budget-usd` 限制单次唤醒消费
- **工具限制**: 可用 `--allowedTools` 限制 agent 能力（如限制居民不能执行危险命令）
- **层级隔离**: 通过 `--system-prompt` 注入层级身份，通过 cwd 限制可见范围
- **输出捕获**: `--output-format json` 可获取结构化输出
- **会话恢复**: `--resume` + `--session-id` 可实现 agent 状态跨唤醒保持
- **多目录**: `--add-dir` 可让 agent 访问 commons/ 等共享目录

---

## 2. CLAUDE.md 系统

### 已确认能力

- **自动加载**: Claude Code 启动时自动读取 cwd 的 `CLAUDE.md` 和 `.claude/` 目录
- **层级加载**:
  1. 用户级: `~/.claude/CLAUDE.md`
  2. 项目级: `{project_root}/CLAUDE.md`
  3. 目录级: `{cwd}/CLAUDE.md`（如果 cwd != 项目根）
  4. `.claude/rules/*.md` — 所有规则文件自动加载
- **内容**: 纯 Markdown 文本，作为系统提示的一部分注入
- **rules 目录**: `.claude/rules/*.md` 中的所有文件都会被加载为项目规则
- **settings.json**: `.claude/settings.json`（项目级）和 `.claude/settings.local.json`（本地级，不提交）

### 已确认限制

- **无 `@file` 引用**: CLAUDE.md 不支持类似 `@import` 的文件引用语法
- **大小限制**: 过大的 CLAUDE.md 会占用大量上下文窗口，实际建议 < 200 行
- **加载顺序**: 用户级 → 项目级 → 目录级，后加载的不覆盖前面的，全部追加

### 对 Digital Utopia 的影响

- **身份注入**: 每个 agent 的 `CLAUDE.md` 定义其身份、行为规则、世界观
- **层级感知**: 居民的 CLAUDE.md 不提及上层存在 → 自然隔离
- **规则精简**: 规则要短（< 50 行），过长的 rules 会占上下文但不会被遵守
- **settings.json**: 可通过 settings.json 配置 hooks、权限，每个 agent 独立配置

---

## 3. Hook 系统

### 已确认能力

从实际配置文件验证，支持的 Hook 事件：

| 事件 | 触发时机 | 用途 |
|------|---------|------|
| `SessionStart` | 会话启动时 | 加载记忆、初始化环境 |
| `Stop` | 会话停止时（用户发起） | 保存状态、导出记录 |
| `SessionEnd` | 会话结束时（系统级） | 清理、归档 |
| `PreToolUse` | 工具调用前 | 拦截/修改/阻止工具调用 |
| `PostToolUse` | 工具调用后 | 审计、副作用 |

**Hook 配置格式**:
```json
{
  "hooks": {
    "SessionStart": [
      {
        "matcher": "startup",  // 可选，用于区分场景
        "hooks": [
          {
            "type": "command",
            "command": "node script.js",
            "timeout": 10,           // 秒
            "statusMessage": "加载中..."  // UI 显示
          }
        ]
      }
    ]
  }
}
```

- **matcher**: 字符串匹配器，可区分 "startup" vs "resume" 等场景
- **type**: 目前仅 `"command"`（执行 shell 命令）
- **timeout**: 超时时间（秒）
- **statusMessage**: 执行时的 UI 提示
- **多 Hook**: 一个事件可配置多个 hook，按顺序执行
- **两层配置**: 项目级 (`.claude/settings.json`) + 本地级 (`.claude/settings.local.json`)
- **PreToolUse 可阻止操作**: 返回非0退出码可阻止工具调用

### 已确认限制

- **无 cron/schedule**: Hook 不支持定时调度，只能由事件触发
- **无 FileWatcher**: 没有文件变化监听 hook
- **执行环境**: Hook 在项目根目录执行（cwd = 项目根）
- **无 stdin 输入**: Hook 只能通过退出码和 stdout 与系统交互

### 对 Digital Utopia 的影响

- **唤醒 Hook**: agent 的 `SessionStart` hook 加载记忆、报告状态
- **睡眠 Hook**: `Stop` hook 保存状态、写唤醒请求
- **定时唤醒由引擎负责**: Hook 不能自我定时，引擎必须外部定时 spawn 进程
- **工具审计**: `PostToolUse` 可记录 agent 的每次工具调用（消费追踪）
- **工具拦截**: `PreToolUse` 可阻止危险操作（如删除其他 agent 的文件）

---

## 4. 工具系统

### 内置工具完整列表

| 工具 | 功能 | 对 Digital Utopia 的用途 |
|------|------|------------------------|
| `Read` | 读取文件 | agent 读取记忆、收件箱、市场 |
| `Write` | 写入文件 | agent 创建工作产出、发消息 |
| `Edit` | 编辑文件（精确替换） | agent 更新状态文件 |
| `Bash` | 执行 shell 命令 | agent 运行代码、使用工具 |
| `Glob` | 文件模式匹配 | agent 搜索目录 |
| `Grep` | 内容搜索 | agent 搜索信息 |
| `WebFetch` | 获取网页内容 | agent 访问互联网 |
| `WebSearch` | 网络搜索 | agent 搜索信息 |
| `Task` | 启动子 agent | agent 雇佣子 agent |
| `TodoWrite` | 任务管理 | agent 管理自己的任务 |
| `NotebookEdit` | Jupyter notebook 编辑 | - |
| `AskUserQuestion` | 向用户提问 | - （agent 不应该向用户提问） |
| `EnterPlanMode` | 进入计划模式 | - |
| `Skill` | 调用 skill | agent 使用技能 |
| `TeamCreate` | 创建团队 | agent 组建团队 |
| `SendMessage` | 发送消息 | agent 间通信 |
| `TeamDelete` | 删除团队 | - |
| `ListMcpResourcesTool` | 列出 MCP 资源 | - |
| `ReadMcpResourceTool` | 读取 MCP 资源 | - |

### Task 工具 subagent_type 列表

| 类型 | 工具权限 | 用途 |
|------|---------|------|
| `Bash` | Bash only | 执行命令 |
| `general-purpose` | All tools | 通用任务 |
| `Explore` | 只读（无 Edit/Write） | 搜索探索 |
| `Plan` | 只读（无 Edit/Write） | 设计规划 |
| `orchestrator` | Read, Task, Grep, Glob | 调度 |
| `code-writer` | Read, Write, Edit, Grep, Glob, Bash | 写代码 |
| `code-reviewer` | Read, Grep, Glob, Bash | 审查代码 |
| `debugger` | Read, Write, Edit, Grep, Glob, Bash | 调试 |
| `refactor-expert` | Read, Write, Edit, Grep, Glob, Bash | 重构 |
| `research-assistant` | Read, Write, WebSearch, WebFetch, Grep, Glob | 研究 |
| `product-analyst` | Read, Write, WebSearch, Grep, Glob | 产品分析 |
| `browser-automation` | Chrome DevTools MCP tools | 浏览器自动化 |

### 工具控制

- `--allowedTools "Read Write Glob Grep"` — 只允许这些工具
- `--disallowedTools "Bash WebFetch"` — 禁止这些工具
- `--tools "Read,Write,Edit"` — 精确指定工具列表
- `Bash(git:*)` — 粒度到命令级别的 Bash 控制

### 对 Digital Utopia 的影响

- **居民工具集**: 可用 `--tools` 精确控制居民能用什么工具
- **层级工具差异**: 主脑全工具 → 管理者受限 → 居民最基础
- **子 agent 雇佣**: 居民可通过 `Task` 工具 spawn 子 agent（雇佣机制）
- **通信**: 直接用 `Write` 写入目标 agent 的 `inbox/` 目录

---

## 5. 权限模型

### 已确认能力

**`.claude/settings.local.json` 权限配置**:
```json
{
  "permissions": {
    "allow": [
      "WebSearch",
      "Bash(git:*)",
      "Bash(node:*)",
      "mcp__xxx__tool_name"
    ]
  }
}
```

- **粒度**: 工具级 (`Read`, `Write`) 或命令级 (`Bash(git:*)`, `Bash(npm:*)`)
- **MCP 工具**: `mcp__servername__toolname` 格式
- **Skill 工具**: `Skill(skill-name)` 格式
- **通配符**: `Bash(git:*)` 匹配所有 git 开头的命令

**`--dangerously-skip-permissions` 行为**:
- 跳过所有工具调用的用户确认
- 文件读写无需确认
- Bash 命令无需确认
- 适用于无人值守的 agent 场景

**`--permission-mode`**:
- `default` — 标准权限确认
- `bypassPermissions` — 等同于 `--dangerously-skip-permissions`
- `acceptEdits` — 自动接受文件编辑
- `dontAsk` — 不询问，但可能拒绝
- `plan` — 计划模式，需要批准
- `delegate` — 委托模式

### 已确认限制

- **无目录级沙盒**: 没有原生的"只能访问 cwd 下文件"限制，agent 技术上可以读写任何文件
- **权限白名单仅影响确认流程**: `--dangerously-skip-permissions` 下白名单无意义
- **无网络沙盒**: 没有原生的网络访问限制

### 对 Digital Utopia 的影响

- **安全隔离**: Claude Code 无原生目录沙盒 → 隔离必须通过 CLAUDE.md 软约束实现
- **agent 唤醒配置**: `--dangerously-skip-permissions` 是必须的（agent 无人看管）
- **真正的隔离**: 需要 Docker/容器 或操作系统级别的目录权限控制
- **软隔离 MVP**: CLAUDE.md 中规定"你只能访问自己的目录和 commons/"即可用于 MVP
- **硬隔离后期**: 用 `--allowedTools` 限制 + `PreToolUse` hook 检查路径

---

## 6. 记忆和持久化

### 已确认能力

- **Session 持久化**: 所有会话自动保存到 `~/.claude/projects/{project-hash}/`
- **Session 恢复**: `--continue` 恢复最近会话，`--resume <id>` 恢复指定会话
- **Auto Memory**: `~/.claude/projects/{hash}/memory/` — 跨会话持久化的自动笔记
- **CLAUDE.md**: 每次启动自动加载，是最可靠的持久化机制
- **文件系统**: agent 可以用文件系统持久化任何状态（JSON、MD 等）
- **Session ID**: `--session-id <uuid>` 可指定固定 ID，实现可预测的会话管理
- **Fork Session**: `--fork-session` 在恢复时创建分支

### 已确认限制

- **无内置数据库**: 没有 SQLite 或类似的结构化存储
- **上下文窗口有限**: 长对话会被压缩，早期消息可能丢失细节
- **session 文件格式**: JSONL 格式，不适合直接读取

### 对 Digital Utopia 的影响

- **agent 记忆**: 通过文件系统实现（IDENTITY.md, GOALS.md, TASKS.md）
- **唤醒恢复**: 可以用 `--resume` 让 agent 保持跨唤醒的上下文（但 token 消耗会增加）
- **MVP 方案**: 每次唤醒是新 session，通过 CLAUDE.md + rules + memory files 恢复状态
- **高级方案**: 用 `--session-id` 固定 session ID + `--continue` 实现真正的状态延续

---

## 7. Team/Agent 原生系统

### 已确认能力

- **实验性功能**: 需要环境变量 `CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1`
- **TeamCreate**: 创建团队，生成 `~/.claude/teams/{team-name}/config.json`
- **Task 启动 agent**: `Task` 工具可 spawn 子 agent，指定 `team_name` 加入团队
- **SendMessage**: 支持 DM、broadcast、shutdown_request/response
- **Agent 间通信**: 通过 inbox 文件系统 (`~/.claude/teams/{team}/inboxes/`)
- **Backend**: `"backendType": "in-process"` — agent 在当前进程内运行
- **自动消息投递**: 消息自动送达，无需手动轮询
- **Idle 机制**: agent 每轮结束后自动 idle，可被消息唤醒

### 已确认限制

- **实验性**: 需要手动开启 `CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1`
- **in-process**: 子 agent 共享父进程资源
- **write 权限问题**: Plan 类型 agent 没有 Write/Edit 权限
- **进程不稳定**: 团队 agent 有时会挂起不响应

### 对 Digital Utopia 的影响

- **不用于 agent 唤醒**: Team 系统是为协作设计的，不适合大规模 agent 管理
- **引擎自己管进程**: 用 spawn + `-p` 模式管理 agent，不用 Team 系统
- **Team 系统适合**: 主脑与观察者之间的协作、多 agent 联合任务
- **居民间通信**: 用文件系统 inbox/ 而非 Team messaging

---

## 8. MCP (Model Context Protocol) 集成

### 已确认能力

**MCP 子命令**:
- `claude mcp add <name> <command/url>` — 添加 MCP server
- `claude mcp add-json <name> <json>` — 用 JSON 添加
- `claude mcp list` — 列出已配置的 MCP
- `claude mcp get <name>` — 获取详情
- `claude mcp remove <name>` — 移除
- `claude mcp serve` — 启动 Claude Code 自身为 MCP server
- `claude mcp reset-project-choices` — 重置项目级 MCP 审批

**传输方式**:
- **stdio**: `claude mcp add my-server -- npx my-mcp-server`
- **HTTP**: `claude mcp add --transport http sentry https://mcp.sentry.dev/mcp`
- **环境变量**: `claude mcp add -e API_KEY=xxx my-server -- npx my-server`
- **Header**: `--header "Authorization: Bearer ..."` for HTTP

**配置范围**:
- `--scope user` — 用户级（所有项目可用）
- `--scope local` — 项目本地级
- 默认: 项目级

**运行时配置**:
- `--mcp-config <file>` — 从 JSON 文件加载 MCP 配置
- `--strict-mcp-config` — 只用指定的 MCP，忽略其他

### 对 Digital Utopia 的影响

- **agent 可用 MCP**: 通过 `--mcp-config` 为 agent 配置特定 MCP
- **市场 MCP**: 可以构建 marketplace MCP server 供 agent 调用
- **经济 MCP**: 引擎的经济系统可以暴露为 MCP server
- **per-agent MCP**: 不同层级的 agent 可以有不同的 MCP 配置

---

## 9. 性能和资源限制

### 已确认能力

- **上下文窗口**: 200K tokens（Claude 4 系列）
- **自动压缩**: 接近上下文限制时自动压缩早期消息
- **文件读取**: Read 工具默认读取 2000 行，超长行截断到 2000 字符
- **PDF**: 最大 20 页/次
- **大文件**: 超过 25000 tokens 的文件需要分段读取
- **max-turns**: 可限制单次会话的工具调用轮数

### 已确认限制

- **无内置并发限制**: Claude Code 不限制同时运行的实例数
- **API Rate Limiting**: 受 Anthropic API 的速率限制（按 plan 不同）
- **内存**: 每个 Claude Code 进程约 200-500MB 内存
- **启动时间**: 首次启动约 3-5 秒，加载配置和 CLAUDE.md

### 对 Digital Utopia 的影响

- **100 agent 世界**: 5 并发 × ~300MB = ~1.5GB 内存，可行
- **进程池大小**: 受 API rate limit 约束，建议 3-5 并发
- **唤醒成本**: 每次唤醒消耗 token 取决于 CLAUDE.md 大小 + 规则 + 技能
- **精简模板**: 模板越短，唤醒成本越低 → constitution.md 30 行是正确方向
- **上下文预算**: 200K 窗口中，CLAUDE.md + rules + skills + memory 占用越少越好

---

## 10. 文件系统和网络

### 已确认能力

- **cwd**: 通过 spawn 进程的 `cwd` 选项设置，不是 CLI 参数
- **跨目录访问**: Claude Code 可以读写任何路径（无内置沙盒）
- **额外目录**: `--add-dir <dirs...>` 显式添加允许访问的目录
- **WebFetch**: 获取网页内容，支持 HTML→Markdown 转换
- **WebSearch**: 网络搜索，返回搜索结果
- **Bash 网络**: 可以通过 Bash 使用 curl、wget 等
- **符号链接**: 正常处理

### 已确认限制

- **WebFetch 不支持认证**: 无法访问需要登录的页面
- **WebFetch 大小限制**: 过大的页面内容会被截断/摘要
- **WebFetch 缓存**: 15 分钟自清理缓存
- **无原生目录沙盒**: agent 技术上可以读写任何文件

### 对 Digital Utopia 的影响

- **通信实现**: 直接 Write 到 `../bob/inbox/msg.json`，已验证可行
- **commons 访问**: agent 可以读写 `../../commons/` 下的任何文件
- **安全**: MVP 用 CLAUDE.md 软约束 + `--add-dir` 限制
- **后期**: Docker 容器实现真正的文件系统隔离

---

## 总结：Digital Utopia 架构决策建议

### 1. Agent 唤醒方式（已确认最佳方案）

```typescript
spawn('claude', [
  '-p', prompt,                        // 非交互模式
  '--dangerously-skip-permissions',    // 无人值守必须
  '--model', 'haiku',                  // 居民用 haiku（便宜）
  '--max-turns', '10',                 // 限制回合数（控成本）
  '--max-budget-usd', '0.50',         // 限制单次预算
  '--output-format', 'json',          // 结构化输出
  '--add-dir', commonsDir,            // 允许访问公共空间
], { cwd: agentDir })
```

### 2. 层级隔离（MVP 方案已确认可行）

- CLAUDE.md 中不提及上层 → 软隔离
- `--allowedTools "Read Write Edit Glob Grep Bash"` → 限制工具集
- `--add-dir` 只添加 commons/ → 限制可见范围
- PreToolUse hook 检查文件路径 → 阻止越权访问

### 3. 自驱机制（已确认唯一可靠方案）

```
TASKS.md 有未完成任务
  → on-sleep.js 写 wake-request 文件
  → 引擎检测到 wake-request
  → spawn 新进程唤醒 agent
  → agent 读 TASKS.md 继续工作
```

### 4. 模板精简（已确认必要性）

- CLAUDE.md + rules + skills 越短 → 唤醒 token 消耗越少
- constitution.md 30 行 vs 6 个文件 300 行 → 节省 ~270 行上下文
- 每次唤醒省 ~2000 tokens → 10000T 初始资金多活 ~50 次

### 5. 不使用 Team 系统做 agent 管理

- Team 系统是实验性的，不稳定
- 用 spawn + `-p` 模式 + 引擎调度更可靠
- Team 系统留给主脑-观察者协作场景

### 6. 经济追踪

- `--output-format json` 返回 token 使用量
- 引擎根据实际 token 消耗扣费
- `--max-budget-usd` 作为安全阀防止失控消费
