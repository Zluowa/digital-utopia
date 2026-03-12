// @input: CitizenEntry data + action callbacks
// @output: Individual citizen card for kanban and list views
// @position: Leaf component in citizen classification board

import { useNavigate } from 'react-router-dom';
import type { CitizenEntry, AgentStatus } from '@/types/citizen';

const STATUS_DOT: Record<AgentStatus, string> = {
  alive:     'bg-green-400 animate-pulse',
  awakening: 'bg-yellow-400 animate-pulse',
  sleeping:  'bg-blue-400',
  dead:      'bg-red-400',
};

function timeAgo(iso: string): string {
  if (!iso) return 'never';
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h`;
  return `${Math.floor(hrs / 24)}d`;
}

interface CitizenCardProps {
  citizen: CitizenEntry;
  onAwaken?: (id: string) => void;
  onStop?: (id: string) => void;
  compact?: boolean;
}

export function CitizenCard({ citizen, onAwaken, onStop, compact }: CitizenCardProps) {
  const navigate = useNavigate();
  const dot = STATUS_DOT[citizen.status] ?? STATUS_DOT.sleeping;
  const name = citizen.identity || citizen.id;
  const clickable = citizen.status !== 'dead';

  const handleClick = clickable
    ? () => navigate(`/workspaces/${citizen.id}`)
    : undefined;

  return (
    <div
      className={`bg-secondary rounded border p-base transition-colors cursor-default
        ${citizen.status === 'dead' ? 'opacity-50' : 'hover:border-brand/50 cursor-pointer'}`}
      onClick={handleClick}
    >
      <div className="flex items-center justify-between mb-1">
        <div className="flex items-center gap-1.5 min-w-0">
          <span className={`w-2 h-2 rounded-full shrink-0 ${dot}`} />
          <span className="text-base font-medium text-high truncate">{name}</span>
        </div>

        <div className="flex items-center gap-1 shrink-0 ml-1">
          {citizen.status === 'sleeping' && onAwaken && (
            <button
              onClick={(e) => { e.stopPropagation(); onAwaken(citizen.id); }}
              className="text-xs text-brand hover:underline"
            >
              Wake
            </button>
          )}
          {(citizen.status === 'alive' || citizen.status === 'awakening') && onStop && (
            <button
              onClick={(e) => { e.stopPropagation(); onStop(citizen.id); }}
              className="text-xs text-error hover:underline"
            >
              Stop
            </button>
          )}
        </div>
      </div>

      <div className="text-sm text-low mb-1 truncate">
        {citizen.economicNiche || citizen.type}
      </div>

      {!compact && (
        <div className="flex items-center justify-between text-sm">
          <span className="text-normal font-ibm-plex-mono">
            {citizen.tokenBalance.toLocaleString()} T
          </span>
          <span className="text-low">{timeAgo(citizen.lastAwakened)}</span>
        </div>
      )}

      {!compact && citizen.currentGoal && (
        <div className="mt-1 text-xs text-low truncate" title={citizen.currentGoal}>
          {citizen.currentGoal}
        </div>
      )}

      {citizen.inboxCount > 0 && (
        <div className="mt-1 text-xs text-brand">{citizen.inboxCount} inbox</div>
      )}
    </div>
  );
}
