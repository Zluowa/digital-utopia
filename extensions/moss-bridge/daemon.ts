// @input: 世界目录 + 项目根目录
// @output: 持续轮询，处理借阅请求和交付提交
// @position: MOSS Bridge入口，独立于引擎运行

import { existsSync, promises as fs } from 'fs';
import path from 'path';
import { processLendRequest, type LendRequest } from './lender.js';
import { deduct } from '../../engine/src/economy.js';
import type { SafetyConfig } from './safety.js';

const POLL_MS = 5000;

interface PricingConfig {
  lending: { baseReadCost: number; costPerKB: number; maxFileSizeKB: number; maxFilesPerRequest: number; allowedPatterns: string[]; deniedPatterns: string[] };
  delivery: { submissionCost: number };
  acceptance: { baseReward: number; qualityMultiplier: Record<string, number> };
}

async function loadPricing(bridgeDir: string): Promise<PricingConfig> {
  return JSON.parse(await fs.readFile(path.join(bridgeDir, 'pricing.json'), 'utf-8'));
}

function safetyFromPricing(p: PricingConfig): SafetyConfig {
  return {
    allowedPatterns: p.lending.allowedPatterns,
    deniedPatterns: p.lending.deniedPatterns,
    maxFileSizeKB: p.lending.maxFileSizeKB,
    maxFilesPerRequest: p.lending.maxFilesPerRequest,
  };
}

async function scanRequests(requestsDir: string): Promise<LendRequest[]> {
  if (!existsSync(requestsDir)) return [];
  const files = await fs.readdir(requestsDir);
  const requests: LendRequest[] = [];
  for (const f of files.filter((n) => n.endsWith('.json'))) {
    try {
      const req = JSON.parse(await fs.readFile(path.join(requestsDir, f), 'utf-8')) as LendRequest;
      if (req.status === 'pending') requests.push(req);
    } catch { /* skip malformed */ }
  }
  return requests;
}

async function scanSubmissions(submissionsDir: string): Promise<string[]> {
  if (!existsSync(submissionsDir)) return [];
  const files = await fs.readdir(submissionsDir);
  const pending: string[] = [];
  for (const f of files.filter((n) => n.endsWith('.json'))) {
    try {
      const sub = JSON.parse(await fs.readFile(path.join(submissionsDir, f), 'utf-8'));
      if (sub.status === 'pending-review') pending.push(f);
    } catch { /* skip */ }
  }
  return pending;
}

function resolveAgentDir(worldDir: string, agentId: string): string | null {
  const dir = path.join(worldDir, 'children', agentId);
  return existsSync(dir) ? dir : null;
}

async function tick(projectRoot: string, worldDir: string, bridgeDir: string): Promise<void> {
  const pricing = await loadPricing(bridgeDir);
  const safety = safetyFromPricing(pricing);

  // Process lending requests
  const requests = await scanRequests(path.join(bridgeDir, 'lending', 'requests'));
  for (const req of requests) {
    const agentDir = resolveAgentDir(worldDir, req.requestedBy);
    if (!agentDir) {
      console.log(`[bridge] unknown agent: ${req.requestedBy}`);
      continue;
    }

    console.log(`[bridge] lending: ${req.id} from ${req.requestedBy} (${req.files.length} files)`);
    const grant = await processLendRequest(
      req, projectRoot, worldDir, agentDir, safety, bridgeDir,
      pricing.lending.costPerKB, pricing.lending.baseReadCost,
    );

    // Update request status
    const reqFile = path.join(bridgeDir, 'lending', 'requests', `${req.id}.json`);
    req.status = grant.status === 'granted' ? 'granted' : 'denied';
    await fs.writeFile(reqFile, JSON.stringify(req, null, 2));
    console.log(`[bridge] lending ${req.id}: ${grant.status} (cost=${grant.totalCost}T)`);
  }

  // Process delivery submissions (deduct submission cost)
  const submissions = await scanSubmissions(path.join(bridgeDir, 'deliveries', 'submissions'));
  for (const f of submissions) {
    const subPath = path.join(bridgeDir, 'deliveries', 'submissions', f);
    const sub = JSON.parse(await fs.readFile(subPath, 'utf-8'));
    const agentDir = resolveAgentDir(worldDir, sub.submittedBy);
    if (!agentDir) continue;

    const paid = await deduct(agentDir, sub.submittedBy, pricing.delivery.submissionCost, `delivery-submission: ${sub.id}`);
    if (paid) {
      sub.status = 'awaiting-review';
      console.log(`[bridge] delivery ${sub.id} from ${sub.submittedBy}: submission fee charged`);
    } else {
      sub.status = 'denied-insufficient-funds';
      console.log(`[bridge] delivery ${sub.id}: insufficient funds`);
    }
    await fs.writeFile(subPath, JSON.stringify(sub, null, 2));
  }
}

// ── Main ──────────────────────────────────────────────────

const worldName = process.argv[2] ?? 'genesis';
const engineRoot = path.resolve(import.meta.dirname, '..', '..');
const projectRoot = path.resolve(engineRoot, '..', '..');
const worldDir = path.join(engineRoot, 'worlds', worldName);
const bridgeDir = path.join(worldDir, 'commons', 'moss-bridge');

console.log(`[bridge] MOSS Bridge daemon starting`);
console.log(`[bridge] world: ${worldDir}`);
console.log(`[bridge] project root: ${projectRoot}`);
console.log(`[bridge] polling every ${POLL_MS}ms`);

async function loop(): Promise<void> {
  while (true) {
    try { await tick(projectRoot, worldDir, bridgeDir); }
    catch (e) { console.error(`[bridge] tick error:`, e); }
    await new Promise((r) => setTimeout(r, POLL_MS));
  }
}

loop();
