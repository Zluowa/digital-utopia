// @input: MOSS operator commands via process.argv
// @output: outsource workflow actions
// @position: CLI entry point — the control panel

import path from 'path';
import { createJob, getJob, listJobs, updateJobStatus, recordAssignment } from './core/board.js';
import { createWorktree, removeWorktree, getMeta, listWorktrees, updateMetaStatus } from './core/provision.js';
import { runChecks, formatReport } from './core/review.js';
import { QUALITY_MULTIPLIER } from './core/protocol.js';
import type { AgentAdapter } from './core/protocol.js';
import { DuResidentAdapter } from './adapters/du-resident.js';
import { GenericAdapter } from './adapters/generic.js';

// ── Config ───────────────────────────────────────────────────────────

const WORLD_DIR = path.resolve(import.meta.dirname, '../../worlds/genesis');

function getAdapter(type: string): AgentAdapter {
  if (type === 'du') return new DuResidentAdapter(WORLD_DIR);
  return new GenericAdapter();
}

function parseProject(raw: string): string | string[] {
  const parts = raw.split(',').map(s => s.trim()).filter(Boolean);
  return parts.length === 1 ? parts[0] : parts;
}

function arg(name: string): string {
  const idx = process.argv.indexOf(`--${name}`);
  if (idx === -1 || idx + 1 >= process.argv.length) return '';
  return process.argv[idx + 1];
}

// ── Commands ─────────────────────────────────────────────────────────

async function cmdPost(): Promise<void> {
  const job = await createJob(WORLD_DIR, {
    title: arg('title') || 'Untitled Job',
    description: arg('desc') || '',
    targetProject: parseProject(arg('project') || 'projects/digital-utopia/frontend-new'),
    reward: parseInt(arg('reward') || '100'),
    requiredSkills: (arg('skills') || '').split(',').filter(Boolean),
    createdBy: 'MOSS',
  });
  console.log(`[post] Job created: ${job.id}`);
  console.log(`  Title: ${job.title}`);
  console.log(`  Reward: ${job.reward} Token`);
  console.log(`  Project: ${job.targetProject}`);
}

async function cmdHire(): Promise<void> {
  const jobId = arg('job');
  const agentId = arg('agent');
  const adapterType = arg('adapter') || 'du';
  if (!jobId || !agentId) return console.error('Usage: hire --job <id> --agent <id> [--adapter du|generic]');

  const job = await getJob(WORLD_DIR, jobId);
  if (!job) return console.error(`Job ${jobId} not found`);

  const adapter = getAdapter(adapterType);
  const check = await adapter.canClaim(agentId, job);
  if (!check.eligible) return console.error(`Agent not eligible: ${check.reason}`);

  const meta = await createWorktree({
    worldDir: WORLD_DIR, jobId, agentId,
    agentType: adapter.type,
    targetProject: job.targetProject,
  });

  const assignment = {
    jobId, agentId, agentType: adapter.type,
    branch: meta.branch,
    worktreePath: meta.worktreePath,
    assignedAt: new Date().toISOString(),
    accessPaths: (Array.isArray(job.targetProject) ? job.targetProject : [job.targetProject])
      .map(p => path.join(meta.worktreePath, p)),
  };

  await recordAssignment(WORLD_DIR, assignment);
  await updateJobStatus(WORLD_DIR, jobId, 'in-progress');
  await adapter.notify(agentId, assignment, job);

  console.log(`[hire] ${agentId} assigned to job ${jobId}`);
  console.log(`  Branch: ${meta.branch}`);
  console.log(`  Worktree: ${meta.worktreePath}`);
}

async function cmdReview(): Promise<void> {
  const jobId = arg('job');
  if (!jobId) return console.error('Usage: review --job <id>');

  const job = await getJob(WORLD_DIR, jobId);
  if (!job) return console.error(`Job ${jobId} not found`);

  const checks = await runChecks(WORLD_DIR, jobId, job.targetProject);
  console.log(formatReport(checks));
}

async function cmdPay(): Promise<void> {
  const jobId = arg('job');
  const verdict = arg('verdict') as 'excellent' | 'good' | 'acceptable' | 'rejected';
  const feedback = arg('feedback') || '';
  if (!jobId || !verdict) return console.error('Usage: pay --job <id> --verdict <excellent|good|acceptable|rejected> [--feedback "..."]');

  const job = await getJob(WORLD_DIR, jobId);
  const meta = await getMeta(WORLD_DIR, jobId);
  if (!job || !meta) return console.error(`Job or worktree not found: ${jobId}`);

  const multiplier = QUALITY_MULTIPLIER[verdict] ?? 0;
  const reward = Math.floor(job.reward * multiplier);
  const adapter = getAdapter(meta.agentType === 'du-resident' ? 'du' : 'generic');

  if (reward > 0) {
    await adapter.pay(meta.agentId, reward, `outsource-reward: ${job.title}`, { verdict, jobId });
    console.log(`[pay] ${meta.agentId} rewarded ${reward} Token (${verdict}, ${multiplier}x)`);
  } else {
    console.log(`[pay] Rejected — no payment. Feedback sent.`);
  }

  const finalStatus = verdict === 'rejected' ? 'in-progress' : 'completed';
  await updateJobStatus(WORLD_DIR, jobId, finalStatus);
  await updateMetaStatus(WORLD_DIR, jobId, verdict === 'rejected' ? 'active' : 'merged');
}

async function cmdCleanup(): Promise<void> {
  const jobId = arg('job');
  if (!jobId) return console.error('Usage: cleanup --job <id>');

  const meta = await getMeta(WORLD_DIR, jobId);
  const deleteBranch = meta?.status !== 'merged';
  await removeWorktree(WORLD_DIR, jobId, deleteBranch);
  await updateJobStatus(WORLD_DIR, jobId, 'cancelled');
  console.log(`[cleanup] Worktree removed for job ${jobId}`);
}

async function cmdList(): Promise<void> {
  const jobs = await listJobs(WORLD_DIR);
  const worktrees = await listWorktrees(WORLD_DIR);

  console.log(`\n  Jobs: ${jobs.length}`);
  for (const j of jobs) {
    const wt = worktrees.find(w => w.jobId === j.id);
    const wtLabel = wt ? ` → ${wt.agentId} [${wt.status}]` : '';
    console.log(`    ${j.id}  ${j.status.padEnd(12)} ${j.reward}T  ${j.title}${wtLabel}`);
  }
  console.log('');
}

// ── Dispatch ─────────────────────────────────────────────────────────

const cmd = process.argv[2];
const commands: Record<string, () => Promise<void>> = {
  post: cmdPost, hire: cmdHire, review: cmdReview,
  pay: cmdPay, cleanup: cmdCleanup, list: cmdList,
};

if (!cmd || !commands[cmd]) {
  console.log('Usage: npx tsx cli.ts <post|hire|review|pay|cleanup|list> [options]');
  process.exit(1);
}

commands[cmd]().catch(err => { console.error(err.message); process.exit(1); });
