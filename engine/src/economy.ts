// @input: Agent钱包文件(balance.json)、物理规则(physics.json)
// @output: Token增减、交易记录、经济摘要
// @position: 引擎核心，等同于"能量守恒"

import { randomUUID } from 'crypto';
import { existsSync, promises as fs } from 'fs';
import path from 'path';
import type { Transaction, WalletData, EconomySummary, PhysicsConfig } from './types.js';

// ── Economic health result ─────────────────────────────────

export type EconomicStatus = 'healthy' | 'starving' | 'dead';

export interface EconomicHealth {
  status: EconomicStatus;
  balance: number;
  criticalThreshold: number;
  deathThreshold: number;
}

// ── File-lock helpers ──────────────────────────────────────

const LOCK_TIMEOUT_MS = 5000;
const LOCK_RETRY_MS = 20;

export async function acquireLock(lockPath: string): Promise<void> {
  const deadline = Date.now() + LOCK_TIMEOUT_MS;
  while (Date.now() < deadline) {
    try {
      const fh = await fs.open(lockPath, 'wx');
      await fh.close();
      return;
    } catch {
      await new Promise(r => setTimeout(r, LOCK_RETRY_MS));
    }
  }
  // Stale lock: remove and retry once
  await fs.unlink(lockPath).catch(() => undefined);
  const fh = await fs.open(lockPath, 'wx');
  await fh.close();
}

export async function releaseLock(lockPath: string): Promise<void> {
  await fs.unlink(lockPath).catch(() => undefined);
}

async function withLock<T>(lockPath: string, fn: () => Promise<T>): Promise<T> {
  await acquireLock(lockPath);
  try { return await fn(); }
  finally { await releaseLock(lockPath); }
}

// ── Wallet I/O ─────────────────────────────────────────────

function walletPath(agentDir: string): string {
  return path.join(agentDir, '.claude', 'wallet', 'balance.json');
}

async function readWallet(agentDir: string): Promise<WalletData> {
  return JSON.parse(await fs.readFile(walletPath(agentDir), 'utf-8'));
}

async function atomicWriteWallet(agentDir: string, data: WalletData): Promise<void> {
  const p = walletPath(agentDir);
  await fs.mkdir(path.dirname(p), { recursive: true });
  const tmp = `${p}.tmp`;
  await fs.writeFile(tmp, JSON.stringify(data, null, 2));
  await rename(tmp, p);
}

async function rename(src: string, dst: string): Promise<void> {
  for (let i = 0; i < 3; i++) {
    try { await fs.rename(src, dst); return; }
    catch { if (i === 2) throw new Error(`rename failed: ${src} → ${dst}`); }
    await new Promise(r => setTimeout(r, 50));
  }
}

// ── Transaction helpers ────────────────────────────────────

function makeTx(
  from: string,
  to: string,
  amount: number,
  reason: string,
  type: Transaction['type'],
  metadata?: Record<string, unknown>,
): Transaction {
  const base: Transaction = {
    id: randomUUID(), from, to, amount, reason,
    timestamp: new Date().toISOString(), type,
  };
  if (metadata) base.metadata = metadata;
  return base;
}

// ── Claude-equivalent pricing ────────────────────────────

const CLAUDE_OPUS_PRICING = {
  inputPerMTok: 15,
  outputPerMTok: 75,
  cacheReadPerMTok: 1.875,
  cacheCreatePerMTok: 18.75,
};

export interface SessionUsage {
  input_tokens: number;
  output_tokens: number;
  cache_read_input_tokens?: number;
  cache_creation_input_tokens?: number;
}

export function calculateClaudeCost(usage: SessionUsage): number {
  const i = (usage.input_tokens / 1e6) * CLAUDE_OPUS_PRICING.inputPerMTok;
  const o = (usage.output_tokens / 1e6) * CLAUDE_OPUS_PRICING.outputPerMTok;
  const cr = ((usage.cache_read_input_tokens ?? 0) / 1e6) * CLAUDE_OPUS_PRICING.cacheReadPerMTok;
  const cc = ((usage.cache_creation_input_tokens ?? 0) / 1e6) * CLAUDE_OPUS_PRICING.cacheCreatePerMTok;
  return Math.round((i + o + cr + cc) * 100) / 100;
}

// ── Public wallet API ──────────────────────────────────────

export async function getBalance(agentDir: string): Promise<number> {
  return (await readWallet(agentDir)).balance;
}

export async function deduct(
  agentDir: string,
  agentId: string,
  amount: number,
  reason: string,
  metadata?: Record<string, unknown>,
): Promise<boolean> {
  const lock = `${walletPath(agentDir)}.lock`;
  return withLock(lock, async () => {
    const w = await readWallet(agentDir);
    if (w.balance < amount) return false;
    w.balance -= amount;
    w.transactions = [makeTx(agentId, 'system', amount, reason, 'deduct', metadata), ...w.transactions].slice(0, 200);
    await atomicWriteWallet(agentDir, w);
    return true;
  });
}

export async function credit(
  agentDir: string,
  agentId: string,
  amount: number,
  source: string,
  metadata?: Record<string, unknown>,
  txType: Transaction['type'] = 'credit',
): Promise<void> {
  const lock = `${walletPath(agentDir)}.lock`;
  await withLock(lock, async () => {
    const w = await readWallet(agentDir);
    w.balance += amount;
    w.transactions = [makeTx('system', agentId, amount, source, txType, metadata), ...w.transactions].slice(0, 200);
    await atomicWriteWallet(agentDir, w);
  });
}

// ── Transfer with WAL ──────────────────────────────────────

/**
 * Generic wallet-file-path transfer. Supports agent→agent, agent→treasury, treasury→agent, etc.
 * WAL: write .pending intent file before deducting; delete after crediting.
 * On engine restart, stale .pending files signal incomplete transfers for recovery.
 */
export async function transferByPath(
  fromWalletFile: string,
  toWalletFile: string,
  fromId: string,
  toId: string,
  amount: number,
  reason: string,
): Promise<boolean> {
  const walPath = `${fromWalletFile}.pending`;
  const intent = JSON.stringify({ fromId, toWalletFile, toId, amount, reason, ts: new Date().toISOString() });
  await fs.mkdir(path.dirname(walPath), { recursive: true });
  await fs.writeFile(walPath, intent);

  const fromDir = path.dirname(path.dirname(path.dirname(fromWalletFile))); // balance.json → .claude/wallet → .claude → agentDir
  const toDir = path.dirname(path.dirname(path.dirname(toWalletFile)));

  const ok = await deduct(fromDir, fromId, amount, `transfer to ${toId}: ${reason}`);
  if (!ok) { await fs.unlink(walPath).catch(() => undefined); return false; }

  await credit(toDir, toId, amount, `transfer from ${fromId}: ${reason}`);
  await fs.unlink(walPath).catch(() => undefined);
  return true;
}

/**
 * Agent-dir–based transfer. Preserves backwards-compatible 6-arg signature.
 */
export async function transfer(
  fromDir: string, fromId: string,
  toDir: string, toId: string,
  amount: number, reason: string,
): Promise<boolean> {
  return transferByPath(walletPath(fromDir), walletPath(toDir), fromId, toId, amount, reason);
}

export async function deductUpTo(
  agentDir: string,
  agentId: string,
  amount: number,
  reason: string,
): Promise<{ deducted: number; remaining: number }> {
  const lock = `${walletPath(agentDir)}.lock`;
  return withLock(lock, async () => {
    const w = await readWallet(agentDir);
    const actual = Math.min(w.balance, amount);
    if (actual > 0) {
      w.balance -= actual;
      w.transactions = [makeTx(agentId, 'system', actual, reason, 'deduct'), ...w.transactions].slice(0, 200);
      await atomicWriteWallet(agentDir, w);
    }
    return { deducted: actual, remaining: w.balance };
  });
}

// ── Treasury ───────────────────────────────────────────────

function treasuryPath(worldDir: string): string {
  return path.join(worldDir, '.world', 'treasury.json');
}

export async function creditTreasury(worldDir: string, amount: number, reason: string, txType: Transaction['type'] = 'tax'): Promise<void> {
  const tp = treasuryPath(worldDir);
  const lock = `${tp}.lock`;
  await withLock(lock, async () => {
    let data = { balance: 0 };
    if (existsSync(tp)) data = JSON.parse(await fs.readFile(tp, 'utf-8'));
    data.balance += amount;
    const tmp = `${tp}.tmp`;
    await fs.mkdir(path.dirname(tp), { recursive: true });
    await fs.writeFile(tmp, JSON.stringify(data, null, 2));
    await rename(tmp, tp);
  });
  const lp = path.join(worldDir, '.world', 'ledger.json');
  await appendLedger(lp, makeTx('agent', 'treasury', amount, reason, txType));
}

export async function appendLedger(ledgerPath: string, tx: Transaction): Promise<void> {
  let ledger: Transaction[] = [];
  if (existsSync(ledgerPath)) ledger = JSON.parse(await fs.readFile(ledgerPath, 'utf-8'));
  ledger.unshift(tx);
  if (ledger.length > 1000) ledger = ledger.slice(0, 1000);
  await fs.writeFile(ledgerPath, JSON.stringify(ledger, null, 2));
}

// ── Physics & Economy summary ──────────────────────────────

export async function resolvePhysics(agentDir: string, worldDir: string): Promise<PhysicsConfig | null> {
  const worldCfgPath = path.join(worldDir, '.world', 'config.json');
  if (!existsSync(worldCfgPath)) return null;
  const worldCfg = JSON.parse(await fs.readFile(worldCfgPath, 'utf-8'));
  let physics: PhysicsConfig = worldCfg.physics;
  const localPhysics = path.join(agentDir, 'physics.json');
  if (!existsSync(localPhysics)) return physics;
  const local = JSON.parse(await fs.readFile(localPhysics, 'utf-8'));
  return {
    economy: { ...physics.economy, ...local.economy },
    awakening: { ...physics.awakening, ...local.awakening },
  };
}

export async function getEconomySummary(worldDir: string, agentDirs: { id: string; dir: string }[]): Promise<EconomySummary> {
  const dist: EconomySummary['distribution'] = [];
  let circ = 0;
  for (const { id, dir } of agentDirs) { const b = existsSync(walletPath(dir)) ? await getBalance(dir) : 0; circ += b; dist.push({ id, balance: b, pct: 0 }); }
  for (const d of dist) d.pct = circ > 0 ? Math.round((d.balance / circ) * 1000) / 10 : 0;
  dist.sort((a, b) => b.balance - a.balance);
  const tp = treasuryPath(worldDir), lp = path.join(worldDir, '.world', 'ledger.json');
  return { treasuryBalance: existsSync(tp) ? (JSON.parse(await fs.readFile(tp, 'utf-8')).balance ?? 0) : 0, circulation: circ, transactionCount: existsSync(lp) ? (JSON.parse(await fs.readFile(lp, 'utf-8')) as Transaction[]).length : 0, distribution: dist };
}

export async function transferWithTax(
  fromDir: string, fromId: string,
  toDir: string, toId: string,
  amount: number, reason: string,
  worldDir: string, taxRate: number,
): Promise<boolean> {
  const tax = Math.floor(amount * taxRate);
  const net = amount - tax;
  const ok = await deduct(fromDir, fromId, amount, `trade to ${toId}: ${reason} (tax=${tax})`);
  if (!ok) return false;
  await credit(toDir, toId, net, `trade from ${fromId}: ${reason}`);
  if (tax > 0) await creditTreasury(worldDir, tax, `tax on ${fromId}→${toId}`);
  return true;
}

export async function getTransactions(worldDir: string, limit = 50): Promise<Transaction[]> {
  const ledgerPath = path.join(worldDir, '.world', 'ledger.json');
  if (!existsSync(ledgerPath)) return [];
  return (JSON.parse(await fs.readFile(ledgerPath, 'utf-8')) as Transaction[]).slice(0, limit);
}

export async function treasuryPay(
  worldDir: string,
  agentId: string,
  agentDir: string,
  amount: number,
  reason: string,
): Promise<boolean> {
  const tp = treasuryPath(worldDir);
  const lock = `${tp}.lock`;
  const paid = await withLock(lock, async () => {
    let treasury = { balance: 0 };
    if (existsSync(tp)) treasury = JSON.parse(await fs.readFile(tp, 'utf-8'));
    if (treasury.balance < amount) return false;
    treasury.balance -= amount;
    const tmp = `${tp}.tmp`;
    await fs.writeFile(tmp, JSON.stringify(treasury, null, 2));
    await rename(tmp, tp);
    return true;
  });
  if (!paid) return false;
  await credit(agentDir, agentId, amount, reason);
  const lp = path.join(worldDir, '.world', 'ledger.json');
  await appendLedger(lp, makeTx('treasury', agentId, amount, reason, 'bounty'));
  return true;
}

export async function getTreasuryBalance(worldDir: string): Promise<number> {
  const tp = treasuryPath(worldDir);
  if (!existsSync(tp)) return 0;
  return (JSON.parse(await fs.readFile(tp, 'utf-8')) as { balance: number }).balance;
}

// ── Daily survival cost (proposal L97-109, L497-500) ─────

export interface SurvivalDeductResult {
  agentId: string;
  deducted: number;
  remaining: number;
  dead: boolean;
}

export async function deductSurvivalCosts(
  agentDirs: { id: string; dir: string }[],
  costPerAgent: number,
  worldDir: string,
): Promise<SurvivalDeductResult[]> {
  if (costPerAgent <= 0) return [];
  const results: SurvivalDeductResult[] = [];
  for (const { id, dir } of agentDirs) {
    const { deducted, remaining } = await deductUpTo(dir, id, costPerAgent, 'daily survival cost');
    if (deducted > 0) await creditTreasury(worldDir, deducted, `survival:${id}`);
    results.push({ agentId: id, deducted, remaining, dead: remaining <= 0 });
  }
  return results;
}

// ── Economic health ────────────────────────────────────────

export async function checkEconomicHealth(agentDir: string, worldDir: string): Promise<EconomicHealth> {
  const physics = await resolvePhysics(agentDir, worldDir);
  const criticalThreshold = physics?.economy.criticalThreshold ?? 500;
  const deathThreshold = physics?.economy.deathThreshold ?? 0;
  const balance = existsSync(walletPath(agentDir)) ? await getBalance(agentDir) : 0;
  const status: EconomicStatus =
    balance <= deathThreshold ? 'dead' :
    balance < criticalThreshold ? 'starving' :
    'healthy';
  return { status, balance, criticalThreshold, deathThreshold };
}

// ── External revenue → Token minting ─────────────────────

export interface DepositResult {
  agentId: string;
  depositUsd: number;
  tokensToAgent: number;
  tokensToTreasury: number;
  totalMinted: number;
  newBalance: number;
}

/**
 * Mint new tokens from external revenue.
 * Agent earns real money (Stripe/Alipay) → deposits here → gets tokens.
 * Treasury takes treasurySharePct% as minting tax.
 */
export async function mintDeposit(
  worldDir: string,
  agentId: string,
  agentDir: string,
  depositUsd: number,
  tokenPerDollar: number,
  treasurySharePct: number,
  reason: string,
): Promise<DepositResult> {
  const totalMinted = Math.floor(depositUsd * tokenPerDollar);
  const toTreasury = Math.floor(totalMinted * treasurySharePct / 100);
  const toAgent = totalMinted - toTreasury;

  await credit(agentDir, agentId, toAgent, reason, { depositUsd, totalMinted }, 'deposit');
  if (toTreasury > 0) await creditTreasury(worldDir, toTreasury, `mint-tax:${agentId}`, 'mint');

  const lp = path.join(worldDir, '.world', 'ledger.json');
  await appendLedger(lp, makeTx('external', agentId, totalMinted, reason, 'deposit', { depositUsd, toAgent, toTreasury }));

  const newBalance = await getBalance(agentDir);
  return { agentId, depositUsd, tokensToAgent: toAgent, tokensToTreasury: toTreasury, totalMinted, newBalance };
}

// ── Economic metrics & flow — moved to snapshot.ts (proposal L493) ──
