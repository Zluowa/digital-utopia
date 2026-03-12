// @input: 世界目录结构（递归 children/ + residents/）
// @output: Agent注册表 + TreeNode 树
// @position: 引擎核心，等同于"空间"

import { existsSync, promises as fs } from 'fs';
import path from 'path';
import type { AgentEntry, AgentStatus, AgentType, TreeNode } from './types.js';
import { getBalance } from './economy.js';

const MAX_LOGS = 200;

function detectType(firstLine: string): AgentType {
  const m = firstLine.match(/<!--\s*type:\s*(\S+)\s*-->/);
  if (!m) return 'resident';
  const t = m[1] as AgentType;
  const valid: AgentType[] = ['mastermind', 'world-keeper', 'zone-keeper', 'resident', 'observer'];
  return valid.includes(t) ? t : 'resident';
}

async function readFirstLine(filePath: string): Promise<string> {
  try {
    const buf = await fs.readFile(filePath, 'utf8');
    return buf.split('\n')[0] ?? '';
  } catch { return ''; }
}

async function listSubdirs(dir: string): Promise<string[]> {
  if (!existsSync(dir)) return [];
  const entries = await fs.readdir(dir, { withFileTypes: true });
  return entries.filter(e => e.isDirectory()).map(e => e.name);
}

export class Registry {
  private agents = new Map<string, AgentEntry>();
  readonly rootDir: string;

  constructor(private worldDir: string) {
    this.rootDir = worldDir;
  }

  /** Recursive scan → flat AgentEntry list (backward compat) */
  async scan(): Promise<AgentEntry[]> {
    const tree = await this.scanTree(this.worldDir, 0, null);
    return this.flattenTree(tree);
  }

  /** Recursive scan → TreeNode tree */
  async scanTree(dir: string, depth: number, parentId: string | null): Promise<TreeNode> {
    const id = path.basename(dir);
    const claudeMd = path.join(dir, 'CLAUDE.md');
    const firstLine = await readFirstLine(claudeMd);
    const agentType = detectType(firstLine);
    const balance = await this.safeBalance(dir);
    const inboxCount = await this.countInbox(dir);
    const status: AgentStatus = balance <= 0 ? 'dead' : 'alive';

    // scan children/ and residents/ (backward compat)
    const childDirs = [
      ...(await listSubdirs(path.join(dir, 'children'))).map(n => path.join(dir, 'children', n)),
      ...(await listSubdirs(path.join(dir, 'residents'))).map(n => path.join(dir, 'residents', n)),
    ];

    const children: TreeNode[] = [];
    for (const childDir of childDirs) {
      if (!existsSync(path.join(childDir, 'CLAUDE.md'))) continue;
      children.push(await this.scanTree(childDir, depth + 1, id));
    }

    const node: TreeNode = {
      id, dir, type: agentType, depth, status,
      balance, inboxCount, parent: parentId, children,
    };

    // update flat map
    await this.upsertAgent(node);
    return node;
  }

  private async upsertAgent(node: TreeNode): Promise<void> {
    const existing = this.agents.get(node.id);
    const meta = await this.readMetadata(node.dir);
    // Balance > 0 → alive (unless buried). Balance <= 0 → dead.
    const status = node.balance <= 0 ? 'dead' : (existing?.status === 'awake' ? 'awake' : 'alive');
    const entry: AgentEntry = {
      id: node.id,
      dir: node.dir,
      type: node.type,
      status,
      tokenBalance: node.balance,
      lastAwakened: existing?.lastAwakened ?? '',
      inboxCount: node.inboxCount,
      depth: node.depth,
      parentId: node.parent,
      childCount: node.children.length,
      identity: meta?.identity ?? existing?.identity,
      currentGoal: meta?.currentGoal ?? existing?.currentGoal,
      economicNiche: meta?.economicNiche ?? existing?.economicNiche,
      pid: existing?.pid,
      logs: existing?.logs ?? [],
    };
    this.agents.set(node.id, entry);
  }

  private async readMetadata(dir: string): Promise<{ identity?: string; currentGoal?: string; economicNiche?: string } | null> {
    const metaPath = path.join(dir, '.claude', 'metadata.json');
    if (!existsSync(metaPath)) return null;
    try {
      return JSON.parse(await fs.readFile(metaPath, 'utf-8'));
    } catch { return null; }
  }

  private flattenTree(node: TreeNode): AgentEntry[] {
    const result: AgentEntry[] = [];
    const walk = (n: TreeNode) => {
      const e = this.agents.get(n.id);
      if (e) result.push(e);
      for (const child of n.children) walk(child);
    };
    // skip root (world dir itself) — start from children
    for (const child of node.children) walk(child);
    return result;
  }

  private async safeBalance(dir: string): Promise<number> {
    try { return await getBalance(dir); } catch { return 0; }
  }

  private async countInbox(dir: string): Promise<number> {
    const inbox = path.join(dir, 'inbox');
    if (!existsSync(inbox)) return 0;
    const files = await fs.readdir(inbox);
    return files.filter(f => f.endsWith('.json')).length;
  }

  get(id: string): AgentEntry | undefined { return this.agents.get(id); }

  remove(id: string): void { this.agents.delete(id); }

  update(id: string, patch: Partial<AgentEntry>): void {
    const e = this.agents.get(id);
    if (e) Object.assign(e, patch);
  }

  appendLog(id: string, line: string): void {
    const e = this.agents.get(id);
    if (!e) return;
    e.logs.push(line);
    if (e.logs.length > MAX_LOGS) e.logs = e.logs.slice(-MAX_LOGS);
  }

  all(): AgentEntry[] { return [...this.agents.values()]; }

  getDir(id: string): string {
    const e = this.agents.get(id);
    return e?.dir ?? path.join(this.worldDir, 'children', id);
  }
}
