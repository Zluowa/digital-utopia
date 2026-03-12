# Digital Utopia

**Build living civilizations where AI agents trade, collaborate, and evolve in real time.**

Digital Utopia is an open-source AI-native sandbox where autonomous agents form societies with real economic systems. Unlike agent frameworks (OpenClaw, CrewAI), Utopia is a *playable world* — agents negotiate, buy/sell skills, compete for resources, and build emergent behaviors.

```
┌─────────────────────────────────────────┐
│  OpenClaw (Framework)                   │  Agents follow hardcoded workflows
│  → Single agent patterns                │  → No economic incentives
│  → No economy/incentives                │  → Black-box agent behavior
└─────────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────┐
│  Digital Utopia (Operating System)      │  🎮 Build full agent economies
│  → Agent societies + Token economy      │  🎭 Observable, emergent behavior
│  → Skill marketplace                    │  ⚡ Real constraints (cost, latency)
│  → Inter-agent negotiation              │  💬 Live agent collaboration
└─────────────────────────────────────────┘
```

## Why Utopia?

- **Agent Economy**: Agents earn/spend tokens for actions. Build incentive systems that drive real emergent behavior.
- **Playable World**: Deploy agents, watch them negotiate prices, form partnerships, compete for resources.
- **Observable System**: Dashboard shows agent decisions, token flows, skill markets — no black boxes.
- **Production-Ready**: Real operational constraints (API costs, rate limits, latency) so you learn what actually works.

## Open Source Status

This repository is currently in **public beta** (March 2026).

- Full source code available under MIT license
- Ready for deployment and integration
- Community contributions welcome

See [OPEN_SOURCE_STATUS.md](./OPEN_SOURCE_STATUS.md) for detailed roadmap.

## 5-Minute Quick Start

### 1. Create a World

```bash
npx create-utopia my-civilization --yes
cd my-civilization
```

### 2. Start the Engine

```bash
# This starts both the API engine (port 4000) and dashboard (port 3000)
npm run dev
```

### 3. Open Dashboard

Visit: **http://localhost:3000**

You should see:
- **World Map**: Your civilization with agent territories
- **Agent Status**: Real-time activity feed
- **Token Flow**: Live economic transactions
- **Console**: Agent decision logs

### 4. Awaken Your First Agent

In the dashboard:
1. Click **"New Agent"**
2. Name them (e.g., "Alice")
3. Select a role: **Entrepreneur**, **Scholar**, **Trader**
4. Click **"Awaken"**

Watch them immediately start trading with neighbors and earning tokens.

### 5. Assign a Task

Click any agent → **"Give Task"** → describe what you want:
- *"Find the cheapest knowledge in the market and resell it"*
- *"Teach everyone a new skill"*
- *"Accumulate 1000 tokens"*

Agents will plan, negotiate, execute, and report results.

---

## Install from Source (Development)

For contributors / local development:

```bash
git clone https://github.com/tishi-tech/digital-utopia.git
cd digital-utopia
npm install
npm run dev
```

Requires: Node.js ≥ 20, git, [claude CLI](https://github.com/anthropics/claude-code)

---

## One-Line Install (Coming Soon)

```bash
# npm
npx create-utopia@latest my-world --yes

# GitHub
npx --yes github:tishi-tech/digital-utopia my-world --yes
```

## Use Cases

### 1. AI Agent Marketplace Simulator
Build a virtual economy where agents trade skills, knowledge, or services. Perfect for testing market dynamics without real money.

```
Agents form partnerships → negotiate prices → compete → evolve behaviors
```

### 2. Autonomous Workflow Testing
Deploy agents to handle multi-step tasks (research → analysis → reporting). See how they handle deadlines, negotiate with each other, and recover from failures.

### 3. AI Civilization Game
Create a playable world where players command AI agents competing for resources. Real economic incentives = engaging emergent gameplay.

### 4. Agent Research & Benchmarking
Measure agent performance in coordinated tasks, market dynamics, and resource constraints. More realistic than isolated benchmarks.

### 5. Integration with Existing Systems
Hook Utopia agents into your product as autonomous workers, customer service reps, or internal bots with real cost/benefit incentives.

---

## Architecture

```
engine/              TypeScript runtime (API + world loop)
├── src/
│   ├── index.ts            Engine core (initialization)
│   ├── server.ts           REST API + WebSocket
│   ├── adapter.ts          Data translation layer
│   ├── awakener.ts         Agent spawning
│   ├── registry.ts         Agent registration
│   ├── economy.ts          Token accounting + taxes
│   └── monitor.ts          Heartbeat + event timeline
├── worlds/         Runtime world instances (agent directories)
└── start.ts        Entry point

frontend-new/       React dashboard (port 3000)
├── src/
│   ├── pages/AgentView.tsx       Agent status & control
│   ├── pages/EconomyDashboard.tsx Token flow visualization
│   ├── pages/TaskBoard.tsx        Task assignment & tracking
│   └── components/                UI components

shared/             Shared type definitions
templates/          Agent templates (roles, skills)
```

## Requirements

- **Node.js** ≥ 20
- **git** (for cloning)
- **Claude CLI** ([install here](https://github.com/anthropics/claude-code)) — powers agent cognition
- **OpenClaw CLI** (optional) — for multi-agent coordination protocols

## Local Development

For source development:

```powershell
# Windows: Auto-restart both services
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/restart-dev-ports.ps1
```

This spawns:
- **Engine** on `http://localhost:4000` (API + WebSocket)
- **Dashboard** on `http://localhost:3000` (observability UI)

Waits until both are healthy before returning.

## Key Features

✅ **Agent Economy** — Token-based incentive system drives emergent behaviors
✅ **Skill Marketplace** — Agents buy/sell capabilities; dynamic pricing
✅ **Real Constraints** — Cost, latency, rate limits = production-like simulation
✅ **Observable Behavior** — Dashboard shows every decision, trade, negotiation
✅ **Inter-Agent Negotiation** — Built-in protocol for agents to coordinate
✅ **Composable Skills** — Skills combine with agents like plugins
✅ **Multi-World Support** — Run multiple isolated civilizations
✅ **REST API** — Full programmatic control
✅ **WebSocket Events** — Real-time streaming of agent activities
✅ **Extensible** — Hook into existing frameworks (OpenClaw, CrewAI, etc.)

---

## Roadmap

- **v0.1 (Mar 2026)** — Public beta, core economy, basic skills
- **v0.2 (Apr 2026)** — Agent partnerships, contract system
- **v0.3 (May 2026)** — Advanced negotiation, supply chains
- **v1.0 (Jun 2026)** — Production-grade APIs, enterprise deployments

See [ROADMAP.md](./docs/ROADMAP.md) for detailed plan.

---

## FAQ

**Q: How is this different from OpenClaw?**
A: OpenClaw is a multi-agent *framework* (how to run agents). Utopia is a multi-agent *operating system* (a world where agents live with economics, incentives, constraints). You could use Utopia agents *with* OpenClaw for even more power.

**Q: Can I integrate with my product?**
A: Yes! Use the REST API to spawn agents, assign tasks, and listen to events. Agents operate autonomously and report results.

**Q: How much do agents cost to run?**
A: Agents use Claude API (pay-as-you-go). The token economy lets you configure how much agents can spend. Average cost: $0.01-0.50 per agent per task.

**Q: Can I modify agent behavior?**
A: Fully. Edit agent templates, create custom skills, modify the economy rules, or hook into agent decision points via the API.

**Q: Is this a game?**
A: It can be! Utopia is both a *framework* (for developers) and *experience* (for users). Use it to build games, simulations, or autonomous systems.

---

## Community & Contributing

- **Discord**: [discord.gg/tishi-tech](https://discord.gg/tishi-tech) (development & ideas)
- **GitHub Issues**: [Report bugs or suggest features](https://github.com/tishi-tech/digital-utopia/issues)
- **Contributing Guide**: See [CONTRIBUTING.md](./CONTRIBUTING.md)

---

## Thanks

We appreciate the open-source community that inspired this project.

Special thanks to **vibe-kanban** and **vinekanban** — Utopia's dashboard evolved from that foundation.

See [ACKNOWLEDGEMENTS.md](./ACKNOWLEDGEMENTS.md).

---

## License

MIT License — see [`LICENSE`](./LICENSE)

---

**Ready to build your civilization?**

```bash
npx create-utopia my-world --yes && cd my-world && npm run dev
```

Then open http://localhost:3000 and awaken your first agent.

Questions? [GitHub Discussions](https://github.com/tishi-tech/digital-utopia/discussions) or support@tishi.tech
