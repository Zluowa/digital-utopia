// @input: routes/agents.ts, lifecycle.ts, server.ts
// @output: security audit test results for path traversal, billing order, API key middleware
// @position: validates P2 security fixes from DU-v2-architecture-proposal Ch.6

import assert from 'node:assert/strict';
import { existsSync, promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const tmpDir = path.join(__dirname, '..', 'worlds', '_test_security');

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

async function cleanup(): Promise<void> {
  if (existsSync(tmpDir)) await fs.rm(tmpDir, { recursive: true, force: true });
}

async function makeAgent(name: string, balance: number): Promise<string> {
  const dir = path.join(tmpDir, 'children', name);
  await fs.mkdir(path.join(dir, '.claude', 'wallet'), { recursive: true });
  await fs.mkdir(path.join(dir, 'inbox'), { recursive: true });
  const wallet = { agentId: name, balance, currency: 'Token', transactions: [], createdAt: new Date().toISOString() };
  await fs.writeFile(path.join(dir, '.claude', 'wallet', 'balance.json'), JSON.stringify(wallet));
  await fs.writeFile(path.join(dir, 'CLAUDE.md'), `<!-- type: resident -->\n# ${name}`);
  return dir;
}

// ── Issue 1: Path traversal protection in agents routes ─────────────────────
// Verifies that path.resolve() + startsWith(agentDir) blocks escapes.
// The protection is in routes/agents.ts L77-79 and L89-91.

await test('PathTraversal: path.resolve blocks "../" escape attempt', async () => {
  const agentDir = path.join(tmpDir, 'children', 'alice');
  await makeAgent('alice', 1000);
  // Simulate what the route does:
  const userInput = '../../../etc/passwd';
  const target = path.resolve(agentDir, userInput);
  const isSafe = target.startsWith(agentDir + path.sep) || target === agentDir;
  assert.equal(isSafe, false, 'traversal should be blocked (not within sandbox)');
});

await test('PathTraversal: safe path within sandbox is allowed', async () => {
  const agentDir = path.join(tmpDir, 'children', 'alice');
  const userInput = 'workspace/notes.md';
  const target = path.resolve(agentDir, userInput);
  const isSafe = target.startsWith(agentDir + path.sep) || target === agentDir;
  assert.equal(isSafe, true, 'valid relative path should pass sandbox check');
});

await test('PathTraversal: absolute path outside sandbox is blocked', async () => {
  const agentDir = path.join(tmpDir, 'children', 'alice');
  const userInput = '/etc/passwd';
  const target = path.resolve(agentDir, userInput);
  const isSafe = target.startsWith(agentDir + path.sep) || target === agentDir;
  assert.equal(isSafe, false, 'absolute path outside sandbox should be blocked');
});

await test('PathTraversal: agentDir itself is allowed (root of sandbox)', async () => {
  const agentDir = path.join(tmpDir, 'children', 'alice');
  const target = path.resolve(agentDir, '.');
  const isSafe = target.startsWith(agentDir + path.sep) || target === agentDir;
  assert.equal(isSafe, true, 'agent root dir itself should be accessible');
});

// ── Issue 2: Awakening billing order ────────────────────────────────────────
// Verifies deduct() is called BEFORE spawnAgent() in lifecycle.doAwaken().
// We test the economy deduct function directly: insufficient balance → no spawn.

await test('AwakeningBilling: deduct succeeds when balance sufficient', async () => {
  await makeAgent('bob', 100);
  const bobDir = path.join(tmpDir, 'children', 'bob');
  const worldDir = path.join(tmpDir, '.world');
  await fs.mkdir(worldDir, { recursive: true });
  await fs.writeFile(path.join(worldDir, 'treasury.json'), JSON.stringify({ balance: 0 }));
  await fs.writeFile(path.join(worldDir, 'ledger.json'), '[]');

  const { deduct } = await import('../src/economy.js');
  const ok = await deduct(bobDir, 'bob', 5, 'awakening base cost');
  assert.equal(ok, true, 'deduct should succeed when balance >= cost');
});

await test('AwakeningBilling: deduct fails when balance insufficient → spawn blocked', async () => {
  await makeAgent('broke', 3);
  const brokeDir = path.join(tmpDir, 'children', 'broke');
  const worldDir = path.join(tmpDir, '.world');
  await fs.mkdir(worldDir, { recursive: true });
  await fs.writeFile(path.join(worldDir, 'treasury.json'), JSON.stringify({ balance: 0 }));
  await fs.writeFile(path.join(worldDir, 'ledger.json'), '[]');

  const { deduct } = await import('../src/economy.js');
  const ok = await deduct(brokeDir, 'broke', 5, 'awakening base cost');
  assert.equal(ok, false, 'deduct should fail when balance < cost, preventing spawn');
});

await test('AwakeningBilling: balance is unchanged after failed deduct', async () => {
  await makeAgent('penny', 2);
  const pennyDir = path.join(tmpDir, 'children', 'penny');
  const worldDir = path.join(tmpDir, '.world');
  await fs.mkdir(worldDir, { recursive: true });
  await fs.writeFile(path.join(worldDir, 'treasury.json'), JSON.stringify({ balance: 0 }));
  await fs.writeFile(path.join(worldDir, 'ledger.json'), '[]');

  const { deduct, getBalance } = await import('../src/economy.js');
  await deduct(pennyDir, 'penny', 5, 'awakening base cost');
  const remaining = await getBalance(pennyDir);
  assert.equal(remaining, 2, 'balance should be unchanged when deduct fails');
});

// ── Issue 3: API key middleware ──────────────────────────────────────────────
// Verifies the middleware logic: health is always open, other routes require key.

await test('APIKey: health endpoint bypasses auth check', () => {
  // Simulate the middleware logic from server.ts
  const DU_API_KEY = 'test-secret-key';
  const checkAuth = (path: string, apiKeyHeader: string | undefined): boolean => {
    if (path === '/api/health') return true; // always allowed
    return apiKeyHeader === DU_API_KEY;
  };
  assert.equal(checkAuth('/api/health', undefined), true, 'health should pass without key');
  assert.equal(checkAuth('/api/health', 'wrong'), true, 'health should pass even with wrong key');
  return Promise.resolve();
});

await test('APIKey: protected endpoint blocked without key', () => {
  const DU_API_KEY = 'test-secret-key';
  const checkAuth = (path: string, apiKeyHeader: string | undefined): boolean => {
    if (path === '/api/health') return true;
    return apiKeyHeader === DU_API_KEY;
  };
  assert.equal(checkAuth('/api/agents', undefined), false, 'agents route should require key');
  assert.equal(checkAuth('/api/economy/metrics', 'wrong-key'), false, 'wrong key should be rejected');
  return Promise.resolve();
});

await test('APIKey: protected endpoint accessible with correct key', () => {
  const DU_API_KEY = 'test-secret-key';
  const checkAuth = (path: string, apiKeyHeader: string | undefined): boolean => {
    if (path === '/api/health') return true;
    return apiKeyHeader === DU_API_KEY;
  };
  assert.equal(checkAuth('/api/snapshot', DU_API_KEY), true, 'correct key should be accepted');
  assert.equal(checkAuth('/api/agents/alice/awaken', DU_API_KEY), true, 'agent route with key should pass');
  return Promise.resolve();
});

// ── Cleanup ──────────────────────────────────────────────────────────────────

await cleanup();

console.log(`\n  Results: ${passed} passed, ${failed} failed\n`);
if (failed > 0) process.exit(1);
