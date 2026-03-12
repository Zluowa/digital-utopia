// @input: worldDir filesystem path
// @output: Job CRUD on the bulletin board
// @position: agent-agnostic task board, pure file operations

import { promises as fs } from 'fs';
import path from 'path';
import { randomUUID } from 'crypto';
import type { Job, JobStatus, Claim, Assignment, WorktreeMeta } from './protocol.js';

const BOARD_DIR = 'commons/outsource-board';

function boardPath(worldDir: string): string {
  return path.join(worldDir, BOARD_DIR);
}

function jobFile(worldDir: string, jobId: string): string {
  return path.join(boardPath(worldDir), `job-${jobId}.json`);
}

// ── Ensure board directory exists ────────────────────────────────────

async function ensureBoard(worldDir: string): Promise<void> {
  await fs.mkdir(boardPath(worldDir), { recursive: true });
}

// ── Create ───────────────────────────────────────────────────────────

export async function createJob(
  worldDir: string,
  input: Pick<Job, 'title' | 'description' | 'targetProject' | 'reward' | 'requiredSkills' | 'createdBy'> &
    Partial<Pick<Job, 'expiresAt' | 'metadata'>>,
): Promise<Job> {
  await ensureBoard(worldDir);
  const job: Job = {
    id: randomUUID().slice(0, 8),
    status: 'open',
    createdAt: new Date().toISOString(),
    ...input,
  };
  await fs.writeFile(jobFile(worldDir, job.id), JSON.stringify(job, null, 2));
  return job;
}

// ── Read ─────────────────────────────────────────────────────────────

export async function getJob(worldDir: string, jobId: string): Promise<Job | null> {
  try {
    return JSON.parse(await fs.readFile(jobFile(worldDir, jobId), 'utf-8')) as Job;
  } catch {
    return null;
  }
}

export async function listJobs(worldDir: string, status?: JobStatus): Promise<Job[]> {
  await ensureBoard(worldDir);
  const dir = boardPath(worldDir);
  const files = (await fs.readdir(dir)).filter(f => f.startsWith('job-') && f.endsWith('.json'));
  const jobs: Job[] = [];
  for (const f of files) {
    try {
      jobs.push(JSON.parse(await fs.readFile(path.join(dir, f), 'utf-8')) as Job);
    } catch { /* skip corrupt */ }
  }
  const filtered = status ? jobs.filter(j => j.status === status) : jobs;
  return filtered.sort((a, b) => (b.createdAt ?? '').localeCompare(a.createdAt ?? ''));
}

// ── Update status ────────────────────────────────────────────────────

export async function updateJobStatus(worldDir: string, jobId: string, status: JobStatus): Promise<Job | null> {
  const job = await getJob(worldDir, jobId);
  if (!job) return null;
  job.status = status;
  await fs.writeFile(jobFile(worldDir, job.id), JSON.stringify(job, null, 2));
  return job;
}

// ── Claim ────────────────────────────────────────────────────────────

export async function recordClaim(worldDir: string, claim: Claim): Promise<void> {
  const dir = path.join(boardPath(worldDir), 'claims');
  await fs.mkdir(dir, { recursive: true });
  const fp = path.join(dir, `claim-${claim.jobId}-${claim.agentId}.json`);
  await fs.writeFile(fp, JSON.stringify(claim, null, 2));
}

// ── Assignment ───────────────────────────────────────────────────────

export async function recordAssignment(worldDir: string, assignment: Assignment): Promise<void> {
  const dir = path.join(boardPath(worldDir), 'assignments');
  await fs.mkdir(dir, { recursive: true });
  const fp = path.join(dir, `assign-${assignment.jobId}.json`);
  await fs.writeFile(fp, JSON.stringify(assignment, null, 2));
}

export async function getAssignment(worldDir: string, jobId: string): Promise<Assignment | null> {
  const fp = path.join(boardPath(worldDir), 'assignments', `assign-${jobId}.json`);
  try {
    return JSON.parse(await fs.readFile(fp, 'utf-8')) as Assignment;
  } catch {
    return null;
  }
}
