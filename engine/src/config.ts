// @input: env vars + runtime config file
// @output: 全局配置（defaults → env → runtime override）
// @position: 所有可配置值的唯一来源

import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'fs';
import path from 'path';

// ── Schema ──────────────────────────────────────────────

export interface DUConfig {
  anthropicBaseUrl: string;
  anthropicApiKey: string;
  openaiBaseUrl: string;
  openaiApiKey: string;
  agentModel: string;
  gmModel: string;
  verifierTier1Model: string;
  verifierTier2Model: string;
  maxConcurrentAgents: number;
  heartbeatIntervalMs: number;
  maxChatDurationMs: number;
}

export type ConfigKey = keyof DUConfig;

// ── Defaults ────────────────────────────────────────────

const DEFAULTS: DUConfig = {
  anthropicBaseUrl: 'https://api.anthropic.com',
  anthropicApiKey: '',
  openaiBaseUrl: '',
  openaiApiKey: '',
  agentModel: 'claude-sonnet-4-6',
  gmModel: 'claude-haiku-4-5-20251001',
  verifierTier1Model: 'claude-haiku-4-5-20251001',
  verifierTier2Model: 'claude-sonnet-4-6',
  maxConcurrentAgents: 3,
  heartbeatIntervalMs: 60_000,
  maxChatDurationMs: 5 * 60_000,
};

// ── Env mapping ─────────────────────────────────────────

const ENV_MAP: Record<ConfigKey, string> = {
  anthropicBaseUrl: 'ANTHROPIC_BASE_URL',
  anthropicApiKey: 'ANTHROPIC_API_KEY',
  openaiBaseUrl: 'MINIMAX_BASE_URL',
  openaiApiKey: 'MINIMAX_API_KEY',
  agentModel: 'DU_AGENT_MODEL',
  gmModel: 'DU_GM_MODEL',
  verifierTier1Model: 'DU_VERIFIER_T1_MODEL',
  verifierTier2Model: 'DU_VERIFIER_T2_MODEL',
  maxConcurrentAgents: 'DU_MAX_CONCURRENT',
  heartbeatIntervalMs: 'DU_HEARTBEAT_MS',
  maxChatDurationMs: 'DU_MAX_CHAT_MS',
};

// ── Runtime overrides (per-world) ───────────────────────

let worldDir: string | null = null;

function configPath(): string | null {
  return worldDir ? path.join(worldDir, '.world', 'engine-config.json') : null;
}

function readOverrides(): Partial<DUConfig> {
  const p = configPath();
  if (!p || !existsSync(p)) return {};
  try { return JSON.parse(readFileSync(p, 'utf-8')); }
  catch { return {}; }
}

// ── Public API ──────────────────────────────────────────

/** Set the world directory for runtime config persistence */
export function setWorldDir(dir: string): void { worldDir = dir; }

/** Get resolved config: defaults → env → runtime override */
export function getConfig(): DUConfig {
  const result = { ...DEFAULTS };
  // Layer 2: env vars
  for (const [key, envKey] of Object.entries(ENV_MAP)) {
    const val = process.env[envKey];
    if (val !== undefined && val !== '') {
      const k = key as ConfigKey;
      (result as Record<string, unknown>)[k] = typeof DEFAULTS[k] === 'number' ? Number(val) : val;
    }
  }
  // Layer 3: runtime file
  const overrides = readOverrides();
  for (const [k, v] of Object.entries(overrides)) {
    if (v !== undefined && k in DEFAULTS) {
      (result as Record<string, unknown>)[k] = v;
    }
  }
  return result;
}

/** Get a single config value */
export function get<K extends ConfigKey>(key: K): DUConfig[K] {
  return getConfig()[key];
}

/** Patch runtime overrides (persisted to world config file) */
export function setConfigOverrides(patch: Partial<DUConfig>): void {
  const p = configPath();
  if (!p) throw new Error('No world directory set');
  const current = readOverrides();
  const merged = { ...current, ...patch };
  mkdirSync(path.dirname(p), { recursive: true });
  writeFileSync(p, JSON.stringify(merged, null, 2));
}

/** Reset all runtime overrides (revert to defaults + env) */
export function resetConfig(): void {
  const p = configPath();
  if (p && existsSync(p)) writeFileSync(p, '{}');
}

/** Get config for API response (mask secrets) */
export function getSafeConfig(): DUConfig {
  const cfg = getConfig();
  return { ...cfg, anthropicApiKey: cfg.anthropicApiKey ? '••••' + cfg.anthropicApiKey.slice(-4) : '' };
}

/** Get defaults for UI display */
export function getDefaults(): DUConfig { return { ...DEFAULTS }; }

/** Get env var names for UI display */
export function getEnvMap(): Record<ConfigKey, string> { return { ...ENV_MAP }; }
