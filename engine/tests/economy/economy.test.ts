// @input: economy.ts functions
// @output: unit test results for bounty + metrics
// @position: validation layer for token economy

import assert from 'node:assert/strict';
import { existsSync, promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const tmpDir = path.join(__dirname, '..', '..', 'worlds', '_test_economy');

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

async function setupWorld(): Promise<void> {
  const worldDir = path.join(tmpDir, '.world');
  await fs.mkdir(worldDir, { recursive: true });
  await fs.writeFile(path.join(worldDir, 'treasury.json'), JSON.stringify({ balance: 1000 }));
  await fs.writeFile(path.join(worldDir, 'ledger.json'), '[]');
  await fs.mkdir(path.join(tmpDir, 'commons', 'bulletin-board'), { recursive: true });
}

async function setupAgent(name: string, balance: number): Promise<string> {
  const dir = path.join(tmpDir, 'children', name);
  await fs.mkdir(path.join(dir, '.claude', 'wallet'), { recursive: true });
  const wallet = {
    agentId: name, balance, currency: 'Token',
    transactions: [], createdAt: new Date().toISOString(),
  };
  await fs.writeFile(path.join(dir, '.claude', 'wallet', 'balance.json'), JSON.stringify(wallet, null, 2));
  return dir;
}

async function cleanup(): Promise<void> {
  if (existsSync(tmpDir)) await fs.rm(tmpDir, { recursive: true, force: true });
}

async function main(): Promise<void> {
  console.log('\n[economy unit tests]\n');
  await cleanup();
  await setupWorld();
  await setupAgent('alice', 5000);
  await setupAgent('bob', 2000);
  await setupAgent('charlie', 500);

  const econ = await import('../../src/economy.js');

  // ── Bounty: create ─────────────────────────────────────
  await test('Bounty: createBounty persists to file', async () => {
    const b = await econ.createBounty(tmpDir, 'Write a poem', 'Write a haiku', 100, 'alice');
    assert.equal(b.status, 'open');
    assert.equal(b.reward, 100);
    assert.equal(b.createdBy, 'alice');
    const loaded = await econ.getBounty(tmpDir, b.id);
    assert.ok(loaded, 'bounty not persisted');
    assert.equal(loaded!.title, 'Write a poem');
  });

  // ── Bounty: list filter ────────────────────────────────
  await test('Bounty: listBounties filters by status', async () => {
    await econ.createBounty(tmpDir, 'Build a bridge', 'Detailed description', 200, 'alice');
    const open = await econ.listBounties(tmpDir, 'open');
    assert.ok(open.length >= 2, `expected >=2 open bounties, got ${open.length}`);
    const paid = await econ.listBounties(tmpDir, 'paid');
    assert.equal(paid.length, 0);
  });

  // ── Bounty: claim ──────────────────────────────────────
  await test('Bounty: claimBounty updates status to claimed', async () => {
    const bounties = await econ.listBounties(tmpDir, 'open');
    const b = bounties[0];
    const claim = await econ.claimBounty(tmpDir, b.id, 'bob', 'Here is my deliverable');
    assert.ok(claim, 'claim should succeed');
    assert.equal(claim!.claimedBy, 'bob');
    const updated = await econ.getBounty(tmpDir, b.id);
    assert.equal(updated!.status, 'claimed');
    assert.equal(updated!.claimedBy, 'bob');
  });

  // ── Bounty: double-claim blocked ──────────────────────
  await test('Bounty: double-claim returns null', async () => {
    const bounties = await econ.listBounties(tmpDir, 'claimed');
    const b = bounties[0];
    const claim2 = await econ.claimBounty(tmpDir, b.id, 'charlie', 'Late entry');
    assert.equal(claim2, null, 'double claim should be blocked');
  });

  // ── Bounty: pay ───────────────────────────────────────
  await test('Bounty: verifyAndPayBounty transfers from treasury', async () => {
    const bounties = await econ.listBounties(tmpDir, 'claimed');
    const b = bounties[0];
    assert.ok(b.claimedBy, 'need a claimer');
    const claimerDir = path.join(tmpDir, 'children', b.claimedBy!);
    const balBefore = await econ.getBalance(claimerDir);
    const result = await econ.verifyAndPayBounty(tmpDir, b.id, claimerDir, b.claimedBy!);
    assert.ok(result.ok, `pay failed: ${result.reason}`);
    const balAfter = await econ.getBalance(claimerDir);
    assert.equal(balAfter, balBefore + b.reward);
    const paid = await econ.getBounty(tmpDir, b.id);
    assert.equal(paid!.status, 'paid');
  });

  // ── Bounty: wrong claimer blocked ─────────────────────
  await test('Bounty: pay by wrong agent is rejected', async () => {
    const b = await econ.createBounty(tmpDir, 'Draw a map', 'Create a map', 50, 'alice');
    await econ.claimBounty(tmpDir, b.id, 'alice', 'Here is the map');
    const charlieDir = path.join(tmpDir, 'children', 'charlie');
    const result = await econ.verifyAndPayBounty(tmpDir, b.id, charlieDir, 'charlie');
    assert.ok(!result.ok, 'wrong agent should be rejected');
    assert.equal(result.reason, 'agent is not the claimer');
  });

  // ── Bounty: expiry ────────────────────────────────────
  await test('Bounty: expireBounties marks expired bounties', async () => {
    const past = new Date(Date.now() - 1000).toISOString();
    await econ.createBounty(tmpDir, 'Expired task', 'desc', 10, 'alice', past);
    const expired = await econ.expireBounties(tmpDir);
    assert.ok(expired >= 1, `expected >=1 expired, got ${expired}`);
    const openList = await econ.listBounties(tmpDir, 'open');
    assert.ok(!openList.some(b => b.title === 'Expired task'), 'expired bounty still open');
  });

  // ── Metrics: gini ─────────────────────────────────────
  await test('EconomicMetrics: gini=0 for equal distribution', async () => {
    const aliceDir = await setupAgent('eq1', 1000);
    const bobDir = await setupAgent('eq2', 1000);
    const agents = [
      { id: 'eq1', dir: aliceDir },
      { id: 'eq2', dir: bobDir },
    ];
    const m = await econ.getEconomicMetrics(tmpDir, agents);
    assert.equal(m.giniCoefficient, 0);
  });

  await test('EconomicMetrics: gini>0 for unequal distribution', async () => {
    const richDir = await setupAgent('rich', 9000);
    const poorDir = await setupAgent('poor', 100);
    const agents = [
      { id: 'rich', dir: richDir },
      { id: 'poor', dir: poorDir },
    ];
    const m = await econ.getEconomicMetrics(tmpDir, agents);
    assert.ok(m.giniCoefficient > 0, 'gini should be > 0 for unequal');
    assert.ok(m.giniCoefficient < 1, 'gini should be < 1');
  });

  // ── Metrics: circulation ratio ────────────────────────
  await test('EconomicMetrics: circulationRatio is valid (0-1)', async () => {
    const agents = [
      { id: 'alice', dir: path.join(tmpDir, 'children', 'alice') },
      { id: 'bob', dir: path.join(tmpDir, 'children', 'bob') },
    ];
    const m = await econ.getEconomicMetrics(tmpDir, agents);
    assert.ok(m.circulationRatio >= 0 && m.circulationRatio <= 1, 'circulationRatio out of range');
    assert.ok(m.totalSupply > 0, 'totalSupply should be > 0');
  });

  // ── Metrics: wealthConcentration ─────────────────────
  await test('EconomicMetrics: wealthConcentration=100 if one agent has all', async () => {
    const soloDir = await setupAgent('solo', 9999);
    const brokeDir = await setupAgent('broke', 0);
    const agents = [
      { id: 'solo', dir: soloDir },
      { id: 'broke', dir: brokeDir },
    ];
    const m = await econ.getEconomicMetrics(tmpDir, agents);
    assert.equal(m.wealthConcentration, 100);
  });

  // ── Metrics: inflationRate ────────────────────────────
  await test('EconomicMetrics: inflationRate tracks circulation change', async () => {
    const agents = [{ id: 'alice', dir: path.join(tmpDir, 'children', 'alice') }];
    const mBefore = await econ.getEconomicMetrics(tmpDir, agents);
    await econ.credit(path.join(tmpDir, 'children', 'alice'), 'alice', 500, 'test mint');
    const mAfter = await econ.getEconomicMetrics(tmpDir, agents, mBefore.totalSupply - (await econ.getTreasuryBalance(tmpDir)));
    assert.ok(mAfter.inflationRate > 0, 'should detect positive inflation');
  });

  await cleanup();

  console.log(`\n  Results: ${passed} passed, ${failed} failed\n`);
  if (failed > 0) process.exit(1);
}

main().catch(e => { console.error(e); process.exit(1); });
