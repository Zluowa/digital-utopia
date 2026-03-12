// @input: mock agent directories
// @output: BDI pipeline test results
// @position: BDI 单元测试套件

import assert from 'node:assert/strict';
import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const tmpDir = path.join(__dirname, '..', '..', '..', 'worlds', '_test_bdi');

let passed = 0;
let failed = 0;

function test(name: string, fn: () => void | Promise<void>): Promise<void> {
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

async function setupAgent(id: string, opts: {
  balance?: number;
  inboxCount?: number;
  tasks?: string;
  goals?: string;
  type?: string;
}): Promise<string> {
  const agentDir = path.join(tmpDir, id);
  await fs.mkdir(path.join(agentDir, '.claude', 'wallet'), { recursive: true });
  await fs.mkdir(path.join(agentDir, '.claude', 'memory', 'categories'), { recursive: true });
  await fs.mkdir(path.join(agentDir, 'inbox'), { recursive: true });

  const walletData = {
    agentId: id, balance: opts.balance ?? 5000, currency: 'Token',
    transactions: [{ type: 'credit', amount: 100, reason: 'bounty', timestamp: new Date().toISOString() }],
    createdAt: new Date().toISOString(),
  };
  await fs.writeFile(path.join(agentDir, '.claude', 'wallet', 'balance.json'), JSON.stringify(walletData));
  await fs.writeFile(path.join(agentDir, 'CLAUDE.md'), `<!-- type: ${opts.type ?? 'resident'} -->\n# ${id}`);
  await fs.writeFile(path.join(agentDir, '.claude', 'memory', 'categories', 'TASKS.md'), opts.tasks ?? '- [ ] do something\n- [x] done already');
  await fs.writeFile(path.join(agentDir, '.claude', 'memory', 'categories', 'GOALS.md'), opts.goals ?? '# Goals\nBe productive');

  for (let i = 0; i < (opts.inboxCount ?? 0); i++) {
    const msg = { id: `msg-${i}`, from: 'alice', to: id, subject: `Test ${i}`, content: 'hello', priority: 'normal', timestamp: new Date().toISOString() };
    await fs.writeFile(path.join(agentDir, 'inbox', `msg-${i}.json`), JSON.stringify(msg));
  }
  return agentDir;
}

async function cleanup(): Promise<void> {
  await fs.rm(tmpDir, { recursive: true, force: true });
}

async function main(): Promise<void> {
  console.log('\n[BDI pipeline tests]\n');
  await cleanup();

  await test('scanBeliefs: reads balance and tasks correctly', async () => {
    const dir = await setupAgent('agent-a', { balance: 1234, tasks: '- [ ] task1\n- [x] done' });
    const { scanBeliefs } = await import('../../src/bdi/belief-scanner.js');
    const beliefs = await scanBeliefs(dir);
    assert.equal(beliefs.balance, 1234);
    assert.ok(beliefs.tasks.includes('task1'));
    assert.ok(beliefs.identity.includes('agent-a'));
  });

  await test('scanBeliefs: inbox messages are parsed', async () => {
    const dir = await setupAgent('agent-b', { inboxCount: 3 });
    const { scanBeliefs } = await import('../../src/bdi/belief-scanner.js');
    const beliefs = await scanBeliefs(dir);
    assert.equal(beliefs.inboxMessages.length, 3);
    assert.equal(beliefs.inboxMessages[0].from, 'alice');
  });

  await test('deriveDesires: survival desire fires at low balance', async () => {
    const dir = await setupAgent('agent-c', { balance: 50 });
    const { scanBeliefs } = await import('../../src/bdi/belief-scanner.js');
    const { deriveDesires } = await import('../../src/bdi/desire-engine.js');
    const beliefs = await scanBeliefs(dir);
    const desires = deriveDesires(beliefs, 'resident');
    assert.ok(desires.length > 0, 'should have desires');
    assert.equal(desires[0].category, 'survival', 'survival should be top priority');
    assert.equal(desires[0].priority, 1);
  });

  await test('deriveDesires: inbox desire fires when messages present', async () => {
    const dir = await setupAgent('agent-d', { inboxCount: 2, balance: 10000 });
    const { scanBeliefs } = await import('../../src/bdi/belief-scanner.js');
    const { deriveDesires } = await import('../../src/bdi/desire-engine.js');
    const beliefs = await scanBeliefs(dir);
    const desires = deriveDesires(beliefs, 'resident');
    const socialDesire = desires.find(d => d.category === 'social');
    assert.ok(socialDesire, 'should have social desire for inbox');
    assert.ok(socialDesire!.description.includes('2'));
  });

  await test('planIntentions: max 3 intentions produced', async () => {
    const dir = await setupAgent('agent-e', { balance: 50, inboxCount: 5 });
    const { scanBeliefs } = await import('../../src/bdi/belief-scanner.js');
    const { deriveDesires } = await import('../../src/bdi/desire-engine.js');
    const { planIntentions } = await import('../../src/bdi/intention-planner.js');
    const beliefs = await scanBeliefs(dir);
    const desires = deriveDesires(beliefs, 'resident');
    const intentions = planIntentions(desires, beliefs);
    assert.ok(intentions.length <= 3, `expected ≤3, got ${intentions.length}`);
    assert.equal(intentions[0].order, 1);
  });

  await test('buildPrompt: output contains key sections', async () => {
    const dir = await setupAgent('agent-f', { balance: 3000, inboxCount: 1, tasks: '- [ ] write docs' });
    const { buildBDIState } = await import('../../src/bdi/index.js');
    const { buildPrompt } = await import('../../src/bdi/prompt-builder.js');
    const state = await buildBDIState({ agentId: 'agent-f', agentType: 'resident', agentDir: dir, reason: 'heartbeat' });
    const prompt = buildPrompt(state, 'heartbeat');
    assert.ok(prompt.includes('BDI State'), 'should include BDI State header');
    assert.ok(prompt.includes('agent-f'), 'should include agent id');
    assert.ok(prompt.includes('3000'), 'should include balance');
    assert.ok(prompt.includes('Action plan'), 'should include action plan');
    // Rough token estimate: prompt should be within reasonable bounds
    assert.ok(prompt.length < 8000, `prompt too long: ${prompt.length} chars`);
  });

  await test('runBDIPipeline: full pipeline returns non-empty string', async () => {
    const dir = await setupAgent('agent-g', { balance: 1000, inboxCount: 1 });
    const { runBDIPipeline } = await import('../../src/bdi/index.js');
    const prompt = await runBDIPipeline({ agentId: 'agent-g', agentType: 'resident', agentDir: dir, reason: 'test' });
    assert.ok(prompt.length > 100, 'prompt should be substantial');
    assert.ok(prompt.includes('agent-g'));
  });

  await cleanup();

  console.log(`\n  Results: ${passed} passed, ${failed} failed\n`);
  if (failed > 0) process.exit(1);
}

main().catch(e => { console.error(e); process.exit(1); });
