// @input: 所有子模块（Registry, Lifecycle, Economy, Server）
// @output: Engine类 + Monitor + WorldManager，统一入口
// @position: 引擎顶层，等同于"物理定律集合"

import { EventEmitter } from 'events';
import { randomUUID } from 'crypto';
import { existsSync, promises as fs } from 'fs';
import path from 'path';
import { Registry } from './registry.js';
import { Lifecycle } from './lifecycle.js';
import * as economy from './economy.js';
import { startServer } from './server.js';
import type { WorldConfig, WorldSnapshot, WorldSpec, AgentSpec, MessagePayload, TimelineEvent, AgentEntry, EconomySummary, TreeNode } from './types.js';
import { setWorldDir, get as getConfigValue } from './config.js';
import { Postman, deliverOutbox } from './postman.js';

// ── Graveyard (merged from graveyard.ts) ──────────────────────────────────

export interface Epitaph {
  agentId: string;
  killedAt: string;
  epitaph: string;
  finalBalance: number;
  cause: string;
}

async function doGraveyardBury(
  worldDir: string,
  agentId: string,
  agentDir: string,
  epitaph: string,
  cause: string = 'culled',
): Promise<Epitaph> {
  const finalBalance = await economy.getBalance(agentDir).catch(() => 0);
  const dest = path.join(worldDir, 'graveyard', agentId);
  await fs.mkdir(path.join(worldDir, 'graveyard'), { recursive: true });
  await fs.rename(agentDir, dest);
  const record: Epitaph = { agentId, killedAt: new Date().toISOString(), epitaph, finalBalance, cause };
  await fs.writeFile(path.join(dest, 'epitaph.json'), JSON.stringify(record, null, 2));
  const tx = { id: randomUUID(), from: agentId, to: 'graveyard', amount: finalBalance, reason: `Death: ${epitaph}`, timestamp: new Date().toISOString(), type: 'deduct' as const };
  await economy.appendLedger(path.join(worldDir, '.world', 'ledger.json'), tx);
  return record;
}

async function listGraves(worldDir: string): Promise<Epitaph[]> {
  const dir = path.join(worldDir, 'graveyard');
  if (!existsSync(dir)) return [];
  const entries = await fs.readdir(dir, { withFileTypes: true });
  const graves: Epitaph[] = [];
  for (const e of entries.filter(e => e.isDirectory())) {
    try { graves.push(JSON.parse(await fs.readFile(path.join(dir, e.name, 'epitaph.json'), 'utf-8')) as Epitaph); }
    catch { /* skip */ }
  }
  return graves;
}

// ── Monitor (merged from monitor.ts) ──────────────────────────────────────

const MAX_EVENTS = 500;

class Monitor {
  private timeline: TimelineEvent[] = [];
  private cycle = 0;

  constructor(private registry: Registry, private worldConfig: WorldConfig) {}

  async snapshot(): Promise<WorldSnapshot> {
    const agents = await this.registry.scan();
    const tree = await this.registry.scanTree(this.registry.rootDir, 0, null);
    const alive = agents.filter(a => a.status !== 'dead');
    const total = agents.reduce((s, a) => s + a.tokenBalance, 0);
    const agentDirs = agents.map(a => ({ id: a.id, dir: a.dir }));
    const economySummary = await this.safeEconomy(agentDirs);
    return {
      worldId: this.worldConfig.id, worldName: this.worldConfig.name,
      worldTheme: this.worldConfig.theme, timestamp: new Date().toISOString(),
      totalAgents: agents.length, aliveAgents: alive.length,
      totalTokens: total, agents, tree: this.pruneTree(tree), economySummary,
    };
  }

  private async safeEconomy(agentDirs: { id: string; dir: string }[]): Promise<EconomySummary> {
    try { return await economy.getEconomySummary(this.registry.rootDir, agentDirs); }
    catch { return { treasuryBalance: 0, circulation: 0, transactionCount: 0, distribution: [] }; }
  }

  private pruneTree(root: TreeNode): TreeNode | undefined {
    return root.children.length > 0 ? root : undefined;
  }

  pushEvent(partial: Omit<TimelineEvent, 'id' | 'timestamp'>): TimelineEvent {
    const ev: TimelineEvent = { id: randomUUID(), timestamp: new Date().toISOString(), ...partial };
    this.timeline.unshift(ev);
    if (this.timeline.length > MAX_EVENTS) this.timeline = this.timeline.slice(0, MAX_EVENTS);
    return ev;
  }

  getTimeline(limit = 100): TimelineEvent[] { return this.timeline.slice(0, limit); }

  async writeWorldState(commonsDir: string): Promise<void> {
    this.cycle += 1;
    const snap = await this.snapshot();
    const eco = snap.economySummary ?? { treasuryBalance: 0, circulation: 0, transactionCount: 0, distribution: [] };
    const total = eco.treasuryBalance + eco.circulation;
    const tPct = total > 0 ? Math.round((eco.treasuryBalance / total) * 100) : 0;
    const health = tPct > 20 ? 'green' : tPct > 10 ? 'yellow' : 'red';
    const bals = eco.distribution.map(d => d.balance);
    const state = {
      timestamp: snap.timestamp, cycle: this.cycle, world_name: snap.worldName,
      awakeAgents: snap.agents.filter(a => a.status === 'awakening').map(a => ({ id: a.id, since: a.lastAwakened })),
      sleeping: snap.agents.filter(a => a.status !== 'awakening' && a.status !== 'dead').map(a => ({ id: a.id, last_active: a.lastAwakened })),
      dead: snap.agents.filter(a => a.status === 'dead').map(a => ({ id: a.id })),
      economy: { total_supply: total, treasury: eco.treasuryBalance, treasury_pct: tPct, avg_balance: bals.length ? Math.round(bals.reduce((s, b) => s + b, 0) / bals.length) : 0, min_balance: bals.length ? Math.min(...bals) : 0, health, alert: health === 'red' ? `Treasury critically low: ${tPct}%` : null },
      recentEvents: this.getTimeline(10).map(e => ({ agent: e.agentId ?? '', type: e.type, summary: e.message })),
    };
    await fs.mkdir(commonsDir, { recursive: true });
    await fs.writeFile(path.join(commonsDir, 'world-state.json'), JSON.stringify(state, null, 2));
  }
}

// ── WorldManager (merged from world-manager.ts) ───────────────────────────

export interface WorldInfo {
  name: string;
  displayName: string;
  theme: string;
  agentCount: number;
  createdAt: string;
  isActive: boolean;
}

export interface WorldUpdateInput {
  name?: string;
  theme?: string;
}

export interface BootstrapResult {
  worldName: string;
  worldDir: string;
  createdAgents: string[];
}

export class WorldNotFoundError extends Error {
  constructor(name: string) { super(`world not found: ${name}`); }
}

export class WorldActiveError extends Error {
  constructor() { super('cannot delete the active world'); }
}

export class WorldValidationError extends Error {}

const SAFE_NAME = /^[\w-]+$/;

function assertSafeName(worldName: string): void {
  if (!SAFE_NAME.test(worldName)) throw new WorldValidationError('invalid world name');
}

async function countAgents(worldDir: string): Promise<number> {
  const dir = path.join(worldDir, 'children');
  if (!existsSync(dir)) return 0;
  return (await fs.readdir(dir, { withFileTypes: true })).filter(e => e.isDirectory() && existsSync(path.join(dir, e.name, 'CLAUDE.md'))).length;
}

async function readWorldConfig(worldDir: string): Promise<Record<string, unknown>> {
  return JSON.parse(await fs.readFile(path.join(worldDir, '.world', 'config.json'), 'utf-8')) as Record<string, unknown>;
}

export async function bootstrapWorldFromSpec(
  projectRoot: string,
  spec: WorldSpec,
): Promise<BootstrapResult> {
  const worldName = spec.name.toLowerCase().replace(/[^a-z0-9-]/g, '-');
  const worldDir = path.join(projectRoot, 'worlds', worldName);
  const childrenDir = path.join(worldDir, 'children');
  const created: string[] = [];

  await fs.mkdir(path.join(worldDir, '.world'), { recursive: true });
  await fs.mkdir(childrenDir, { recursive: true });
  await fs.mkdir(path.join(worldDir, 'commons'), { recursive: true });

  const config = {
    id: worldName,
    name: spec.name,
    theme: spec.theme ?? '',
    physics: spec.physics ?? { cycle: { intervalMs: 30000 }, economy: { tokenPerDollar: 1000 } },
    agents: spec.agents.map(a => a.name),
  };
  await fs.writeFile(
    path.join(worldDir, '.world', 'config.json'),
    JSON.stringify(config, null, 2),
  );

  for (const agent of spec.agents) {
    const dest = path.join(childrenDir, agent.name);
    if (existsSync(dest)) continue;
    await fs.mkdir(dest, { recursive: true });
    await fs.mkdir(path.join(dest, '.claude'), { recursive: true });
    await fs.writeFile(
      path.join(dest, '.claude', 'metadata.json'),
      JSON.stringify({
        identity: agent.name,
        personality: agent.personality ?? '',
        type: agent.type ?? 'resident',
        lastUpdated: new Date().toISOString(),
      }, null, 2),
    );
    created.push(agent.name);
  }

  return { worldName, worldDir, createdAgents: created };
}

export async function listWorlds(
  projectRoot: string,
  activeWorldName?: string,
): Promise<WorldInfo[]> {
  const worldsDir = path.join(projectRoot, 'worlds');
  if (!existsSync(worldsDir)) return [];

  const entries = await fs.readdir(worldsDir, { withFileTypes: true });
  const worlds: WorldInfo[] = [];

  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const worldDir = path.join(worldsDir, entry.name);
    if (!existsSync(path.join(worldDir, '.world', 'config.json'))) continue;

    try {
      const config = await readWorldConfig(worldDir);
      worlds.push({
        name: entry.name,
        displayName: (config.name as string) ?? entry.name,
        theme: (config.theme as string) ?? '',
        agentCount: await countAgents(worldDir),
        createdAt: (config.createdAt as string) ?? '',
        isActive: entry.name === activeWorldName,
      });
    } catch { /* skip invalid configs */ }
  }

  return worlds.sort((a, b) => {
    if (a.isActive !== b.isActive) return a.isActive ? -1 : 1;
    return a.name.localeCompare(b.name);
  });
}

export async function deleteWorld(
  projectRoot: string,
  worldName: string,
  activeWorldName: string,
): Promise<void> {
  assertSafeName(worldName);
  if (worldName === activeWorldName) throw new WorldActiveError();
  const worldDir = path.join(projectRoot, 'worlds', worldName);
  if (!existsSync(worldDir)) throw new WorldNotFoundError(worldName);
  const trashDir = path.join(projectRoot, '.trash', `${worldName}-${Date.now()}`);
  await fs.mkdir(path.dirname(trashDir), { recursive: true });
  await fs.rename(worldDir, trashDir);
}

export async function updateWorld(
  projectRoot: string,
  worldName: string,
  updates: WorldUpdateInput,
): Promise<WorldInfo> {
  assertSafeName(worldName);
  const worldDir = path.join(projectRoot, 'worlds', worldName);
  const configPath = path.join(worldDir, '.world', 'config.json');
  if (!existsSync(configPath)) throw new WorldNotFoundError(worldName);

  const config = await readWorldConfig(worldDir);
  if (updates.name !== undefined) config.name = updates.name;
  if (updates.theme !== undefined) config.theme = updates.theme;
  await fs.writeFile(configPath, JSON.stringify(config, null, 2));

  return {
    name: worldName,
    displayName: (config.name as string) ?? worldName,
    theme: (config.theme as string) ?? '',
    agentCount: await countAgents(worldDir),
    createdAt: (config.createdAt as string) ?? '',
    isActive: false,
  };
}

export type { WorldConfig, WorldSnapshot, WorldSpec, AgentSpec, MessagePayload, TimelineEvent } from './types.js';

export class Engine extends EventEmitter {
  readonly registry: Registry;
  readonly worldDir: string;
  readonly projectRoot: string;
  private awakener: Lifecycle;
  private monitor: Monitor;
  readonly config: WorldConfig;
  private heartbeat: NodeJS.Timeout | null = null;
  private survivalTimer: NodeJS.Timeout | null = null;
  private postman: Postman | null = null;

  constructor(projectRoot: string, worldDir: string, config: WorldConfig) {
    super();
    this.projectRoot = projectRoot;
    this.worldDir = worldDir;
    this.config = config;
    setWorldDir(worldDir);
    this.registry = new Registry(worldDir);
    this.monitor = new Monitor(this.registry, config);

    const commonsDir = path.join(worldDir, 'commons');
    this.awakener = new Lifecycle(this.registry, {
      worldDir,
      commonsDir,
      maxConcurrent: getConfigValue('maxConcurrentAgents'),
      awakenBaseCost: config.physics.economy.awakenBaseCost,
      tokenPerDollar: config.physics.economy.tokenPerDollar,
    });

    this.awakener.on('event', (ev) => {
      const full = this.monitor.pushEvent(ev);
      this.emit('event', full);
    });
  }

  async init(): Promise<void> {
    await this.registry.scan();
    // Cold start in manual-wake mode: clear stale lockfiles and keep everyone sleeping.
    for (const a of this.registry.all()) {
      if (a.status === 'dead') continue;
      const lock = path.join(a.dir, '.awakening');
      if (existsSync(lock)) {
        try {
          await fs.rm(lock, { force: true });
        } catch {}
      }
      this.registry.update(a.id, { status: 'sleeping' });
    }
    this.awakener.watcher.watchAllSleepSignals();
    this.awakener.watcher.watchAllWakeAt();
    this.startPostman();
    // Catch-up: deliver any messages written before watchers were ready
    const delivered = await deliverOutbox(
      this.registry, this.worldDir,
      (type, msg) => this.pushEvent(type, msg),
    ).catch(() => 0);
    if (delivered > 0) this.pushEvent('postman', `Startup catch-up delivered ${delivered} messages`);
    this.startHeartbeat();
    this.startSurvivalCostTimer();
    await this.initGmInbox();
    this.pushEvent('world-started', `World "${this.config.name}" online`);
  }

  private startPostman(): void {
    this.postman = new Postman(this.registry, this.worldDir);
    this.postman.on('event', (ev: { type: string; message: string; agentId?: string }) => {
      if (ev.type === 'external-message') {
        this.forwardToExternal(ev.message, ev.agentId).catch(() => {});
        return;
      }
      this.pushEvent(ev.type, ev.message);
    });
    this.postman.on('wake-request', (agentId: string, reason: string) => {
      this.awakener.awaken(agentId, reason).catch(() => {});
    });
    this.postman.start();
  }

  private async forwardToExternal(rawJson: string, senderId?: string): Promise<void> {
    const chatId = process.env.DU_HELIOS_FEISHU_CHAT;
    if (!chatId) {
      this.pushEvent('external-skip', `No DU_HELIOS_FEISHU_CHAT env — message from ${senderId} dropped`);
      return;
    }
    try {
      const msg = JSON.parse(rawJson) as Record<string, string>;
      const text = `[${msg.from || senderId}] ${msg.subject || 'message'}\n\n${msg.content || msg.body || ''}`;
      const cli = path.join(this.projectRoot, 'services', 'moss-feishu', 'cli', 'feishu-send.js');
      const { execFile } = await import('child_process');
      execFile('node', [cli, 'text', chatId, text], (err) => {
        if (err) this.pushEvent('external-fail', `Feishu send failed: ${err.message}`);
        else this.pushEvent('external-sent', `${senderId} → helios: ${msg.subject || 'message'}`);
      });
    } catch (e) {
      this.pushEvent('external-fail', `Forward failed: ${e}`);
    }
  }

  private startHeartbeat(): void {
    // Snapshot-only heartbeat (60s). Message delivery is event-driven via postman fs.watch.
    // Economic wake trigger also runs here: sleeping agents with balance < criticalThreshold get awakened.
    this.heartbeat = setInterval(async () => {
      await this.awakener.refreshStatus();
      await this.monitor.writeWorldState(path.join(this.worldDir, 'commons')).catch(() => {});
      await this.checkEconomicWakeTriggers();
    }, getConfigValue('heartbeatIntervalMs'));
  }

  /** Deduct daily survival cost from all alive agents — proposal L97-109 */
  private startSurvivalCostTimer(): void {
    const cost = this.config.physics.economy.dailySurvivalCost ?? 0;
    if (cost <= 0) return;
    const intervalMs = 24 * 60 * 60 * 1000; // once per day
    this.survivalTimer = setInterval(() => void this.deductSurvivalCosts(cost), intervalMs);
    // Also run once at startup (prorated or full — full for simplicity)
    void this.deductSurvivalCosts(cost);
  }

  private async deductSurvivalCosts(cost: number): Promise<void> {
    const alive = this.registry.all().filter(a => a.status !== 'dead');
    const agentDirs = alive.map(a => ({ id: a.id, dir: a.dir }));
    const results = await economy.deductSurvivalCosts(agentDirs, cost, this.worldDir);
    for (const r of results) {
      if (r.dead) {
        this.pushEvent('agent-died', `${r.agentId} died: survival cost depleted balance`);
        this.registry.update(r.agentId, { status: 'dead' });
      } else if (r.deducted > 0) {
        this.pushEvent('survival-cost', `${r.agentId} -${r.deducted}T survival (remaining: ${r.remaining})`);
      }
    }
  }

  private async checkEconomicWakeTriggers(): Promise<void> {
    for (const agent of this.registry.all()) {
      if (agent.status !== 'sleeping') continue;
      const health = await economy.checkEconomicHealth(agent.dir, this.worldDir).catch(() => null);
      if (!health) continue;
      if (health.status === 'dead') {
        this.pushEvent('agent-died', `${agent.id} balance ${health.balance} ≤ death threshold`);
        this.registry.update(agent.id, { status: 'dead' });
      } else if (health.status === 'starving') {
        this.pushEvent('economy-alert', `${agent.id} balance ${health.balance} < ${health.criticalThreshold} — economic wake`);
        this.awakener.awaken(agent.id, `你快饿死了，余额仅剩 ${health.balance} Token，起来找活干`).catch(() => {});
      }
    }
  }

  async snapshot(): Promise<WorldSnapshot> {
    return this.monitor.snapshot();
  }

  getTimeline(limit = 100): TimelineEvent[] {
    return this.monitor.getTimeline(limit);
  }

  async awaken(agentId: string, reason: string, briefing?: string): Promise<void> {
    await this.awakener.awaken(agentId, reason, briefing);
  }

  async awakenAll(reason: string): Promise<void> {
    await this.awakener.awakenAll(reason);
  }

  killAgent(agentId: string): boolean {
    const killed = this.awakener.killAgent(agentId);
    this.registry.update(agentId, { status: 'sleeping' });
    return killed;
  }

  async buryAgent(agentId: string, epitaph: string, cause = 'culled'): Promise<Epitaph> {
    this.killAgent(agentId);
    const agent = this.registry.get(agentId);
    if (!agent) throw new Error(`Agent ${agentId} not found`);
    const record = await doGraveyardBury(this.worldDir, agentId, agent.dir, epitaph, cause);
    this.registry.remove(agentId);
    this.pushEvent('agent-buried', `${agentId} buried: ${epitaph}`);
    return record;
  }

  async getGraves(): Promise<Epitaph[]> {
    return listGraves(this.worldDir);
  }

  setAgentSkip(agentId: string, skip: boolean): void {
    this.awakener.setAgentSkip(agentId, skip);
  }

  getSkipList(): string[] {
    return this.awakener.getSkipList();
  }

  async creditAgent(agentId: string, amount: number): Promise<void> {
    const dir = this.registry.getDir(agentId);
    await economy.credit(dir, agentId, amount, 'manual credit');
    const balance = await economy.getBalance(dir);
    this.registry.update(agentId, { tokenBalance: balance });
    this.pushEvent('economy-credit', `${agentId} credited ${amount} tokens`);
  }

  async sendMessage(msg: Omit<MessagePayload, 'id' | 'timestamp'>): Promise<void> {
    const full: MessagePayload = {
      ...msg,
      id: crypto.randomUUID(),
      timestamp: new Date().toISOString(),
    };
    const toDir = this.registry.getDir(msg.to);
    const inbox = path.join(toDir, 'inbox');
    await fs.mkdir(inbox, { recursive: true });
    await fs.writeFile(path.join(inbox, `${full.id}.json`), JSON.stringify(full, null, 2));
    this.pushEvent('message-sent', `${msg.from} → ${msg.to}: ${msg.subject}`);

    // Trigger wake for sleeping agents — proposal L324-325
    const agent = this.registry.get(msg.to);
    if (agent?.status === 'sleeping') {
      this.awakener.awaken(msg.to, `message from ${msg.from}`).catch(() => {});
    }
  }

  async bootstrap(opts: { residents?: string[]; spec?: WorldSpec }): Promise<void> {
    const childrenDir = path.join(this.worldDir, 'children');
    await fs.mkdir(childrenDir, { recursive: true });
    const agents: AgentSpec[] = opts.spec?.agents
      ?? (opts.residents ?? []).map(name => ({ name }));
    for (const agent of agents) {
      const type = agent.type ?? 'resident';
      const templateDir = path.join(this.projectRoot, 'templates', type);
      if (!existsSync(templateDir)) { this.pushEvent('error', `Template not found: ${type}`); continue; }
      const dest = path.join(childrenDir, agent.name);
      if (existsSync(dest)) continue;
      await copyDir(templateDir, dest);
      await patchTemplate(dest, agent.name, agent, this.config);
      this.pushEvent('agent-created', `${type} ${agent.name} created`);
    }
    await this.registry.scan();
    for (const a of this.registry.all()) this.postman?.watchAgent(a.id, a.dir);
  }

  // ── GM Inbox (MOSS review layer) ────────────────────
  private get gmDir() { return path.join(this.worldDir, 'gm-inbox'); }

  private async initGmInbox(): Promise<void> {
    await fs.mkdir(path.join(this.gmDir, 'processed'), { recursive: true });
  }

  async getGmMessages(): Promise<MessagePayload[]> {
    if (!existsSync(this.gmDir)) return [];
    const msgs: MessagePayload[] = [];
    for (const f of (await fs.readdir(this.gmDir)).filter(f => f.endsWith('.json'))) {
      try { msgs.push(JSON.parse(await fs.readFile(path.join(this.gmDir, f), 'utf-8'))); } catch {}
    }
    return msgs.sort((a, b) => (a.timestamp ?? '').localeCompare(b.timestamp ?? ''));
  }

  async markGmProcessed(msgId: string): Promise<boolean> {
    const src = (await fs.readdir(this.gmDir)).find(f => f.includes(msgId) && f.endsWith('.json'));
    if (!src) return false;
    await fs.rename(path.join(this.gmDir, src), path.join(this.gmDir, 'processed', src));
    return true;
  }

  async sendToGm(msg: Omit<MessagePayload, 'id' | 'timestamp'>): Promise<string> {
    const id = crypto.randomUUID();
    const full: MessagePayload = { ...msg, id, timestamp: new Date().toISOString() };
    await fs.mkdir(this.gmDir, { recursive: true });
    await fs.writeFile(path.join(this.gmDir, `${id}.json`), JSON.stringify(full, null, 2));
    this.pushEvent('gm-inbox', `${msg.from} → GM: ${msg.subject}`);
    return id;
  }

  shutdown(): void {
    this.postman?.stop();
    this.awakener.stopAll();
    if (this.heartbeat) clearInterval(this.heartbeat);
    if (this.survivalTimer) clearInterval(this.survivalTimer);
    this.pushEvent('world-stopped', 'Engine shutting down');
  }

  private pushEvent(type: string, message: string): void {
    const ev = this.monitor.pushEvent({ type, message });
    this.emit('event', ev);
  }
}

async function copyDir(src: string, dest: string): Promise<void> {
  await fs.mkdir(dest, { recursive: true });
  const entries = await fs.readdir(src, { withFileTypes: true });
  for (const e of entries) {
    const s = path.join(src, e.name);
    const d = path.join(dest, e.name);
    if (e.isDirectory()) await copyDir(s, d);
    else await fs.copyFile(s, d);
  }
}

async function patchTemplate(dir: string, name: string, agent: Partial<AgentSpec>, config: WorldConfig): Promise<void> {
  const now = new Date().toISOString();
  const v: Record<string, string> = {
    '{{name}}': name, '{{id}}': name, '{{world_name}}': config.name, '{{world_theme}}': config.theme ?? '',
    '{{world_id}}': config.id, '{{personality}}': agent.personality ?? '', '{{backstory}}': agent.backstory ?? '',
    '{{economic_niche}}': agent.economic_niche ?? '', '{{speech_style}}': agent.speech_style ?? '',
    '{{initial_goal}}': agent.initial_goal ?? '', '{{friends}}': (agent.friends ?? []).join(', '),
    '{{createdAt}}': now, '{{created_at}}': now,
  };
  const patch = async (d: string) => {
    for (const e of await fs.readdir(d, { withFileTypes: true })) {
      const p = path.join(d, e.name);
      if (e.isDirectory()) { await patch(p); continue; }
      if (!e.name.endsWith('.md') && !e.name.endsWith('.json')) continue;
      let c = await fs.readFile(p, 'utf-8');
      for (const [k, val] of Object.entries(v)) c = c.replaceAll(k, val);
      await fs.writeFile(p, c);
    }
  };
  await patch(dir);
  await fs.mkdir(path.join(dir, '.claude'), { recursive: true });
  await fs.writeFile(path.join(dir, '.claude', 'metadata.json'), JSON.stringify({
    identity: name, personality: agent.personality ?? '', economicNiche: agent.economic_niche ?? '',
    currentGoal: agent.initial_goal ?? '', type: agent.type ?? 'resident', lastUpdated: now,
  }, null, 2));
}

export async function createEngine(projectRoot: string, worldName: string): Promise<Engine> {
  const worldDir = path.join(projectRoot, 'worlds', worldName);
  const configPath = path.join(worldDir, '.world', 'config.json');
  if (!existsSync(configPath)) throw new Error(`World config not found: ${configPath}`);
  const config: WorldConfig = JSON.parse(await fs.readFile(configPath, 'utf-8'));
  return new Engine(projectRoot, worldDir, config);
}

export async function startAll(projectRoot: string, worldName: string, port: number): Promise<Engine> {
  const engine = await createEngine(projectRoot, worldName);
  await engine.init();
  startServer(engine, port);
  return engine;
}
