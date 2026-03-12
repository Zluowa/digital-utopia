// @input: timeline events + agents snapshot
// @output: 世界动态 — 当前进行 + 重要事件（过滤系统噪声）
// @position: WorldDashboard 右侧，替代原 TimelineFeed

import type { AgentEntry, TimelineEvent } from '@/hooks/useWorldData';
import { cn } from '@/lib/utils';

// ── Noise filter — only show events that carry real information ──────────────

const SIGNAL_TYPES = new Set([
  'message-sent',
  'gm-inbox',
  'economy-credit',
  'agent-created',
  'world-started',
  'world-stopped',
  'error',
]);

const EVENT_ICON: Record<string, string> = {
  'message-sent':   '✉',
  'gm-inbox':       '📬',
  'economy-credit': '💰',
  'agent-created':  '🆕',
  'world-started':  '🌍',
  'world-stopped':  '⏸',
  error:            '❌',
};

const EVENT_COLOR: Record<string, string> = {
  'message-sent':   'text-normal',
  'gm-inbox':       'text-brand',
  'economy-credit': 'text-brand',
  'agent-created':  'text-green-400',
  'world-started':  'text-green-400',
  'world-stopped':  'text-red-400',
  error:            'text-error',
};

// ── Helpers ──────────────────────────────────────────────────────────────────

function formatTime(iso: string): string {
  try {
    return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  } catch {
    return '';
  }
}

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const min = Math.floor(diff / 60_000);
  if (min < 1) return '刚刚';
  if (min < 60) return `${min}m`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h`;
  return `${Math.floor(hr / 24)}d`;
}

// ── Active Goals section ────────────────────────────────────────────────────

interface GoalRowProps {
  agent: AgentEntry;
}

function GoalRow({ agent }: GoalRowProps) {
  const isActive = agent.status === 'alive' || agent.status === 'awakening';
  return (
    <div className="flex items-start gap-1.5 py-0.5">
      <span className={cn('size-1.5 rounded-full mt-1.5 shrink-0', isActive ? 'bg-green-400' : 'bg-low')}>
      </span>
      <span className="text-high font-medium shrink-0">{agent.id}</span>
      <span className="text-low truncate flex-1">
        {agent.currentGoal || agent.identity || '—'}
      </span>
      <span className="text-low shrink-0 text-[10px]">
        {relativeTime(agent.lastAwakened)}
      </span>
    </div>
  );
}

// ── Event row ───────────────────────────────────────────────────────────────

function EventRow({ event }: { event: TimelineEvent }) {
  const icon = EVENT_ICON[event.type] ?? '·';
  const color = EVENT_COLOR[event.type] ?? 'text-low';
  return (
    <div className="flex items-start gap-1.5 py-0.5">
      <span className={cn('shrink-0 w-4 text-center', color)}>{icon}</span>
      <span className="text-normal flex-1 truncate">{event.message}</span>
      <span className="text-low shrink-0 font-ibm-plex-mono text-[10px]">
        {formatTime(event.timestamp)}
      </span>
    </div>
  );
}

// ── Main export ─────────────────────────────────────────────────────────────

interface WorldPulseProps {
  events: TimelineEvent[];
  agents: AgentEntry[];
}

export function WorldPulse({ events, agents }: WorldPulseProps) {
  const activeAgents = agents.filter((a) => a.status === 'alive' || a.status === 'awakening');
  const sleepCount = agents.length - activeAgents.length;

  // Filter to signal events only
  const signals = events.filter((e) => SIGNAL_TYPES.has(e.type)).slice(-30);

  return (
    <div className="bg-secondary rounded-md border p-base space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-medium text-high">世界动态</h3>
        <span className="text-[10px] text-low">
          {activeAgents.length} 活跃 · {sleepCount} 休眠
        </span>
      </div>

      {/* Active Goals */}
      {activeAgents.length > 0 && (
        <div>
          <div className="text-[10px] text-low uppercase tracking-wide mb-1">当前进行</div>
          <div className="text-sm space-y-0">
            {activeAgents.map((a) => <GoalRow key={a.id} agent={a} />)}
          </div>
        </div>
      )}

      {/* Key Events */}
      <div>
        <div className="text-[10px] text-low uppercase tracking-wide mb-1">重要事件</div>
        {signals.length === 0 ? (
          <div className="text-sm text-low">暂无重要事件</div>
        ) : (
          <div className="max-h-48 overflow-y-auto text-sm space-y-0">
            {[...signals].reverse().map((e) => <EventRow key={e.id} event={e} />)}
          </div>
        )}
      </div>
    </div>
  );
}
