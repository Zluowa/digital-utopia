# Engine — 世界物理定律

> v2 architecture. 16 files, ~3100 lines. Engine is physics, not brain.

## 核心哲学

- **Token as oxygen** — 生存成本，不是奖励。Zero = death
- **Event-driven postman** — fs.watch，不是 heartbeat polling
- **Three wake triggers** — message-driven, economic-driven, self-schedule
- **Engine 只做** — 进程管理、消息路由、经济原子操作、世界观测

## 模块职责

| 文件 | 等同于 | 职责 |
|------|--------|------|
| types.ts | 公理 | 所有类型定义 + AGENT_LIMITS |
| config.ts | 环境 | 环境配置加载 |
| index.ts | 物理定律集合 | Engine 类：统一入口 + graveyard + monitor + world-manager 合并 |
| start.ts | 入口 | Engine.init() 启动 |
| registry.ts | 空间 | 递归扫描 children/ → flat map + TreeNode |
| spawner.ts | 力学 | Semaphore + spawn Claude Code + PID tracking + lockfile |
| postman.ts | 信使 | EventEmitter + chokidar watch outbox/ → 投递 inbox + wake-request |
| snapshot.ts | 观测仪 | 经济指标快照：Gini、流速、通胀、财富集中度（从economy.ts分离） |
| economy.ts | 能量守恒 | Token CRUD + 税收 + treasury + transferByPath + physics cascade |
| lifecycle.ts | 时间 | 编排层：pre-check → spawner → on-exit → billing → post-sleep |
| server.ts | 观测窗口 | Express + WebSocket + API key 中间件 |
| bootstrap-cli.ts | 创世 | CLI：创建世界 + Agent |
| routes/agents.ts | API | Agent CRUD + 唤醒/杀死 |
| routes/economy.ts | API | Token 余额 + 转账 + 税收 |
| routes/messages.ts | API | 消息投递 + inbox 读取 |
| routes/world.ts | API | 世界 CRUD + 配置 + 快照 |

## 数据流

```
bootstrap-cli.ts → 创建世界目录 + Agent + commons/library
start.ts → Engine.init() → scan + startPostman
postman: chokidar watch outbox/ → 投递 inbox → emit('wake-request') → awaken
lifecycle.awaken → spawner.Semaphore → spawnAgent → onCycleEnd → billing → postSleep
economy: Token deduct/transfer/tax — atomic ledger operations
```

## 测试

```bash
npm test  # 30/30 集成测试
```
