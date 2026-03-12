// @input: none (pure type definitions)
// @output: universal outsource protocol types
// @position: the USB interface — stable contract, agents plug in via adapters

// ── Job: what needs to be done ───────────────────────────────────────

export interface Job {
  id: string;
  title: string;
  description: string;
  targetProject: string | string[];  // relative to repo root, e.g. "projects/digital-utopia/frontend-new" or array for multi-dir
  reward: number;
  requiredSkills: string[];
  status: JobStatus;
  createdAt: string;
  createdBy: string;           // who posted (e.g. "MOSS", "helios")
  expiresAt?: string;
  metadata?: Record<string, unknown>;
}

export type JobStatus = 'open' | 'claimed' | 'in-progress' | 'submitted' | 'completed' | 'cancelled';

// ── Claim: an agent applies for a job ────────────────────────────────

export interface Claim {
  jobId: string;
  agentId: string;
  agentType: string;           // "du-resident" | "openclaw" | "codex" | "human"
  claimedAt: string;
  message?: string;            // why this agent is a good fit
}

// ── Assignment: agent is hired, worktree provisioned ─────────────────

export interface Assignment {
  jobId: string;
  agentId: string;
  agentType: string;
  branch: string;              // e.g. "du/bob/a1b2c3d4"
  worktreePath: string;        // absolute path to the worktree
  assignedAt: string;
  accessPaths: string[];       // directories the agent can access
}

// ── Delivery: agent signals work is done ─────────────────────────────

export interface Delivery {
  jobId: string;
  agentId: string;
  submittedAt: string;
  commitHash: string;
  summary: string;
}

// ── Review: quality assessment ───────────────────────────────────────

export type ReviewVerdict = 'excellent' | 'good' | 'acceptable' | 'rejected';

export interface Review {
  jobId: string;
  reviewedAt: string;
  verdict: ReviewVerdict;
  feedback: string;
  automated: AutomatedCheckResult;
  reward: number;              // final reward after multiplier
}

export interface AutomatedCheckResult {
  tscPassed: boolean;
  tscOutput: string;
  scopeValid: boolean;
  scopeViolations: string[];
  diff: DiffSummary;
}

export interface DiffSummary {
  filesChanged: number;
  linesAdded: number;
  linesRemoved: number;
  stat: string;
}

// ── Adapter interface: what each agent type must implement ────────────

export interface AgentAdapter {
  readonly type: string;

  /** Notify agent they've been hired */
  notify(agentId: string, assignment: Assignment, job: Job): Promise<void>;

  /** Pay agent for completed work */
  pay(agentId: string, amount: number, reason: string, metadata?: Record<string, unknown>): Promise<void>;

  /** Verify agent identity / eligibility */
  canClaim(agentId: string, job: Job): Promise<{ eligible: boolean; reason?: string }>;
}

// ── Quality multipliers (universal) ──────────────────────────────────

export const QUALITY_MULTIPLIER: Record<ReviewVerdict, number> = {
  excellent: 2.0,
  good: 1.5,
  acceptable: 1.0,
  rejected: 0,
};

// ── WorktreeMeta: persisted alongside each worktree ──────────────────

export interface WorktreeMeta {
  jobId: string;
  agentId: string;
  agentType: string;
  branch: string;
  worktreePath: string;
  targetProject: string | string[];
  createdAt: string;
  status: 'active' | 'submitted' | 'merged' | 'abandoned';
}
