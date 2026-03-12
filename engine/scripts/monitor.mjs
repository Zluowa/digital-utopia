#!/usr/bin/env node
// DU World Monitor — polls snapshot and prints status table
// Usage: node scripts/monitor.mjs [intervalSec] [port]

const interval = parseInt(process.argv[2] || '30', 10) * 1000;
const port = process.argv[3] || '4000';
const url = `http://localhost:${port}/api/snapshot`;

async function poll() {
  try {
    const res = await fetch(url);
    const snap = await res.json();
    const s = snap;
    const ts = new Date().toLocaleTimeString('en-US', { hour12: false });
    const eco = s.economySummary ?? {};

    console.log(`\n─── ${ts} ── Cycle ─────────────────────────────`);
    console.log(`World: ${s.worldName} | Alive: ${s.aliveAgents}/${s.totalAgents} | Treasury: ${eco.treasuryBalance}T | Circ: ${eco.circulation}T`);
    console.log('');
    console.log('Agent            Status       Balance    %Circ  Last Awakened');
    console.log('───────────────  ───────────  ─────────  ─────  ────────────────────');
    for (const a of s.agents) {
      const pct = eco.distribution?.find(d => d.id === a.id)?.pct ?? 0;
      const lastWake = a.lastAwakened ? new Date(a.lastAwakened).toLocaleTimeString('en-US', { hour12: false }) : 'never';
      const statusIcon = a.status === 'awakening' ? '🟢' : a.status === 'dead' ? '💀' : '💤';
      console.log(
        `${a.id.padEnd(16)} ${statusIcon} ${a.status.padEnd(10)} ${String(a.tokenBalance).padStart(8)}T  ${String(pct).padStart(4)}%  ${lastWake}`
      );
    }

    if (s.aliveAgents === 0) {
      console.log('\n💀💀💀 ALL AGENTS DEAD — WORLD ENDED 💀💀💀');
      process.exit(0);
    }
  } catch (e) {
    console.log(`[${new Date().toLocaleTimeString()}] Poll failed: ${e.message}`);
  }
}

console.log(`🔭 DU Monitor — polling every ${interval / 1000}s on port ${port}`);
await poll();
setInterval(poll, interval);
