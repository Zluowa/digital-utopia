// @input: agents[] from WorldSnapshot，onAwaken/onStop 回调，onSelect 回调
// @output: 活跃 Agent 实时面板 — 状态 + token 余额 + 操作
// @position: WorldDashboard 顶部 Agent 概览区块

import { Link } from 'react-router-dom';

interface AgentEntry {
  id: string;
  type: string;
  status: 'alive' | 'dead' | 'awakening' | 'sleeping';
  tokenBalance: number;
  lastAwakened: string;
  inboxCount: number;
  identity?: string;
  currentGoal?: string;
  economicNiche?: string;
}

const STATUS_CONFIG: Record<string, { dot: string; label: string; border: string }> = {
  alive:     { dot: 'bg-green-400 animate-pulse', label: '在线',  border: 'border-green-500/30' },
  awakening: { dot: 'bg-yellow-400 animate-pulse', label: '唤醒中', border: 'border-yellow-500/30' },
  sleeping:  { dot: 'bg-blue-400',                 label: '休眠',  border: 'border-border' },
  dead:      { dot: 'bg-red-400',                  label: '停机',  border: 'border-border' },
};

function timeAgo(iso: string): string {
  if (!iso) return '未启动';
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return '刚刚';
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h`;
  return `${Math.floor(hrs / 24)}d`;
}

interface AgentRunCardProps {
  agent: AgentEntry;
  onAwaken?: (id: string) => void;
  onStop?: (id: string) => void;
}

function AgentRunCard({ agent, onAwaken, onStop }: AgentRunCardProps) {
  const cfg = STATUS_CONFIG[agent.status] ?? STATUS_CONFIG.sleeping;
  const isActive = agent.status === 'alive' || agent.status === 'awakening';
  const name = agent.identity ?? agent.id;

  return (
    <div className={`flex flex-col rounded-md border overflow-hidden bg-secondary ${cfg.border}`}>
      {/* Header */}
      <div className="flex items-center justify-between px-half py-1 border-b border-border/50">
        <div className="flex items-center gap-1.5 min-w-0">
          <span className={`relative flex h-2 w-2 shrink-0 rounded-full ${cfg.dot}`} />
          <span className="text-sm text-high truncate font-medium">{name}</span>
          {isActive && (
            <span className="text-xs font-medium text-green-500">Live</span>
          )}
        </div>
        <Link
          to={`/world/agents/${agent.id}`}
          className="text-xs text-low hover:text-normal shrink-0 ml-1"
          onClick={(e) => e.stopPropagation()}
        >
          详情
        </Link>
      </div>

      {/* Body */}
      <div className="flex-1 px-half py-1 space-y-0.5">
        <div className="text-xs text-low truncate">
          {agent.economicNiche ?? agent.type}
        </div>
        {agent.currentGoal && (
          <div className="text-xs text-low truncate" title={agent.currentGoal}>
            ↳ {agent.currentGoal}
          </div>
        )}
        <div className="flex items-center justify-between text-xs pt-0.5">
          <span className="font-ibm-plex-mono text-normal">
            {agent.tokenBalance.toLocaleString()} T
          </span>
          <span className="text-low">{timeAgo(agent.lastAwakened)}</span>
        </div>
        {agent.inboxCount > 0 && (
          <div className="text-xs text-brand">{agent.inboxCount} 条新消息</div>
        )}
      </div>

      {/* Actions */}
      {(agent.status === 'sleeping' && onAwaken) || (isActive && onStop) ? (
        <div className="px-half py-1 border-t border-border/30 flex gap-2">
          {agent.status === 'sleeping' && onAwaken && (
            <button
              onClick={() => onAwaken(agent.id)}
              className="text-xs text-brand hover:underline"
            >
              唤醒
            </button>
          )}
          {isActive && onStop && (
            <button
              onClick={() => onStop(agent.id)}
              className="text-xs text-error hover:underline"
            >
              停止
            </button>
          )}
        </div>
      ) : null}
    </div>
  );
}

interface Props {
  agents: AgentEntry[];
  onAwaken?: (id: string) => void;
  onStop?: (id: string) => void;
}

export function ActiveAgentsPanel({ agents, onAwaken, onStop }: Props) {
  const sorted = [...agents].sort((a, b) => {
    const order: Record<string, number> = { awakening: 0, alive: 1, sleeping: 2, dead: 3 };
    const diff = (order[a.status] ?? 9) - (order[b.status] ?? 9);
    return diff !== 0 ? diff : b.tokenBalance - a.tokenBalance;
  });

  if (sorted.length === 0) {
    return (
      <div className="border rounded-md p-base bg-secondary">
        <p className="text-sm text-low">暂无居民。引擎启动后会自动出现。</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-2">
      {sorted.map((agent) => (
        <AgentRunCard
          key={agent.id}
          agent={agent}
          onAwaken={onAwaken}
          onStop={onStop}
        />
      ))}
    </div>
  );
}
