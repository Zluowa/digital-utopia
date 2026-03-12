// @input: CitizenEntry + onAwaken/onStop callbacks
// @output: Resident status card with actions (wake, stop)
// @position: Leaf component for kanban and list views

import { useNavigate } from 'react-router-dom';
import { Envelope, Circle, Play, Pause } from '@phosphor-icons/react';
import type { CitizenEntry, AgentStatus } from '@/types/citizen';

const STATUS_DOT_COLOR: Record<AgentStatus, string> = {
  awakening: 'var(--status-awakening, #3b82f6)',
  alive: 'var(--status-alive, #10b981)',
  sleeping: 'var(--status-sleeping, #9ca3af)',
  dead: 'var(--status-dead, #ef4444)',
};

const STATUS_LABEL: Record<AgentStatus, string> = {
  awakening: '唤醒中',
  alive: '活跃',
  sleeping: '休眠',
  dead: '已死亡',
};

function timeAgo(iso: string): string {
  if (!iso) return '未醒';
  const mins = Math.floor((Date.now() - new Date(iso).getTime()) / 60_000);
  if (mins < 1) return '刚刚';
  if (mins < 60) return `${mins}分钟前`;
  const hrs = Math.floor(mins / 60);
  return hrs < 24 ? `${hrs}小时前` : `${Math.floor(hrs / 24)}天前`;
}

interface ResidentCardProps {
  resident: CitizenEntry;
  onAwaken?: (id: string) => void;
  onStop?: (id: string) => void;
}

export function ResidentCard({ resident, onAwaken, onStop }: ResidentCardProps) {
  const navigate = useNavigate();
  const isClickable = resident.status !== 'dead';
  const displayName = resident.identity || resident.id;

  return (
    <div
      className={`bg-secondary rounded border border-transparent p-base transition-all duration-200
        ${isClickable ? 'hover:border-brand/40 cursor-pointer' : 'opacity-50 cursor-default'}`}
      onClick={() => isClickable && navigate(`/world/agents/${resident.id}`)}
      role={isClickable ? 'button' : undefined}
      tabIndex={isClickable ? 0 : undefined}
      onKeyDown={(e) => { if (isClickable && (e.key === 'Enter' || e.key === ' ')) navigate(`/world/agents/${resident.id}`); }}
      aria-label={isClickable ? `查看居民 ${displayName}` : undefined}
    >
      <div className="flex items-center justify-between gap-2 mb-2">
        <div className="flex items-center gap-2 min-w-0 flex-1">
          <Circle
            size={6}
            weight="fill"
            color={STATUS_DOT_COLOR[resident.status]}
            className={(resident.status === 'awakening' || resident.status === 'alive') ? 'animate-pulse' : ''}
            aria-hidden="true"
          />
          <span className="sr-only">{STATUS_LABEL[resident.status]}</span>
          <span className="text-high font-medium truncate">{displayName}</span>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          {resident.status === 'sleeping' && onAwaken && (
            <button
              onClick={(e) => { e.stopPropagation(); onAwaken(resident.id); }}
              className="p-1 text-brand hover:opacity-80 transition-opacity"
              title="唤醒"
              aria-label="唤醒居民"
            >
              <Play size={14} weight="fill" />
            </button>
          )}
          {(resident.status === 'alive' || resident.status === 'awakening') && onStop && (
            <button
              onClick={(e) => { e.stopPropagation(); onStop(resident.id); }}
              className="p-1 text-error hover:opacity-80 transition-opacity"
              title="停止"
              aria-label="停止居民"
            >
              <Pause size={14} weight="fill" />
            </button>
          )}
        </div>
      </div>
      <div className="text-low text-sm mb-2 truncate">
        {resident.economicNiche || resident.type}
      </div>
      <div className="flex items-center justify-between text-sm mb-2">
        <span className="font-ibm-plex-mono text-normal">
          {resident.tokenBalance.toLocaleString()} T
        </span>
        <span className="text-low text-xs">{timeAgo(resident.lastAwakened)}</span>
      </div>
      {(resident.categories?.length ?? 0) > 0 && (
        <div className="flex flex-wrap gap-1 mb-1">
          {resident.categories?.slice(0, 3).map((cat) => (
            <span
              key={cat.id}
              className="inline-flex items-center px-2 py-0.5 rounded text-xs text-white"
              style={{ backgroundColor: cat.color }}
            >
              {cat.name}
            </span>
          ))}
          {(resident.categories?.length ?? 0) > 3 && (
            <span className="text-xs text-low">+{(resident.categories?.length ?? 0) - 3}</span>
          )}
        </div>
      )}
      {resident.inboxCount > 0 && (
        <div className="flex items-center gap-1 mt-2">
          <Envelope size={12} weight="fill" className="text-brand" />
          <span className="text-xs text-brand">{resident.inboxCount} 消息</span>
        </div>
      )}
    </div>
  );
}
