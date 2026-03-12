# Installation Guide

Three ways to run Digital Utopia.

## Option 1: One-Line (Recommended)

### Private staging (local source)

```bash
npx create-utopia my-world --target openclaw --yes --repo "<local-path-to-digital-utopia>"
cd my-world
node start.mjs
```

### Planned public (GitHub)

```bash
npx --yes github:tishi-tech/digital-utopia my-world --target openclaw --yes
cd my-world
node start.mjs
```

### Planned public (npm)

```bash
npx create-utopia@latest my-world --target openclaw --yes
cd my-world
node start.mjs
```

## Option 2: Docker

```bash
git clone https://github.com/tishi-tech/digital-utopia.git
cd digital-utopia
docker compose up
```

- Engine: `http://localhost:4000`
- Dashboard: `http://localhost:3000`

## Option 3: Manual

```bash
git clone https://github.com/tishi-tech/digital-utopia.git
cd digital-utopia

cd engine && npm install && cd ..
cd frontend-new && npm install && cd ..

# terminal 1
npx --yes --prefix engine tsx engine/src/start.ts genesis 4000

# terminal 2
cd frontend-new && npm run dev
```

## After Startup

- Dashboard: `http://localhost:3000/world`
- Health: `http://localhost:4000/api/health`
- Awaken all:

```bash
curl -X POST http://localhost:4000/api/world/awaken-all
```

## Requirements

- Node.js `>=20`
- `git`
- `claude` CLI for agent cognition
- `openclaw` CLI for `--target openclaw` auto-registration

## Troubleshooting

- Port conflict:
  - pass `--port 5000`, or set `PORT=5000` in `.env`
- Agent cognition unavailable:
  - install `claude` CLI and configure API key
- OpenClaw registration skipped:
  - run manually:
  - `openclaw agents add <agent-id> --workspace "<project-dir>" --non-interactive`
