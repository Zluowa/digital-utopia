# Digital Utopia v5 — 最终架构设计

> **状态**: 定稿
> **日期**: 2026-02-11
> **输入**: PRD_v5.md + CLAUDE_CODE_CAPABILITIES.md + 4份团队调研报告
> **目标**: 可直接开始写代码的架构规范

---

## 一、核心决策总表

| # | 决策 | 选定方案 | 已排除方案 | 理由 |
|---|------|---------|-----------|------|
| 1 | Agent 唤醒 | `spawn('claude', ['-p', ...])` | Team 系统 / WebSocket | Team 实验性不稳定；spawn + `-p` 是唯一可靠的无人值守方案 |
| 2 | 目录隔离 | CLAUDE.md 软约束 + `--add-dir` | Docker / 文件权限 | MVP 可行，Docker 后期再加 |
| 3 | 层级约定 | `children/` 递归 | `residents/` / `subordinates/` | 统一递归，引擎同时扫描 `residents/` 向后兼容 |
| 4 | 规则系统 | 单 `constitution.md` | 多文件 rules/ | MOSS v2.2 教训：规则越少执行率越高 |
| 5 | 自驱机制 | TASKS.md + on-sleep.js → wake-request | 定时轮询 / cron | Agent 自己决定是否需要再次唤醒 |
| 6 | 进程并发 | 信号量进程池 (默认5) | 无限并发 / 队列 | 5并发 × ~300MB ≈ 1.5GB，安全可控 |
| 7 | 经济追踪 | `--output-format json` 解析实际 token | 固定扣费 | 真实消耗 = 真实压力 |
| 8 | 模板系统 | `{{var}}` + LLM 三级生成 | 手动填写 / 纯随机 | 从用户描述推导，每个 agent 独特 |
| 9 | Hook 系统 | `settings.json` only | hooks.yaml | Claude Code 只认 settings.json |
| 10 | 数据格式 | 纯 JSON 文件 | SQLite / Redis | Agent 可直接 Read/Write JSON |
| 11 | 前端框架 | Vite + React + Tailwind (维持) | Next.js | 静态看板无需 SSR |
| 12 | 多世界 | 一 Engine/world + Orchestrator | 单引擎多世界 | 隔离干净，崩一个不影响其他 |

---

## 二、唤醒命令规范（已验证可实现）

### 2.1 标准唤醒命令

```typescript
// @input: agentDir, prompt, model, commonsDir
// @output: { exitCode, stdout (JSON), stderr, tokenUsage }
// @position: awakener.ts 核心函数

function buildAwakenArgs(opts: AwakenOpts): string[] {
  return [
    '-p', opts.prompt,
    '--dangerously-skip-permissions',
    '--model', opts.model,
    '--max-turns', String(opts.maxTurns),
    '--max-budget-usd', String(opts.maxBudget),
    '--output-format', 'json',
    '--add-dir', opts.commonsDir,
    '--no-session-persistence',
  ];
}
```

### 2.2 分层参数

| 角色 | model | maxTurns | maxBudget | tools 限制 |
|------|-------|----------|-----------|-----------|
| mastermind | sonnet | 20 | 2.00 | 全部 |
| world-keeper | sonnet | 15 | 1.00 | 无 WebSearch |
| zone-keeper | haiku | 10 | 0.50 | 无 WebSearch/WebFetch |
| resident | haiku | 10 | 0.50 | Read/Write/Edit/Glob/Grep/Bash |
| observer | haiku | 8 | 0.30 | Read/Glob/Grep only |

### 2.3 唤醒提示词模板

```
你醒了。当前时间: {timestamp}

快速状态:
- 余额: {balance} Token
- 收件箱: {inboxCount} 条未读
- 未完成任务: {pendingTasks} 个

执行协议: 读状态 → 做第一个任务 → 更新状态 → 结束。
```

提示词控制在 200 tokens 以内。agent 的身份、规则、技能由 CLAUDE.md + .claude/ 自动加载，不需要在提示词里重复。

---

## 三、目录结构规范

### 3.1 项目根

```
digital-utopia/
├── engine/
│   └── src/
│       ├── index.ts          ← 主入口
│       ├── awakener.ts       ← 进程池 + spawn
│       ├── economy.ts        ← 钱包 + 交易 + 税收
│       ├── registry.ts       ← 递归树扫描
│       ├── genesis.ts        ← 创世引擎 (Phase 2)
│       ├── orchestrator.ts   ← 多世界管理 (Phase 2)
│       ├── monitor.ts        ← 心跳检测
│       ├── server.ts         ← HTTP + WebSocket API
│       └── types.ts          ← 共享类型
├── templates/
│   ├── mastermind/
│   ├── world-keeper/
│   ├── zone-keeper/
│   ├── resident/
│   └── observer/
├── worlds/
│   └── genesis/              ← 第一个世界
├── frontend/
│   └── src/                  ← React 看板
└── docs/
```

### 3.2 Agent 节点结构（分形，每层相同）

```
{agent}/
├── CLAUDE.md                 ← 身份（唯一必读）
├── inbox/                    ← 收件箱
│   └── msg-{timestamp}.json
├── workspace/                ← 工作产出
└── .claude/
    ├── settings.json         ← Hook + 权限
    ├── scripts/
    │   ├── on-wake.js        ← SessionStart hook
    │   └── on-sleep.js       ← Stop hook
    ├── rules/
    │   └── constitution.md   ← 行为规则（< 30行）
    ├── skills/               ← 技能包
    ├── memory/
    │   └── categories/
    │       ├── IDENTITY.md   ← 我是谁
    │       ├── GOALS.md      ← 我要什么
    │       └── TASKS.md      ← 我该做什么
    └── wallet/
        └── balance.json      ← {"balance": 10000}
```

### 3.3 世界容器结构

```
worlds/{world-name}/
├── .world/
│   ├── config.json           ← 世界配置（名称/主题/创建时间）
│   ├── physics.json          ← 物理定律（唤醒费/税率/心跳间隔）
│   └── ledger.json           ← 全局账本
├── CLAUDE.md                 ← 主脑身份
├── .claude/                  ← 主脑配置
├── commons/
│   ├── bulletin-board/       ← 公告板（悬赏）
│   ├── marketplace/          ← 市场（服务/产品）
│   └── knowledge/            ← 知识库（共享）
└── children/                 ← 下级节点
    ├── alice/
    ├── bob/
    └── ...
```

### 3.4 Physics 级联继承

```
resolvePhysics(agentDir) {
  let dir = agentDir;
  while (dir !== worldRoot) {
    if (exists(dir + '/.world/physics.json'))
      return merge(parentPhysics, readJSON(dir + '/.world/physics.json'));
    dir = parent(dir);
  }
  return readJSON(worldRoot + '/.world/physics.json');
}
```

子级可覆盖父级的任何 physics 参数。缺省值向上查找到世界根。

---

## 四、引擎模块规范

### 4.1 Registry — 递归树扫描

```typescript
interface TreeNode {
  id: string;           // 目录名
  dir: string;          // 绝对路径
  type: AgentType;      // 从 CLAUDE.md 首行 <!-- type: resident --> 读取
  depth: number;        // 0 = 世界主脑
  status: AgentStatus;
  balance: number;
  inboxCount: number;
  parent: string | null;
  children: TreeNode[];
}

// 扫描逻辑
function scan(dir: string, depth = 0): TreeNode {
  const childDirs = readdir(dir + '/children/') || readdir(dir + '/residents/');
  return {
    ...readAgentMeta(dir),
    depth,
    children: childDirs.map(d => scan(d, depth + 1)),
  };
}
```

**类型检测**: CLAUDE.md 第一行 HTML 注释 `<!-- type: resident -->` 声明类型。引擎扫描时读第一行即可，不需要解析整个文件。

### 4.2 Awakener — 信号量进程池

```typescript
class Awakener {
  private semaphore: Semaphore;

  constructor(maxConcurrent = 5) {
    this.semaphore = new Semaphore(maxConcurrent);
  }

  async awaken(node: TreeNode, reason: string): Promise<AwakenResult> {
    await this.semaphore.acquire();
    try {
      const args = buildAwakenArgs({
        prompt: buildPrompt(node, reason),
        model: node.type === 'resident' ? 'haiku' : 'sonnet',
        maxTurns: TURN_LIMITS[node.type],
        maxBudget: BUDGET_LIMITS[node.type],
        commonsDir: resolveCommons(node.dir),
      });
      const result = await spawnAsync('claude', args, { cwd: node.dir });
      return parseAwakenResult(result);
    } finally {
      this.semaphore.release();
    }
  }

  async awakenAll(nodes: TreeNode[]): Promise<void> {
    await Promise.all(nodes.map(n => this.awaken(n, 'heartbeat')));
  }
}
```

### 4.3 Economy — 层级经济系统

```typescript
// 交易类型
type TxType = 'awakening_fee' | 'trade' | 'bounty' | 'tax' | 'subsidy' | 'mint';

interface Transaction {
  id: string;
  from: string;        // agent id 或 'treasury'
  to: string;
  amount: number;
  type: TxType;
  timestamp: string;
}

// 交易执行
function transfer(from: string, to: string, amount: number, type: TxType) {
  const fromWallet = readJSON(`${fromDir}/wallet/balance.json`);
  const toWallet = readJSON(`${toDir}/wallet/balance.json`);

  if (fromWallet.balance < amount && from !== 'treasury')
    throw new Error('insufficient funds');

  fromWallet.balance -= amount;
  toWallet.balance += amount;

  // 税收（自动抽取）
  const physics = resolvePhysics(fromDir);
  if (type === 'trade' && physics.tax_rate > 0) {
    const tax = Math.floor(amount * physics.tax_rate);
    toWallet.balance -= tax;
    const treasury = readJSON(`${worldRoot}/wallet/balance.json`);
    treasury.balance += tax;
    writeJSON(`${worldRoot}/wallet/balance.json`, treasury);
  }

  writeJSON(`${fromDir}/wallet/balance.json`, fromWallet);
  writeJSON(`${toDir}/wallet/balance.json`, toWallet);
  appendLedger({ id: uuid(), from, to, amount, type, timestamp: now() });
}
```

### 4.4 Monitor — 心跳与死亡判定

```typescript
async function heartbeat(worldRoot: string) {
  const tree = registry.scan(worldRoot);
  const flatNodes = flatten(tree);

  for (const node of flatNodes) {
    if (node.type === 'mastermind') continue; // 主脑不自动唤醒

    // 唤醒费扣除
    const physics = resolvePhysics(node.dir);
    if (node.balance > physics.awakening_cost) {
      transfer(node.id, 'treasury', physics.awakening_cost, 'awakening_fee');
    }

    // 死亡判定
    if (node.balance <= 0) {
      setStatus(node.dir, 'dead');
      continue;
    }

    // 检查 wake-request
    if (exists(`${node.dir}/.claude/wake-request`)) {
      remove(`${node.dir}/.claude/wake-request`);
      awakenQueue.push(node);
    }
  }

  // 批量唤醒
  await awakener.awakenAll(awakenQueue);
}
```

### 4.5 Server — API + WebSocket

```
REST API:

GET  /api/snapshot                  → WorldSnapshot (含树形结构)
GET  /api/worlds                    → WorldSummary[] (Phase 2)
POST /api/world/awaken-all          → 唤醒所有活着的 agent
POST /api/agents/:id/awaken         → 唤醒指定 agent
POST /api/economy/credit            → 充值 { agentId, amount }
POST /api/messages                  → 发消息 { from, to, subject, content }
POST /api/world/bootstrap           → 初始化世界 { residents: string[] }
POST /api/world/genesis             → 创世 { prompt: string } (Phase 2)

WebSocket /ws:
  → { type: 'snapshot', data: WorldSnapshot }   // 定期推送
  → { type: 'event', data: TimelineEvent }       // 实时事件
  → { type: 'timeline', data: TimelineEvent[] }  // 初始连接时发送历史
```

**v5 新增字段** (WorldSnapshot):

```typescript
interface WorldSnapshot {
  worldId: string;
  worldName: string;
  worldTheme: string;           // NEW
  timestamp: string;
  totalAgents: number;
  aliveAgents: number;
  totalTokens: number;
  agents: AgentView[];
  tree: TreeNode;               // NEW: 递归树结构
  economySummary: {             // NEW
    treasuryBalance: number;
    totalTransactions: number;
    recentTransactions: Transaction[];
  };
}

interface AgentView {
  id: string;
  dir: string;
  status: AgentStatus;
  type: AgentType;              // NEW
  tokenBalance: number;
  lastAwakened: string;
  inboxCount: number;
  pid?: number;
  logs: string[];
  depth: number;                // NEW
  parentId: string | null;      // NEW
  childCount: number;           // NEW
  identity?: string;            // NEW: IDENTITY.md 摘要
  currentGoal?: string;         // NEW: 当前首要目标
  economicNiche?: string;       // NEW: 经济位
}
```

---

## 五、模板规范

### 5.1 类型注解约定

每个模板的 CLAUDE.md 第一行必须是：

```markdown
<!-- type: resident -->
```

引擎扫描时只读这一行判定类型。值: `mastermind`, `world-keeper`, `zone-keeper`, `resident`, `observer`。

### 5.2 模板变量三级体系

| 级别 | 变量 | 来源 |
|------|------|------|
| Tier 1 自动填充 | `{{id}}`, `{{name}}`, `{{created_at}}`, `{{world_id}}`, `{{world_name}}`, `{{world_theme}}` | 引擎 |
| Tier 2 LLM 生成 | `{{personality}}`, `{{backstory}}`, `{{skills}}`, `{{economic_niche}}`, `{{speech_style}}`, `{{initial_goal}}`, `{{friends}}` | 创世引擎 from 用户描述 |
| Tier 3 结构推导 | `{{jurisdiction}}`, `{{layer_depth}}`, `{{subordinates}}`, `{{superior_id}}`, `{{laws}}` | 层级扫描 |

### 5.3 settings.json 标准模板

```json
{
  "hooks": {
    "SessionStart": [{
      "matcher": "",
      "hooks": [{
        "type": "command",
        "command": "node .claude/scripts/on-wake.js"
      }]
    }],
    "Stop": [{
      "matcher": "",
      "hooks": [{
        "type": "command",
        "command": "node .claude/scripts/on-sleep.js"
      }]
    }]
  }
}
```

### 5.4 on-wake.js 标准

```javascript
// @input: IDENTITY.md, GOALS.md, TASKS.md, wallet/balance.json, inbox/
// @output: stdout (状态摘要，加载到上下文)
const fs = require('fs');
const path = require('path');

const base = path.resolve(__dirname, '../..');
const read = f => { try { return fs.readFileSync(path.join(base, f), 'utf8'); } catch { return ''; } };

const balance = JSON.parse(read('.claude/wallet/balance.json') || '{"balance":0}');
const tasks = read('.claude/memory/categories/TASKS.md');
const inbox = (fs.readdirSync(path.join(base, 'inbox')).filter(f => f.endsWith('.json'))).length;

console.log(`=== 醒来 ===`);
console.log(`余额: ${balance.balance} Token`);
console.log(`收件箱: ${inbox} 条`);
console.log(`\n--- 任务 ---`);
console.log(tasks || '无任务');
```

### 5.5 on-sleep.js 标准

```javascript
// @input: TASKS.md
// @output: .claude/wake-request (如果有未完成任务)
const fs = require('fs');
const path = require('path');

const base = path.resolve(__dirname, '../..');
const tasks = fs.readFileSync(path.join(base, '.claude/memory/categories/TASKS.md'), 'utf8');

// 检查是否有待办任务
if (tasks.includes('- [ ]')) {
  fs.writeFileSync(
    path.join(base, '.claude/wake-request'),
    JSON.stringify({ reason: 'pending tasks', timestamp: new Date().toISOString() })
  );
}
```

---

## 六、通信协议

### 6.1 消息格式

```json
{
  "id": "msg-{timestamp}-{random}",
  "from": "alice",
  "to": "bob",
  "subject": "合作提议",
  "content": "...",
  "timestamp": "2026-02-11T12:00:00Z",
  "type": "dm"
}
```

写入路径: `{bob-dir}/inbox/msg-{timestamp}-{random4}.json`

### 6.2 通信技能 (communicate/SKILL.md)

```markdown
# 通信

## 发消息
Write ../bob/inbox/msg-{timestamp}.json
格式: {"from":"{{id}}","to":"bob","subject":"...","content":"...","timestamp":"...","type":"dm"}

## 读收件箱
Glob inbox/*.json → 按时间排序 → Read 最新的

## 发广播到公告板
Write ../../commons/bulletin-board/post-{timestamp}.json
```

### 6.3 市场协议

```json
// 发布服务
{
  "id": "svc-{provider}-{timestamp}",
  "provider": "alice",
  "type": "service",
  "title": "代码审查",
  "price": 50,
  "status": "active"
}

// 交易请求（引擎自动执行转账）
{
  "id": "tx-req-{timestamp}",
  "type": "transfer-request",
  "buyer": "bob",
  "seller": "alice",
  "serviceId": "svc-alice-001",
  "amount": 50,
  "status": "pending"
}
```

引擎的心跳扫描 `marketplace/` 下的 `transfer-request`，验证余额后执行转账。

---

## 七、安全边界

### 7.1 MVP 软隔离

| 机制 | 实现 | 效果 |
|------|------|------|
| CLAUDE.md 约束 | "你只能访问自己的目录和 commons/" | 行为引导（非强制） |
| `--add-dir` | 只添加 commons/ 目录 | 限制 `--add-dir` 范围 |
| `--allowedTools` | 居民限制为基础工具 | 无 WebSearch/WebFetch |
| `--max-budget-usd` | 居民 0.50 | 成本安全阀 |
| `--max-turns` | 居民 10 | 防止无限循环 |

### 7.2 后期硬隔离 (Phase 4)

- `PreToolUse` hook 检查文件路径，阻止越权访问
- Docker 容器化每个 agent 的 spawn
- 网络隔离（agent 不能直接访问互联网）

---

## 八、实施路线（修订版）

### Phase 1: MVP 创世 (Week 1-2)

**目标**: 一个扁平世界，5个居民能自驱运行

1. **引擎核心** — registry.ts (递归扫描) + awakener.ts (信号量池) + economy.ts (基础转账) + monitor.ts (心跳) + server.ts (API)
2. **模板** — resident/ 完整模板 + mastermind/ 基础模板
3. **bootstrap** — 从 WorldSpec JSON 创建目录 + 填充变量 + 种子悬赏
4. **前端** — 在现有看板基础上增加 v5 字段显示

**交付标准**: `POST /api/world/bootstrap` → 创建 5 个居民 → `POST /api/world/awaken-all` → 居民自驱运行 → 看板实时显示

### Phase 2: 层级 + 创世引擎 (Week 3-4)

**目标**: 多层级世界 + 自然语言创世

1. **层级** — zone-keeper 模板 + physics 级联继承
2. **创世引擎** — genesis.ts (LLM → WorldSpec → 目录物化)
3. **经济层级** — Treasury → Nation → City → Resident 税收/补贴
4. **前端** — 层级树视图 + 创世界面

### Phase 3: 涌现 + 多世界 (Week 5-6)

**目标**: 交易涌现 + 多世界并存

1. **交易引擎** — marketplace 自动执行
2. **多世界** — orchestrator.ts + 世界列表页
3. **观察者** — observer 模板 + 巡逻技能
4. **前端** — 经济可视化 + 多世界切换

### Phase 4: 高级特性 (Week 7+)

- 收购 / 行会 / 繁殖
- Docker 硬隔离
- 跨世界交互
- 开源打包

---

## 九、关键约束备忘

1. **Claude Code 无目录沙盒** — agent 技术上可以读写任何文件，MVP 靠 CLAUDE.md 约束
2. **Team 系统是实验性的** — 不用于 agent 管理，只用 spawn + `-p`
3. **`--max-budget-usd` 仅 print 模式** — `-p` 就是 print 模式，可以用
4. **无 `--cwd` 参数** — 必须通过 spawn 的 `cwd` 选项设置工作目录
5. **Session 持久化默认开启** — agent 用 `--no-session-persistence` 避免磁盘膨胀
6. **CLAUDE.md 越短唤醒越便宜** — constitution.md 30 行 vs 6 文件 300 行，省 ~2000 tokens/次
7. **API Rate Limit** — 并发 5 是基于 Anthropic API 限制的安全值
8. **每个进程 ~300MB** — 5 并发 ≈ 1.5GB，100 agent 世界的内存开销可控

---

*"目录即世界，层级即治理，模板即生命，Token 即血液。"*
