interface Agent {
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

const STATUS_STYLES: Record<string, { dot: string; label: string }> = {
  alive: { dot: 'bg-green-400 animate-pulse', label: '在线' },
  awakening: { dot: 'bg-yellow-400 animate-pulse', label: '唤醒中' },
  sleeping: { dot: 'bg-blue-400', label: '休眠' },
  dead: { dot: 'bg-red-400', label: '停机' },
};

function timeAgo(iso: string): string {
  if (!iso) return '未启动';
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return '刚刚';
  if (mins < 60) return `${mins} 分钟前`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs} 小时前`;
  return `${Math.floor(hrs / 24)} 天前`;
}

interface Props {
  agent: Agent;
  onAwaken?: (id: string) => void;
  onStop?: (id: string) => void;
  onOpenWorkspace?: (id: string) => void;
}

export function AgentCard({ agent, onAwaken, onStop, onOpenWorkspace }: Props) {
  const statusStyle = STATUS_STYLES[agent.status] ?? STATUS_STYLES.sleeping;
  const name = agent.identity || agent.id;
  const clickable = agent.status !== 'dead' && Boolean(onOpenWorkspace);

  return (
    <div
      className={`bg-secondary rounded-md border p-base transition-colors ${agent.status === 'dead' ? 'opacity-50' : 'hover:border-brand/50 cursor-pointer'}`}
      onClick={clickable ? () => onOpenWorkspace?.(agent.id) : undefined}
    >
      <div className="flex items-center justify-between mb-1">
        <div className="flex items-center gap-1.5 min-w-0">
          <span className={`w-2 h-2 rounded-full ${statusStyle.dot}`} />
          <span className="text-lg font-medium text-high truncate">{name}</span>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <span className="text-xs text-low">{statusStyle.label}</span>
          {agent.status === 'sleeping' && onAwaken && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onAwaken(agent.id);
              }}
              className="text-xs text-brand hover:underline"
            >
              唤醒
            </button>
          )}
          {(agent.status === 'alive' || agent.status === 'awakening') && onStop && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onStop(agent.id);
              }}
              className="text-xs text-error hover:underline"
            >
              停止
            </button>
          )}
        </div>
      </div>

      <div className="text-sm text-low mb-1">{agent.economicNiche || agent.type}</div>

      <div className="flex items-center justify-between text-sm">
        <span className="text-normal font-ibm-plex-mono">
          {agent.tokenBalance.toLocaleString()} T
        </span>
        <span className="text-low">{timeAgo(agent.lastAwakened)}</span>
      </div>

      {agent.currentGoal && (
        <div className="mt-1.5 text-xs text-low truncate" title={agent.currentGoal}>
          ↳ 使命: {agent.currentGoal}
        </div>
      )}

      {agent.inboxCount > 0 && (
        <div className="mt-1 text-xs text-brand">{agent.inboxCount} 条待处理消息</div>
      )}
    </div>
  );
}
