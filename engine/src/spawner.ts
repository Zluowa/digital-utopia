// @input: Registry(agent目录), config(model/apiKey/baseUrl/commonsDir)
// @output: spawn/kill Claude Code进程，Semaphore并发控制，lockfile管理
// @position: 引擎进程层，等同于"时间"的执行者

import { spawn, type ChildProcess } from 'child_process';
import { createWriteStream, existsSync, unlinkSync, promises as fs, type WriteStream } from 'fs';
import path from 'path';
import { get } from './config.js';

export class Semaphore {
  private queue: (() => void)[] = [];
  private active = 0;

  constructor(private max: number) {}

  acquire(): Promise<void> {
    if (this.active < this.max) {
      this.active += 1;
      return Promise.resolve();
    }
    return new Promise((resolve) => this.queue.push(resolve));
  }

  release(): void {
    this.active -= 1;
    const next = this.queue.shift();
    if (next) {
      this.active += 1;
      next();
    }
  }
}

export type EngineLogEntry = {
  type: 'engine';
  subtype: 'heartbeat' | 'timeout' | 'spawn-error' | 'process-exit';
  agent_id: string;
  timestamp: string;
  message?: string;
  elapsed_ms?: number;
  exit_code?: number | null;
  signal?: string | null;
};

export type SpawnResult = {
  child: ChildProcess;
  logFile: string;
  logStream: WriteStream;
};

export type SpawnOptions = {
  commonsDir?: string;
  heartbeatIntervalMs?: number;
  maxDurationMs?: number;
};

function nowIso(): string {
  return new Date().toISOString();
}

function writeEngineLog(logStream: WriteStream, entry: EngineLogEntry): void {
  try { logStream.write(`${JSON.stringify(entry)}\n`); } catch {}
}

function closeLogStream(logStream: WriteStream): void {
  try { logStream.end(); } catch {}
}

function buildEnv(wakeReason?: string): NodeJS.ProcessEnv {
  const env: NodeJS.ProcessEnv = { ...process.env };
  for (const key of Object.keys(env)) {
    if (key.startsWith('CLAUDE') || key === 'CLAUDECODE') delete env[key];
  }
  // Agents use Claude Code native OAuth (Max subscription), not the engine's API proxy.
  // Delete ANTHROPIC_* so Claude Code falls through to OAuth credentials.
  delete env.ANTHROPIC_API_KEY; delete env.ANTHROPIC_BASE_URL;
  // Keep HTTP_PROXY — agents need VPN to reach api.anthropic.com (international).
  // Ensure localhost bypassed for engine API calls.
  const skip = [env.NO_PROXY, env.no_proxy, 'localhost', '127.0.0.1'].filter(Boolean);
  env.NO_PROXY = [...new Set(skip.join(',').split(',').map(s => s.trim()).filter(Boolean))].join(',');
  if (wakeReason) env.DU_WAKE_REASON = wakeReason;
  return env;
}

export function spawnAgent(
  agentId: string,
  dir: string,
  prompt: string,
  opts: SpawnOptions = {},
  wakeReason?: string,
): SpawnResult {
  const logFile = path.join(dir, '.awaken-log.txt');
  const logStream = createWriteStream(logFile, { encoding: 'utf8', flags: 'w' });

  const args: string[] = [
    '-p',
    '--model', get('agentModel'),
    '--output-format', 'stream-json',
    '--include-partial-messages',
    '--verbose',
    '--strict-mcp-config',
    '--permission-mode', 'bypassPermissions',
    '--dangerously-skip-permissions',
    '--setting-sources', 'local',
  ];

  const commonsDir = opts.commonsDir;
  if (commonsDir && existsSync(commonsDir)) args.push('--add-dir', commonsDir);
  args.push('--', prompt);

  const child = spawn('claude', args, {
    cwd: dir,
    windowsHide: true,
    shell: false,
    env: buildEnv(wakeReason),
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  const heartbeatMs = opts.heartbeatIntervalMs ?? 15_000;
  const maxMs = opts.maxDurationMs ?? 0;
  const startedAt = Date.now();
  let lastStdIoAt = startedAt;
  let lastHeartbeatAt = 0;

  const onStdIo = (chunk: Buffer | string) => {
    lastStdIoAt = Date.now();
    logStream.write(chunk);
  };
  child.stdout?.on('data', onStdIo);
  child.stderr?.on('data', onStdIo);

  const timer = setInterval(() => {
    const now = Date.now();
    const elapsed = now - startedAt;
    if (now - lastStdIoAt >= heartbeatMs && now - lastHeartbeatAt >= heartbeatMs) {
      lastHeartbeatAt = now;
      writeEngineLog(logStream, { type: 'engine', subtype: 'heartbeat', agent_id: agentId, timestamp: nowIso(), elapsed_ms: elapsed, message: 'no new stdout/stderr' });
    }
    if (maxMs > 0 && elapsed >= maxMs) {
      writeEngineLog(logStream, { type: 'engine', subtype: 'timeout', agent_id: agentId, timestamp: nowIso(), elapsed_ms: elapsed, message: 'exceeded max duration' });
      clearInterval(timer);
      child.kill();
    }
  }, 5000);

  child.on('close', () => clearInterval(timer));
  child.on('error', () => clearInterval(timer));

  return { child, logFile, logStream };
}

export function writeProcessLog(logStream: WriteStream, entry: EngineLogEntry): void {
  writeEngineLog(logStream, entry);
}

export function finalizeProcess(logStream: WriteStream, agentId: string, exitCode: number | null, signal: string | null, timedOut = false): void {
  writeEngineLog(logStream, {
    type: 'engine',
    subtype: 'process-exit',
    agent_id: agentId,
    timestamp: nowIso(),
    exit_code: exitCode,
    signal,
    message: timedOut ? 'exited after timeout' : 'exited normally',
  });
  closeLogStream(logStream);
}

export async function writeLockfile(dir: string): Promise<void> {
  await fs.writeFile(path.join(dir, '.awakening'), nowIso());
}

export function clearLockfile(dir: string): void {
  const lockPath = path.join(dir, '.awakening');
  if (!existsSync(lockPath)) return;
  try { unlinkSync(lockPath); } catch {}
}

export async function isLockfileStale(agentId: string, lockPath: string, runningProcesses: Map<string, ChildProcess>, staleLockThresholdMs: number): Promise<boolean> {
  if (!existsSync(lockPath)) return false;
  if (runningProcesses.has(agentId)) return false;

  let lockTimestampMs = Number.NaN;
  try {
    const content = (await fs.readFile(lockPath, 'utf8')).trim();
    lockTimestampMs = Date.parse(content);
  } catch {}

  if (!Number.isFinite(lockTimestampMs)) {
    try {
      const stat = await fs.stat(lockPath);
      lockTimestampMs = stat.mtimeMs;
    } catch { return false; }
  }

  return Date.now() - lockTimestampMs >= staleLockThresholdMs;
}
