#!/usr/bin/env node
// Auto-cycle driver — keeps awakening agents until all are dead
// Usage: node scripts/auto-cycle.mjs [intervalMin] [port]

const intervalMin = parseInt(process.argv[2] || '5', 10);
const port = process.argv[3] || '4000';
const base = `http://localhost:${port}`;

async function getAlive() {
  const res = await fetch(`${base}/api/snapshot`);
  const snap = await res.json();
  return { alive: snap.aliveAgents, total: snap.totalAgents, agents: snap.agents };
}

async function awakenAll() {
  await fetch(`${base}/api/world/awaken-all`, { method: 'POST', headers: { 'Content-Type': 'application/json' } });
}

async function anyRunning() {
  const { agents } = await getAlive();
  for (const a of agents) {
    const { existsSync } = await import('fs');
    const { join } = await import('path');
    if (existsSync(join(a.dir, '.awakening'))) return true;
  }
  return false;
}

async function tick() {
  try {
    const { alive, total } = await getAlive();
    const ts = new Date().toLocaleTimeString('en-US', { hour12: false });

    if (alive === 0) {
      console.log(`[${ts}] 💀 ALL AGENTS DEAD — simulation complete.`);
      process.exit(0);
    }

    const running = await anyRunning();
    if (running) {
      console.log(`[${ts}] ⏳ Agents still running, skipping awaken (${alive}/${total} alive)`);
      return;
    }

    console.log(`[${ts}] 🔄 All sleeping — triggering awaken-all (${alive}/${total} alive)`);
    await awakenAll();
  } catch (e) {
    console.log(`[${new Date().toLocaleTimeString()}] ❌ ${e.message}`);
  }
}

console.log(`🔄 Auto-cycle driver — checking every ${intervalMin}min on port ${port}`);
await tick();
setInterval(tick, intervalMin * 60 * 1000);
