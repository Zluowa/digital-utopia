// @input: jobId, agentId, targetProject
// @output: git worktree lifecycle (create/remove/diff/list)
// @position: git-native isolation — the universal work area

import { promises as fs } from 'fs';
import path from 'path';
import { execFile } from 'child_process';
import { promisify } from 'util';
import type { WorktreeMeta, DiffSummary } from './protocol.js';

const exec = promisify(execFile);

// ── Resolve git repo root ────────────────────────────────────────────

async function repoRoot(): Promise<string> {
  const { stdout } = await exec('git', ['rev-parse', '--show-toplevel']);
  return stdout.trim().replace(/\\/g, '/');
}

function worktreeDir(worldDir: string): string {
  return path.join(worldDir, '.worktrees');
}

function metaFile(worldDir: string, jobId: string): string {
  return path.join(worktreeDir(worldDir), jobId, '.worktree-meta.json');
}

// ── Create worktree ──────────────────────────────────────────────────

export async function createWorktree(opts: {
  worldDir: string;
  jobId: string;
  agentId: string;
  agentType: string;
  targetProject: string | string[];
  baseBranch?: string;
}): Promise<WorktreeMeta> {
  const root = await repoRoot();
  const branch = `du/${opts.agentId}/${opts.jobId}`;
  const wtPath = path.join(worktreeDir(opts.worldDir), opts.jobId).replace(/\\/g, '/');
  const projects = Array.isArray(opts.targetProject) ? opts.targetProject : [opts.targetProject];

  await fs.mkdir(path.dirname(wtPath), { recursive: true });

  // Sparse checkout: only materialize the target project(s), not the whole repo
  await exec('git', [
    'worktree', 'add', '--no-checkout',
    '-b', branch,
    wtPath,
    opts.baseBranch ?? 'main',
  ], { cwd: root });

  await exec('git', ['sparse-checkout', 'set', '--no-cone', ...projects], { cwd: wtPath });
  await exec('git', ['checkout'], { cwd: wtPath });

  const meta: WorktreeMeta = {
    jobId: opts.jobId,
    agentId: opts.agentId,
    agentType: opts.agentType,
    branch,
    worktreePath: wtPath,
    targetProject: opts.targetProject,
    createdAt: new Date().toISOString(),
    status: 'active',
  };

  await fs.writeFile(metaFile(opts.worldDir, opts.jobId), JSON.stringify(meta, null, 2));
  return meta;
}

// ── Remove worktree ──────────────────────────────────────────────────

export async function removeWorktree(worldDir: string, jobId: string, deleteBranch = false): Promise<void> {
  const meta = await getMeta(worldDir, jobId);
  if (!meta) return;

  const root = await repoRoot();
  const wtPath = meta.worktreePath.replace(/\\/g, '/');

  try {
    await exec('git', ['worktree', 'remove', wtPath, '--force'], { cwd: root });
  } catch { /* already removed */ }

  if (deleteBranch) {
    try {
      await exec('git', ['branch', '-D', meta.branch], { cwd: root });
    } catch { /* branch may not exist */ }
  }
}

// ── Get diff ─────────────────────────────────────────────────────────

export async function getDiff(worldDir: string, jobId: string): Promise<{ summary: DiffSummary; raw: string }> {
  const meta = await getMeta(worldDir, jobId);
  if (!meta) throw new Error(`No worktree for job ${jobId}`);

  const root = await repoRoot();
  const base = 'main';

  const { stdout: stat } = await exec(
    'git', ['diff', '--stat', `${base}...${meta.branch}`],
    { cwd: root, maxBuffer: 10 * 1024 * 1024 },
  );

  const { stdout: raw } = await exec(
    'git', ['diff', `${base}...${meta.branch}`],
    { cwd: root, maxBuffer: 10 * 1024 * 1024 },
  );

  return { summary: parseDiffStat(stat), raw };
}

function parseDiffStat(stat: string): DiffSummary {
  const lines = stat.trim().split('\n');
  const summary = lines.at(-1) ?? '';
  const filesMatch = summary.match(/(\d+) files? changed/);
  const addMatch = summary.match(/(\d+) insertions?/);
  const delMatch = summary.match(/(\d+) deletions?/);
  return {
    filesChanged: parseInt(filesMatch?.[1] ?? '0'),
    linesAdded: parseInt(addMatch?.[1] ?? '0'),
    linesRemoved: parseInt(delMatch?.[1] ?? '0'),
    stat,
  };
}

// ── List all worktrees ───────────────────────────────────────────────

export async function listWorktrees(worldDir: string): Promise<WorktreeMeta[]> {
  const dir = worktreeDir(worldDir);
  try {
    const entries = await fs.readdir(dir, { withFileTypes: true });
    const metas: WorktreeMeta[] = [];
    for (const e of entries) {
      if (!e.isDirectory()) continue;
      try {
        const fp = path.join(dir, e.name, '.worktree-meta.json');
        metas.push(JSON.parse(await fs.readFile(fp, 'utf-8')) as WorktreeMeta);
      } catch { /* skip */ }
    }
    return metas;
  } catch {
    return [];
  }
}

// ── Get meta ─────────────────────────────────────────────────────────

export async function getMeta(worldDir: string, jobId: string): Promise<WorktreeMeta | null> {
  try {
    return JSON.parse(await fs.readFile(metaFile(worldDir, jobId), 'utf-8')) as WorktreeMeta;
  } catch {
    return null;
  }
}

export async function updateMetaStatus(
  worldDir: string, jobId: string, status: WorktreeMeta['status'],
): Promise<void> {
  const meta = await getMeta(worldDir, jobId);
  if (!meta) return;
  meta.status = status;
  await fs.writeFile(metaFile(worldDir, jobId), JSON.stringify(meta, null, 2));
}
