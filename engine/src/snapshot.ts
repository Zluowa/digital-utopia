// @input: Agent钱包余额、世界账本、国库
// @output: 经济指标快照（Gini、流速、通胀、财富集中度）
// @position: 引擎观测层，metric计算从economy.ts分离

import { existsSync, promises as fs } from 'fs';
import path from 'path';
import { getBalance, getTreasuryBalance } from './economy.js';
import type { Transaction, EconomicMetrics } from './types.js';

// ── Local path helpers ─────────────────────────────────────

function walletPath(agentDir: string): string {
  return path.join(agentDir, '.claude', 'wallet', 'balance.json');
}

function treasuryPath(worldDir: string): string {
  return path.join(worldDir, '.world', 'treasury.json');
}

// ── Pure metric functions ──────────────────────────────────

export function giniCoefficient(balances: number[]): number {
  if (balances.length === 0) return 0;
  const sorted = [...balances].sort((a, b) => a - b);
  const n = sorted.length;
  const total = sorted.reduce((s, v) => s + v, 0);
  if (total === 0) return 0;
  const numerator = sorted.reduce((sum, val, i) => sum + (2 * (i + 1) - n - 1) * val, 0);
  return Math.round((numerator / (n * total)) * 1000) / 1000;
}

export function velocityIndex(txCount: number, agentCount: number): number {
  if (agentCount === 0) return 0;
  return Math.round((txCount / agentCount) * 100) / 100;
}

export function wealthConcentration(balances: number[]): number {
  if (balances.length === 0) return 0;
  const sorted = [...balances].sort((a, b) => b - a);
  const top20Count = Math.max(1, Math.ceil(sorted.length * 0.2));
  const top20Sum = sorted.slice(0, top20Count).reduce((s, v) => s + v, 0);
  const total = sorted.reduce((s, v) => s + v, 0);
  if (total === 0) return 0;
  return Math.round((top20Sum / total) * 1000) / 10;
}

// ── Flow types ────────────────────────────────────────────

export interface FlowNode { id: string; balance: number; type: 'agent' | 'treasury' }
export interface FlowEdge { from: string; to: string; totalAmount: number; txCount: number }

// ── Snapshot queries ──────────────────────────────────────

export async function getTransactionHistory(
  worldDir: string,
  agentId: string,
  limit = 50,
  agentDir?: string,
): Promise<Transaction[]> {
  if (agentDir) {
    const wp = walletPath(agentDir);
    if (existsSync(wp)) {
      const w = JSON.parse(await fs.readFile(wp, 'utf-8'));
      return (w.transactions ?? []).slice(0, limit);
    }
  }
  const ledgerPath = path.join(worldDir, '.world', 'ledger.json');
  if (!existsSync(ledgerPath)) return [];
  const all = JSON.parse(await fs.readFile(ledgerPath, 'utf-8')) as Transaction[];
  return all.filter(tx => tx.from === agentId || tx.to === agentId).slice(0, limit);
}

export async function getEconomyFlow(
  worldDir: string,
  agentDirs: { id: string; dir: string }[],
): Promise<{ nodes: FlowNode[]; edges: FlowEdge[] }> {
  const nodes: FlowNode[] = [];
  for (const { id, dir } of agentDirs) {
    nodes.push({ id, balance: existsSync(walletPath(dir)) ? await getBalance(dir) : 0, type: 'agent' });
  }
  const tp = treasuryPath(worldDir);
  const treasuryBalance = existsSync(tp) ? (JSON.parse(await fs.readFile(tp, 'utf-8')).balance ?? 0) : 0;
  nodes.push({ id: 'treasury', balance: treasuryBalance, type: 'treasury' });

  const lp = path.join(worldDir, '.world', 'ledger.json');
  const txs: Transaction[] = existsSync(lp) ? JSON.parse(await fs.readFile(lp, 'utf-8')) : [];
  const edgeMap = new Map<string, FlowEdge>();
  for (const tx of txs) {
    const key = `${tx.from}→${tx.to}`;
    const e = edgeMap.get(key) ?? { from: tx.from, to: tx.to, totalAmount: 0, txCount: 0 };
    e.totalAmount += tx.amount;
    e.txCount++;
    edgeMap.set(key, e);
  }
  return { nodes, edges: [...edgeMap.values()] };
}

export async function getEconomicMetrics(
  worldDir: string,
  agentDirs: { id: string; dir: string }[],
  prevCirculation?: number,
): Promise<EconomicMetrics> {
  const balances: number[] = [];
  for (const { dir } of agentDirs) {
    balances.push(existsSync(walletPath(dir)) ? await getBalance(dir) : 0);
  }
  const circ = balances.reduce((s, v) => s + v, 0);
  const treasury = await getTreasuryBalance(worldDir);
  const total = circ + treasury;

  const lp = path.join(worldDir, '.world', 'ledger.json');
  const txCount = existsSync(lp) ? (JSON.parse(await fs.readFile(lp, 'utf-8')) as Transaction[]).length : 0;

  return {
    giniCoefficient: giniCoefficient(balances),
    velocityIndex: velocityIndex(txCount, agentDirs.length),
    inflationRate: prevCirculation != null && prevCirculation > 0
      ? Math.round(((circ - prevCirculation) / prevCirculation) * 10000) / 100
      : 0,
    totalSupply: total,
    circulationRatio: total > 0 ? Math.round((circ / total) * 1000) / 1000 : 0,
    aliveAgentPct: agentDirs.length > 0
      ? Math.round((balances.filter(b => b > 0).length / agentDirs.length) * 1000) / 10
      : 0,
    wealthConcentration: wealthConcentration(balances),
  };
}
