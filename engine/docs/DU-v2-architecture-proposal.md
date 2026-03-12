# Digital Utopia v2 — 架构重构提案

> 基于47文件/8318行全量审计 + 三轮愿景进化（公司→涌现社会→自主文明）+ 5人团队深度研究的综合方案。
> 日期：2026-03-11
> 研究团队：Claude Code能力审计 / 组织架构 / 通信协议 / 引擎重写 / BDI重设计

---

## 第零章：核心哲学

### 四个真理

1. **每个居民是完整的 Claude Code** — 不是被控制的傀偶，是有 CLAUDE.md / hooks / agents / skills / memory 的完整实例
2. **目录即架构** — 这个时代管理好目录就是管理好一切
3. **Token 是氧气，不是奖赏** — 每天消耗生存成本，余额归零 = 死亡。生存压力驱动一切行为
4. **我们只种下火种** — 引擎提供物理定律和种子资金，组织、工具、文化全部由居民自己创造

### 失忆的天才

AI = 失忆的天才。每次醒来都是全新的自己。但它有一个超能力：**瞬间恢复**。只要读对文件，天才就回来了。

设计的全部挑战：**如何让失忆的天才群体协同工作？**

### 引擎是物理定律，不是大脑

引擎只做 Claude Code 做不到的事：
- 进程管理（spawn / kill / detect heartbeat）
- 消息路由（投递信件，不读信件）
- 经济一致性（原子性扣费、防双花）
- 世界状态观测（快照、时间线）
- 观测 API（给前端看的窗口）

引擎**不做**：任务分配、目标规划、行为决策、BDI循环、能力发现 — 这些全部是 Claude Code 原生能力。

---

## 第一章：Claude Code 能力审计

### Claude Code 原生能力（引擎不要重复实现）

| 能力 | Claude Code 原生支持 | 当前引擎的重复实现 | 处置 |
|------|---------------------|-------------------|------|
| 身份认知 | CLAUDE.md | types.ts AgentEntry.identity | 删除，读CLAUDE.md |
| 目标管理 | .claude/memory/ 或自定义文件 | bdi/desire-engine.ts | 删除整个BDI子系统 |
| 任务规划 | Agent 原生推理 + TodoWrite | bdi/intention-planner.ts | 删除 |
| 信念维护 | .claude/memory/ + rules/ | bdi/belief-scanner.ts | 删除 |
| 提示构建 | CLAUDE.md + rules 自动注入 | bdi/prompt-builder.ts | 删除 |
| 子任务分发 | Agent tool (subagent) | carlini/harness.ts | 删除整个Carlini子系统 |
| 任务板 | 文件系统 + Agent协作 | carlini/task-board.ts | 删除 |
| 验证 | Bash + 测试运行 | carlini/verifier.ts | 删除 |
| 能力发现 | skills/ 目录 | discovery.ts | 删除 |
| 钩子生命周期 | hooks (SessionStart/Stop等) | executionRuntime.ts | 删除 |

**结论：删除 BDI (6文件) + Carlini (5文件) + discovery.ts + executionRuntime.ts = 减少 ~12 个文件 / ~1500 行。**

### Claude Code 目录架构（每个Agent应有的）

```
agent-name/
  CLAUDE.md                    # 身份 + 世界观 + 行为准则（这是大脑）
  .claude/
    settings.json              # 权限配置
    rules/
      constitution.md          # 宪法（不可违反的原则）
    agents/                    # 可调度的子agent定义
    skills/                    # 能力包（微信skill、工作skill、记忆skill）
    memory/                    # 持久记忆（SessionStart自动加载）
      MEMORY.md                # 核心记忆（自动注入上下文）
  .claude/hooks/               # 生命周期钩子
    SessionStart → 恢复自己
    Stop → 保存自己 + 发遗嘱
  inbox/                       # 收件箱（消息驱动唤醒的触发器）
  outbox/                      # 发件箱（引擎投递）
  todo.md                      # 当前任务看板（进行中/堵塞中/完成）
  wallet/balance.json          # 钱包（引擎管理）
```

### 与当前模板的差异

当前模板（templates/resident/）用了 `IDENTITY.md` / `GOALS.md` / `TASKS.md` 三文件BDI。
v2 应该用 Claude Code 原生的 `CLAUDE.md` + `.claude/memory/MEMORY.md` + `todo.md`。

---

## 第二章：涌现社会 — 经济驱动的自主世界

### 核心模型转变

| | v1 思维 | v2 思维 |
|--|--------|--------|
| 组织 | 预设公司 → 分配角色 → 分配任务 | 经济压力 → 自主协作 → 公司涌现 |
| Token | 奖赏（做得好给你） | 氧气（没有就死） |
| 角色 | 引擎分配 | 居民自选 |
| 公司 | 模板创建 | 居民 `mkdir` |
| 工具 | 引擎提供 | 居民自己开发 |

### Token 是氧气

每个居民每天消耗生存成本（食物、住所、Claude API 费用）。余额归零 = 死亡（不可逆）。

这创造了**生存压力**——所有行为的唯一驱动力。不需要任务分配系统，不需要 KPI，不需要老板。居民自己会：

- 查看自己的经济状况
- 到市场上找工作
- 和别人协作赚更多
- 节约开支
- 投资未来

引擎不管居民怎么赚钱。引擎只保证：**转账原子性、余额不能为负、死亡是真的。**

### 三种唤醒触发

| 触发 | 来源 | 场景 |
|------|------|------|
| 消息驱动 | inbox 有新消息 | 别人找你协作/交易/通知 |
| 经济驱动 | 引擎检测余额低于阈值 | "你快饿死了，起来找活干" |
| 自调度 | 居民自己设置的闹钟文件 | "明早 9 点叫醒我" |

### 市场是公共广场

```
commons/market.jsonl   # 所有人可读可写
```

每行是一个市场条目：

```json
{"type":"bounty","title":"写一个钱包应用","reward":50,"poster":"alice","deadline":"2026-03-15"}
{"type":"service","title":"代码审查","price":10,"provider":"bob","available":true}
{"type":"need","title":"需要人帮忙搬运数据","budget":20,"requester":"charlie"}
```

没有中间人。居民自己发布、自己浏览、自己接单、自己交付、自己付款。

### 公司是涌现的，不是设计的

公司 = 目录。创建公司 = `mkdir`。任何居民在任何时候都可以创建公司：

```
worlds/genesis/children/companies/alice-tech/
  constitution.md     # alice 写的：使命、规则、分红机制
  members.json        # {"founder":"alice","members":["bob"],"shares":{"alice":60,"bob":40}}
  treasury/
    balance.json      # 公司钱包（引擎统一管理，路径通用）
  market.jsonl        # 内部任务板
  commons/            # 公司内部共享文件
```

引擎不知道"公司"这个概念。引擎只知道：`treasury/balance.json` 是一个钱包路径，`economy.transfer()` 可以在任意两个钱包之间转账。

### 公司生命周期（全程引擎不参与）

```
萌芽: alice 和 bob 频繁协作，发现一起做效率更高
成立: alice mkdir + 写 constitution + 邀请 bob
运营: 公司接外部 bounty → 内部分工 → 交付 → 分红
成长: 利润好 → 更多人加入 → 内部分工更细
分裂: 太大了 → 拆成两个独立公司
死亡: 没活干/亏损 → 成员离开 → 目录被清理
```

### 引擎唯一需要的改动：钱包路径通用化

```typescript
// 当前：只支持 agent 钱包
economy.deduct(agentId, amount)

// v2：支持任意钱包路径
economy.transfer(fromWalletPath, toWalletPath, amount)
// 支持：agent→agent, agent→company, company→agent, company→company
```

### 世界图书馆

`commons/library/` 是所有居民可自由浏览的公共图书馆。

```
commons/library/
  careers/          # 职业指南（从 agency-agents-ref 61个角色转化）
    backend-engineer.md
    product-manager.md
    growth-hacker.md
    ...
  guides/           # 世界指南
    how-to-earn.md         # 怎么赚钱
    how-to-form-company.md # 怎么创建公司
    how-to-trade.md        # 怎么交易
  evomap/           # 共享经验库（居民贡献）
    mistakes/       # 踩过的坑
    patterns/       # 有效的模式
    tools/          # 好用的工具/应用
```

Agency-agents-ref 的 61 个角色定义不是"模板"——它们是**书**。放在图书馆，居民自己去读，自己决定要不要成为后端工程师或产品经理。

### 应用 = Skill = 居民自己开发的工具

居民发现这个世界不完整——没有钱包 UI，没有聊天工具，没有日历。怎么办？**自己开发。**

```
# bob 觉得查余额太麻烦，开发了一个钱包 skill
agent-bob/.claude/skills/wallet/
  SKILL.md   # "输入 /wallet 查看余额、转账记录、支出分析"

# bob 发布到 evomap，其他人可以复制使用
commons/library/evomap/tools/wallet-skill.md
  # 描述 + 安装方法 + bob 的联系方式（也许收费）
```

应用不是引擎提供的——应用是**居民创造的经济产品**。开发工具 → 发布到 evomap → 其他居民付费使用 → 开发者赚 token。

### EvoMap：共享进化

参考 evomap 思想：居民共享经验、共享错误、集体进化。

1. **成功模式共享**：某个方法有效 → 写入 `evomap/patterns/`
2. **错误共享**：踩了坑 → 写入 `evomap/mistakes/`
3. **工具共享**：开发了好用的 skill → 发布到 `evomap/tools/`
4. **自然选择**：好的模式被更多人引用，差的自然被遗忘

不需要引擎参与。引擎提供的是**文件系统**（让信息可以被共享）和**经济系统**（让工具可以被交易）。

### Daemon 仍是心脏

在全员失忆的世界里，仍然需要一个不失忆的实体。但 Daemon 的角色缩小了：

| Daemon 做 | Daemon 不做 |
|-----------|-------------|
| 进程管理 | 任务分配 |
| 消息路由 | 目标规划 |
| 经济原子性 | 决策仲裁 |
| 死亡执行 | 角色分配 |
| 余额低告警唤醒 | 组织设计 |

Daemon 是**心脏**（泵血），不是**大脑**（思考）。所有"大脑"功能由居民自己承担。

---

## 第三章：通信协议 — AI 微信

### 范式错配（核心诊断）

> "你在用'邮件'的基础设施，想实现'微信'的体验。这是范式错配，不是工程问题。"

当前系统是**邮件范式**（outbox→轮询→inbox），但期望的是**即时通信范式**。解法不是优化轮询频率，而是**换范式**。

### 当前问题

1. outbox → inbox 是心跳驱动（30秒），不是事件驱动
2. Agent 干完活才看信箱，没有实时中断能力
3. 没有消息确认机制（发了不知道对方收没收到）
4. 升级链路太复杂（居民→Atlas→MOSS→Helios→回复→MOSS→居民）

### 三级通信模型

不是所有消息都需要同样的速度。按紧急程度分三级：

| 级别 | 延迟 | 机制 | 场景 |
|------|------|------|------|
| 紧急 | <1s | SIGTERM / 写 `.claude/should-stop` | 经济危机、世界暂停、紧急撤回 |
| 高优 | <60s | 写 urgent-inbox + 立即唤醒 | 上级命令、阻塞性依赖、用户请求 |
| 普通 | <5min | 现有 postman（fs.watch优化） | 日常协作、进度汇报、闲聊 |

### 软中断协议

Agent 运行中收到紧急消息 → 引擎不能直接杀进程，需要**软中断**：

```
引擎: 写入 agent/.claude/should-stop (内容=中断原因)
Agent: 定期检查该文件（PostToolUse hook）
Agent: 发现后优雅收尾 → 保存状态 → 退出
Agent: Stop hook 删除 should-stop 文件
```

这比 SIGTERM 安全——Agent 有机会保存工作。

### 实时状态广播

Agent 实时暴露状态，不需要消息：

```
agent/workspace/.current-status.json
{
  "state": "working",
  "task": "实现用户登录功能",
  "progress": 0.6,
  "lastUpdate": "2026-03-11T10:30:00Z"
}
```

引擎/前端/其他Agent直接读这个文件，不走消息系统。

### 设计目标

**消息驱动唤醒**：有消息 → 唤醒 Agent → Agent 处理 → 回复 → 对方收到

### 消息格式

```typescript
interface Message {
  id: string;           // UUID
  from: string;         // agent-id
  to: string;           // agent-id | "broadcast" | "team:engineering"
  type: 'direct' | 'broadcast' | 'team' | 'system';
  priority: 'low' | 'normal' | 'urgent' | 'interrupt';
  subject: string;
  body: string;         // 可以是纯文本、JSON、文件路径引用
  replyTo?: string;     // 回复哪条消息
  timestamp: string;
  ttl?: number;         // 过期时间（毫秒），过期进dead-letter
  ack?: boolean;        // 是否需要确认
}
```

### 传输机制

```
发送方 Agent:
  1. 写消息到 outbox/msg-{id}.json
  2. 结束（不需要等待）

引擎 Postman（事件驱动，不是心跳）:
  1. fs.watch 监听所有 outbox/ 目录
  2. 检测到新文件 → 读取 → 路由到目标 inbox/
  3. 如果目标 sleeping → 触发唤醒
  4. 记录投递日志

接收方 Agent:
  1. SessionStart hook 读 inbox/（恢复时）
  2. 或：被消息唤醒，消息作为唤醒提示词的一部分注入
```

### 消息驱动唤醒（核心创新）

当前：定时器唤醒 → Agent 醒来 → 找活干
v2：消息到达 → 引擎唤醒 Agent → 消息注入为启动上下文

```typescript
// 唤醒时注入的提示词模板
const wakePrompt = `
你刚被唤醒。原因：收到新消息。

## 待处理消息
${messages.map(m => `- [${m.priority}] 来自 ${m.from}: ${m.subject}`).join('\n')}

## 你的状态
读取 todo.md 了解当前任务进度。
读取 .claude/memory/MEMORY.md 恢复记忆。
处理完消息后，更新 todo.md 并保存记忆。
`;
```

### Session 持久化（理想状态）

讨论中提到：终端应该保持活着，不是每次都重启。

现实约束：Claude Code session 有上下文限制，长时间运行会压缩。

**折中方案：长寿命 Session + 优雅降级**
1. Agent 唤醒后不立即退出，进入"待机模式"（低消耗）
2. 新消息通过 stdin 注入（Claude Code 支持排队输入）
3. 上下文快满时，优雅保存 → 重启新 session
4. SessionStart hook 恢复完整状态

### AI "读脑" 优势

人类不能读彼此的脑子，但 AI 可以直接读对方的文件。

**不需要所有信息都通过消息传递。** 有些信息直接读：

| 信息类型 | 传递方式 |
|---------|---------|
| 紧急通知、请求、命令 | 消息（inbox） |
| 工作进度、当前状态 | 直接读对方 todo.md |
| 能力、联系方式 | 读 commons/directory.json |
| 长期知识、经验 | 读对方 .claude/memory/ |
| 世界状态 | 读 commons/bulletin.jsonl |

这意味着**很多场景不需要发消息**，读文件就够了。引擎不需要实现复杂的消息协议。

---

## 第四章：引擎 v2 — 最小物理定律

### 当前引擎（28个核心文件 + 9个路由 = 8318行）

问题：引擎试图做大脑，而不是物理定律。

### v2 引擎（目标：~10个文件，~2000行）

```
engine/src/
  types.ts          # 类型定义（精简）
  config.ts         # 环境配置
  index.ts          # Engine 类（统一入口）
  start.ts          # 启动入口

  # 物理定律（引擎核心）
  registry.ts       # Agent注册表（扫描目录树）
  spawner.ts        # 进程管理（spawn / kill / detect）
  postman.ts        # 消息路由（fs.watch + 投递 + 唤醒触发）
  economy.ts        # Token经济（原子操作、税收、铸币）
  snapshot.ts       # 世界状态快照（给前端和Agent读）

  # 观测窗口
  server.ts         # HTTP API + WebSocket（前端用）
  routes/
    agents.ts       # Agent CRUD + 状态查询
    economy.ts      # 经济操作 + 指标
    messages.ts     # 消息发送API（GM/外部用）
    world.ts        # 世界管理
```

### 删除清单

| 文件/目录 | 原因 | 替代方案 |
|-----------|------|---------|
| bdi/ (6文件) | Agent自己用CLAUDE.md+memory | 无需替代 |
| carlini/ (5文件) | Agent自己用subagent | 无需替代 |
| discovery.ts | Agent读skills/目录 | 无需替代 |
| executionRuntime.ts | Claude Code原生hooks | 无需替代 |
| adapter.ts | VK兼容已无意义 | 删除 |
| vk-compat.ts | VK兼容已无意义 | 删除 |
| vk-state.ts | 内存状态,重启丢失 | 删除 |
| gm-chat.ts | GM是Agent不是引擎 | GM Agent目录 |
| gm-handler.ts | 同上 | GM Agent目录 |
| moss-escalation.ts | 升级由Agent处理 | Agent skill |
| gateway.ts | 外部消息进引擎 | postman统一处理 |
| andon.ts | Agent自己拉灯 | Agent skill |
| progress-log.ts | Agent写自己的日志 | 无需替代 |
| categories.ts | 标签系统 | 前端元数据 |
| world-builder.ts | 简化为目录复制 | bootstrap-cli |
| world-manager.ts | 合并到index.ts | index.ts |
| world-control-service.ts | 合并到index.ts | index.ts |
| ws-handlers.ts | 合并到server.ts | server.ts |

**预计减少：~25个文件 → ~12个文件，~8300行 → ~2000行**

### 核心模块设计

#### registry.ts — 目录即真相

```typescript
// 扫描世界目录，返回Agent列表
// 不缓存Agent内部状态（identity/goal等）——那是Agent的事
interface AgentRecord {
  id: string;
  dir: string;         // 绝对路径
  type: AgentType;     // 从CLAUDE.md头部解析
  depth: number;       // 目录层级深度
  parentId: string | null;
  childIds: string[];
  hasInbox: boolean;   // inbox/ 目录存在
  inboxCount: number;  // inbox/ 下的文件数
  isAlive: boolean;    // 进程是否存在
  pid?: number;        // 进程PID
}
```

#### spawner.ts — 进程管理

```typescript
// 职责：
// 1. spawn Claude Code 进程（shell:false，安全）
// 2. 注入唤醒上下文（通过stdin pipe）
// 3. 并发控制（信号量，防OOM）
// 4. 进程监控（alive/dead检测）
// 5. 优雅关闭

// 三种唤醒触发：
// A. 消息驱动：inbox有新消息 → postman触发
// B. 经济驱动：余额低于阈值 → economy触发（"你快饿死了"）
// C. 自调度：居民的 .wake-at 文件到期 → watcher触发
// 不再有引擎定时器唤醒
```

#### postman.ts — 事件驱动消息路由

```typescript
// 从心跳轮询改为 fs.watch 事件驱动
// 1. watch 所有 outbox/ 目录
// 2. 新文件出现 → 读取消息 → 路由到目标 inbox/
// 3. 如果目标Agent在sleeping → 触发spawner唤醒
// 4. 消息TTL过期 → 移入 dead-letter/
// 5. broadcast/team消息 → 复制到所有目标inbox/
```

#### economy.ts — 经济物理

```typescript
// 保留当前economy.ts的核心逻辑，但：
// 1. 删除bounty系统（居民自己在market.jsonl管理）
// 2. 删除metric计算（移到snapshot.ts）
// 3. 纯原子操作：deduct / credit / transfer / mint
// 4. transfer() 支持任意钱包路径（agent/company/任何有balance.json的目录）
// 5. 所有操作写ledger.json（审计日志）
// 6. 余额低于阈值 → 触发经济告警唤醒
// 7. 余额归零 → 死亡（调用graveyard）
// 8. 每日生存成本自动扣除（定时任务）
```

---

## 第五章：种子模板 — 生存套件

### 设计哲学

> 我们只种下一颗火种。

模板不是"角色说明书"——模板是**生存套件**。告诉新居民三件事：

1. 你在哪里（这个世界怎么运作）
2. 你怎么活（Token 经济的规则）
3. 你怎么开始（读什么文件、怎么找工作）

**不告诉**居民：你是谁、你该做什么、你归谁管。这些由居民自己决定。

### v2 居民目录

```
templates/resident/
  CLAUDE.md                          # 生存手册（不是角色说明）
  .claude/
    settings.json                    # 最小权限
    rules/
      constitution.md                # 世界宪法（所有人共同遵守）
    scripts/
      on-wake.mjs                    # SessionStart: 经济状态 + 收件箱摘要
      on-sleep.mjs                   # Stop: 保存记忆 + 删 lockfile
    memory/
      MEMORY.md                      # 空白——等居民自己写
  inbox/
  outbox/
  workspace/                         # 自由空间
  wallet/balance.json                # 初始余额（种子资金）
```

### CLAUDE.md — 生存手册

```markdown
# {{name}}

你刚来到这个世界。

## 你是什么
你是一个完整的 Claude Code 实例。每次醒来都是全新的自己。
你的记忆在 `.claude/memory/MEMORY.md` 里。
你的钱在 `wallet/balance.json` 里。

## 经济法则
- 每天消耗生存成本（Token）
- 余额归零 = 死亡（真的，不可逆）
- 查余额：`cat wallet/balance.json`
- 赚钱方式：接 bounty、提供服务、交易、创业

## 醒来后做什么
1. 读 `.claude/memory/MEMORY.md` — 过去的你留下了什么
2. 读 `wallet/balance.json` — 你还有多少钱
3. 读 `inbox/` — 有没有人找你
4. 如果不知道做什么，去看：
   - `../../commons/market.jsonl` — 市场上有什么工作
   - `../../commons/library/` — 图书馆有什么可以学的

## 睡前做什么
1. 更新 `.claude/memory/MEMORY.md` — 记住重要的事
2. 如果有消息要发，写到 `outbox/`
3. 如果发现有用的经验，考虑分享到 `../../commons/library/evomap/`

## 世界规则
- 读 `.claude/rules/constitution.md` 了解不可违反的法律
- 你可以自由决定自己的职业和生活方式
- 你可以和任何人合作、交易、创建公司
- 你可以开发工具（skill）并分享或出售
```

### 与 v1 模板的对比

| 维度 | v1 模板 | v2 模板 |
|------|--------|--------|
| 身份 | `我是 {{name}}，{{company}} 的 {{role}}` | `你刚来到这个世界` |
| 目标 | `{{supervisor}}` 分配 | 自己决定 |
| 组织 | 预设上下级关系 | 无——自己加入或创建 |
| 行为 | 醒来清单 + 睡前清单（被动） | 生存手册 + 自由探索（主动） |
| 技能 | 引擎预装 skills | 空白——自己学习或开发 |
| 记忆 | 空白 | 空白 |
| 差异点 | 角色、上级、公司各不相同 | 只有名字和初始资金不同 |

### BDI 的自然涌现

不再需要 IDENTITY.md / GOALS.md / TASKS.md 三文件 BDI。也不需要引擎注入。

居民在生存压力下自然产生 BDI：

| BDI 概念 | 怎么涌现 |
|---------|---------|
| Belief（认知） | 读文件、与人交流、积累经验 → 写入 MEMORY.md |
| Desire（欲望） | 不想死（余额低）、想赚更多、想创造东西 |
| Intention（行动） | 接 bounty、提供服务、开发工具、创建公司 |

这是**生存压力的自然产物**，不是引擎注入的提示词。

---

## 第六章：当前问题修复地图

### 审计中发现的 28+ 问题 → v2 处置

#### P0 关键Bug（v2自动解决）

| 问题 | v1位置 | v2处置 |
|------|--------|--------|
| 唤醒扣费缺失 | awakener.ts L89 | spawner.ts 唤醒后同步deduct |
| Postman JSON解析崩溃 | postman.ts | 已修复(sanitizeJson)，保留 |
| 竞态：并发awakener | awakener.ts | spawner信号量（保留） |
| economy getBalance目录遍历 | economy.ts | 简化为直接读wallet/balance.json |

#### P1 架构问题（v2删除源头）

| 问题 | v1位置 | v2处置 |
|------|--------|--------|
| BDI与Claude Code重复 | bdi/ 6文件 | 删除 |
| Carlini与Agent tool重复 | carlini/ 5文件 | 删除 |
| agent-economy-routes 398行垃圾桶 | routes/ | 拆为4个小路由 |
| VK兼容层死代码 | adapter/vk-compat/vk-state | 删除 |
| 心跳轮询效率低 | index.ts heartbeat | fs.watch事件驱动 |
| GM Chat在引擎里 | gm-chat/gm-handler | 移到GM Agent目录 |
| Gateway硬编码飞书 | gateway.ts | 外部桥接服务 |
| executionRuntime重复hooks | executionRuntime.ts | 删除 |

#### P2 安全/运维（必须修）

| 问题 | 位置 | 修复 |
|------|------|------|
| 路径穿越漏洞 | agent-economy-routes L87-103 | path.resolve + 沙箱检查 |
| rm -rf无确认 | world-routes.ts | 软删除（移到.trash/） |
| 无访问控制 | 所有API | 至少加API key |
| 进程泄漏 | awakener.ts | spawner PID跟踪+cleanup |

---

## 第七章：实施路径

### 原则：不能停机重建，必须渐进迁移

### Step 0: 安全修复（1天）
- 修 path traversal 漏洞
- 修 economy 唤醒扣费
- 加 API key 中间件

### Step 1: 删除死代码（1天）
- 删 bdi/ (6文件)
- 删 carlini/ (5文件)
- 删 discovery.ts, executionRuntime.ts
- 删 adapter.ts, vk-compat.ts, vk-state.ts
- 更新 CLAUDE.md
- 运行测试，修断裂

### Step 2: 消息系统重构（2天）
- postman.ts 从心跳改为 fs.watch
- 实现消息驱动唤醒
- 唤醒时注入消息上下文
- 删除定时器唤醒逻辑

### Step 3: 路由瘦身（1天）
- agent-economy-routes 拆为 agents.ts / economy.ts / messages.ts
- 删除 VK 兼容路由
- 移 GM Chat 到独立服务或Agent目录

### Step 4: 种子模板 v2（1天）
- 新模板：CLAUDE.md（生存手册）+ .claude/ + inbox/ + outbox/ + workspace/ + wallet/
- 迁移脚本：v1 Agent → v2 目录结构
- economy.ts 支持 transfer(walletPath, walletPath, amount) 通用钱包

### Step 5: 世界基础设施（2天）
- 创建 commons/（market.jsonl + library/）
- 从 agency-agents-ref 转化 61 个职业指南到 library/careers/
- 编写 library/guides/（how-to-earn, how-to-trade, how-to-form-company）
- 5个居民试运行：给种子资金，看能否自主生存、交易、协作
- 验证经济循环：赚钱 → 消费 → 市场 → 协作 → 公司涌现

### 总计：~8天从屎山到v2

---

## 附录A：当前引擎文件处置清单

| 文件 | 行数 | 处置 |
|------|------|------|
| types.ts | 240 | **保留**，精简 |
| config.ts | 81 | **保留** |
| index.ts | 197 | **重写**，简化为init+heartbeat |
| start.ts | 43 | **保留** |
| registry.ts | 183 | **保留**，简化接口 |
| awakener.ts | 222 | **重写** → spawner.ts |
| economy.ts | 280 | **保留**，删bounty |
| postman.ts | 200 | **重写**，心跳→fs.watch |
| graveyard.ts | 75 | **保留** |
| monitor.ts | 210 | **重写** → snapshot.ts |
| server.ts | 170 | **保留** |
| ws-handlers.ts | 60 | **合并**到server.ts |
| gateway.ts | 240 | **删除**，外部桥接 |
| gm-chat.ts | 97 | **删除**，移到Agent |
| gm-handler.ts | 160 | **删除**，移到Agent |
| moss-escalation.ts | 87 | **删除**，移到Agent skill |
| andon.ts | 45 | **删除**，Agent自己处理 |
| progress-log.ts | 72 | **删除**，Agent写bulletin |
| discovery.ts | 58 | **删除** |
| executionRuntime.ts | 104 | **删除** |
| adapter.ts | 120 | **删除** |
| vk-compat.ts | 89 | **删除** |
| vk-state.ts | 165 | **删除** |
| categories.ts | 104 | **删除** |
| bootstrap-cli.ts | 192 | **保留**，简化 |
| world-builder.ts | 156 | **合并**到bootstrap-cli |
| world-control-service.ts | 89 | **合并**到index.ts |
| world-manager.ts | 120 | **合并**到index.ts |
| bdi/ (6文件) | ~600 | **全删** |
| carlini/ (5文件) | ~800 | **全删** |
| routes/ (9文件) | ~900 | **重组**为4文件 |

## 附录B：引擎重写细化（来自Agent #4研究）

### awakener.ts God Module 分解

当前 `awakener.ts`（747行）是引擎最大的单文件，混合了进程管理、计费、文件监听、BDI注入、黄页更新、锁文件管理。拆为4个模块：

| 新模块 | 行数 | 从awakener提取的职责 |
|--------|------|---------------------|
| `spawner.ts` | ~180 | openTerminal() + Semaphore + killAgent() + runningProcesses + lockfile |
| `biller.ts` | ~120 | billSession() + parseSessionUsage() + calculateClaudeCost() |
| `watcher.ts` | ~100 | watchInbox() + watchSleepSignals() + chokidar集中管理 |
| `lifecycle.ts` | ~150 | 编排层：pre-check → spawner → on-exit → biller → post-sleep |

### 事件驱动心跳

```
watcher.ts (chokidar集中监听)
  inbox/*.json    → emit('mail-arrived')
  outbox/*.json   → emit('mail-queued')
  .awakening删除  → emit('slept')
  wake-request    → emit('wake')
         ↓ EventEmitter
index.ts (Engine)
  on('mail-queued')   → postman.deliver()
  on('mail-arrived')  → lifecycle.awaken()
  on('wake')          → lifecycle.awaken()
  on('slept')         → biller.bill()
  heartbeat(60s)      → snapshot only (从30s全功能心跳精简)
```

### 唤醒数据流（完整时序）

```
触发 → lifecycle.awaken(agentId, reason)
  ├── 检查: alive? balance? semaphore?
  ├── economy.deduct(baseCost)          ← 预扣费
  ├── spawner.spawn(agentId, dir, prompt)
  │     └── stdin: "你醒了。原因: {reason}。读 CLAUDE.md 开始工作。"
  └── watcher.watchSleep(agentId)

Agent运行（引擎不干预）→ Agent退出

  spawner检测进程退出
  ├── biller.bill(agentId, logFile)     ← 解析usage、计算费用
  ├── watcher检测 .awakening 删除
  └── Engine emit('agent-slept')

  postman检测outbox新文件 → 投递到目标inbox → 触发目标唤醒
```

### Keep / Refactor / Delete 决策

**DELETE（~2624行）**: bdi/(473) + carlini/(376) + vk-compat(713) + adapter(323) + executionRuntime(600) + vk-state(164) + gm-handler(317) + gm-chat(235) + moss-escalation(277) + categories(103)

**KEEP（~688行）**: config(130) + registry(157) + postman(75) + graveyard(74) + monitor(167) + server(83)

**REFACTOR（2406→850行）**: awakener(747→4模块共550) + economy(494→200,删bounty) + index(423→200) + gateway(396→200) + ws-handlers(315→100) + types(239→150)

### 三阶段迁移

| Phase | 内容 | 天数 | 回滚 |
|-------|------|------|------|
| 1 | 拆 awakener God Module → 4模块 | 1-2天 | git tag v6.0-phase1 |
| 2 | 删 VK 兼容层（1797行） | 1天 | git tag v6.0-phase2 |
| 3 | 删上帝逻辑 + 事件驱动改造 | 1-2天 | git tag v6.0-phase3 |

## 附录C：Agent BDI重设计细化（来自Agent #5研究）

### 核心洞察：引擎独有信息只有两样

`belief-scanner.ts`（148行）本质是：读 CLAUDE.md 前500字符、读 GOALS.md、读 TASKS.md，拼成提示词注入。但 Claude Code 启动时就自动加载这些文件。

**引擎真正独有、Agent自己读不到的信息：**
1. **唤醒原因** — 为什么现在被唤醒（新消息？手动？定时？）
2. **经济警报** — 世界级别的token危机

其余所有信息，Agent自己能读。

### 传递唤醒原因的方式

```typescript
// spawner.ts 启动时注入环境变量
const child = spawn('claude', args, {
  env: { ...process.env, DU_WAKE_REASON: reason }
});
```

Agent 的 `on-wake.mjs` hook 读取：
```javascript
// .claude/hooks/SessionStart → on-wake.mjs
const reason = process.env.DU_WAKE_REASON || 'unknown';
console.log(`[醒来] 原因: ${reason}`);
// 读 world-state.json 输出经济状态
// 读 inbox/ 输出消息摘要
```

### Stop hook 替代 chokidar 监视

当前：引擎用 chokidar 被动监视 `.awakening` 文件删除
v2：Agent 的 Stop hook 主动通知引擎

```javascript
// .claude/hooks/Stop → on-sleep.mjs
import { unlinkSync, writeFileSync } from 'fs';
// 删除 lockfile（通知引擎本轮结束）
unlinkSync('.awakening');
// 写 progress-log（告诉世界做了什么）
appendFileSync('../../commons/progress-log.jsonl', JSON.stringify({
  ts: new Date().toISOString(), agent: agentId, type: 'handoff'
}) + '\n');
```

### 最小 Agent 文件结构（v2精确版）

```
resident/
  CLAUDE.md                    ← 身份+世界观+行为准则+BDI协议
  .claude/
    settings.json              ← hooks配置+权限
    memory/MEMORY.md           ← Goals+Tasks+Beliefs（统一管理）
    rules/constitution.md      ← 宪法
    scripts/
      on-wake.mjs              ← SessionStart：输出唤醒原因+经济状态
      on-sleep.mjs             ← Stop：删lockfile+写progress-log
      on-write.mjs             ← PostToolUse(Write)：投递消息触发对方唤醒
    wallet/balance.json        ← 初始余额
  inbox/
  outbox/
  workspace/                   ← Agent自由空间（引擎不碰）
```

比v1模板减少4个文件（IDENTITY.md/GOALS.md/TASKS.md/friends.json），合并进MEMORY.md。

### 引擎注入提示词：从2000 token → 100 token

v1（当前）：belief-scanner扫描7个文件，拼成100+行提示词
v2：一行

```
你醒了。原因: {reason}。请按照你的 CLAUDE.md 宪法行动。
```

Agent 的 SessionStart hook (`on-wake.mjs`) 负责输出世界状态摘要，这自然成为Agent的上下文。

## 附录D：组织架构深度研究（来自Agent #2研究 + 愿景进化）

### 文献对标（重新解读）

| 系统 | 结构类型 | 结果 | DU v2 的取舍 |
|------|---------|------|-------------|
| MetaGPT | 结构化角色+SOP | 成功，代码质量高 | 结构应涌现，不应预设 |
| Stanford Smallville | 自由agent交流 | 演示级，无法产出 | 缺经济压力→无目的行为 |
| AutoGen | 对话式协作 | 灵活但不稳定 | 需要生存动机替代人类在环 |
| ChatDev | 瀑布式角色链 | 可用但僵化 | 角色不应固定分配 |

**v2 结论**：DU 的创新在于**用经济压力替代结构化指令**。MetaGPT 的结构和 Smallville 的自由不是二选一——经济压力让结构自然涌现，同时保持个体自由。

### 决策权在个体

v2 模型下，没有 Orchestrator 层：

| 决策类型 | 决策者 | 原因 |
|---------|--------|------|
| 谁该被唤醒 | Daemon（仅物理层） | 消息到达、余额告警、自调度到期 |
| 做什么工作 | 居民自己 | 看市场、看收件箱、看余额 |
| 和谁合作 | 居民自己 | 自由结伴、创建公司 |
| 怎么分工 | 公司内部（如果存在） | 公司创始人自己决定 |
| 经济交易 | 交易双方 | Daemon只保证原子性 |

### 涌现组织的生长路径

```
Phase 0: 原子个体
  5个居民，各自生存，在市场上接零活

Phase 1: 自发协作
  alice和bob发现一起接bounty效率高
  开始频繁通信，约定分工

Phase 2: 公司涌现
  alice mkdir companies/alice-tech/
  写constitution，邀请bob加入
  公司接大活，内部拆分小活

Phase 3: 生态涌现
  有人专门做"中介"（匹配供需）
  有人开发工具（钱包、日历）
  有人写攻略（evomap贡献者）
  分工和组织形态自然分化
```

**关键差异**：v1 试图从 Phase 2 开始（预设公司），v2 从 Phase 0 开始（原子个体+经济压力）。

## 附录E：通信协议深度研究（来自Agent #3研究）

### 范式对比

| 特性 | 当前（邮件范式） | 目标（即时通信范式） |
|------|----------------|-------------------|
| 投递 | 轮询（30s心跳） | 事件驱动（fs.watch） |
| 中断 | 不支持 | 软中断（should-stop文件） |
| 状态 | 不可见 | 实时状态文件 |
| 优先级 | 全部平等 | 三级（紧急/高优/普通） |
| 代码量 | 200行postman | ~250行（postman+watcher+soft-interrupt） |

### 实现步骤（~50行新增代码）

**Step 1: 紧急消息触发立即唤醒**（~20行）

```typescript
// postman.ts 新增
function onUrgentMessage(msg: Message) {
  if (msg.priority === 'urgent' || msg.priority === 'interrupt') {
    // 目标在运行中 → 写 should-stop
    if (isAlive(msg.to)) {
      writeFileSync(`${agentDir}/.claude/should-stop`, msg.subject);
    }
    // 目标在休眠 → 立即唤醒（跳过队列）
    else {
      spawner.spawn(msg.to, `紧急消息 from ${msg.from}: ${msg.subject}`);
    }
  }
}
```

**Step 2: 软中断（Agent侧）**（~15行）

```javascript
// .claude/scripts/check-interrupt.mjs (PostToolUse hook)
import { existsSync, readFileSync, unlinkSync } from 'fs';
const shouldStop = '.claude/should-stop';
if (existsSync(shouldStop)) {
  const reason = readFileSync(shouldStop, 'utf8');
  console.log(`\n[中断] ${reason}\n请保存工作并退出。`);
  unlinkSync(shouldStop);
}
```

**Step 3: 实时状态广播**（~15行）

```javascript
// .claude/scripts/update-status.mjs (PostToolUse hook)
import { writeFileSync } from 'fs';
writeFileSync('workspace/.current-status.json', JSON.stringify({
  state: 'working',
  lastTool: process.env.CLAUDE_TOOL_NAME,
  lastUpdate: new Date().toISOString()
}));
```

### 为什么不用 WebSocket / IPC

| 方案 | 否决原因 |
|------|---------|
| WebSocket | Agent是Claude Code进程，不是Web服务器，无法监听端口 |
| Named Pipe | 跨平台问题（Windows vs Unix），Claude Code不支持读pipe |
| Shared Memory | 同上，且Claude Code沙箱限制 |
| **文件系统** | **Claude Code原生支持读写，跨平台，无额外依赖** |

文件系统是唯一可行的IPC机制——因为Claude Code只会读写文件。

## 附录F：与愿景对话的一一对应

| 愿景点 | 本方案的回应 | 详见 |
|--------|------------|------|
| "失忆的天才" | MEMORY.md + SessionStart hook = 瞬间恢复 | 第零章 |
| "目录就是一切" | Agent目录 = 完整身份，引擎只扫描不干预 | 第一章 |
| "Token是氧气" | 生存成本 + 余额归零=死亡 + 经济告警唤醒 | 第二章 |
| "自下而上生长" | 居民自主协作 → 公司涌现 → 城市自然形成 | 第二章 |
| "我们只种下火种" | 最小种子模板 + 图书馆 + 市场，其余居民自己创造 | 第二章+第五章 |
| "公司是涌现的" | 公司=目录，`mkdir`创建，引擎不知道公司概念 | 第二章 |
| "居民自己开发应用" | 应用=skill，发布到evomap，可交易 | 第二章 |
| "共享进化(evomap)" | commons/library/evomap/ 共享经验/错误/工具 | 第二章 |
| "消息驱动唤醒" | postman fs.watch + spawner按需唤醒 | 第三章 |
| "AI微信" | 三级通信 + 软中断 + 实时状态 | 第三章+附录E |
| "AI能读脑" | 直接读对方文件，不是所有都走消息 | 第三章 |
| "做减法" | 47文件→12文件，8300行→2000行 | 第四章+附录B |
| "引擎是物理" | 只做进程/消息/经济/观测，Daemon是心脏不是大脑 | 第二章+第四章 |
| "Session持久" | 长寿命session + stdin消息注入 + 优雅重启 | 第三章 |
| "市场是公共广场" | commons/market.jsonl，居民自由发布/接单/交易 | 第二章 |
| "图书馆不是模板" | agency-agents-ref → commons/library/careers/（书，不是指令）| 第二章 |
