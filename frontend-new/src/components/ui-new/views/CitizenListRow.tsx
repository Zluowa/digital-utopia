// @input: CitizenEntry data
// @output: Single row for list view mode
// @position: Leaf component for list layout

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

interface CitizenListRowProps {
  citizen: CitizenEntry;
  onAwaken?: (id: string) => void;
  onStop?: (id: string) => void;
}

export function CitizenListRow({ citizen, onAwaken, onStop }: CitizenListRowProps) {
  const navigate = useNavigate();
  const dot = STATUS_DOT[citizen.status] ?? STATUS_DOT.sleeping;
  const name = citizen.identity || citizen.id;
  const clickable = citizen.status !== 'dead';

  return (
    <div
      className={`flex items-center justify-between gap-double px-double py-half
        transition-colors hover:bg-secondary
        ${clickable ? 'cursor-pointer' : 'opacity-50 cursor-default'}`}
      onClick={clickable ? () => navigate(`/workspaces/${citizen.id}`) : undefined}
    >
      <div className="flex items-center gap-base flex-1 min-w-0">
        <span className={`w-2 h-2 rounded-full shrink-0 ${dot}`} />
        <span className="text-base text-high truncate">{name}</span>
        <span className="text-sm text-low truncate hidden sm:block">
          {citizen.economicNiche || citizen.type}
        </span>
      </div>

      <div className="flex items-center gap-base shrink-0">
        {citizen.inboxCount > 0 && (
          <span className="text-xs text-brand">{citizen.inboxCount}</span>
        )}
        <span className="text-sm font-ibm-plex-mono text-normal">
          {citizen.tokenBalance.toLocaleString()} T
        </span>
        <span className="text-sm text-low w-8 text-right">
          {timeAgo(citizen.lastAwakened)}
        </span>

        {citizen.status === 'sleeping' && onAwaken && (
          <button
            onClick={(e) => { e.stopPropagation(); onAwaken(citizen.id); }}
            className="text-xs text-brand hover:underline w-8"
          >
            Wake
          </button>
        )}
        {(citizen.status === 'alive' || citizen.status === 'awakening') && onStop && (
          <button
            onClick={(e) => { e.stopPropagation(); onStop(citizen.id); }}
            className="text-xs text-error hover:underline w-8"
          >
            Stop
          </button>
        )}
        {citizen.status === 'dead' && (
          <span className="text-xs text-low w-8">Dead</span>
        )}
      </div>
    </div>
  );
}
