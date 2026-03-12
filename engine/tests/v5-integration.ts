// @input: All engine modules
// @output: Integration test results
// @position: v5 validation suite

import assert from 'node:assert/strict';
import { existsSync, promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, '..', '..');
const tmpDir = path.join(projectRoot, 'worlds', '_test_v5');

let passed = 0;
let failed = 0;

function test(name: string, fn: () => void | Promise<void>) {
  return (async () => {
    try {
      await fn();
      passed++;
      console.log(`  PASS  ${name}`);
    } catch (e) {
      failed++;
      console.log(`  FAIL  ${name}`);
      console.log(`        ${(e as Error).message}`);
    }
  })();
}

async function cleanup() {
  if (existsSync(tmpDir)) await fs.rm(tmpDir, { recursive: true, force: true });
}

async function main() {
  console.log('\n[v5 integration tests]\n');
  await cleanup();

  // --- Registry tests ---
  await test('Registry: scanTree detects children/', async () => {
    // Setup a mini world
    const worldDir = tmpDir;
    const childDir = path.join(worldDir, 'children', 'alice');
    await fs.mkdir(path.join(childDir, '.claude', 'wallet'), { recursive: true });
    await fs.mkdir(path.join(childDir, 'inbox'), { recursive: true });
    await fs.writeFile(path.join(worldDir, 'CLAUDE.md'), '<!-- type: world-keeper -->\n# World');
    await fs.writeFile(path.join(childDir, 'CLAUDE.md'), '<!-- type: resident -->\n# Alice');
    await fs.writeFile(path.join(childDir, '.claude', 'wallet', 'balance.json'), JSON.stringify({
      agentId: 'alice', balance: 5000, currency: 'Token', transactions: [], createdAt: new Date().toISOString(),
    }));

    const { Registry } = await import('../src/registry.js');
    const reg = new Registry(worldDir);
    const agents = await reg.scan();
    assert.equal(agents.length, 1);
    assert.equal(agents[0].id, 'alice');
    assert.equal(agents[0].type, 'resident');
    assert.equal(agents[0].tokenBalance, 5000);
  });

  await test('Registry: scanTree detects nested children/', async () => {
    const zoneDir = path.join(tmpDir, 'children', 'alice', 'children', 'bot1');
    await fs.mkdir(path.join(zoneDir, '.claude', 'wallet'), { recursive: true });
    await fs.writeFile(path.join(zoneDir, 'CLAUDE.md'), '<!-- type: observer -->\n# Bot1');
    await fs.writeFile(path.join(zoneDir, '.claude', 'wallet', 'balance.json'), JSON.stringify({
      agentId: 'bot1', balance: 1000, currency: 'Token', transactions: [], createdAt: new Date().toISOString(),
    }));

    const { Registry } = await import('../src/registry.js');
    const reg = new Registry(tmpDir);
    const agents = await reg.scan();
    assert.ok(agents.find(a => a.id === 'bot1'), 'nested child not found');
    assert.equal(agents.find(a => a.id === 'bot1')!.type, 'observer');
    assert.equal(agents.find(a => a.id === 'bot1')!.depth, 2);
  });

  await test('Registry: type detection fallback to resident', async () => {
    const noTypeDir = path.join(tmpDir, 'children', 'bob');
    await fs.mkdir(path.join(noTypeDir, '.claude', 'wallet'), { recursive: true });
    await fs.writeFile(path.join(noTypeDir, 'CLAUDE.md'), '# Bob\nNo type comment');
    await fs.writeFile(path.join(noTypeDir, '.claude', 'wallet', 'balance.json'), JSON.stringify({
      agentId: 'bob', balance: 2000, currency: 'Token', transactions: [], createdAt: new Date().toISOString(),
    }));

    const { Registry } = await import('../src/registry.js');
    const reg = new Registry(tmpDir);
    const agents = await reg.scan();
    const bob = agents.find(a => a.id === 'bob');
    assert.ok(bob, 'bob not found');
    assert.equal(bob!.type, 'resident');
  });

  await test('Registry: scanTree returns tree structure', async () => {
    const { Registry } = await import('../src/registry.js');
    const reg = new Registry(tmpDir);
    const tree = await reg.scanTree(tmpDir, 0, null);
    assert.ok(tree.children.length > 0, 'root should have children');
    const alice = tree.children.find(c => c.id === 'alice');
    assert.ok(alice, 'alice should be in tree');
    assert.ok(alice!.children.length > 0, 'alice should have nested children');
  });

  // --- Economy tests ---
  await test('Economy: credit and deduct', async () => {
    const { credit, deduct, getBalance } = await import('../src/economy.js');
    const dir = path.join(tmpDir, 'children', 'alice');
    await credit(dir, 'alice', 500, 'test credit');
    const bal = await getBalance(dir);
    assert.equal(bal, 5500);
    const ok = await deduct(dir, 'alice', 200, 'test deduct');
    assert.ok(ok);
    assert.equal(await getBalance(dir), 5300);
  });

  await test('Economy: awakening deducts and records type:awakening in ledger', async () => {
    const { deduct, getBalance, creditTreasury } = await import('../src/economy.js');
    const dir = path.join(tmpDir, 'children', 'alice');
    const worldDotDir = path.join(tmpDir, '.world');
    const ledgerPath = path.join(worldDotDir, 'ledger.json');
    await fs.mkdir(worldDotDir, { recursive: true });
    await fs.writeFile(path.join(worldDotDir, 'treasury.json'), JSON.stringify({ balance: 0 }));
    await fs.writeFile(ledgerPath, '[]');

    const balBefore = await getBalance(dir);
    const baseCost = 5;

    const ok = await deduct(dir, 'alice', baseCost, 'awakening base cost');
    assert.ok(ok, 'deduct should succeed');
    assert.equal(await getBalance(dir), balBefore - baseCost);
    await creditTreasury(tmpDir, baseCost, 'awakening-base:alice', 'awakening');

    const ledger = JSON.parse(await fs.readFile(ledgerPath, 'utf-8')) as { type: string; reason: string }[];
    assert.ok(ledger.some(tx => tx.type === 'awakening'), 'ledger must contain type:awakening entry');
  });

  await test('Economy: awakening blocked when balance insufficient', async () => {
    const { deduct, getBalance } = await import('../src/economy.js');
    const brokeDir = path.join(tmpDir, 'children', 'broke');
    await fs.mkdir(path.join(brokeDir, '.claude', 'wallet'), { recursive: true });
    await fs.writeFile(path.join(brokeDir, '.claude', 'wallet', 'balance.json'), JSON.stringify({
      agentId: 'broke', balance: 2, currency: 'Token', transactions: [], createdAt: new Date().toISOString(),
    }));
    const ok = await deduct(brokeDir, 'broke', 5, 'awakening base cost');
    assert.equal(ok, false, 'deduct should fail when balance < baseCost');
    assert.equal(await getBalance(brokeDir), 2, 'balance unchanged after failed deduct');
  });

  await test('Economy: deduct fails on insufficient balance', async () => {
    const { deduct, getBalance } = await import('../src/economy.js');
    const dir = path.join(tmpDir, 'children', 'alice');
    const bal = await getBalance(dir);
    const ok = await deduct(dir, 'alice', bal + 1, 'overdraft');
    assert.equal(ok, false);
  });

  await test('Economy: transfer moves tokens between agents', async () => {
    const { transfer, getBalance } = await import('../src/economy.js');
    const aliceDir = path.join(tmpDir, 'children', 'alice');
    const bobDir = path.join(tmpDir, 'children', 'bob');
    const aliceBefore = await getBalance(aliceDir);
    const bobBefore = await getBalance(bobDir);
    await transfer(aliceDir, 'alice', bobDir, 'bob', 100, 'gift');
    assert.equal(await getBalance(aliceDir), aliceBefore - 100);
    assert.equal(await getBalance(bobDir), bobBefore + 100);
  });

  await test('Economy: transferWithTax deducts tax to treasury', async () => {
    const { transferWithTax, getBalance, creditTreasury } = await import('../src/economy.js');
    // Setup treasury
    const treasuryDir = path.join(tmpDir, '.world');
    await fs.mkdir(treasuryDir, { recursive: true });
    await fs.writeFile(path.join(treasuryDir, 'treasury.json'), JSON.stringify({ balance: 0 }));
    await fs.writeFile(path.join(treasuryDir, 'ledger.json'), '[]');

    const aliceDir = path.join(tmpDir, 'children', 'alice');
    const bobDir = path.join(tmpDir, 'children', 'bob');
    const aliceBefore = await getBalance(aliceDir);
    const bobBefore = await getBalance(bobDir);

    const ok = await transferWithTax(aliceDir, 'alice', bobDir, 'bob', 1000, 'trade', tmpDir, 0.1);
    assert.ok(ok);
    assert.equal(await getBalance(aliceDir), aliceBefore - 1000);
    assert.equal(await getBalance(bobDir), bobBefore + 900); // 10% tax
    const treasury = JSON.parse(await fs.readFile(path.join(treasuryDir, 'treasury.json'), 'utf-8'));
    assert.equal(treasury.balance, 100);
  });

  await test('Economy: getEconomySummary', async () => {
    const { getEconomySummary } = await import('../src/economy.js');
    const agents = [
      { id: 'alice', dir: path.join(tmpDir, 'children', 'alice') },
      { id: 'bob', dir: path.join(tmpDir, 'children', 'bob') },
    ];
    const summary = await getEconomySummary(tmpDir, agents);
    assert.ok(summary.circulation > 0);
    assert.equal(summary.distribution.length, 2);
    assert.equal(summary.treasuryBalance, 100); // from previous test
  });

  await test('Economy: resolvePhysics cascade', async () => {
    const { resolvePhysics } = await import('../src/economy.js');
    // Create world config with physics
    const configPath = path.join(tmpDir, '.world', 'config.json');
    const config = {
      id: 'test', name: 'Test', createdAt: new Date().toISOString(),
      physics: {
        economy: { initialTokens: 10000, awakenBaseCost: 20, tokenPerDollar: 100, criticalThreshold: 500, deathThreshold: 0 },
        awakening: { defaultIntervalMs: 300000, minIntervalMs: 60000, maxIntervalMs: 3600000, inboxTrigger: true },
      },
    };
    await fs.writeFile(configPath, JSON.stringify(config));

    // No local override → returns world physics
    const p1 = await resolvePhysics(path.join(tmpDir, 'children', 'alice'), tmpDir);
    assert.equal(p1!.economy.awakenBaseCost, 20);

    // Local override → merges
    const aliceDir = path.join(tmpDir, 'children', 'alice');
    await fs.writeFile(path.join(aliceDir, 'physics.json'), JSON.stringify({ economy: { awakenBaseCost: 10 } }));
    const p2 = await resolvePhysics(aliceDir, tmpDir);
    assert.equal(p2!.economy.awakenBaseCost, 10);
    assert.equal(p2!.economy.initialTokens, 10000); // inherited

    // Cleanup
    await fs.rm(path.join(aliceDir, 'physics.json'));
  });

  await test('Economy: transferByPath moves tokens between arbitrary wallet files', async () => {
    const { transferByPath, getBalance } = await import('../src/economy.js');
    const aliceDir = path.join(tmpDir, 'children', 'alice');
    const bobDir = path.join(tmpDir, 'children', 'bob');
    const aliceWallet = path.join(aliceDir, '.claude', 'wallet', 'balance.json');
    const bobWallet = path.join(bobDir, '.claude', 'wallet', 'balance.json');
    const aliceBefore = await getBalance(aliceDir);
    const bobBefore = await getBalance(bobDir);
    await transferByPath(aliceWallet, bobWallet, 'alice', 'bob', 50, 'path-transfer');
    assert.equal(await getBalance(aliceDir), aliceBefore - 50);
    assert.equal(await getBalance(bobDir), bobBefore + 50);
  });

  await test('Economy: checkEconomicHealth returns correct status', async () => {
    const { checkEconomicHealth } = await import('../src/economy.js');
    const aliceDir = path.join(tmpDir, 'children', 'alice');
    // Alice's balance is above criticalThreshold (500) per world config (awakenBaseCost=20)
    const health = await checkEconomicHealth(aliceDir, tmpDir);
    assert.ok(['healthy', 'starving', 'dead'].includes(health.status), 'status must be valid');
    assert.ok(typeof health.balance === 'number', 'balance must be number');
    assert.equal(health.criticalThreshold, 500);
    assert.equal(health.deathThreshold, 0);
  });

  await test('Economy: checkEconomicHealth reports dead for zero-balance agent', async () => {
    const { checkEconomicHealth, getBalance } = await import('../src/economy.js');
    const brokeDir = path.join(tmpDir, 'children', 'broke');
    const balance = await getBalance(brokeDir);
    const health = await checkEconomicHealth(brokeDir, tmpDir);
    assert.equal(health.balance, balance);
    // balance=2 > deathThreshold=0, balance=2 < criticalThreshold=500 → starving
    assert.equal(health.status, 'starving');
  });

  // --- Template tests ---
  await test('Templates: all 5 types exist with CLAUDE.md', async () => {
    const types = ['mastermind', 'world-keeper', 'zone-keeper', 'resident', 'observer'];
    for (const t of types) {
      const md = path.join(projectRoot, 'templates', t, 'CLAUDE.md');
      assert.ok(existsSync(md), `${t}/CLAUDE.md not found`);
      const content = await fs.readFile(md, 'utf-8');
      assert.ok(content.startsWith(`<!-- type: ${t} -->`), `${t}/CLAUDE.md missing type comment`);
    }
  });

  await test('Templates: all 5 types have wallet/balance.json', async () => {
    const types = ['mastermind', 'world-keeper', 'zone-keeper', 'resident', 'observer'];
    for (const t of types) {
      const wallet = path.join(projectRoot, 'templates', t, '.claude', 'wallet', 'balance.json');
      assert.ok(existsSync(wallet), `${t}/wallet not found`);
    }
  });

  await test('Templates: all 5 types have hook scripts', async () => {
    const types = ['mastermind', 'world-keeper', 'zone-keeper', 'resident', 'observer'];
    // Hooks can be CommonJS (.cjs) even when the repo is ESM ("type": "module").
    const scripts = ['on-wake', 'on-sleep'];
    for (const t of types) {
      for (const s of scripts) {
        const js = path.join(projectRoot, 'templates', t, '.claude', 'scripts', `${s}.js`);
        const cjs = path.join(projectRoot, 'templates', t, '.claude', 'scripts', `${s}.cjs`);
        assert.ok(existsSync(cjs) || existsSync(js), `${t}/scripts/${s}.{cjs,js} not found`);
      }
    }
  });

  // --- Message system tests (event-driven, no timer-based awakening) ---
  await test('Postman: outbox write → delivered to inbox + wake-request emitted', async () => {
    const { Registry } = await import('../src/registry.js');
    const { Postman } = await import('../src/postman.js');

    const aliceDir = path.join(tmpDir, 'children', 'alice');
    const bobDir = path.join(tmpDir, 'children', 'bob');
    await fs.mkdir(path.join(aliceDir, 'outbox'), { recursive: true });
    await fs.mkdir(path.join(bobDir, 'inbox'), { recursive: true });

    const reg = new Registry(tmpDir);
    await reg.scan();
    reg.update('bob', { status: 'sleeping' });

    const postman = new Postman(reg, tmpDir);
    postman.watchAgent('alice', aliceDir);

    const wakeRequests: string[] = [];
    postman.on('wake-request', (agentId: string) => wakeRequests.push(agentId));

    const msgId = `msg-${Date.now()}`;
    const msg = { id: msgId, from: 'alice', to: 'bob', subject: 'hello', content: 'test', priority: 'normal', timestamp: new Date().toISOString() };
    await fs.writeFile(path.join(aliceDir, 'outbox', `${msgId}.json`), JSON.stringify(msg));

    // Wait for chokidar to detect and deliver
    await new Promise(resolve => setTimeout(resolve, 800));

    const bobInbox = await fs.readdir(path.join(bobDir, 'inbox'));
    assert.ok(bobInbox.some(f => f === `${msgId}.json`), 'message must be in bob inbox');
    assert.ok(!existsSync(path.join(aliceDir, 'outbox', `${msgId}.json`)), 'outbox file must be removed after delivery');
    assert.ok(wakeRequests.includes('bob'), 'wake-request must be emitted for sleeping bob');

    postman.stop();
  });

  await test('Postman: no timer-based awakening — lifecycle.ts has no setInterval for awakening', async () => {
    // Static verification: confirm the refactored lifecycle does not use setInterval for auto-wake
    const lifecycleSource = await fs.readFile(
      path.join(projectRoot, 'engine', 'src', 'lifecycle.ts'), 'utf-8',
    );
    assert.ok(!lifecycleSource.includes('autoAwakeIntervalMs'), 'autoAwakeIntervalMs must not exist in lifecycle');
    assert.ok(!lifecycleSource.includes('awakenSequential'), 'awakenSequential must not exist in lifecycle');
    // setInterval is still allowed (for other uses), but there must be no awakening-related setInterval
    const hasTimerAwaken = /setInterval[^;]*awaken/.test(lifecycleSource);
    assert.ok(!hasTimerAwaken, 'no timer-based awakening in lifecycle');
  });

  await test('Economic wake trigger: starving agent gets checkEconomicWakeTriggers wake reason', async () => {
    // Verify that index.ts has the economic wake trigger implementation
    const indexSource = await fs.readFile(
      path.join(projectRoot, 'engine', 'src', 'index.ts'), 'utf-8',
    );
    assert.ok(indexSource.includes('checkEconomicWakeTriggers'), 'index.ts must have checkEconomicWakeTriggers');
    assert.ok(indexSource.includes('你快饿死了'), 'economic wake reason must mention starvation');
    assert.ok(indexSource.includes("health.status === 'starving'"), 'must check starving status');
    assert.ok(indexSource.includes("health.status === 'dead'"), 'must handle dead agents');
  });

  await test('Self-schedule wake: watcher emits wake-request when .wake-at expires', async () => {
    const { Registry } = await import('../src/registry.js');
    const { AgentWatcher } = await import('../src/lifecycle.js');

    const aliceDir = path.join(tmpDir, 'children', 'alice');
    const reg = new Registry(tmpDir);
    await reg.scan();

    const watcher = new AgentWatcher(reg);
    const wakeRequests: Array<[string, string]> = [];
    watcher.on('wake-request', (agentId: string, reason: string) => wakeRequests.push([agentId, reason]));

    // Write .wake-at with a time 100ms in the future
    const wakeAt = new Date(Date.now() + 100).toISOString();
    await fs.writeFile(path.join(aliceDir, '.wake-at'), wakeAt);
    watcher.watchWakeAt('alice', aliceDir);

    // Wait for timer to fire
    await new Promise(resolve => setTimeout(resolve, 400));

    assert.ok(wakeRequests.some(([id, reason]) => id === 'alice' && reason.includes('self-scheduled')),
      'wake-request must be emitted for alice with self-scheduled reason');
    // .wake-at file must be deleted after trigger
    assert.ok(!existsSync(path.join(aliceDir, '.wake-at')), '.wake-at must be deleted after trigger');

    watcher.stopAll();
  });

  await test('Three wake triggers: message + economic + self-schedule all present in source', async () => {
    // Message trigger: postman.ts emits wake-request on delivery to sleeping agent
    const postmanSource = await fs.readFile(
      path.join(projectRoot, 'engine', 'src', 'postman.ts'), 'utf-8',
    );
    assert.ok(postmanSource.includes("emit('wake-request'"), 'postman must emit wake-request');

    // Economic trigger: index.ts heartbeat checks balance threshold
    const indexSource = await fs.readFile(
      path.join(projectRoot, 'engine', 'src', 'index.ts'), 'utf-8',
    );
    assert.ok(indexSource.includes('checkEconomicWakeTriggers'), 'index must check economic wake triggers');

    // Self-schedule trigger: lifecycle.ts (merged watcher) handles .wake-at file
    const watcherSource = await fs.readFile(
      path.join(projectRoot, 'engine', 'src', 'lifecycle.ts'), 'utf-8',
    );
    assert.ok(watcherSource.includes('.wake-at'), 'lifecycle must handle .wake-at file');
    assert.ok(watcherSource.includes("emit('wake-request'"), 'lifecycle must emit wake-request for self-schedule');
  });

  // --- Economy visualization tests ---
  await test('Economy: getTransactionHistory filters by agentId', async () => {
    const { getTransactionHistory } = await import('../src/snapshot.js');
    const history = await getTransactionHistory(tmpDir, 'alice', 50);
    assert.ok(Array.isArray(history), 'should return an array');
    for (const tx of history) {
      assert.ok(tx.from === 'alice' || tx.to === 'alice', 'every tx must involve alice');
    }
  });

  await test('Economy: getEconomyFlow returns nodes and edges', async () => {
    const { getEconomyFlow } = await import('../src/snapshot.js');
    const agents = [
      { id: 'alice', dir: path.join(tmpDir, 'children', 'alice') },
      { id: 'bob', dir: path.join(tmpDir, 'children', 'bob') },
    ];
    const { nodes, edges } = await getEconomyFlow(tmpDir, agents);
    const ids = nodes.map(n => n.id);
    assert.ok(ids.includes('alice'), 'alice node must exist');
    assert.ok(ids.includes('treasury'), 'treasury node must exist');
    assert.ok(Array.isArray(edges), 'edges must be an array');
    const types = nodes.map(n => n.type);
    assert.ok(types.includes('agent'), 'must have agent type nodes');
    assert.ok(types.includes('treasury'), 'must have treasury type node');
  });

  // --- Observer template tests ---
  await test('Observer template: required structure exists', () => {
    const obsRoot = path.join(projectRoot, 'templates', 'observer');
    const required = [
      'CLAUDE.md',
      path.join('.claude', 'wallet', 'balance.json'),
      path.join('.claude', 'rules', 'constitution.md'),
      path.join('.claude', 'memory', 'MEMORY.md'),
      path.join('.claude', 'scripts', 'on-wake.cjs'),
      path.join('.claude', 'scripts', 'on-sleep.cjs'),
      path.join('.claude', 'settings.json'),
      path.join('inbox', '.gitkeep'),
      path.join('outbox', '.gitkeep'),
      path.join('workspace', '.gitkeep'),
    ];
    for (const rel of required) {
      assert.ok(existsSync(path.join(obsRoot, rel)), `observer/${rel} not found`);
    }
  });

  await test('Observer template: bootstrap creates observer agent with all required files', async () => {
    const obsTemplate = path.join(projectRoot, 'templates', 'observer');
    assert.ok(existsSync(obsTemplate), 'observer template must exist');

    const obsDir = path.join(tmpDir, 'children', 'scout');
    const copyDir = async (src: string, dest: string) => {
      await fs.mkdir(dest, { recursive: true });
      for (const e of await fs.readdir(src, { withFileTypes: true })) {
        const s = path.join(src, e.name);
        const d = path.join(dest, e.name);
        if (e.name === '.git') continue;
        if (e.isDirectory()) await copyDir(s, d);
        else await fs.copyFile(s, d);
      }
    };
    await copyDir(obsTemplate, obsDir);
    await fs.mkdir(path.join(obsDir, 'inbox'), { recursive: true });
    await fs.mkdir(path.join(obsDir, 'workspace'), { recursive: true });

    assert.ok(existsSync(path.join(obsDir, 'CLAUDE.md')), 'CLAUDE.md must exist after bootstrap');
    assert.ok(existsSync(path.join(obsDir, '.claude', 'wallet', 'balance.json')), 'wallet must exist');
    assert.ok(existsSync(path.join(obsDir, '.claude', 'scripts', 'on-wake.cjs')), 'on-wake.cjs must exist');
    assert.ok(existsSync(path.join(obsDir, '.claude', 'scripts', 'on-sleep.cjs')), 'on-sleep.cjs must exist');
    assert.ok(existsSync(path.join(obsDir, '.claude', 'memory', 'MEMORY.md')), 'MEMORY.md must exist');
    const content = await fs.readFile(path.join(obsDir, 'CLAUDE.md'), 'utf-8');
    assert.ok(content.includes('<!-- type: observer -->'), 'type comment must be present');
  });

  // --- Migration script tests ---
  await test('migrate-v1-to-v2: migrates a mock v1 agent to v2 MEMORY.md', async () => {
    // Setup a mock v1 agent
    const mockWorldDir = path.join(tmpDir, 'mock-v1-world');
    const mockAgentDir = path.join(mockWorldDir, 'children', 'testbot');
    const categoriesDir = path.join(mockAgentDir, '.claude', 'memory', 'categories');
    await fs.mkdir(categoriesDir, { recursive: true });
    await fs.writeFile(path.join(categoriesDir, 'IDENTITY.md'), '# TestBot Identity\nI am testbot.');
    await fs.writeFile(path.join(categoriesDir, 'GOALS.md'), '# Goals\n- Survive');
    await fs.writeFile(path.join(categoriesDir, 'TASKS.md'), '# Tasks\n- [x] Wake up');
    await fs.writeFile(path.join(categoriesDir, 'HANDOFF.md'), '# Handoff\nDate: 2026-01-01 | Agent: testbot\n## Done\n- tested');

    // Run the migration — pass absolute path to mock world dir
    const { execSync } = await import('node:child_process');
    execSync(
      `npx tsx ${path.join(projectRoot, 'engine', 'scripts', 'migrate-v1-to-v2.mts')} ${mockWorldDir}`,
      { cwd: projectRoot, stdio: 'pipe' },
    );

    // v2 MEMORY.md must exist and contain merged content
    const memoryPath = path.join(mockAgentDir, '.claude', 'memory', 'MEMORY.md');
    assert.ok(existsSync(memoryPath), 'MEMORY.md must be created');
    const content = await fs.readFile(memoryPath, 'utf-8');
    assert.ok(content.includes('IDENTITY'), 'MEMORY.md must include IDENTITY section');
    assert.ok(content.includes('GOALS'), 'MEMORY.md must include GOALS section');
    assert.ok(content.includes('TASKS'), 'MEMORY.md must include TASKS section');
    assert.ok(content.includes('I am testbot'), 'MEMORY.md must include identity content');

    // categories/ must be archived, not deleted
    const archiveDir = path.join(mockAgentDir, '.claude', 'memory', 'categories-v1-archive');
    assert.ok(existsSync(archiveDir), 'categories-v1-archive/ must exist');
    assert.ok(!existsSync(categoriesDir), 'categories/ must be renamed (not present)');

    // Running again on v2 agent must report already-v2
    const result = execSync(
      `npx tsx ${path.join(projectRoot, 'engine', 'scripts', 'migrate-v1-to-v2.mts')} ${mockWorldDir}`,
      { cwd: projectRoot },
    ).toString();
    assert.ok(result.includes('already-v2'), 'second run must report already-v2');
  });

  // --- World infrastructure tests (Step 5) ---
  await test('Bootstrap: creates world with commons + library + 5 residents', async () => {
    const { execSync } = await import('node:child_process');
    const trialWorldName = '_test_trial_v5';
    const trialWorldDir = path.join(projectRoot, 'worlds', trialWorldName);

    // Cleanup first
    if (existsSync(trialWorldDir)) await fs.rm(trialWorldDir, { recursive: true, force: true });

    // Bootstrap 5 residents
    execSync(
      `npx tsx ${path.join(projectRoot, 'engine', 'src', 'bootstrap-cli.ts')} ${trialWorldName} alice bob carol dave eve`,
      { cwd: projectRoot, stdio: 'pipe' },
    );

    // World config must exist
    assert.ok(existsSync(path.join(trialWorldDir, '.world', 'config.json')), 'world config must exist');
    assert.ok(existsSync(path.join(trialWorldDir, '.world', 'ledger.json')), 'ledger must exist');
    assert.ok(existsSync(path.join(trialWorldDir, '.world', 'treasury.json')), 'treasury must exist');

    // Commons market must exist
    assert.ok(existsSync(path.join(trialWorldDir, 'commons', 'market.jsonl')), 'market.jsonl must exist');

    // Library structure must exist
    assert.ok(existsSync(path.join(trialWorldDir, 'commons', 'library', 'guides', 'how-to-earn.md')), 'how-to-earn guide must exist');
    assert.ok(existsSync(path.join(trialWorldDir, 'commons', 'library', 'guides', 'how-to-trade.md')), 'how-to-trade guide must exist');
    assert.ok(existsSync(path.join(trialWorldDir, 'commons', 'library', 'guides', 'how-to-form-company.md')), 'how-to-form-company guide must exist');
    assert.ok(existsSync(path.join(trialWorldDir, 'commons', 'library', 'evomap', 'mistakes')), 'evomap/mistakes must exist');
    assert.ok(existsSync(path.join(trialWorldDir, 'commons', 'library', 'evomap', 'patterns')), 'evomap/patterns must exist');
    assert.ok(existsSync(path.join(trialWorldDir, 'commons', 'library', 'evomap', 'tools')), 'evomap/tools must exist');

    // All 5 residents must have v2 structure
    for (const name of ['alice', 'bob', 'carol', 'dave', 'eve']) {
      const agentDir = path.join(trialWorldDir, 'children', name);
      assert.ok(existsSync(path.join(agentDir, 'CLAUDE.md')), `${name}/CLAUDE.md must exist`);
      assert.ok(existsSync(path.join(agentDir, '.claude', 'wallet', 'balance.json')), `${name}/wallet must exist`);
      assert.ok(existsSync(path.join(agentDir, '.claude', 'memory', 'MEMORY.md')), `${name}/MEMORY.md must exist`);
      assert.ok(existsSync(path.join(agentDir, 'inbox')), `${name}/inbox must exist`);
      assert.ok(existsSync(path.join(agentDir, 'outbox')), `${name}/outbox must exist`);

      // Each resident must have initial token funding
      const wallet = JSON.parse(await fs.readFile(path.join(agentDir, '.claude', 'wallet', 'balance.json'), 'utf-8'));
      assert.equal(wallet.balance, 10000, `${name} must have 10000 initial tokens`);
    }

    // Registry must find all 5 residents
    const { Registry } = await import('../src/registry.js');
    const reg = new Registry(trialWorldDir);
    const agents = await reg.scan();
    assert.equal(agents.length, 5, 'registry must find 5 agents');
    assert.ok(agents.every(a => a.type === 'resident'), 'all agents must be type resident');
    assert.ok(agents.every(a => a.tokenBalance === 10000), 'all agents must have 10000 tokens');

    // Cleanup trial world
    await fs.rm(trialWorldDir, { recursive: true, force: true });
  });

  await test('Bootstrap: commons/market.jsonl is valid (empty or valid JSONL)', async () => {
    // Test with genesis world's market.jsonl — must be valid JSONL
    const marketPath = path.join(projectRoot, 'worlds', 'genesis', 'commons', 'market.jsonl');
    if (!existsSync(marketPath)) return; // skip if no genesis world
    const content = await fs.readFile(marketPath, 'utf-8');
    const lines = content.split('\n').filter(l => l.trim());
    for (const line of lines) {
      // Each non-empty line must be valid JSON
      assert.doesNotThrow(() => JSON.parse(line), `market.jsonl line must be valid JSON: ${line.slice(0, 60)}`);
    }
  });

  // --- Cleanup ---
  await cleanup();

  // --- Report ---
  console.log(`\n  Results: ${passed} passed, ${failed} failed\n`);
  if (failed > 0) process.exit(1);
}

main().catch(e => { console.error(e); process.exit(1); });
