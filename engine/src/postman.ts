// @input: Registry (agent locations) + worldDir for dead-letter routing
// @output: event-driven outbox→inbox delivery; emits 'mail-delivered' and 'wake-request'
// @position: 引擎消息路由，fs.watch事件驱动（不再心跳轮询）

import { existsSync, promises as fs, writeFileSync, mkdirSync } from 'fs';
import path from 'path';
import { EventEmitter } from 'events';
import chokidar, { type FSWatcher } from 'chokidar';
import type { Registry } from './registry.js';

type Emit = (type: string, msg: string, agentId?: string) => void;

/** Escape bare control chars inside JSON string values (agents write raw \n in content) */
function sanitizeJson(raw: string): string {
  return raw.replace(/"(?:[^"\\]|\\.)*"/g, m =>
    m.replace(/[\x00-\x1f]/g, c => '\\u' + c.charCodeAt(0).toString(16).padStart(4, '0')),
  );
}

function writeShouldStop(agentDir: string, reason: string): void {
  const dir = path.join(agentDir, '.claude');
  try {
    mkdirSync(dir, { recursive: true });
    writeFileSync(path.join(dir, 'should-stop'), reason);
  } catch { /* best-effort */ }
}

/** Deliver a single message file to one agent's inbox (copy variant for broadcast). */
async function deliverToAgent(
  content: string,
  file: string,
  senderId: string,
  targetDir: string,
  targetId: string,
  subject: string,
  emit: Emit,
): Promise<void> {
  const inbox = path.join(targetDir, 'inbox');
  await fs.mkdir(inbox, { recursive: true });
  await fs.writeFile(path.join(inbox, file), content);
  emit('mail-delivered', `${senderId} → ${targetId}: ${subject}`, targetId);
}

/** Returns true when msg has expired per its TTL. */
function isTtlExpired(msg: Record<string, unknown>): boolean {
  const { ttl, timestamp } = msg;
  if (typeof ttl !== 'number' || ttl <= 0 || typeof timestamp !== 'string') return false;
  return Date.now() - new Date(timestamp).getTime() > ttl;
}

/** Write a delivery ack back to sender's inbox. */
async function sendAck(
  msg: Record<string, unknown>,
  senderId: string,
  targetIds: string[],
  registry: Registry,
): Promise<void> {
  const sender = registry.get(senderId);
  if (!sender) return;
  const ack = {
    type: 'ack',
    originalId: msg['id'],
    from: 'system',
    to: senderId,
    subject: 'delivery-ack',
    deliveredTo: targetIds,
    timestamp: new Date().toISOString(),
  };
  const inbox = path.join(sender.dir, 'inbox');
  await fs.mkdir(inbox, { recursive: true });
  await fs.writeFile(path.join(inbox, `ack-${msg['id'] ?? Date.now()}.json`), JSON.stringify(ack));
}

/** Resolve broadcast/team targets — proposal L484-486. */
function resolveTargets(to: string, senderId: string, registry: Registry): string[] {
  if (to === 'broadcast') return registry.all().filter(a => a.id !== senderId).map(a => a.id);
  if (to.startsWith('team:')) {
    const team = to.slice(5);
    return registry.all().filter(a => a.id !== senderId && a.economicNiche === team).map(a => a.id);
  }
  return [to];
}

async function deliverFile(
  src: string,
  file: string,
  senderId: string,
  registry: Registry,
  worldDir: string,
  emit: Emit,
): Promise<{ targetId: string; priority: string }[] | null> {
  const raw = await fs.readFile(src, 'utf-8');
  const msg: unknown = JSON.parse(sanitizeJson(raw));
  if (!msg || typeof msg !== 'object') return null;

  const typedMsg = msg as Record<string, unknown>;
  const { to, subject, priority } = typedMsg;
  if (!to || typeof to !== 'string') return null;

  if (isTtlExpired(typedMsg)) {
    await fs.rm(src, { force: true });
    const deadLetterDir = path.join(worldDir, 'commons', 'dead-letter');
    await fs.mkdir(deadLetterDir, { recursive: true });
    await fs.writeFile(path.join(deadLetterDir, file), raw);
    emit('ttl-expired', `${senderId} → ${to}: message expired`, senderId);
    return null;
  }

  const targetIds = resolveTargets(to, senderId, registry);
  const subjectStr = typeof subject === 'string' ? subject : file;
  const pri = typeof priority === 'string' ? priority : 'normal';
  const results: { targetId: string; priority: string }[] = [];

  for (const tid of targetIds) {
    const target = registry.get(tid);
    if (!target) continue;
    await deliverToAgent(raw, file, senderId, target.dir, tid, subjectStr, emit);
    results.push({ targetId: tid, priority: pri });
  }

  // Remove source file after delivery
  await fs.rm(src, { force: true });

  if (results.length > 0 && typedMsg['ack'] === true) {
    await sendAck(typedMsg, senderId, results.map(r => r.targetId), registry);
  }

  if (results.length === 0) {
    if (to === 'helios' || to.startsWith('external:')) {
      await fs.rm(src, { force: true });
      emit('external-message', raw, senderId);
      return null;
    }
    const deadLetterDir = path.join(worldDir, 'commons', 'dead-letter');
    await fs.mkdir(deadLetterDir, { recursive: true });
    await fs.writeFile(path.join(deadLetterDir, file), raw);
    emit('dead-letter', `${senderId} → ${to}: target not found`, senderId);
    return null;
  }

  return results;
}

export class Postman extends EventEmitter {
  private readonly watchers = new Map<string, FSWatcher>();

  constructor(
    private readonly registry: Registry,
    private readonly worldDir: string,
  ) {
    super();
  }

  /** Start watching all known agents' outbox directories */
  start(): void {
    for (const agent of this.registry.all()) {
      this.watchAgent(agent.id, agent.dir);
    }
  }

  /** Add a watcher for a newly created agent */
  watchAgent(agentId: string, agentDir: string): void {
    if (this.watchers.has(agentId)) return;
    const outboxDir = path.join(agentDir, 'outbox');
    const watcher = chokidar.watch(outboxDir, {
      ignoreInitial: false,
      awaitWriteFinish: { stabilityThreshold: 200, pollInterval: 50 },
      depth: 0,
    });
    watcher.on('add', (filePath) => {
      if (!filePath.endsWith('.json')) return;
      const file = path.basename(filePath);
      this.deliver(filePath, file, agentId).catch(() => {});
    });
    this.watchers.set(agentId, watcher);
  }

  private async deliver(src: string, file: string, senderId: string): Promise<void> {
    try {
      const results = await deliverFile(
        src, file, senderId,
        this.registry, this.worldDir,
        (type, msg, id) => this.emit('event', { type, message: msg, agentId: id }),
      );

      if (!results) return;

      for (const { targetId, priority } of results) {
        const target = this.registry.get(targetId);
        if (!target) continue;
        const isUrgent = priority === 'urgent' || priority === 'interrupt';
        if (isUrgent && target.status === 'alive') {
          writeShouldStop(target.dir, `Urgent message received — check inbox`);
          this.emit('event', { type: 'soft-interrupt', message: `Soft interrupt sent to ${targetId}` });
        } else if (isUrgent && target.status === 'sleeping') {
          this.emit('wake-request', targetId, `urgent message from ${senderId}`);
        } else if (target.status === 'sleeping') {
          this.emit('wake-request', targetId, 'new message in inbox');
        }
      }
    } catch { /* skip parse errors silently */ }
  }

  stop(): void {
    for (const w of this.watchers.values()) w.close();
    this.watchers.clear();
  }
}

/**
 * One-shot scan of all agents' outbox folders — used as startup catch-up only.
 * Returns count of delivered messages.
 */
export async function deliverOutbox(
  registry: Registry,
  worldDir: string,
  emit: Emit,
): Promise<number> {
  let delivered = 0;
  for (const agent of registry.all()) {
    const outbox = path.join(agent.dir, 'outbox');
    if (!existsSync(outbox)) continue;

    let files: string[];
    try { files = await fs.readdir(outbox); } catch { continue; }

    for (const file of files.filter(f => f.endsWith('.json'))) {
      const src = path.join(outbox, file);
      try {
        const results = await deliverFile(src, file, agent.id, registry, worldDir, emit);
        if (results) delivered += results.length;
      } catch { /* skip unparseable or fs-error files silently */ }
    }
  }
  return delivered;
}
