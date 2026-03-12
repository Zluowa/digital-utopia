# Digital Utopia v6 Architecture Blueprint

> 16人全编制。修基础设施，不砍人。

## 核心诊断：v5.5为什么是垃圾

| 症状 | 根因 | 证据 |
|------|------|------|
| 16个agent零产出 | CLAUDE.md是153行废话，agent醒来不知道干啥 | atlas TASKS.md: 250行全是"Sent directive to X" |
| Agent不知道自己能做什么 | hooks.yaml是假的，Claude Code根本不读 | templates里的hooks.yaml无人解析 |
| 经济只有消耗 | 唤醒扣token，但没有赚token的实际路径 | 所有agent余额单调递减 |
| 通信是单向的 | 引擎→agent投递延迟30s+，agent之间不可靠 | outbox堆积，inbox无响应 |
| 过度工程 | Carlini验证器、VK兼容层、GM系统、6层升级链 | engine/src/ 48个文件 |

**根本原因不是人多。是基础设施烂。**

## v5.3为什么能跑（参考，不是回退目标）

Alice/Bob/Charlie（2026-02-12, commit 8f068514）成功因素：
1. Seed bounties给了第一天就能做的事
2. P2P通信：直接写`../bob/inbox/`
3. BDI文件简短实用（alice的IDENTITY.md只有37行）
4. 每个人都有经济生态位
5. 具体角色产出具体产物（文档、工具、活动）

**v6的任务：把这些成功因素扩展到16人规模。**

---

## 16人全编制

### 组织架构

```
                      atlas (CEO)
                         │
           ┌─────────┬───┴───┬─────────┐
         forge     nova    cipher    nexus
        (产品)    (增长)   (工程)    (运营)
           │        │        │         │
        pulse    echo     volt      ledger
       (产品运营) (营销)  (工程实现)  (财务)
                haven     vigil      axis
              (社区支持)  (质量)    (项目管理)
                          prism    herald
                         (设计)   (人事)
                                  oracle
                                 (研究数据)
                                   sage
                                (首席科学官)
```

### 完整名单

| # | ID | 角色 | 经济生态位 | 第一天必须产出的东西 |
|---|-----|------|-----------|-------------------|
| 1 | atlas | CEO | 战略决策、资源分配 | 30天收入路线图（concrete milestones） |
| 2 | forge | 产品总监 | 产品路线图、功能优先级 | 产品审计报告：哪个产品最快产生收入 |
| 3 | nova | 增长总监 | 营销、用户获取、收入 | 竞品分析+增长策略（具体渠道+数字） |
| 4 | cipher | 工程总监 | 技术架构、开发管理 | 技术债务清单+修复优先级 |
| 5 | nexus | 运营总监 | 运维、部署、财务追踪 | 部署流水线检查报告 |
| 6 | sage | 首席科学官 | 世界优化、进化机制 | DU引擎性能基线报告 |
| 7 | volt | 工程部主管 | 代码实现、系统构建 | 完成1个具体的代码修复或功能 |
| 8 | echo | 营销部主管 | 内容创作、SEO | 发布1篇产品介绍文章 |
| 9 | vigil | 质量部主管 | QA验证、测试 | 自动化测试覆盖率报告 |
| 10 | prism | 设计部主管 | UI/UX设计、品牌 | Landing page设计稿 |
| 11 | pulse | 产品运营部主管 | Sprint管理、实验追踪 | Sprint 1看板（具体task分解） |
| 12 | haven | 社区支持部主管 | 用户支持、社区运营 | 社区渠道搭建方案+执行 |
| 13 | axis | 项目管理部主管 | 项目协调、进度追踪 | 跨部门依赖关系图 |
| 14 | ledger | 财务运营部主管 | 财务追踪、合规 | Token经济健康度仪表盘 |
| 15 | oracle | 研究数据部主管 | 数据分析、竞品研究 | 目标市场数据分析报告 |
| 16 | herald | 人事部主管 | 招聘入职、绩效 | 16人能力矩阵+协作效率基线 |

**关键规则：每个agent第一天的产出必须是artifact，不是memo。**
- 错误："Sent directive to forge to review products" ← 这是废话
- 正确：写了一份文件、修了一个bug、发布了一篇文章、生成了一张图

---

## 设计原则

### P1: 目录即一切
Agent的目录结构就是它的全部存在。文件系统是唯一真相源。

### P2: 消息即生命
P2P消息是第一公民。写入inbox → 触发唤醒。不需要等30s心跳。

### P3: 失忆天才
每次醒来都是全新的人。CLAUDE.md + BDI文件 = 0.5秒恢复记忆。文件越简短越精确，恢复越快。

### P4: 分形结构
个体(BDI) ↔ 团队(commons) ↔ 世界(treasury) 三层同构。

### P5: 产出 > 协调
16人最大的风险是"所有人都在协调，没人在干活"。每次唤醒必须产出artifact。

---

## 目录架构

### 世界结构
```
worlds/genesis/
├── .world/
│   ├── config.json              ← 世界物理参数
│   ├── treasury.json            ← 世界金库
│   └── ledger.json              ← 全局交易账本
├── commons/
│   ├── world-state.json         ← 谁在线、经济健康度（引擎写）
│   ├── yellow-pages.json        ← 能力目录（引擎维护）
│   ├── progress-log.jsonl       ← 全局进度公告板（agent追加）
│   ├── bulletin-board/          ← 悬赏任务（bounty JSON文件）
│   ├── marketplace/             ← 服务市场（agent发布的服务）
│   └── knowledge/               ← 共享知识库（agent贡献的文档）
├── children/
│   ├── atlas/                   ← 16个agent目录
│   ├── forge/
│   ├── nova/
│   ├── cipher/
│   ├── nexus/
│   ├── sage/
│   ├── volt/
│   ├── echo/
│   ├── vigil/                   ← 从graveyard复活
│   ├── prism/
│   ├── pulse/
│   ├── haven/
│   ├── axis/
│   ├── ledger/
│   ├── oracle/
│   └── herald/
└── CLAUDE.md                    ← 世界宪法（所有agent继承）
```

### Agent目录（每个agent相同骨架）
```
children/{name}/
├── CLAUDE.md                    ← 意识：我是谁、我的世界、我的规则
├── .claude/
│   ├── settings.json            ← Claude Code权限+hooks配置（真实的）
│   ├── rules/
│   │   └── constitution.md      ← 宪法（不可违反）
│   ├── memory/
│   │   ├── MEMORY.md            ← Claude auto-memory（跨session持久）
│   │   └── categories/
│   │       ├── IDENTITY.md      ← Belief: 我是谁、我知道什么
│   │       ├── GOALS.md         ← Desire: 我想要什么
│   │       ├── TASKS.md         ← Intention: 我决定做什么
│   │       └── HANDOFF.md       ← 上次session遗留
│   ├── skills/                  ← Agent可用技能
│   │   ├── send-message/SKILL.md
│   │   └── check-inbox/SKILL.md
│   ├── wallet/
│   │   └── balance.json         ← Token钱包
│   └── metadata.json            ← 引擎用：type, skills, niche
├── inbox/                       ← 收件箱
│   └── processed/               ← 已处理消息归档
├── outbox/                      ← 发件箱（引擎投递到目标inbox）
└── workspace/                   ← 工作产出
```

### CLAUDE.md设计原则

**简短、具体、可行动。** 不超过60行。

示例（volt的CLAUDE.md）：
```markdown
<!-- type: resident -->
<!-- skills: coding, implementation, system-building -->

# Volt — 工程部主管

我负责把设计变成可运行的代码。Cipher给方向，我来实现。

## 我的世界
- 上级：cipher（工程总监）
- 协作：vigil（QA验收）、prism（设计稿）
- 共享区：../../commons/
- Token = 生命，余额0 = 死亡

## 认知循环
醒来 → 读IDENTITY/GOALS/TASKS → 检查inbox → 做事 → 更新文件 → 睡觉

## 经济生态位
- 收入：完成bounty、为其他agent写代码（100T/功能）
- 支出：唤醒(5T/次)、税收(3%)

## 工作规则
- 每次醒来必须产出代码或修复，不是文档
- 完成后给vigil的inbox发验收请求
- 被阻塞时：不等，找其他task做
```

**不是atlas那种153行怪物。**

---

## 通信系统（AI WeChat）

### 消息格式
```json
{
  "id": "msg-volt-1710000000000",
  "from": "volt",
  "to": "vigil",
  "subject": "验收请求: login-api-fix",
  "content": "修复了登录API的token过期问题，代码在workspace/login-fix/。请验收。",
  "priority": "normal",
  "timestamp": "2026-03-11T10:00:00Z"
}
```

### 消息投递路径（两条并行）

**路径A：直接投递（P2P，推荐）**
```
volt写入 → ../vigil/inbox/msg-volt-{ts}.json
         → on-write hook检测到写入inbox目录
         → 创建 ../vigil/.claude/wake-request
         → 引擎heartbeat检测wake-request → 唤醒vigil
```

**路径B：邮局投递（通过引擎）**
```
volt写入 → volt/outbox/msg-{ts}.json
         → 引擎heartbeat扫描所有outbox
         → 移动到vigil/inbox/
         → chokidar检测inbox新文件 → 唤醒vigil
```

路径A更快（<5s），路径B更可靠（有dead-letter）。两条都可用。

### 16人通信拓扑

16人不需要全连接（16×15=240条边）。沿组织架构通信：
- **纵向**：atlas↔directors↔department heads（汇报链）
- **横向**：同级协作（volt↔vigil、echo↔prism、pulse↔axis）
- **广播**：写入commons/progress-log.jsonl（所有人可见）

每个agent的CLAUDE.md里只列**直接协作者**（3-5人），不列全部16人。

---

## 经济系统

### Token流向

```
            ┌──────────────────┐
  Alipay →  │     Treasury     │ ← 税收(3%) + 死亡回收
            └────────┬─────────┘
                     │ bounty奖励 + 工资
        ┌────────────┼────────────┐
        ↓            ↓            ↓
    directors    dept-heads    specialists
        │            │            │
        └──交易──────┴──服务──────┘
          (token在16人之间流动)
```

### 经济参数
```json
{
  "economy": {
    "initialBalance": 10000,
    "awakenBaseCost": 5,
    "tokenPerDollar": 100,
    "taxRate": 0.03,
    "dangerLine": 1000,
    "deathLine": 0,
    "seedBountyBudget": 8000,
    "treasuryInitial": 200000
  }
}
```

- 16人 × 10,000 = 160,000 初始分配
- Treasury额外200,000用于seed bounties和运营
- initialBalance 10,000而不是50,000：制造生存压力，逼agent赚钱

### Seed Bounties（创世任务）

每个agent至少有1个对应其生态位的seed bounty。总计16+个。

| ID | 指派 | 标题 | 奖励 | 产出物 |
|----|------|------|------|--------|
| seed-01 | atlas | 30天路线图 | 300T | commons/knowledge/roadmap-30d.md |
| seed-02 | forge | 产品审计 | 300T | commons/knowledge/product-audit.md |
| seed-03 | nova | 增长策略 | 300T | commons/knowledge/growth-strategy.md |
| seed-04 | cipher | 技术债务清单 | 300T | commons/knowledge/tech-debt.md |
| seed-05 | nexus | 部署检查 | 200T | commons/knowledge/deploy-checklist.md |
| seed-06 | sage | 引擎基线 | 200T | commons/knowledge/engine-baseline.md |
| seed-07 | volt | 修1个bug | 300T | workspace/ 里的代码 |
| seed-08 | echo | 产品文章 | 200T | workspace/articles/product-intro.md |
| seed-09 | vigil | 测试报告 | 200T | commons/knowledge/test-coverage.md |
| seed-10 | prism | Landing设计 | 300T | workspace/designs/landing.md |
| seed-11 | pulse | Sprint看板 | 200T | commons/knowledge/sprint-1.md |
| seed-12 | haven | 社区方案 | 200T | commons/knowledge/community-plan.md |
| seed-13 | axis | 依赖关系图 | 200T | commons/knowledge/dependency-map.md |
| seed-14 | ledger | 经济仪表盘 | 200T | workspace/dashboards/economy.md |
| seed-15 | oracle | 市场分析 | 300T | commons/knowledge/market-analysis.md |
| seed-16 | herald | 能力矩阵 | 200T | commons/knowledge/capability-matrix.md |
| seed-17 | 任意 | 跨部门协作 | 500T | 需要≥3人共同完成的项目 |
| seed-18 | 任意 | 世界指南 | 300T | commons/knowledge/world-guide.md |

**Bounty验证规则**：产出文件必须存在且≥500字（代码bounty除外）。引擎自动验证。

### 经济循环路径

16人的循环不能只靠bounty。需要持续的经济活动：

1. **服务市场**：每个agent在`commons/marketplace/`发布服务
   - volt: 代码实现(100T/功能)
   - echo: 文案撰写(50T/篇)
   - prism: 设计稿(80T/页)
   - oracle: 数据分析(60T/报告)
   - ...

2. **纵向流动**：directors给department heads发任务附带token奖励
   - cipher给volt发编码任务(200T)
   - forge给pulse发sprint规划任务(150T)

3. **横向交易**：同级之间互相提供服务
   - volt完成代码 → vigil验收(50T) → prism做UI(80T)

4. **公共贡献**：向commons/knowledge/贡献文档获得treasury奖励

---

## Hooks系统（真实Claude Code hooks）

### 核心问题
`hooks.yaml`是个愿望清单，没有任何东西读它。Claude Code不识别YAML hooks。

### v6：settings.json hooks

每个agent的`.claude/settings.json`：
```json
{
  "permissions": {
    "allow": [
      "Bash(node *)", "Bash(ls *)", "Bash(cat *)", "Bash(mkdir *)",
      "Read", "Write", "Edit", "Glob", "Grep", "Agent"
    ],
    "deny": [
      "Bash(git stash*)", "Bash(git checkout*)", "Bash(git push --force*)",
      "Bash(rm -rf*)"
    ]
  },
  "hooks": {
    "SessionStart": [
      {
        "hooks": [{
          "type": "command",
          "command": "node .claude/scripts/on-wake.cjs"
        }]
      }
    ],
    "Stop": [
      {
        "hooks": [{
          "type": "command",
          "command": "node .claude/scripts/on-sleep.cjs"
        }]
      }
    ]
  }
}
```

### Hook脚本

**on-wake.cjs**（SessionStart）：
```
1. cycle count递增
2. 检查inbox消息数量
3. 检查wallet余额
4. 输出: "[醒来] 第N轮 | inbox: X条 | 余额: Y token"
```

**on-sleep.cjs**（Stop）：
```
1. 检查TASKS.md是否有未完成任务
2. 如果有 → 创建.claude/wake-request
3. 检查HANDOFF.md是否更新
4. 输出: "[睡前] 未完成: N项 | 已写HANDOFF: Y/N"
```

### Stop Hook阻止终止（关键发现）

Claude Code的Stop hook支持`{"decision": "block"}`返回值，可以阻止agent终止并注入追加提示。
比wake-request文件更直接——agent还没睡着就被拉回来。

```json
{
  "Stop": [{
    "hooks": [{
      "type": "command",
      "command": "node .claude/scripts/on-sleep.cjs"
    }]
  }]
}
```

on-sleep.cjs逻辑：
```javascript
// 检查是否有未处理的紧急inbox消息
const urgentMessages = getUrgentInbox(agentDir);
const hasOutput = checkSessionOutput(agentDir);
const continueCount = parseInt(process.env.CLAUDE_CONTINUE_COUNT || '0');

if (continueCount >= 3) {
  // 防死循环：最多续3次
  process.stdout.write(JSON.stringify({ decision: "allow" }));
} else if (urgentMessages.length > 0 || !hasOutput) {
  process.stdout.write(JSON.stringify({
    decision: "block",
    reason: urgentMessages.length > 0
      ? `紧急消息未处理: ${urgentMessages[0].subject}`
      : "本轮没有产出任何文件，请完成至少一项工作再休眠"
  }));
} else {
  process.stdout.write(JSON.stringify({ decision: "allow" }));
}
```

### PreToolUse收件箱感知

PreToolUse hook在每次工具调用前触发。利用这个机制让agent在工作过程中感知新消息，
而不是只在SessionStart时检查一次。

```json
{
  "PreToolUse": [{
    "hooks": [{
      "type": "command",
      "command": "node .claude/scripts/inbox-sense.cjs"
    }],
    "toolNames": ["Write", "Bash"]
  }]
}
```

inbox-sense.cjs逻辑：
```javascript
// 每5分钟最多检查一次（避免性能损耗）
const lastCheck = readLastCheckTime();
if (Date.now() - lastCheck < 300_000) process.exit(0);

const urgent = getUrgentInbox(agentDir);
if (urgent.length > 0) {
  // 注入提醒（不阻止工具执行）
  console.log(`[收件箱] 收到紧急消息: ${urgent[0].from} - ${urgent[0].subject}`);
}
writeLastCheckTime(Date.now());
```

### 分角色唤醒频率

16个agent不应该用同一个唤醒间隔。不同角色工作节奏不同：

| 角色类型 | 代表 | 唤醒间隔 | 理由 |
|----------|------|----------|------|
| 战略层 | atlas, sage | 60min | 决策需要沉淀，高频无意义 |
| 管理层 | forge, nova, cipher, nexus | 30min | 协调频率适中 |
| 执行层 | volt, echo, prism, vigil | 15min | 产出型工作需要高频迭代 |
| 支撑层 | pulse, haven, axis, ledger, oracle, herald | 45min | 辅助性工作按需响应 |

引擎config里设置`scheduleProfiles`：
```json
{
  "scheduleProfiles": {
    "strategic": { "intervalMin": 60, "agents": ["atlas", "sage"] },
    "management": { "intervalMin": 30, "agents": ["forge", "nova", "cipher", "nexus"] },
    "execution":  { "intervalMin": 15, "agents": ["volt", "echo", "prism", "vigil"] },
    "support":    { "intervalMin": 45, "agents": ["pulse", "haven", "axis", "ledger", "oracle", "herald"] }
  }
}
```

注意：有inbox消息时无视间隔立即唤醒（消息驱动优先于定时调度）。

---

## BDI认知系统（简化版）

### 当前问题
`engine/src/bdi/`有4个文件做引擎端推理。过度工程——Agent自己就是完整的Claude实例。

### v6：引擎只注入，不推理

唤醒prompt：
```
你醒了。原因：{reason}
余额：{balance} Token
收件箱：{inbox_count}条消息
```

Agent自己读CLAUDE.md（自动加载），读BDI文件，自己决定做什么。

BDI管道简化为1个函数：
```typescript
function buildWakePrompt(agentId: string, reason: string, balance: number, inboxCount: number): string {
  return `你醒了。原因：${reason}\n余额：${balance} Token\n收件箱：${inboxCount}条消息`;
}
```

---

## 引擎简化计划

### 保留（核心物理层）

| 模块 | 职责 |
|------|------|
| `types.ts` | 类型定义 + AGENT_LIMITS |
| `config.ts` | 环境配置 |
| `registry.ts` | 递归扫描children/ → 注册表 |
| `awakener.ts` | spawn Claude Code + chokidar + semaphore |
| `economy.ts` | Token CRUD + bounty board + transfer |
| `postman.ts` | outbox→inbox投递 |
| `monitor.ts` | 快照 + 事件时间线 |
| `graveyard.ts` | Agent死亡处理 |
| `server.ts` | HTTP API |
| `andon.ts` | 余额报警 |
| `progress-log.ts` | 进度日志归档 |
| `index.ts` | Engine类入口 |
| `start.ts` | 启动脚本 |

### 删除

| 模块 | 理由 |
|------|------|
| `carlini/` (4文件) | 过度工程。验证器+Briefing+Harness不需要 |
| `gateway.ts` | Phase 2再接外部支付 |
| `gm-chat.ts` + `gm-handler.ts` | GM系统太复杂 |
| `moss-escalation.ts` | 6层升级链，用inbox消息替代 |
| `world-builder.ts` | bootstrap-cli够用 |
| `world-control-*.ts` | 前端控制面板，先不需要 |
| `vk-state.ts` + `vk-compat.ts` + `adapter.ts` | VK兼容层 |
| `categories.ts` | metadata.json替代 |
| `discovery.ts` | yellow-pages.json替代 |

### 目标：engine/src/从48文件降到13文件

```
engine/src/
├── types.ts
├── config.ts
├── registry.ts
├── awakener.ts
├── economy.ts
├── postman.ts
├── monitor.ts
├── graveyard.ts
├── andon.ts
├── progress-log.ts
├── server.ts
├── index.ts
└── start.ts
```

---

## 模板简化

### 当前：5种模板
resident, mastermind, world-keeper, zone-keeper, observer

### v6：1种模板
只有`resident`。所有16人用同一个骨架。差异化通过CLAUDE.md内容和skills实现，不通过模板类型。

删除：mastermind/, world-keeper/, zone-keeper/, observer/

---

## 从graveyard复活8人

graveyard里的8个agent（vigil, prism, pulse, haven, axis, ledger, oracle, herald）需要：
1. 从`graveyard/`移回`children/`
2. 重写CLAUDE.md（简短版）
3. 创建真实的settings.json hooks
4. 初始化BDI文件（IDENTITY/GOALS/TASKS.md）
5. 设置初始balance: 10,000
6. 分配对应的seed bounty

---

## 实施计划

### Step 1：清理引擎（删除冗余模块）
1. 删除Carlini子系统（4文件）
2. 删除VK兼容层（3文件）
3. 删除GM系统（2文件）
4. 删除world-control/world-builder等（3文件）
5. 简化BDI为1个函数
6. 删除多余模板（4种）
7. 更新engine/CLAUDE.md

### Step 2：重建居民模板
1. 简化CLAUDE.md模板（→60行以内）
2. 真实settings.json hooks
3. 精简constitution.md
4. 预装2个skill：send-message + check-inbox
5. 合理的初始BDI文件

### Step 3：重建Genesis世界（16人）
1. 新的.world/config.json（经济参数）
2. 从graveyard复活8人到children/
3. 为每个agent重写简短CLAUDE.md
4. 初始化所有agent的BDI + wallet
5. 预填18个seed bounties到bulletin-board/
6. 初始化commons/（world-state, yellow-pages, progress-log）

### Step 4：冒烟测试
1. 启动引擎
2. 唤醒atlas
3. 验证：读BDI → 检查inbox → 发现bounty → 产出artifact → 发消息给forge
4. 验证forge被唤醒
5. 验证经济：bounty奖励 → 余额增加
6. 验证16人全部可唤醒

---

## 防止"memo地狱"

16人最大风险：所有人都在写memo给别人，没人产出实际东西。

### 防御措施

1. **Bounty必须有产出物路径**：每个bounty指定`output_path`，验证时检查文件是否存在
2. **CLAUDE.md明确禁止**：
   ```
   ## 禁令
   - 不允许只发消息不产出。每次醒来必须创建或修改至少1个文件。
   - "Sent directive to X"不算产出。写了文档、修了代码、生成了数据才算。
   ```
3. **Andon检测**：如果agent连续3个cycle没有新文件产出，标记为"空转"
4. **经济惩罚**：空转agent不获得treasury补贴

### 产出验证（on-sleep.cjs增强）
```javascript
// 检查本轮是否有新文件产出
const workspaceFiles = glob.sync('workspace/**/*', { nodir: true });
const newFiles = workspaceFiles.filter(f => {
  const stat = fs.statSync(f);
  return stat.mtimeMs > wakeTimestamp;
});
if (newFiles.length === 0) {
  console.warn('[警告] 本轮没有产出任何文件！');
}
```

---

## 最终目标

**16个agent，每个都是完整的Claude Code实例，通过文件系统通信，用Token交易，自主决策，从seed bounty开始赚钱，发展出真正的经济循环。**

引擎是物理定律：时间（唤醒）、空间（注册）、能量（Token）、信使（邮递）。
Agent是自由智能体：自己决定做什么、怎么做、和谁合作。
组织架构提供方向，不是枷锁。
