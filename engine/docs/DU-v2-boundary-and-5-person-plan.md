# Digital Utopia v2 架构澄清

> 目的不是继续堆功能，而是先把“居民边界”和“系统边界”讲清楚。  
> 日期：2026-03-11

## 0. 结论先行

1. 每个居民首先是一个完整的 Claude Code，而不是引擎控制下的木偶。
2. 目录不是实现细节，目录就是组织架构、权限边界和记忆边界。
3. 阶段一必须先做“公司”，并把“医院式工作流”作为公司内部 protocol；不要直接做文明。
4. Claude Code 原生已经提供 subagents、skills、hooks、agent teams、scheduled tasks、worktree 等能力，DU 不应重复造这些轮子。
5. DU 系统真正该做的是 Claude Code 做不到的持续性、公共性、物理性：跨会话协作、世界级账本、组织关系、耐久消息、观测、经济和审计。

---

## 1. Claude Code 原生能力边界

下表只写对 DU 架构有决定意义的能力。

| 能力 | 官方事实 | 对居民意味着什么 | DU 的决策 |
| --- | --- | --- | --- |
| 持久指令 | `CLAUDE.md`、`.claude/CLAUDE.md`、`.claude/rules/` 会在会话启动时生效；规则可按路径生效 | 居民天然有身份、宪法、局部规则 | 不再在引擎里重复做“身份扫描器”“提示词拼装器” |
| 设置与权限 | 设置有 managed / command line / local / project / user 多级作用域；项目级可共享 hooks、permissions、plugins | 居民能有自己的权限和工具边界 | 系统只定义标准，不在引擎里硬编码“角色能力表” |
| Skills | Skill 放在 `~/.claude/skills/<name>/SKILL.md` 或 `.claude/skills/<name>/SKILL.md`；支持嵌套发现、脚本、引用文件、按需加载 | 居民天然能拥有“微信”“工作流”“自检”“记忆整理”等软件能力 | 把行为协议尽量写成 skill，不写死在引擎 |
| Subagents | Subagent 是单会话内的专门工人；有独立上下文、工具权限和权限模式 | 居民自己就能继续拆分任务 | DU 不再实现 resident 内部的“子代理框架” |
| Agent teams | 官方已提供共享任务列表、邮箱通信、自动投递、文件锁防抢占；但该功能实验性、默认关闭 | 活着的居民可以临时组队，直接协作 | 把 agent teams 当作“活体协作层”，不是整个世界的底座 |
| Hooks | `SessionStart` 可注入上下文；`Stop` 可阻止停止；`TeammateIdle`、`TaskCompleted`、`WorktreeCreate` 都可挂钩 | 居民有原生生命周期、质量门和工作树协作入口 | DU 用 hooks 接协议，不再额外造并行生命周期系统 |
| Scheduled tasks | `/loop` 与 `CronCreate/List/Delete` 可在当前会话内轮询或提醒；但任务只在当前 session 存活 | 活着的居民可以自我巡检、自我提醒 | 世界级唤醒/耐久 cron 仍需 DU 或外部调度承担 |
| Worktree | Claude Code 原生支持 worktree；`/batch` 会在隔离 worktree 中并行做事；还有 `WorktreeCreate/Remove` hooks | 居民能安全并行开发 | DU 应复用原生 worktree，不再自造一套代码并行机制 |
| Auto memory | 自动记忆在 `~/.claude/projects/<project>/memory/`；同一 repo 的所有 worktree 和子目录共享一套 auto memory；只会话启动时加载 `MEMORY.md` 前 200 行 | Claude Code 有记忆层，但不是严格的“每居民独立大脑” | 不能直接把 auto memory 当居民级人格存储；DU 需要显式的居民记忆文件或更强隔离 |

### 官方资料

- Memory: https://code.claude.com/docs/en/memory
- Settings: https://code.claude.com/docs/en/settings
- Subagents: https://code.claude.com/docs/en/sub-agents
- Skills: https://code.claude.com/docs/en/skills
- Hooks: https://code.claude.com/docs/en/hooks
- Agent teams: https://code.claude.com/docs/en/agent-teams
- Scheduled tasks: https://code.claude.com/docs/en/scheduled-tasks

---

## 2. Claude Code 的关键局限

这些不是 bug，而是边界。DU 必须正视它们。

| 局限 | 为什么关键 |
| --- | --- |
| Agent teams 是实验能力，官方明确提示在 session 恢复、任务协调、关闭行为上有已知问题 | 不能把整个世界的长期协作压在 agent teams 上 |
| Scheduled tasks 是 session-scoped，关闭终端就消失 | 不能把居民生存、世界巡逻、定时唤醒托付给 `/loop` |
| Auto memory 对同一 repo 的 worktree/子目录共享一套目录 | 如果居民都活在同一 repo 下，原生自动记忆会串味 |
| CLAUDE.md 是上下文，不是强制执行器 | 系统不能假设“写了规则就一定被遵守”，仍需审计与验收 |
| Subagents 只适合单会话内拆工 | 不适合做城市级、公司级、跨睡眠周期的居民建模 |
| Hooks 擅长生命周期拦截，不擅长承担世界级状态存储 | hooks 负责触发，不负责成为数据库 |

**核心判断**：

- Claude Code 很强，但它的强项是“活着时的局部智能体能力”。
- DU 需要补的是“睡着以后依然成立的世界结构”。

---

## 3. 三层架构，不要混

### 3.1 居民层：Claude Code 原生层

居民自己负责：

1. 理解任务、推理、写代码、写文档、跑测试
2. 维护本地身份、规则、技能、局部记忆
3. 在活跃 session 内使用 subagents、agent teams、worktree、scheduled tasks
4. 回复消息、更新 todo、产出 handoff

### 3.2 公司层：DU 组织层

DU 系统负责：

1. 组织关系图：谁归谁管、谁能联系谁、谁对谁负责
2. 统一任务看板：跨居民、跨睡眠周期、可观测、可追踪
3. 耐久消息系统：消息、确认、拒绝、延期、完成
4. 世界级事件流与公告板：谁在做什么、谁被堵塞、谁需要升级
5. 经济与预算：账本、费用、资源、配额
6. 人类接口：老板、GM、用户如何对世界发号施令
7. 验收与审计：谁检查任务，如何留证据

### 3.3 世界层：物理与文明层

只有在公司层稳定后才向上长：

1. 多组织、多行业、多制度
2. 市场、城市、国家、医院、村庄
3. 长周期社会演化

**先后顺序必须是**：

`居民 -> 公司 -> 医院/部门 protocol -> 多组织 -> 文明`

不是反过来。

---

## 4. 为什么先做公司，再做文明

公司先于文明，不是因为想象力不够，而是因为验收闭环更清楚。

| 模型 | 优点 | 风险 |
| --- | --- | --- |
| 文明模型 | 想象空间大，叙事很强 | 目标模糊，协作难验收，容易做成 demo |
| 公司模型 | 目标、分工、依赖、验收都明确 | 抽象层级低，但最适合起盘 |
| 医院模型 | 天然适合“分诊 -> 专科 -> 手术 -> 观察 -> 出院” | 不是世界底座，而是公司内部的高质量 protocol |

**因此**：

1. 世界底座先按公司组织来做。
2. 医院是第一种值得沉淀的“组织运行协议”。
3. 城市、国家、文明来自公司与协议的分形复制，而不是先验设计。

---

## 5. 目录即架构

下面这版目录是阶段一的唯一标准。不是最终文明目录，而是“可运行公司”的目录。

```text
worlds/<company-world>/
  CLAUDE.md                         # 公司总宪法/使命/边界
  company/
    org/
      org-chart.yaml                # 组织树：谁归谁管
      directory.json                # 通讯录：擅长什么、如何联系
      relations.json                # 责任关系图
    board/
      tasks/                        # 世界级任务条目
      incidents/                    # 堵塞/告警/升级
      announcements/                # 公告板
    protocols/
      message-protocol.md           # 消息 schema 与 ACK 规则
      hospital-flow.md              # 医院式工作流协议
    finance/
      ledger.jsonl                  # 世界级账本
      budgets.json                  # 预算与配额
  residents/
    ceo/
      CLAUDE.md
      .claude/
        settings.json
        rules/
        agents/
        skills/
        scripts/
      inbox/
      outbox/
      workspace/
      todo.md
      status.json
      handoff.md
      resident-memory/
        MEMORY.md
    architect/
      ...
    frontend/
      ...
    backend/
      ...
    qa/
      ...
  runtime/
    wake-queue/
    message-log/
    locks/
    pids/
    snapshots/
```

### 这版目录的含义

1. `company/` 是公共世界，不属于任何单个居民。
2. `residents/<id>/` 是居民的生活空间与工作空间。
3. `runtime/` 是系统物理层，不进入居民自我叙事。
4. `resident-memory/` 是显式居民记忆，不直接依赖 Claude Code auto memory。

### 为什么不用 auto memory 直接当居民记忆

因为官方文档明确说明：同一 git repo 的 worktree 和子目录共享 `~/.claude/projects/<project>/memory/`。  
这意味着如果 5 个居民都住在同一个 repo 下，他们的原生 auto memory 会互相污染。

**所以阶段一标准是**：

1. 居民身份、长期记忆、handoff 先落在居民目录自己的显式文件里。
2. Claude Code auto memory 只当辅助记忆，不当居民人格真相源。
3. 以后若要真正做到“每居民独立 auto memory”，要么隔离 repo/root，要么隔离 Claude home。

---

## 6. 消息、状态、唤醒：不要只靠一种机制

你的问题不是“消息收发做得不够像微信”，而是过去把所有信息都塞给消息了。

阶段一统一为三通道：

### 6.1 状态通道

适合“我现在在干嘛、做到哪了、卡在哪”。

读这些，不发消息：

1. `todo.md`
2. `status.json`
3. `company/board/tasks/`
4. `company/board/incidents/`

### 6.2 消息通道

适合“需要你响应/确认/授权/协调”的事情。

统一协议：

`queued -> delivered -> acknowledged -> committed/deferred/declined -> done`

收到消息后的第一反应不是必须立刻执行，而是**必须先 ACK**，告诉对方：

1. 我看到了
2. 我现在在做什么
3. 我准备怎么处理
4. 预计何时给结果

这就解决了你说的“收到消息必须回复，但不一定立即打断手头工作”。

### 6.3 活体协作通道

适合几个正在活着的居民短时密集协作。

这里优先复用 Claude Code 原生能力：

1. subagents
2. agent teams
3. worktree
4. session 内 scheduled tasks

**判定原则**：

- 只要协作目标是短时、活体、并行，就先用 Claude 原生能力。
- 只要协作目标跨睡眠、跨组织、要审计、要耐久，就交给 DU 系统。

---

## 7. 医院模型该放哪

医院不是世界底座，而是一个高质量的组织协议模板。

### 医院协议映射

| 医院阶段 | 公司/AI 对应 |
| --- | --- |
| 挂号/分诊 | 任务进入统一看板，先分类与定级 |
| 专科诊断 | 路由到对应负责人或部门 |
| 手术执行 | 居民或居民内部 subagents / teams 实施 |
| 留院观察 | 测试、复核、质量门、回归检查 |
| 出院 | 验收通过、归档、写 handoff 与经验 |

### 放置位置

医院协议应该沉淀在：

- `company/protocols/hospital-flow.md`
- 角色 skill
- 任务验收规则

而不是塞进引擎核心。

---

## 8. 5 人团队现在怎么拆

这 5 个人不是同时乱做，而是各自拿一个不可替代的交付物。

| 角色 | 唯一任务 | 交付物 | 依赖 |
| --- | --- | --- | --- |
| 1. 架构总负责人 | 收敛标准、裁决冲突、冻结阶段边界 | `v2 architecture baseline` | 读取全部结果后整合 |
| 2. Claude Code 能力审计员 | 只研究官方能力边界与局限，不碰 DU 实现细节 | `claude-code-capability-matrix.md` | 无 |
| 3. 目录与模板架构师 | 只定义居民/公司/runtime 目录、模板与命名规则 | `company-directory-spec.md` | 依赖能力审计结论 |
| 4. 消息与存活协议工程师 | 只定义 ACK、状态、唤醒、消息、阻塞、升级链路 | `message-liveness-protocol.md` | 依赖能力审计结论 |
| 5. 治理与验收负责人 | 只定义公司组织、医院协议、看板规则、验收闭环 | `governance-and-acceptance.md` | 依赖目录与消息协议 |

### 推荐执行顺序

#### Phase A：当天必须完成

1. `能力审计员` 输出原生能力矩阵
2. `目录架构师` 输出目录规范初稿
3. `消息协议工程师` 输出消息/状态/唤醒协议初稿

#### Phase B：第二步收敛

4. `治理与验收负责人` 把公司结构、医院协议、看板与验收接起来
5. `架构总负责人` 统一裁决，冻结 v2 baseline

#### Phase C：冻结后才允许实现

1. 模板改造
2. 板子与消息实现
3. 运行时调度
4. 经济与审计

### 阶段一的 5 名居民建议

如果你要立刻在世界里启动一个 5 人公司，而不是 5 个研究员，建议是这 5 个岗位：

1. `ceo-architect`：唯一总负责人，只做拆解、仲裁、验收，不下场写大段实现
2. `claude-auditor`：专管 Claude Code 能力、hooks、worktree、agent teams、skills
3. `directory-architect`：专管模板、目录、resident identity、memory placement
4. `message-liveness`：专管 AI 微信、ACK、阻塞升级、唤醒规则
5. `ops-acceptance`：专管统一看板、测试门、医院协议、交付证据

这 5 个角色能形成一个最小闭环公司。

---

## 9. 下一阶段实现起点

不要先重写引擎。第一步应该是：

1. 把居民模板从旧 BDI 术语切到 `CLAUDE.md + resident-memory + todo + status + handoff`
2. 做一个公司级目录壳子与统一看板
3. 做一个最小耐久消息协议，至少支持 `ACK / defer / decline / done`
4. 只启动 5 名居民，验证：
   - 组织关系能读懂
   - 看板能协作
   - 消息能确认
   - 睡醒后不失联
5. 只有这 5 人公司稳定后，才允许向“医院”“城市”“文明”复制

---

## 10. 最终判断

你最初的想法没错，错的是起点和边界。

正确版本应该是：

1. 居民本身就是完整 Claude Code
2. Claude Code 原生能力负责“活着时怎么聪明”
3. DU 系统负责“睡着以后世界如何还成立”
4. 先搭公司，再长医院，再长城市，再长文明
5. 一切都以目录、协议、验收为核心，而不是再加一层抽象 BDI 外壳
