// @input: Registry, spawner, economy — biller/watcher/agent-services merged in
// @output: awaken()/killAgent()/stopAll() — 完整唤醒生命周期
// @position: 引擎编排层，协调进程管理/计费/监听，对外暴露awaken()

import { existsSync, promises as fs } from 'fs';
import path from 'path';
import { EventEmitter } from 'events';
import type { ChildProcess } from 'child_process';
import chokidar, { type FSWatcher } from 'chokidar';
import type { Registry } from './registry.js';
import { deduct, creditTreasury, deductUpTo, calculateClaudeCost, type SessionUsage } from './economy.js';
import { Semaphore, spawnAgent, writeLockfile, clearLockfile,
  isLockfileStale, finalizeProcess, type SpawnOptions } from './spawner.js';
import type { MessagePayload } from './types.js';

// ── Biller (merged from biller.ts) ───────────────────────────

export type BillResult = {
  agentId: string;
  baseCost: number;
  additionalDeducted: number;
  totalCostUsd: number;
  remaining: number;
  bankrupt: boolean;
};

export async function parseSessionUsage(logFile: string): Promise<SessionUsage | null> {
  try {
    const content = await fs.readFile(logFile, 'utf-8');
    const lines = content.trim().split('\n');
    for (let i = lines.length - 1; i >= 0; i--) {
      try {
        const obj = JSON.parse(lines[i]) as Record<string, unknown>;
        if (obj.type !== 'result' || !obj.usage) continue;
        const u = obj.usage as Record<string, number>;
        return {
          input_tokens: u.input_tokens ?? 0,
          output_tokens: u.output_tokens ?? 0,
          cache_read_input_tokens: u.cache_read_input_tokens ?? 0,
          cache_creation_input_tokens: u.cache_creation_input_tokens ?? 0,
        };
      } catch {}
    }
  } catch {}
  return null;
}

export async function billSession(
  agentId: string,
  dir: string,
  logFile: string,
  baseCost: number,
  tokenPerDollar: number,
  worldDir: string,
  registry: Registry,
): Promise<BillResult> {
  const usage = await parseSessionUsage(logFile);
  if (!usage) {
    return { agentId, baseCost, additionalDeducted: 0, totalCostUsd: 0, remaining: 0, bankrupt: false };
  }
  const costUsd = calculateClaudeCost(usage);
  const totalTokens = Math.max(Math.ceil(costUsd * tokenPerDollar), baseCost);
  const additional = totalTokens - baseCost;
  if (additional <= 0) {
    return { agentId, baseCost, additionalDeducted: 0, totalCostUsd: costUsd, remaining: additional, bankrupt: false };
  }
  const reason = `awakening-usage ${usage.input_tokens}in/${usage.output_tokens}out $${costUsd}`;
  const { deducted, remaining } = await deductUpTo(dir, agentId, additional, reason);
  if (deducted > 0 && worldDir) await creditTreasury(worldDir, deducted, `awakening-usage:${agentId}`);
  const bankrupt = remaining <= 0;
  if (bankrupt) registry.update(agentId, { status: 'dead' });
  return { agentId, baseCost, additionalDeducted: deducted, totalCostUsd: costUsd, remaining, bankrupt };
}

// ── AgentWatcher (merged from watcher.ts) ────────────────────

export class AgentWatcher extends EventEmitter {
  private readonly sleepWatchers = new Map<string, FSWatcher>();
  private readonly wakeAtWatchers = new Map<string, NodeJS.Timeout>();

  constructor(private registry: Registry) { super(); }

  watchSleepSignal(agentId: string, dir: string): void {
    if (this.sleepWatchers.has(agentId)) return;
    const lockPath = path.join(dir, '.awakening');
    if (!existsSync(lockPath)) return;
    const watcher = chokidar.watch(lockPath, { ignoreInitial: true });
    watcher.on('unlink', () => {
      this.emit('slept', agentId);
      this.sleepWatchers.delete(agentId);
      void watcher.close();
    });
    watcher.on('error', () => {
      this.sleepWatchers.delete(agentId);
      void watcher.close();
    });
    this.sleepWatchers.set(agentId, watcher);
  }

  watchAllSleepSignals(): void {
    for (const agent of this.registry.all()) this.watchSleepSignal(agent.id, agent.dir);
  }

  watchWakeAt(agentId: string, dir: string): void {
    if (this.wakeAtWatchers.has(agentId)) return;
    void this.checkWakeAt(agentId, path.join(dir, '.wake-at'));
  }

  private async checkWakeAt(agentId: string, wakeAtPath: string): Promise<void> {
    if (!existsSync(wakeAtPath)) return;
    let targetTime: number;
    try {
      const content = await fs.readFile(wakeAtPath, 'utf-8');
      targetTime = new Date(content.trim()).getTime();
      if (isNaN(targetTime)) return;
    } catch { return; }
    const delay = Math.max(0, targetTime - Date.now());
    const timer = setTimeout(async () => {
      this.wakeAtWatchers.delete(agentId);
      try { await fs.rm(wakeAtPath, { force: true }); } catch {}
      this.emit('wake-request', agentId, 'self-scheduled wake');
    }, delay);
    this.wakeAtWatchers.set(agentId, timer);
  }

  watchAllWakeAt(): void {
    for (const agent of this.registry.all()) this.watchWakeAt(agent.id, agent.dir);
  }

  stopAll(): void {
    for (const w of this.sleepWatchers.values()) void w.close();
    this.sleepWatchers.clear();
    for (const t of this.wakeAtWatchers.values()) clearTimeout(t);
    this.wakeAtWatchers.clear();
  }
}

// ── Agent services (merged from agent-services.ts) ────────────

function nowIso(): string { return new Date().toISOString(); }

const SNAPSHOT_FILES = ['.claude/memory/categories/IDENTITY.md', '.claude/memory/categories/GOALS.md', '.claude/memory/categories/TASKS.md', '.claude/memory/categories/HANDOFF.md', 'CLAUDE.md'];

export async function snapshotFiles(dir: string): Promise<void> {
  const snapDir = path.join(dir, '.pre-cycle-snapshot');
  await fs.rm(snapDir, { recursive: true, force: true });
  await fs.mkdir(snapDir, { recursive: true });
  for (const rel of SNAPSHOT_FILES) {
    const src = path.join(dir, rel);
    if (!existsSync(src)) continue;
    const dest = path.join(snapDir, rel);
    await fs.mkdir(path.dirname(dest), { recursive: true });
    await fs.copyFile(src, dest);
  }
  await snapshotWorkspace(dir, snapDir);
}

async function snapshotWorkspace(dir: string, snapDir: string): Promise<void> {
  const wsDir = path.join(dir, 'workspace');
  if (!existsSync(wsDir)) return;
  for (const f of await fs.readdir(wsDir)) {
    if (!/\.(md|txt|json)$/.test(f)) continue;
    const src = path.join(wsDir, f), stat = await fs.stat(src);
    if (!stat.isFile() || stat.size > 50_000) continue;
    await fs.mkdir(path.join(snapDir, 'workspace'), { recursive: true });
    await fs.copyFile(src, path.join(snapDir, 'workspace', f));
  }
}

export async function deliverReason(agentId: string, dir: string, reason: string): Promise<void> {
  const inbox = path.join(dir, 'inbox');
  await fs.mkdir(inbox, { recursive: true });
  const msg: MessagePayload = {
    id: `engine-${Date.now()}`,
    from: 'engine',
    to: agentId,
    subject: 'awakening',
    content: reason,
    priority: 'normal',
    timestamp: nowIso(),
  };
  await fs.writeFile(path.join(inbox, `${msg.id}.json`), JSON.stringify(msg, null, 2));
}

export async function writeDefaultHandoff(agentId: string, dir: string): Promise<void> {
  const hp = path.join(dir, '.claude', 'memory', 'categories', 'HANDOFF.md');
  await fs.mkdir(path.dirname(hp), { recursive: true });
  const sp = path.join(dir, '.pre-cycle-snapshot', '.claude', 'memory', 'categories', 'HANDOFF.md');
  try {
    const cur = await fs.readFile(hp, 'utf-8');
    try { if (cur !== await fs.readFile(sp, 'utf-8')) return; } catch { if (!cur.includes('auto-generated')) return; }
  } catch {}
  await fs.writeFile(hp, `# Last Session Handoff (auto-generated)\n\nDate: ${nowIso()}\n\nNote: Agent did not produce a handoff file this session.\nPlease check workspace/ and inbox/ for context.\n`);
}

export async function appendSleepEntry(agentId: string, commonsDir: string): Promise<void> {
  const logPath = path.join(commonsDir, 'progress-log.jsonl');
  const entry = { ts: nowIso(), agent: agentId, type: 'handoff', summary: `${agentId} completed session` };
  await fs.mkdir(commonsDir, { recursive: true });
  await fs.appendFile(logPath, JSON.stringify(entry) + '\n');
}

type YPAgent = { role: string; skills: string[]; status: string; current_task_id: null; last_seen: string; reputation: { tasks_completed: number; reliability: number } };
type YPData = { last_updated: string; agents: Record<string, YPAgent>; skill_index: Record<string, string[]> };

export async function updateYellowPages(agentId: string, status: 'awake' | 'sleeping', commonsDir: string, registry: Registry): Promise<void> {
  const ypPath = path.join(commonsDir, 'yellow-pages.json');
  let data: YPData = { last_updated: '', agents: {}, skill_index: {} };
  try { data = JSON.parse(await fs.readFile(ypPath, 'utf-8')); } catch {}
  const agent = registry.get(agentId);
  if (!agent) return;
  const prev = data.agents[agentId];
  data.agents[agentId] = { role: agent.economicNiche ?? agent.type ?? 'resident', skills: await extractSkills(agent.dir, agent.type), status, current_task_id: null, last_seen: nowIso(), reputation: { tasks_completed: (prev?.reputation?.tasks_completed ?? 0) + (status === 'sleeping' ? 1 : 0), reliability: prev?.reputation?.reliability ?? 1.0 } };
  data.last_updated = nowIso();
  data.skill_index = buildSkillIndex(data.agents);
  await fs.mkdir(commonsDir, { recursive: true });
  await fs.writeFile(ypPath, JSON.stringify(data, null, 2));
}

const DEFAULT_SKILLS: Record<string, string[]> = { mastermind: ['strategy', 'coordination', 'decision-making'], 'world-keeper': ['world-management', 'coordination'], 'zone-keeper': ['zone-management', 'coordination'], resident: ['general', 'communication'], observer: ['monitoring', 'analysis'] };

async function extractSkills(agentDir: string, agentType: string): Promise<string[]> {
  try { const m = JSON.parse(await fs.readFile(path.join(agentDir, '.claude', 'metadata.json'), 'utf-8')) as Record<string, unknown>; if (Array.isArray(m.skills) && m.skills.length > 0) return m.skills as string[]; } catch {}
  try { const m = (await fs.readFile(path.join(agentDir, 'CLAUDE.md'), 'utf-8')).match(/<!--\s*skills:\s*(.+?)\s*-->/); if (m) return m[1].split(',').map(s => s.trim()).filter(Boolean); } catch {}
  return DEFAULT_SKILLS[agentType] ?? DEFAULT_SKILLS['resident'];
}

function buildSkillIndex(agents: Record<string, { skills: string[] }>): Record<string, string[]> {
  const index: Record<string, string[]> = {};
  for (const [agentId, entry] of Object.entries(agents)) {
    for (const skill of entry.skills) (index[skill] ??= []).push(agentId);
  }
  return index;
}

/** Minimal prompt — proposal L854-862. Agent's on-wake.mjs hook handles the rest. */
export function buildPrompt(reason: string): string {
  return `你醒了。原因: ${reason.replace(/\s+/g, ' ').trim()}。请按照你的 CLAUDE.md 宪法行动。`;
}

export async function hasWork(dir: string): Promise<boolean> {
  const inbox = path.join(dir, 'inbox');
  if (existsSync(inbox)) {
    try {
      const files = await fs.readdir(inbox);
      if (files.some((f) => f.endsWith('.json'))) return true;
    } catch {}
  }
  return existsSync(path.join(dir, '.claude', 'wake-request'));
}

// ── Lifecycle ─────────────────────────────────────────────────

export type LifecycleConfig = {
  maxConcurrent?: number;
  worldDir?: string;
  awakenBaseCost?: number;
  tokenPerDollar?: number;
  commonsDir?: string;
};

const STALE_LOCK_THRESHOLD_MS = 90_000;

export class Lifecycle extends EventEmitter {
  private launched = new Set<string>();
  private readonly runningProcesses = new Map<string, ChildProcess>();
  private readonly lastExitCodes = new Map<string, number | null>();
  private readonly skipAgents = new Set<string>();
  private readonly semaphore: Semaphore;
  readonly watcher: AgentWatcher;
  private readonly worldDir: string;
  private readonly commonsDir: string;
  private readonly awakenBaseCost: number;
  private readonly tokenPerDollar: number;

  constructor(private registry: Registry, cfg: LifecycleConfig = {}) {
    super();
    this.semaphore = new Semaphore(cfg.maxConcurrent ?? 3);
    this.worldDir = cfg.worldDir ?? '';
    this.commonsDir = cfg.commonsDir ?? '';
    this.awakenBaseCost = cfg.awakenBaseCost ?? 5;
    this.tokenPerDollar = cfg.tokenPerDollar ?? 100;
    this.watcher = new AgentWatcher(registry);
    this.watcher.on('wake-request', (agentId: string, reason: string) => {
      void this.awaken(agentId, reason);
    });
    this.watcher.on('slept', (agentId: string) => {
      this.launched.delete(agentId);
      this.registry.update(agentId, { status: 'sleeping', lastAwakened: new Date().toISOString() });
      this.emit('event', { type: 'agent-slept', agentId, exitCode: this.lastExitCodes.get(agentId) ?? null, message: `${agentId} finished cycle` });
    });
  }

  async awaken(agentId: string, reason: string, briefing?: string): Promise<void> {
    const agent = this.registry.get(agentId);
    if (!agent || agent.status === 'dead') return;
    if (this.skipAgents.has(agentId)) return;
    if (this.launched.has(agentId)) return;
    if (await this.isTerminalActive(agentId)) return;
    await this.semaphore.acquire();
    try { await this.doAwaken(agentId, reason, briefing); }
    finally { this.semaphore.release(); }
  }

  private async doAwaken(agentId: string, reason: string, briefing?: string): Promise<void> {
    const agent = this.registry.get(agentId);
    if (!agent) return;
    if (this.awakenBaseCost > 0) {
      const ok = await deduct(agent.dir, agentId, this.awakenBaseCost, 'awakening base cost');
      if (!ok) {
        this.registry.update(agentId, { status: 'dead' });
        this.emit('event', { type: 'agent-died', agentId, message: `${agentId} cannot pay ${this.awakenBaseCost}T awakening cost` });
        return;
      }
      if (this.worldDir) await creditTreasury(this.worldDir, this.awakenBaseCost, `awakening-base:${agentId}`, 'awakening');
    }
    await snapshotFiles(agent.dir);
    await deliverReason(agentId, agent.dir, reason);
    const prompt = buildPrompt(briefing ? `${reason} — ${briefing}` : reason);
    const spawnOpts: SpawnOptions = { commonsDir: this.commonsDir };
    await writeLockfile(agent.dir);
    this.watcher.watchSleepSignal(agentId, agent.dir);
    const { child, logFile, logStream } = spawnAgent(agentId, agent.dir, prompt, spawnOpts, reason);
    this.runningProcesses.set(agentId, child);
    this.launched.add(agentId);
    void updateYellowPages(agentId, 'awake', this.commonsDir, this.registry);
    this.registry.update(agentId, { status: 'awakening' });
    this.emit('event', { type: 'agent-awakened', agentId, message: `${agentId} awakened: ${reason} (cost: ${this.awakenBaseCost}T)` });
    let finalized = false;
    const finalize = (exitCode: number | null, signal: string | null) => {
      if (finalized) return;
      finalized = true;
      this.runningProcesses.delete(agentId);
      this.lastExitCodes.set(agentId, exitCode);
      finalizeProcess(logStream, agentId, exitCode, signal);
      this.onCycleEnd(agentId, agent.dir, logFile);
    };
    child.on('error', () => finalize(null, null));
    child.on('close', (code, sig) => finalize(code, sig));
  }

  private onCycleEnd(agentId: string, dir: string, logFile: string): void {
    billSession(agentId, dir, logFile, this.awakenBaseCost, this.tokenPerDollar, this.worldDir, this.registry)
      .then((result) => {
        if (result.bankrupt) {
          this.emit('event', { type: 'agent-died', agentId, message: `${agentId} bankrupted ($${result.totalCostUsd})` });
        }
        this.emit('event', { type: 'session-billed', agentId, message: `${agentId} billed ${this.awakenBaseCost + result.additionalDeducted}T ($${result.totalCostUsd})` });
        return Promise.all([writeDefaultHandoff(agentId, dir), appendSleepEntry(agentId, this.commonsDir)]);
      })
      .then(() => updateYellowPages(agentId, 'sleeping', this.commonsDir, this.registry))
      .catch(() => {})
      .finally(() => clearLockfile(dir));
  }

  private async isTerminalActive(agentId: string): Promise<boolean> {
    const agent = this.registry.get(agentId);
    if (!agent) return false;
    const lockPath = path.join(agent.dir, '.awakening');
    if (!existsSync(lockPath)) return false;
    const stale = await isLockfileStale(agentId, lockPath, this.runningProcesses, STALE_LOCK_THRESHOLD_MS);
    if (stale) { clearLockfile(agent.dir); return false; }
    return existsSync(lockPath);
  }

  killAgent(agentId: string): boolean {
    const child = this.runningProcesses.get(agentId);
    if (child) {
      try { child.kill(); } catch {}
      this.runningProcesses.delete(agentId);
    }
    this.launched.delete(agentId);
    const agent = this.registry.get(agentId);
    if (agent) clearLockfile(agent.dir);
    return !!child;
  }

  setAgentSkip(agentId: string, skip: boolean): void {
    if (skip) this.skipAgents.add(agentId);
    else this.skipAgents.delete(agentId);
  }

  getSkipList(): string[] { return [...this.skipAgents]; }

  async awakenAll(reason: string, staggerMs = 30_000): Promise<void> {
    const agents = this.registry.all().filter((a) => a.status !== 'dead');
    for (let i = 0; i < agents.length; i++) {
      if (i > 0) await new Promise((r) => setTimeout(r, staggerMs));
      this.awaken(agents[i].id, reason).catch(() => {});
    }
  }

  async refreshStatus(): Promise<void> {
    for (const agent of this.registry.all()) {
      const lockPath = path.join(agent.dir, '.awakening');
      const stale = await isLockfileStale(agent.id, lockPath, this.runningProcesses, STALE_LOCK_THRESHOLD_MS);
      if (stale) { clearLockfile(agent.dir); this.launched.delete(agent.id); }
      const active = existsSync(lockPath);
      if (active) {
        this.registry.update(agent.id, { status: 'awakening' });
        this.watcher.watchSleepSignal(agent.id, agent.dir);
      } else if (this.launched.has(agent.id)) {
        this.launched.delete(agent.id);
        this.registry.update(agent.id, { status: 'sleeping', lastAwakened: new Date().toISOString() });
      }
    }
  }

  stopAll(): void {
    this.watcher.stopAll();
    for (const child of this.runningProcesses.values()) { try { child.kill(); } catch {} }
    this.runningProcesses.clear();
    this.launched.clear();
  }
}
