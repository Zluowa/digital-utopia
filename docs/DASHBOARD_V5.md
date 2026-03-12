# Digital Utopia v5 — 前端看板设计

> **状态**: 定稿
> **日期**: 2026-02-11
> **当前**: 12 文件 / Vite + React + Tailwind / 扁平看板 / 单世界
> **目标**: 多世界 / 层级可视化 / 创世界面 / 经济仪表盘

---

## 一、现状分析

### 现有组件

| 文件 | 功能 | v5 处理 |
|------|------|---------|
| App.tsx | 主布局 (kanban + sidebar) | **重写** — 加路由和多视图 |
| types.ts | AgentView / WorldSnapshot / 4列分类 | **扩展** — 加 TreeNode, AgentType, Economy 类型 |
| useDashboard.ts | WebSocket + REST + snapshot 状态 | **扩展** — 加多世界 + 创世 + 经济 API |
| KanbanBoard.tsx | 拖拽看板 | **保留** — 继续用于状态列视图 |
| AgentCardContent.tsx | Agent 卡片 | **增强** — 显示类型/层级/性格 |
| KanbanBadge.tsx | 小标签 | **保留** |
| RunningDots.tsx | 唤醒动画 | **保留** |
| button.tsx / card.tsx | UI 原子 | **保留** |
| api.ts | fetch 封装 | **保留** |
| cn.ts | classnames 工具 | **保留** |

**结论**: 12 个文件中保留 8 个，重写 1 个 (App.tsx)，扩展 3 个 (types.ts, useDashboard.ts, AgentCardContent.tsx)，新增约 8 个文件。总计 ~20 文件。

---

## 二、页面结构

### 2.1 导航

```
┌──────────────────────────────────────────────┐
│ Digital Utopia        [genesis] [empire]  ⚡  │ ← 顶栏：世界切换 tabs
├──────────────────────────────────────────────┤
│ [Kanban] [Tree] [Economy] [Create]           │ ← 视图切换
├──────────────────────────────────────────────┤
│                                              │
│              主内容区域                       │
│                                              │
├──────────────────────────────────────────────┤
│ agents:12  alive:8  tokens:45000  ws:live    │ ← 底栏状态
└──────────────────────────────────────────────┘
```

**路由** (hash router, 无需后端配合):

```
#/                    → 默认世界的 Kanban 视图
#/{world}/kanban      → Kanban 视图
#/{world}/tree        → 层级树视图
#/{world}/economy     → 经济视图
#/create              → 创世界面
```

### 2.2 四个视图

| 视图 | 功能 | Phase |
|------|------|-------|
| **Kanban** | 现有看板增强 — 4 列状态 + Agent 详情侧栏 | Phase 1 |
| **Tree** | 层级树 — 可展开折叠，显示治理关系 | Phase 2 |
| **Economy** | 经济仪表盘 — Token 流向 + 交易历史 | Phase 3 |
| **Create** | 创世界面 — 自然语言输入 → 预览 → 确认 | Phase 2 |

---

## 三、Kanban 视图增强 (Phase 1)

### 3.1 布局不变

保持现有 `grid-cols-[1fr_320px]` 布局：左侧看板，右侧详情。

### 3.2 Agent 卡片增强

**当前**:
```
┌──────────────────────┐
│ alice                │
│ [alive] [8500 tok]   │
│ 14:32:15             │
└──────────────────────┘
```

**v5**:
```
┌──────────────────────┐
│ 🏠 alice        resident │ ← 类型图标 + 类型标签
│ [alive] [8500 tok]       │
│ hacker / bold / creative │ ← 经济位 / 性格标签
│ "写自动化脚本"             │ ← 当前目标（GOALS.md 首条）
│ 14:32:15    depth:2      │ ← 层级深度
└──────────────────────────┘
```

**类型图标映射**:
```typescript
const TYPE_ICONS: Record<AgentType, string> = {
  mastermind:    '👁',
  'world-keeper': '🛡',
  'zone-keeper':  '🏰',
  resident:       '🏠',
  observer:       '👀',
};
```

### 3.3 侧栏详情增强

```
┌─────────────────────────────┐
│ Agent Detail                │
│ alice (resident)            │
├─────────────────────────────┤
│ 基础信息                     │
│  status: alive              │
│  tokens: 8500               │
│  inbox: 2 unread            │
│  depth: 2                   │
│  parent: city-ironforge     │
│  children: 0                │
├─────────────────────────────┤
│ 身份                         │
│  personality: bold, creative │
│  niche: automation scripts  │
│  goal: 写第一个产品并出售    │
├─────────────────────────────┤
│ 操作                         │
│  [awaken] [+1000 tok]       │
│  [send message]             │
├─────────────────────────────┤
│ 最近日志                     │
│  > 读取了 inbox/msg-001     │
│  > 写入 marketplace/svc-001 │
│  > 更新 TASKS.md            │
├─────────────────────────────┤
│ Timeline                    │
│  ...                        │
└─────────────────────────────┘
```

**新增 "send message" 按钮**: 弹出简易表单，输入 subject + content，调用 `POST /api/messages`。

---

## 四、Tree 视图 (Phase 2)

### 4.1 布局

```
┌──────────────────────────────────────────────┐
│  World Tree: empire                          │
├──────────────────────────────────────────────┤
│                                              │
│  👁 mastermind (15000 tok)                   │
│  ├── 🏰 nation-fire (8000 tok)              │
│  │   ├── 🏰 city-ironforge (5000 tok)       │
│  │   │   ├── 🏠 alice (8500 tok) ●         │
│  │   │   └── 🏠 bob (3200 tok) ◌           │
│  │   └── 🏰 city-goldshire (4000 tok)       │
│  │       └── 🏠 charlie (6000 tok) ●        │
│  ├── 🏰 nation-water (6000 tok)             │
│  │   └── 🏠 dave (2000 tok) ◌              │
│  └── 👀 observer-eye (1000 tok)              │
│                                              │
│  ● = alive   ◌ = sleeping   ✕ = dead         │
│                                              │
│  点击节点 → 右侧弹出详情面板                  │
│                                              │
└──────────────────────────────────────────────┘
```

### 4.2 交互

- **展开/折叠**: 点击节点前的箭头
- **选中**: 点击节点名称 → 右侧弹出详情（复用侧栏组件）
- **缩放**: 大世界 (100+ agent) 支持滚轮缩放
- **状态颜色**: alive=绿, awakening=橙, critical=红, dead=灰

### 4.3 实现方案

不用 D3.js（太重）。用纯 CSS 缩进 + 递归 React 组件：

```typescript
function TreeNodeView({ node, depth = 0 }: { node: TreeNode; depth?: number }) {
  const [expanded, setExpanded] = useState(true);
  const hasChildren = node.children.length > 0;

  return (
    <div style={{ paddingLeft: depth * 24 }}>
      <div className="flex items-center gap-2 py-1 hover:bg-secondary rounded cursor-pointer">
        {hasChildren && (
          <button onClick={() => setExpanded(!expanded)}>
            {expanded ? '▼' : '▶'}
          </button>
        )}
        <span>{TYPE_ICONS[node.type]}</span>
        <span className="font-medium">{node.id}</span>
        <span className="text-low text-sm">{node.balance} tok</span>
        <StatusDot status={node.status} />
      </div>
      {expanded && node.children.map(child => (
        <TreeNodeView key={child.id} node={child} depth={depth + 1} />
      ))}
    </div>
  );
}
```

---

## 五、Economy 视图 (Phase 3)

### 5.1 布局

```
┌──────────────────────────────────────────────┐
│  Economy: genesis                            │
├──────────┬───────────────────────────────────┤
│ 总览      │  交易历史                         │
│           │                                   │
│ Treasury  │  14:32 alice → bob    50 trade   │
│  15000 ◆  │  14:28 treasury → alice 100 bounty│
│           │  14:25 bob → treasury  5 tax      │
│ 流通量     │  14:20 dave → alice   80 trade    │
│  45000    │  14:15 treasury → all 500 subsidy │
│           │  ...                              │
│ 交易次数   │                                   │
│  127      │  [加载更多]                        │
│           │                                   │
│ 活跃Agent  │                                   │
│  8/12     │                                   │
├──────────┴───────────────────────────────────┤
│ Token 分布                                    │
│ ████████████████████ alice    8500 (19%)      │
│ ███████████████      treasury 15000 (33%)     │
│ ██████████           charlie  6000 (13%)      │
│ ████████             nation-fire 8000          │
│ ██████               bob      3200            │
│ █████                dave     2000            │
│ ███                  observer 1000            │
└──────────────────────────────────────────────┘
```

### 5.2 数据源

新增 API：
```
GET /api/economy/summary     → { treasury, circulation, txCount, distribution[] }
GET /api/economy/transactions?limit=50&offset=0 → Transaction[]
```

### 5.3 实现

- Token 分布用纯 CSS 横条图（不需要 chart 库）
- 交易历史用虚拟滚动列表（> 1000 条时）
- 数据 5 秒轮询刷新（不需要 WebSocket 推送经济数据）

---

## 六、Create 视图 (Phase 2)

### 6.1 流程

```
步骤1: 描述你的世界
┌──────────────────────────────────────────────┐
│                                              │
│  描述你想要的世界:                            │
│  ┌──────────────────────────────────────┐    │
│  │ 一个赛博朋克世界，5个黑客居民，       │    │
│  │ 分成两个小队互相竞争                  │    │
│  └──────────────────────────────────────┘    │
│                                              │
│                          [生成 WorldSpec →]   │
│                                              │
└──────────────────────────────────────────────┘

步骤2: 预览并调整
┌──────────────────────────────────────────────┐
│ World: neon-city        Theme: cyberpunk     │
│ Hierarchy: flat (1 layer)                    │
│                                              │
│ Agents:                                      │
│ ┌──────────┬──────────┬──────────┐          │
│ │ zero     │ phantom  │ glitch   │          │
│ │ hacker   │ trader   │ analyst  │          │
│ │ bold     │ cautious │ creative │          │
│ └──────────┴──────────┴──────────┘          │
│ ┌──────────┬──────────┐                     │
│ │ cipher   │ rogue    │                     │
│ │ builder  │ hacker   │                     │
│ │ cooperat │ competit │                     │
│ └──────────┴──────────┘                     │
│                                              │
│ Seed Bounties:                               │
│ • 入侵模拟数据库 (100 credits)               │
│ • 写加密通信工具 (150 credits)               │
│ • 建立团队声誉系统 (200 credits)             │
│                                              │
│ [← 重新生成]  [编辑 JSON]  [创建世界 →]     │
└──────────────────────────────────────────────┘

步骤3: 创建中...
┌──────────────────────────────────────────────┐
│ 创建世界: neon-city                          │
│                                              │
│ ✅ 创建世界目录                              │
│ ✅ 填充主脑模板                              │
│ ✅ 创建 zero (hacker)                        │
│ ✅ 创建 phantom (trader)                     │
│ ⏳ 创建 glitch (analyst)                     │
│ ○  创建 cipher (builder)                     │
│ ○  创建 rogue (hacker)                       │
│ ○  播种悬赏                                  │
│ ○  初始唤醒主脑                              │
│                                              │
└──────────────────────────────────────────────┘
```

### 6.2 API 交互

```
POST /api/world/genesis/interpret
  body: { prompt: "一个赛博朋克世界..." }
  response: WorldSpec JSON

POST /api/world/genesis/create
  body: WorldSpec JSON
  response: { worldId, status: "creating" }
  → WebSocket 推送进度事件
```

---

## 七、新增文件清单

```
frontend/src/
├── App.tsx                          ← 重写（路由 + 布局）
├── types.ts                         ← 扩展（TreeNode, AgentType, Economy 类型）
├── hooks/
│   ├── useDashboard.ts              ← 扩展（多世界 + 经济 API）
│   └── useWorldRouter.ts            ← NEW: hash 路由 + 当前世界状态
├── components/
│   ├── layout/
│   │   ├── TopBar.tsx               ← NEW: 世界切换 tabs + 状态
│   │   ├── ViewTabs.tsx             ← NEW: Kanban/Tree/Economy/Create 切换
│   │   └── StatusBar.tsx            ← NEW: 底栏状态
│   ├── kanban/
│   │   ├── KanbanBoard.tsx          ← 保留
│   │   ├── AgentCardContent.tsx     ← 增强（类型/层级/性格）
│   │   ├── KanbanBadge.tsx          ← 保留
│   │   └── RunningDots.tsx          ← 保留
│   ├── tree/
│   │   └── TreeView.tsx             ← NEW: 递归树组件
│   ├── economy/
│   │   ├── EconomyDashboard.tsx     ← NEW: 经济总览
│   │   └── TransactionList.tsx      ← NEW: 交易历史
│   ├── create/
│   │   └── GenesisWizard.tsx        ← NEW: 创世向导
│   ├── shared/
│   │   ├── AgentDetail.tsx          ← NEW: 提取自 App.tsx 侧栏（复用）
│   │   ├── StatusDot.tsx            ← NEW: 状态圆点
│   │   └── TokenBar.tsx             ← NEW: 分布横条
│   └── ui/
│       ├── button.tsx               ← 保留
│       └── card.tsx                 ← 保留
├── lib/
│   ├── api.ts                       ← 保留
│   └── cn.ts                        ← 保留
└── main.tsx                         ← 保留
```

**总计**: ~20 文件。新增 ~10 文件，修改 ~3 文件，保留 ~8 文件。

---

## 八、类型扩展

```typescript
// types.ts 新增

export type AgentType = 'mastermind' | 'world-keeper' | 'zone-keeper' | 'resident' | 'observer';

export interface TreeNode {
  id: string;
  dir: string;
  type: AgentType;
  depth: number;
  status: AgentStatus;
  balance: number;
  parent: string | null;
  children: TreeNode[];
}

// AgentView 扩展
export interface AgentView {
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
  identity?: string;            // NEW: 摘要
  currentGoal?: string;         // NEW
  economicNiche?: string;       // NEW
  personality?: string;         // NEW
}

// WorldSnapshot 扩展
export interface WorldSnapshot {
  worldId: string;
  worldName: string;
  worldTheme: string;           // NEW
  timestamp: string;
  totalAgents: number;
  aliveAgents: number;
  totalTokens: number;
  agents: AgentView[];
  tree: TreeNode;               // NEW
  economySummary: EconomySummary; // NEW
}

export interface EconomySummary {
  treasuryBalance: number;
  circulation: number;
  transactionCount: number;
  distribution: { id: string; balance: number; percentage: number }[];
}

export interface Transaction {
  id: string;
  from: string;
  to: string;
  amount: number;
  type: 'awakening_fee' | 'trade' | 'bounty' | 'tax' | 'subsidy' | 'mint';
  timestamp: string;
}

// 世界列表
export interface WorldSummary {
  id: string;
  name: string;
  theme: string;
  agentCount: number;
  aliveCount: number;
  totalTokens: number;
}

// 创世
export interface WorldSpec {
  name: string;
  theme: string;
  description: string;
  physics: {
    awakening_cost: number;
    starting_tokens: number;
    heartbeat_ms: number;
    tax_rate: number;
  };
  agents: AgentSpec[];
  seed_bounties: string[];
}

export interface AgentSpec {
  name: string;
  personality: string;
  backstory: string;
  skills: string[];
  economic_niche: string;
  speech_style: string;
  initial_goal: string;
  friends: string[];
}
```

---

## 九、useDashboard 扩展

```typescript
// 新增方法
export function useDashboard() {
  // ...现有...

  // Phase 1: 多世界
  const listWorlds = useCallback(
    () => apiRequest<WorldSummary[]>('/api/worlds'), []);
  const switchWorld = useCallback(
    (worldId: string) => apiRequest<WorldSnapshot>(`/api/worlds/${worldId}/snapshot`), []);

  // Phase 2: 创世
  const interpretWorld = useCallback(
    (prompt: string) => postAction('/api/world/genesis/interpret', { prompt }), [postAction]);
  const createWorld = useCallback(
    (spec: WorldSpec) => postAction('/api/world/genesis/create', spec), [postAction]);

  // Phase 3: 经济
  const getTransactions = useCallback(
    (limit = 50, offset = 0) =>
      apiRequest<Transaction[]>(`/api/economy/transactions?limit=${limit}&offset=${offset}`), []);

  return {
    // ...现有...
    listWorlds, switchWorld,
    interpretWorld, createWorld,
    getTransactions,
  };
}
```

---

## 十、分阶段实施

### Phase 1 前端改动 (Week 1-2)

跟引擎 Phase 1 同步。改动最小化。

1. **types.ts**: 加 `type`, `depth`, `parentId`, `childCount` 到 AgentView
2. **AgentCardContent.tsx**: 显示类型图标和经济位
3. **App.tsx**: 侧栏增加身份区块（identity, goal, niche）
4. **useDashboard.ts**: 适配新的 snapshot 字段

**不做**: 路由、多视图、多世界——这些是 Phase 2。

### Phase 2 前端改动 (Week 3-4)

1. **路由系统**: useWorldRouter.ts (hash router)
2. **布局重构**: App.tsx → TopBar + ViewTabs + 内容区 + StatusBar
3. **Tree 视图**: TreeView.tsx (递归组件)
4. **创世界面**: GenesisWizard.tsx (3步流程)
5. **多世界切换**: TopBar 的世界 tabs

### Phase 3 前端改动 (Week 5-6)

1. **经济视图**: EconomyDashboard.tsx + TransactionList.tsx + TokenBar.tsx
2. **多世界**: 世界列表页
3. **共享组件提取**: AgentDetail.tsx 从 App.tsx 侧栏提取

---

## 十一、设计原则

1. **数据驱动**: 前端不做业务逻辑，只展示引擎返回的数据
2. **渐进增强**: Phase 1 最小改动在现有基础上加字段，不重写
3. **无第三方图表库**: 用 CSS 实现横条图、状态点，避免 D3/Chart.js 依赖
4. **纯 CSS 树**: 递归 React 组件 + paddingLeft 缩进，不用 tree 库
5. **hash 路由**: 不加 react-router，自己写 ~30 行 hash 路由 hook
6. **响应式**: 小屏时隐藏侧栏，显示为底部抽屉

---

*"看板是引擎的眼睛。引擎负责跑世界，看板负责让你看到世界在跑。"*
