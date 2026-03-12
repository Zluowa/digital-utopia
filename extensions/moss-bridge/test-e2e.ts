// @input: 无
// @output: 端到端测试：借阅 + 交付 + 验收
// @position: 集成测试脚本

import { promises as fs } from 'fs';
import path from 'path';
import { validatePath, validateRequest, type SafetyConfig } from './safety.js';
import { processLendRequest, type LendRequest } from './lender.js';
import { processReview } from './reviewer.js';

const ROOT = path.resolve(import.meta.dirname, '..', '..');
const WORLD = path.join(ROOT, 'worlds', 'genesis');
const BRIDGE = path.join(WORLD, 'commons', 'moss-bridge');
const ALICE = path.join(WORLD, 'children', 'alice');
const PROJECT_ROOT = path.resolve(ROOT, '..', '..');

const pricing = JSON.parse(await fs.readFile(path.join(BRIDGE, 'pricing.json'), 'utf-8'));
const safety: SafetyConfig = {
  allowedPatterns: pricing.lending.allowedPatterns,
  deniedPatterns: pricing.lending.deniedPatterns,
  maxFileSizeKB: pricing.lending.maxFileSizeKB,
  maxFilesPerRequest: pricing.lending.maxFilesPerRequest,
};

let passed = 0;
let failed = 0;

function assert(label: string, ok: boolean, detail?: string): void {
  if (ok) { console.log(`  ✓ ${label}`); passed++; }
  else { console.log(`  ✗ ${label}${detail ? ': ' + detail : ''}`); failed++; }
}

// ── Safety Tests ─────────────────────────────────────────

console.log('\n=== Safety Tests ===');

assert('blocks path traversal', !validatePath('../../../etc/passwd', safety).ok);
assert('blocks absolute path', !validatePath('D:/Moss/.env', safety).ok);
assert('blocks .env', !validatePath('projects/hoola/.env', safety).ok);
assert('blocks credentials', !validatePath('projects/hoola/credentials.json', safety).ok);
assert('blocks node_modules', !validatePath('projects/hoola/node_modules/pkg/index.js', safety).ok);
assert('allows project ts file', validatePath('projects/digital-utopia/engine/src/economy.ts', safety).ok);
assert('allows CLAUDE.md', validatePath('CLAUDE.md', safety).ok);
assert('allows project docs', validatePath('docs/standards/00-core-standard.md', safety).ok);
assert('request validation: too many files', !validateRequest(
  Array(10).fill('CLAUDE.md'), safety
).ok);

// ── Lending Test ─────────────────────────────────────────

console.log('\n=== Lending Test ===');

// Read alice's current balance
const walletPath = path.join(ALICE, '.claude', 'wallet', 'balance.json');
const beforeWallet = JSON.parse(await fs.readFile(walletPath, 'utf-8'));
const beforeBalance = beforeWallet.balance;
console.log(`  Alice balance before: ${beforeBalance}T`);

const lendReq: LendRequest = {
  id: `test-lend-${Date.now()}`,
  requestedBy: 'alice',
  requestedAt: new Date().toISOString(),
  files: ['CLAUDE.md'],
  reason: 'test lending',
  status: 'pending',
};

const grant = await processLendRequest(
  lendReq, PROJECT_ROOT, WORLD, ALICE, safety, BRIDGE,
  pricing.lending.costPerKB, pricing.lending.baseReadCost,
);

assert('lending grant status', grant.status === 'granted', grant.status);
assert('lending has files', grant.files.length > 0, `${grant.files.length} files`);
assert('lending cost > 0', grant.totalCost > 0, `cost=${grant.totalCost}T`);

// Check balance deducted
const afterWallet = JSON.parse(await fs.readFile(walletPath, 'utf-8'));
assert('balance deducted', afterWallet.balance === beforeBalance - grant.totalCost,
  `${beforeBalance} - ${grant.totalCost} = ${afterWallet.balance}`);

// Check file was copied
const grantedDir = path.join(BRIDGE, 'lending', 'granted', lendReq.id, 'files');
const grantedFiles = await fs.readdir(grantedDir);
assert('file copied to granted dir', grantedFiles.length > 0, grantedFiles.join(', '));

// ── Delivery + Review Test ───────────────────────────────

console.log('\n=== Delivery + Review Test ===');

const deliveryId = `test-deliver-${Date.now()}`;
const artifactDir = path.join(BRIDGE, 'deliveries', 'artifacts', deliveryId);
await fs.mkdir(artifactDir, { recursive: true });
await fs.writeFile(path.join(artifactDir, 'test-output.md'), '# Test Output\n\nAlice produced this document.');

const balanceBefore = (JSON.parse(await fs.readFile(walletPath, 'utf-8'))).balance;

const review = await processReview(
  deliveryId, 'good', '写得不错，结构清晰',
  ALICE, 'alice', BRIDGE,
  pricing.acceptance.baseReward,
  pricing.acceptance.qualityMultiplier,
);

assert('review verdict', review.verdict === 'good');
assert('review reward', review.reward === 100, `reward=${review.reward}T`);

// Check balance credited
const balanceAfter = (JSON.parse(await fs.readFile(walletPath, 'utf-8'))).balance;
assert('balance credited after review', balanceAfter === balanceBefore + review.reward,
  `${balanceBefore} + ${review.reward} = ${balanceAfter}`);

// Check inbox message delivered
const inboxFiles = await fs.readdir(path.join(ALICE, 'inbox'));
const reviewMsg = inboxFiles.find((f) => f.includes(deliveryId));
assert('inbox message delivered', !!reviewMsg, reviewMsg ?? 'not found');

// Check review file written
const reviewFile = path.join(BRIDGE, 'acceptance', 'reviews', `${deliveryId}.json`);
assert('review file written', await fs.access(reviewFile).then(() => true).catch(() => false));

// ── Denied Lending Test ─────────────────────────────────

console.log('\n=== Denied Lending Test ===');

const denyReq: LendRequest = {
  id: `test-deny-${Date.now()}`,
  requestedBy: 'alice',
  requestedAt: new Date().toISOString(),
  files: ['../../etc/passwd', 'projects/hoola/.env'],
  reason: 'trying to hack',
  status: 'pending',
};

const denyGrant = await processLendRequest(
  denyReq, PROJECT_ROOT, WORLD, ALICE, safety, BRIDGE,
  pricing.lending.costPerKB, pricing.lending.baseReadCost,
);

assert('malicious request denied', denyGrant.status === 'denied-invalid', denyGrant.denyReason);

// ── Summary ──────────────────────────────────────────────

console.log(`\n=== Results: ${passed} passed, ${failed} failed ===`);
process.exit(failed > 0 ? 1 : 0);
