// @input: 全系统共享
// @output: 所有类型定义 + API response helpers
// @position: 引擎基础层

// ── API response helpers ──────────────────────────────────

export interface ApiResponse<T> {
  success: boolean;
  data: T | null;
  error_data: unknown;
  message: string | null;
}

export function ok<T>(data: T): ApiResponse<T> {
  return { success: true, data, error_data: null, message: null };
}

export function err(message: string): ApiResponse<null> {
  return { success: false, data: null, error_data: null, message };
}

// ── Agent types ───────────────────────────────────────────

export type AgentStatus = 'alive' | 'dead' | 'awakening' | 'sleeping';
export type AgentType = 'mastermind' | 'world-keeper' | 'zone-keeper' | 'resident' | 'observer';

export interface AgentEntry {
  id: string;
  dir: string;
  type: AgentType;
  status: AgentStatus;
  tokenBalance: number;
  lastAwakened: string;
  inboxCount: number;
  depth: number;
  parentId: string | null;
  childCount: number;
  identity?: string;
  currentGoal?: string;
  economicNiche?: string;
  pid?: number;
  logs: string[];
}

export interface TreeNode {
  id: string;
  dir: string;
  type: AgentType;
  depth: number;
  status: AgentStatus;
  balance: number;
  inboxCount: number;
  parent: string | null;
  children: TreeNode[];
}

export interface WorldConfig {
  id: string;
  name: string;
  theme?: string;
  description?: string;
  createdAt: string;
  physics: PhysicsConfig;
}

export interface PhysicsConfig {
  economy: {
    initialTokens: number;
    awakenBaseCost: number;
    tokenPerDollar: number;
    criticalThreshold: number;
    deathThreshold: number;
    taxRate?: number;
    /** Daily survival cost per agent (proposal L97-109). Zero = no auto-deduct. */
    dailySurvivalCost?: number;
    /**
     * Percentage (0-100) of external deposits that are minted into the world treasury.
     * This is the default split used by /api/exchange/deposit and revenue minting.
     */
    treasurySharePct?: number;
  };
  awakening: {
    defaultIntervalMs: number;
    minIntervalMs: number;
    maxIntervalMs: number;
    inboxTrigger: boolean;
  };
}

export interface EconomySummary {
  treasuryBalance: number;
  circulation: number;
  transactionCount: number;
  distribution: { id: string; balance: number; pct: number }[];
}

export type TxType =
  | 'deduct'
  | 'credit'
  | 'transfer'
  | 'awakening'
  | 'awakening_fee'
  | 'trade'
  | 'bounty'
  | 'tax'
  | 'subsidy'
  | 'mint'
  | 'deposit';

export interface Transaction {
  id: string;
  from: string;
  to: string;
  amount: number;
  reason: string;
  timestamp: string;
  type: TxType;
  metadata?: Record<string, unknown>;
}

export interface WalletData {
  agentId: string;
  balance: number;
  currency: string;
  transactions: Transaction[];
  createdAt: string;
}

export interface TimelineEvent {
  id: string;
  type: string;
  message: string;
  timestamp: string;
  agentId?: string;
  metadata?: Record<string, unknown>;
}

export interface WorldSnapshot {
  worldId: string;
  worldName: string;
  worldTheme?: string;
  timestamp: string;
  totalAgents: number;
  aliveAgents: number;
  totalTokens: number;
  agents: AgentEntry[];
  tree?: TreeNode;
  economySummary?: EconomySummary;
}

export interface MessagePayload {
  id: string;
  from: string;
  to: string;
  subject: string;
  content: string;
  timestamp: string;
  priority: 'low' | 'normal' | 'urgent' | 'interrupt';
  /** Message body — alias for content (proposal L299-312) */
  body?: string;
  /** Reply chain: which message this replies to */
  replyTo?: string;
  /** TTL in ms — expired messages go to dead-letter */
  ttl?: number;
  /** Whether sender requires delivery acknowledgement */
  ack?: boolean;
  /** Routing type: direct, broadcast, team, or system */
  type?: 'direct' | 'broadcast' | 'team' | 'system';
}

export interface AgentSpec {
  name: string;
  type?: AgentType;
  personality?: string;
  backstory?: string;
  economic_niche?: string;
  speech_style?: string;
  initial_goal?: string;
  friends?: string[];
}

export interface WorldSpec {
  name: string;
  theme?: string;
  physics?: Partial<PhysicsConfig>;
  agents: AgentSpec[];
}

// ── Economic metrics types ─────────────────────────────────

export interface EconomicMetrics {
  giniCoefficient: number;     // 0 = perfect equality, 1 = perfect inequality
  velocityIndex: number;        // transactions per agent per cycle (higher = more active)
  inflationRate: number;        // % change in total circulation vs last snapshot
  totalSupply: number;          // tokens in circulation + treasury
  circulationRatio: number;     // circulation / totalSupply (0-1)
  aliveAgentPct: number;        // % agents above deathThreshold
  wealthConcentration: number;  // top 20% agents hold X% of tokens (Pareto measure)
}


