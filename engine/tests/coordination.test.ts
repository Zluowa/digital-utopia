// @input: monitor.ts, carlini/task-board.ts, progress-log.ts, andon.ts, bdi/belief-scanner.ts, bdi/prompt-builder.ts
// @output: coordination protocol test results
// @position: validates cross-module world-state coordination pipeline

import assert from 'node:assert/strict';
import { existsSync, promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const tmpBase = path.join(__dirname, '..', '..', 'worlds', '_test_coordination');

let passed = 0;
let failed = 0;

function test(name: string, fn: () => Promise<void>): Promise<void> {
  return fn().then(() => {
    passed++;
    console.log(`  PASS  ${name}`);
  }).catch((e: Error) => {
    failed++;
    console.log(`  FAIL  ${name}`);
    console.log(`        ${e.message}`);
  });
}

function tmpDir(suffix: string): string {
  return path.join(tmpBase, suffix);
}

async function cleanup(dir: string): Promise<void> {
  if (existsSync(dir)) await fs.rm(dir, { recursive: true, force: true });
}

// ── Helpers ───────────────────────────────────────────────

async function makeAgent(worldDir: string, name: string, balance = 5000, status = 'alive'): Promise<string> {
  const agentDir = path.join(worldDir, 'children', name);
  await fs.mkdir(path.join(agentDir, '.claude', 'wallet'), { recursive: true });
  await fs.mkdir(path.join(agentDir, 'inbox'), { recursive: true });
  await fs.mkdir(path.join(agentDir, '.claude', 'memory', 'categories'), { recursive: true });

  const wallet = { agentId: name, balance, currency: 'Token', transactions: [], createdAt: new Date().toISOString() };
  await fs.writeFile(path.join(agentDir, '.claude', 'wallet', 'balance.json'), JSON.stringify(wallet));
  await fs.writeFile(path.join(agentDir, 'CLAUDE.md'), `<!-- type: resident -->\n# ${name}`);
  await fs.writeFile(path.join(agentDir, '.claude', 'memory', 'categories', 'TASKS.md'), '- [ ] do work');
  await fs.writeFile(path.join(agentDir, '.claude', 'memory', 'categories', 'GOALS.md'), '# Goals\nBe productive');

  // Write lockfile to signal awakening status
  if (status === 'awakening') {
    await fs.writeFile(path.join(agentDir, '.awakening'), '');
  }
  return agentDir;
}

function makeWorldConfig() {
  return {
    id: 'test-world',
    name: 'Test World',
    createdAt: new Date().toISOString(),
    physics: {
      economy: { initialTokens: 10000, awakenBaseCost: 20, tokenPerDollar: 100, criticalThreshold: 500, deathThreshold: 0 },
      awakening: { defaultIntervalMs: 300000, minIntervalMs: 60000, maxIntervalMs: 3600000, inboxTrigger: true },
    },
  };
}

async function makeWorldDir(suffix: string): Promise<string> {
  const dir = tmpDir(suffix);
  await fs.mkdir(path.join(dir, '.world'), { recursive: true });
  await fs.writeFile(path.join(dir, '.world', 'treasury.json'), JSON.stringify({ balance: 1000 }));
  await fs.writeFile(path.join(dir, '.world', 'ledger.json'), '[]');
  await fs.writeFile(path.join(dir, 'CLAUDE.md'), '<!-- type: world-keeper -->\n# Test World');
  return dir;
}

// ── Test 1: World State Writing ───────────────────────────

await test('Monitor: writeWorldState produces correct JSON structure', async () => {
  const dir = await makeWorldDir('monitor');
  await makeAgent(dir, 'alice', 5000);

  const { Registry } = await import('../src/registry.js');
  const { Monitor } = await import('../src/monitor.js');

  const registry = new Registry(dir);
  await registry.scan();
  const monitor = new Monitor(registry, makeWorldConfig());

  const commonsDir = path.join(dir, 'commons');
  await monitor.writeWorldState(commonsDir);

  const raw = await fs.readFile(path.join(commonsDir, 'world-state.json'), 'utf-8');
  const state = JSON.parse(raw);

  assert.ok(state.timestamp, 'missing timestamp');
  assert.equal(state.cycle, 1, 'cycle should be 1 on first write');
  assert.ok(Array.isArray(state.awakeAgents), 'awakeAgents should be an array');
  assert.ok(typeof state.economyHealth === 'string', 'economyHealth should be a string');
  assert.ok(Array.isArray(state.recentEvents), 'recentEvents should be an array');

  await cleanup(dir);
});

// ── Test 2: Optimistic Lock CAS ───────────────────────────

await test('TaskBoard: second claim on active task returns null', async () => {
  const dir = tmpDir('taskboard');
  await fs.mkdir(dir, { recursive: true });

  const { TaskBoard } = await import('../src/carlini/task-board.js');
  const board = new TaskBoard(dir);

  const task = await board.create({ description: 'render scene', tier: 0 });
  assert.equal(task.status, 'pending');

  // First claim succeeds — transitions task to active, bumps version
  const r1 = await board.claim(task.id, 'agent-alpha');
  assert.ok(r1 !== null, 'first claim should succeed');
  assert.equal(r1!.status, 'active');
  assert.equal(r1!.agentId, 'agent-alpha');

  // Second claim fails — task is no longer pending
  const r2 = await board.claim(task.id, 'agent-beta');
  assert.equal(r2, null, 'second claim should return null (task already active)');

  // Verify persisted state reflects first claimer only
  const persisted = await board.get(task.id);
  assert.equal(persisted!.agentId, 'agent-alpha');
  assert.equal(persisted!.status, 'active');

  await cleanup(dir);
});

// ── Test 3: Progress Log Append + readLast ────────────────

await test('ProgressLog: readLast returns entries newest-first with correct count', async () => {
  const dir = tmpDir('progress-append');
  await fs.mkdir(dir, { recursive: true });

  const { appendEntry, readLast } = await import('../src/progress-log.js');

  const entries = [
    { ts: '2024-01-01T00:00:00Z', agent: 'alice', type: 'started' as const, task_id: 't1', summary: 'first' },
    { ts: '2024-01-01T00:01:00Z', agent: 'bob',   type: 'completed' as const, task_id: 't2', summary: 'second' },
    { ts: '2024-01-01T00:02:00Z', agent: 'alice', type: 'blocked' as const, task_id: 't3', summary: 'third' },
    { ts: '2024-01-01T00:03:00Z', agent: 'carol', type: 'discovered' as const, finding: 'fourth' },
  ];

  for (const e of entries) await appendEntry(dir, e);

  const last2 = await readLast(dir, 2);
  assert.equal(last2.length, 2, 'should return exactly 2 entries');
  assert.equal(last2[0].summary ?? last2[0].finding, 'fourth', 'first element should be newest');
  assert.equal(last2[1].summary, 'third', 'second element should be second-newest');

  const allFour = await readLast(dir, 10);
  assert.equal(allFour.length, 4, 'readLast(10) on 4 entries should return 4');

  await cleanup(dir);
});

// ── Test 4: Progress Log Archive ──────────────────────────

await test('ProgressLog: archiveIfNeeded evicts oldest 200 lines when over 500', async () => {
  const dir = tmpDir('progress-archive');
  await fs.mkdir(dir, { recursive: true });

  const { appendEntry, archiveIfNeeded } = await import('../src/progress-log.js');

  // Append 600 entries
  for (let i = 0; i < 600; i++) {
    await appendEntry(dir, {
      ts: new Date().toISOString(),
      agent: `agent-${i}`,
      type: 'started',
      task_id: `t-${i}`,
      summary: `entry ${i}`,
    });
  }

  await archiveIfNeeded(dir);

  const mainRaw = await fs.readFile(path.join(dir, 'progress-log.jsonl'), 'utf-8');
  const mainLines = mainRaw.split('\n').filter(Boolean);
  assert.ok(mainLines.length <= 500, `main file has ${mainLines.length} lines, expected ≤500`);

  const today = new Date().toISOString().slice(0, 10);
  const archiveFile = path.join(dir, `progress-log-archive-${today}.jsonl`);
  assert.ok(existsSync(archiveFile), 'archive file should exist');

  const archiveRaw = await fs.readFile(archiveFile, 'utf-8');
  const archiveLines = archiveRaw.split('\n').filter(Boolean);
  assert.ok(archiveLines.length > 0, 'archive should have entries');

  await cleanup(dir);
});

// ── Test 5: Andon Alert Detection ─────────────────────────

await test('Andon: treasury < 10% triggers emergency alert', async () => {
  const { detectAlerts } = await import('../src/andon.js');

  // treasury = 50, totalTokens = 1000 → ratio = 5% < 10% → emergency
  const snapshot = {
    worldId: 'w1', worldName: 'Test', timestamp: new Date().toISOString(),
    totalAgents: 1, aliveAgents: 1, totalTokens: 1000,
    agents: [],
    economySummary: { treasuryBalance: 50, circulation: 950, transactionCount: 0, distribution: [] },
  };

  const alerts = detectAlerts(snapshot, []);
  const emergency = alerts.find(a => a.level === 'emergency');
  assert.ok(emergency, 'should detect emergency alert when treasury < 10%');
  assert.equal(emergency!.target, 'all');
  assert.ok(emergency!.message.includes('EMERGENCY'));
});

await test('Andon: agent balance < 50 triggers warning alert', async () => {
  const { detectAlerts } = await import('../src/andon.js');

  const snapshot = {
    worldId: 'w1', worldName: 'Test', timestamp: new Date().toISOString(),
    totalAgents: 2, aliveAgents: 2, totalTokens: 5000,
    agents: [
      { id: 'poor-agent', dir: '/tmp/a', type: 'resident' as const, status: 'alive' as const,
        tokenBalance: 30, lastAwakened: '', inboxCount: 0, depth: 1, parentId: null, childCount: 0, logs: [] },
      { id: 'rich-agent', dir: '/tmp/b', type: 'resident' as const, status: 'alive' as const,
        tokenBalance: 4970, lastAwakened: '', inboxCount: 0, depth: 1, parentId: null, childCount: 0, logs: [] },
    ],
    economySummary: { treasuryBalance: 2000, circulation: 3000, transactionCount: 0, distribution: [] },
  };

  const alerts = detectAlerts(snapshot, []);
  const warning = alerts.find(a => a.level === 'warning' && a.target === 'poor-agent');
  assert.ok(warning, 'should warn about poor-agent with balance < 50');
  assert.ok(warning!.message.includes('30'));
});

// ── Test 6: Belief Scanner World Awareness ────────────────

await test('BeliefScanner: scanBeliefs reads world-state.json into worldState field', async () => {
  const dir = tmpDir('belief-scanner');
  const agentDir = path.join(dir, 'agent');
  const commonsDir = path.join(dir, 'commons');

  await fs.mkdir(path.join(agentDir, '.claude', 'wallet'), { recursive: true });
  await fs.mkdir(path.join(agentDir, '.claude', 'memory', 'categories'), { recursive: true });
  await fs.mkdir(path.join(agentDir, 'inbox'), { recursive: true });
  await fs.mkdir(commonsDir, { recursive: true });

  const wallet = { agentId: 'scout', balance: 2000, currency: 'Token', transactions: [], createdAt: new Date().toISOString() };
  await fs.writeFile(path.join(agentDir, '.claude', 'wallet', 'balance.json'), JSON.stringify(wallet));
  await fs.writeFile(path.join(agentDir, 'CLAUDE.md'), '<!-- type: observer -->\n# Scout');
  await fs.writeFile(path.join(agentDir, '.claude', 'memory', 'categories', 'TASKS.md'), '- [ ] observe');
  await fs.writeFile(path.join(agentDir, '.claude', 'memory', 'categories', 'GOALS.md'), '# Goals\nObserve world');

  const worldState = {
    cycle: 7,
    awakeAgents: [{ id: 'alice', task_desc: 'building bridge', duration_min: 12 }],
    economyHealth: 'green',
    economyAlert: null,
    recentEvents: [],
  };
  await fs.writeFile(path.join(commonsDir, 'world-state.json'), JSON.stringify(worldState));

  const { scanBeliefs } = await import('../src/bdi/belief-scanner.js');
  const beliefs = await scanBeliefs(agentDir, commonsDir);

  assert.ok(beliefs.worldState !== null, 'worldState should be populated');
  assert.equal(beliefs.worldState!.cycle, 7);
  assert.equal(beliefs.worldState!.economyHealth, 'green');
  assert.equal(beliefs.worldState!.awakeAgents.length, 1);
  assert.equal(beliefs.worldState!.awakeAgents[0].id, 'alice');

  await cleanup(dir);
});

// ── Test 7: Prompt Builder World Section ──────────────────

await test('PromptBuilder: buildPrompt includes 世界感知 when worldState present', async () => {
  const { buildPrompt } = await import('../src/bdi/prompt-builder.js');

  const state = {
    agentId: 'reporter',
    agentType: 'resident',
    buildTimestamp: new Date().toISOString(),
    beliefs: {
      identity: '# Reporter',
      goals: '# Goals\nReport news',
      tasks: '- [ ] write article',
      balance: 3000,
      walletHistory: 'no transactions',
      inboxMessages: [],
      commonsActivity: [],
      worldState: {
        cycle: 5,
        awakeAgents: [{ id: 'editor', task_desc: 'reviewing copy', duration_min: 8 }],
        economyHealth: 'yellow' as const,
        economyAlert: 'circulation low',
        recentEvents: [],
      },
      neighbors: null,
      recentProgress: [],
      handoff: null,
    },
    desires: [{ category: 'task' as const, description: 'complete article', priority: 2 }],
    intentions: [{ action: 'write the article', rationale: 'task pending', order: 1 }],
  };

  const prompt = buildPrompt(state, 'heartbeat');

  assert.ok(prompt.includes('世界感知'), 'prompt should contain 世界感知 section');
  assert.ok(prompt.includes('周期: 5'), 'prompt should show cycle number');
  assert.ok(prompt.includes('editor'), 'prompt should list awake agents');
  assert.ok(prompt.includes('circulation low'), 'prompt should show economy alert');
});

// ── Summary ───────────────────────────────────────────────

async function main(): Promise<void> {
  await fs.mkdir(tmpBase, { recursive: true });
  console.log(`\n  Results: ${passed} passed, ${failed} failed\n`);
  if (failed > 0) process.exit(1);
}

main().catch(e => { console.error(e); process.exit(1); });
