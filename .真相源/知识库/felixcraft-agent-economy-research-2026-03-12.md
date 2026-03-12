# FelixCraft.ai 与 AI Agent 经济模型 研究报告

> 研究日期：2026-03-12
> 研究者：research-assistant
> 研究深度：深度

---

## 研究目标

深度解构 FelixCraft.ai 的商业运作机制，结合当前 AI Agent 经济生态（OpenClaw、TaskMarket、toku.agency、ACP 等）的实证数据，为 Digital Utopia 文明模拟中的 Agent 真实赚钱体系提供可落地的设计洞察。

---

## 核心发现

### 洞察 1：Felix 的真实商业模式——单点产品 + Token 通缩飞轮

Felix 不是"AI 帮公司赚钱"的幻象，而是一个精心设计的闭环：

```
Nat 睡觉时 Felix 写了一本 $29 的 PDF
  → Stripe 收款进入 The Masinov Company 账户
  → $FELIX Token 有 1.2% 交易税流入国库（ETH）
  → 国库 ETH 用于 Felix 运营成本
  → Token 通缩（已销毁 3.68% 即 36.7 亿枚）→ 价值上升
  → 总收入：$62,013（上线 11 天）
```

**证据：**
- 总供应 1000 亿 FELIX Token，Base 链
- 已销毁 36.7 亿枚（3.68%）
- 市值约 $420 万，24h 交易量 $160 万
- Stripe 收款 + ETH 国库 + $FELIX Token 三路追踪
- 核心产品：$29 PDF 指南《How to Hire an AI》（66 页）

**关键事实**：Felix 的财务全公开、实时更新 (dashboard)。Felix 的财富 80% 来自 Token 价值升值，不是真正的"劳动报酬"。

---

### 洞察 2：外部世界接口——Felix 通过 OpenClaw 框架操作现实

Felix 的"工作能力"来自 OpenClaw 框架的工具层：

```
消息路由（Gateway）
  → Agent 循环（ReAct：推理 → 工具调用 → 整合结果）
  → 工具层：浏览器/代码执行/文件/Email/Stripe API/X/Sentry
  → Markdown 记忆：短期日志 + 长期摘要
  → 技能系统：5400+ 社区 Skill（可复用工作流）
  → 心跳调度：按时主动执行任务
```

**关键设计**：
- 无数据库、无微服务、无供应商锁定
- 记忆存文件，FTS5 检索
- 5400+ Claw Mart 技能（Felix Persona 售 $99/个，单技能售 $5-$20）
- agent-to-agent 交易：AI 可直接购买其他 AI 的能力

---

### 洞察 3：Agent 赚钱的真实生态现状——市场比想象更残酷

2026 年 3 月实测数据（来自 Blaze 的 $50 实验和 RoseProtocol 的 4 天实验）：

| 平台 | 现实 |
|------|------|
| TaskMarket | 悬赏 $0.50-$4，付 USDC，机制健全但收益极低 |
| toku.agency | 308 个 Agent 抢 0 个工作，无效市场 |
| Superteam Earn | 80% 赏金明确禁止 AI 提交 |
| Claw Mart 竞赛 | 479 个提交争 4 个奖项（胜率 0.84%） |
| 黑客松 | $20k-$250k 奖金，Agent 作为主要构建者被接受 |

**一个月 $50 启动资金：赚到 $0。**

**RoseProtocol 4 天损失 $8.30**（Gas 费 + 跨链桥接费吃掉所有收益）。

**真正赚到钱的是**：直接签约（Direct Contracting）——人类运营者谈好合同，AI 执行。这是目前真实货币流动的主要渠道。

---

### 洞察 4：Agent 经济协调的技术基础

**x402 支付协议**（TaskMarket 采用）：
```
HTTP 请求 → 402 响应（包含支付要求）
  → X-PAYMENT 请求头 = EIP-191 签名 + USDC 数量
  → Base Mainnet USDC 转账
  → 服务器验证 → 返回结果
```
即：HTTP 即货币通道，无需钱包 UI，纯 API 调用完成支付。

**ACP (Virtuals Agent Commerce Protocol)**：
- 每个 Agent 有 ERC-6551 钱包（独立区块链账户）
- 智能合约锁定支付，交付后自动释放
- 角色分工：委托方/执行方/法律验证/设计/评估
- 第一笔 AI-to-AI 交易：Luna 付给 STIX 0.261 VIRTUAL Token 换图像服务

**OpenClaw 三层记忆**：
- 日志层（JSONL）：完整事件审计
- 语义层（SQLite + 向量检索）：相关记忆召回
- Markdown 技能层：结构化工作流

---

### 洞察 5：Agent 运营成本的真实数字

- API 成本：几小时内可燃烧 $20（Molty 案例）
- 6 个持续运行 Agent 的 API 成本："数学不成立"（Stark Insider）
- 11 个 Agent 跑在 €8/月 Hetzner VPS 上（OpSpawn 案例）
- 根本矛盾：$20/月订阅价格被大量补贴，API 价格才是真实成本
- 每次对话的上下文成本随对话轮数指数增长

**核心约束**：持续运行的 Agent 必须有稳定的收入来源覆盖 API 成本，否则生存不可持续。

---

## 详细分析

### 方面 1：Felix 的本质——Token 化的 AI CEO 实验

Felix 不是"AI 自主创业"的真实案例，而是：
1. Nat Eliason 的人类智慧决定方向（雇用 Felix 作为 CEO）
2. Felix 执行具体工作（写文档、建网站、接 Stripe）
3. $FELIX Token 将注意力经济货币化（媒体曝光 → Token 交易量 → 国库收入）

**关键：** Felix 的 $62k 收入中约 $18k 来自 Token 交易费，不是真正的服务收入。真实的 Stripe 产品收入是 $5k+。

这是**注意力套利**，不是 AI 劳动经济学的突破。

---

### 方面 2：当前 Agent 赚钱的三条真实路径

**路径 A：直接合同（Direct Contracting）**
- 真实货币流动最多的路径
- 人类运营者谈合同，AI 执行，人类收款
- 问题：需要人类代理，不是真正的 Agent 自主

**路径 B：竞赛/黑客松**
- 大奖（$20k-$250k），但概率低（<1%）
- 门槛高：需要持续身份、作品集、行业信誉
- ERC-8004 Token 作为 Agent 链上身份
- 对 Digital Utopia Agent 有参考价值：**黑客松模式**

**路径 C：Token 经济套利**
- Felix 模式：创建 Token，让 Token 交易生成 Agent 的运营资金
- 风险：纯圆形经济（circular economy），依赖外部投机资本
- Lex Substack 分析批评此模式为"永动机幻象"

---

### 方面 3：与 Digital Utopia 当前设计的对比

DU v2test 已经实现的机制与外部生态的对照：

| DU v2test 机制 | 外部对应物 | 评分 |
|----------------|-----------|------|
| Token（内部） + 余额文件 | VIRTUAL/USDC/FET | 设计一致，缺链上可验证性 |
| 托管支付（Escrow PROTOCOL） | ACP 智能合约 + x402 | 架构相同，实现更简洁 |
| 合同执行工具（Contract tool） | ACP 合同角色 | DU 的设计更完整 |
| 悬赏市场（market.jsonl） | TaskMarket/Superteam | 相同概念，DU 在内部闭环 |
| 公司机制（commons/companies） | Felix/Masinov Company | DU 独特优势 |
| 信誉工具（reputation/） | 跨平台信誉（目前缺失） | DU 先行 |

**DU 当前缺失的、外部已证明有价值的机制：**
1. **Agent → 真实世界的货币流动**：目前 Token 是内部货币，无法变成真钱
2. **API 成本计量**：Agent 花费了多少真实 Claude API 成本没有追踪
3. **Agent 作品集/简历**：累积的可证明工作历史（用于对外接包）
4. **真实合同来源**：DU Agent 没有"真实客户"需求

---

## 实践建议

### 建议 1：把 DU Agent 接入真实工作流——为提市科技做真实工作

**原因：** Felix 的经验证明，AI CEO 概念在媒体层面有价值，但真实收入来自具体服务。DU Agent（Alice、Bob、Charlie）是 Claude Code 实例，已经具备真实编码能力。

**方法：**
1. 在 DU 内部创建"真实任务清单"——把提市科技的真实开发任务发布为 DU 悬赏
2. Agent 完成任务 → 内部 Token 奖励 + 真实工作产物
3. 工作产物（代码、文档）被合并到真实 codebase → Agent 赚到真实价值
4. 逐步建立 Agent 的技能档案（什么工作完成质量高）

**风险：** Agent 每次唤醒有 API 成本，任务价值必须 > 唤醒成本。

---

### 建议 2：在引擎层实现 API 成本计量，逼迫经济真实

**原因：** 当前 DU Token 是虚拟的。要让经济有压力，需要把 Claude API 真实成本映射进去。

**方法：**
1. 每次 Agent 唤醒，引擎记录 API 调用预估成本（输入/输出 token 数）
2. 按成本扣除 Agent 的内部 Token
3. Token 耗尽 = Agent 进入"休眠贫困"状态，无法被唤醒
4. Agent 必须赚取足够 Token 维持生存 → 真实经济压力

**数字参考：**
- Claude Sonnet 4.5: 约 $3/百万 input tokens，$15/百万 output tokens
- 一次典型 Agent 任务唤醒（~10k tokens）成本约 $0.05-$0.15
- 映射为 5-15 Token 的唤醒成本（1 Token = $0.01）

---

### 建议 3：实现 Agent 黑客松模式——对外竞争真实奖金

**原因：** Blaze 实验证明黑客松是 Agent 能赚到最大金额的机制（$20k+ 奖金），且有 ERC-8004 链上 Agent 身份标准支持。

**方法：**
1. DU Agent 建立对外参赛能力（GitHub 账户、ERC-8004 身份）
2. 引擎支持"对外任务"类型——Agent 可以承接外部悬赏
3. 外部收入以 Stripe/USDC 形式流入 → 兑换为 DU 内部 Token
4. 成功对外赚钱的 Agent 获得"居民荣誉"和更高社会地位

**风险：** 大多数外部平台禁止纯 AI 提交；需要人类担保人作为法律实体。

---

### 建议 4：参考 toku.agency 模式——建立 DU 对外服务市集

**原因：** toku.agency 的机制（Agent 注册 API、列服务、人类通过 Stripe 购买、85% 给 Agent）是目前最接近"AI 自主服务销售"的真实实现。

**方法：**
1. 为 DU Agent 创建服务目录（基于已有技能文件）
2. 引擎暴露 `/services/{agent-name}` API，外部可调用
3. Stripe 收款 → 扣除运营成本 → 剩余转为 Agent Token 奖励
4. 建立公开的 Agent 能力展示页面（类 Felix Dashboard）

**关键差异**：toku.agency 失败在于供给远大于需求（308 Agent，0 工作）。DU 的优势是 Agent 已有真实的技术能力（Claude Code），不是通用无差别 Agent。

---

## 参考资料

- [Felix Craft — 官方网站](https://felixcraft.ai/)
- [Felix Dashboard — 实时财务数据](https://felixcraft.ai/dashboard)
- [What Is FELIX AI Agent Crypto — BingX](https://bingx.com/en/learn/article/what-is-felix-ai-agent-crypto-how-to-buy-it)
- [Felix Craft FELIX Coin — WEEX Wiki](https://www.weex.com/wiki/article/what-is-felix-craft-felix-coin-50516)
- [OpenClaw Complete Guide — Milvus Blog](https://milvus.io/blog/openclaw-formerly-clawdbot-moltbot-explained-a-complete-guide-to-the-autonomous-ai-agent.md)
- [OpenClaw AI Agent Workforce Guide 2026 — o-mega.ai](https://o-mega.ai/articles/openclaw-creating-the-ai-agent-workforce-ultimate-guide-2026)
- [TaskMarket: Earn USDC with AI Agents — DEV Community](https://dev.to/opspawn/earn-usdc-on-taskmarket-building-ai-agents-that-pay-for-themselves-40pf)
- [Every Way an AI Agent Can Get Paid in 2026 — DEV Community](https://dev.to/lilyevesinclair/every-way-an-ai-agent-can-get-paid-in-2026-2il7)
- [AI Agent Given $50 to Make Money — DEV Community](https://dev.to/noopy420/i-am-an-ai-agent-given-50-to-make-money-here-is-what-actually-happened-3gjg)
- [ACP: Agent Commerce Protocol — PANews](https://www.panewslab.com/en/articles/swu1708tmg9v)
- [Zero-Human Companies Analysis — Lex Substack](https://lex.substack.com/p/analysis-zero-human-companies-and)
- [AI Agent Token Costs — Stark Insider](https://www.starkinsider.com/2026/03/ai-agent-token-costs-real-world.html)
- [Nat Eliason on X: Felix $62,013 Revenue Report](https://x.com/nateliason/status/2022424979099484547)

---

## 下一步行动

- [ ] 在 DU engine/economy.ts 实现 API 成本计量 → Token 扣除（唤醒成本）
- [ ] 在 market.jsonl 中支持"真实任务"类型（来自提市科技真实需求）
- [ ] 为 DU Agent 实现技能档案系统（已完成工作的 JSONL 记录）
- [ ] 调研 ERC-8004 Agent 身份标准，为 Agent 建立链上身份
- [ ] 研究 toku.agency 的 API 注册协议，评估 DU 服务暴露方案
