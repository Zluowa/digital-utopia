interface TimelineEvent {
  id: string;
  type: string;
  message: string;
  timestamp: string;
  agentId?: string;
}

const TYPE_STYLE: Record<string, { icon: string; color: string }> = {
  'agent-awakened': { icon: '⚡', color: 'text-yellow-400' },
  'agent-slept':    { icon: '💤', color: 'text-blue-400' },
  'world-started':  { icon: '🌍', color: 'text-green-400' },
  'world-stopped':  { icon: '⏸',  color: 'text-red-400' },
  'economy-credit': { icon: '💰', color: 'text-brand' },
  'message-sent':   { icon: '✉',  color: 'text-normal' },
  'agent-created':  { icon: '🆕', color: 'text-green-400' },
  'gm-inbox':       { icon: '📬', color: 'text-brand' },
  error:            { icon: '❌', color: 'text-error' },
};

function formatTime(iso: string): string {
  try {
    return new Date(iso).toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  } catch {
    return '';
  }
}

function humanize(event: TimelineEvent): string {
  const agent = event.agentId ?? '';
  switch (event.type) {
    case 'agent-awakened': return `${agent} 苏醒，开始新的活动周期`;
    case 'agent-slept':    return `${agent} 进入休眠`;
    case 'world-started':  return '世界引擎已启动';
    case 'world-stopped':  return '世界引擎已停止';
    case 'agent-created':  return `新居民 ${agent} 加入了这个世界`;
    case 'gm-inbox':       return `GM 收到新消息`;
    default:               return event.message;
  }
}

interface Props {
  events: TimelineEvent[];
}

export function TimelineFeed({ events }: Props) {
  if (!events.length) {
    return (
      <div className="bg-secondary rounded-md border p-base">
        <h3 className="text-lg font-medium text-high mb-1">世界时间线</h3>
        <div className="text-sm text-low">
          暂无世界事件。引擎启动后会自动出现实时状态流。
        </div>
      </div>
    );
  }

  return (
    <div className="bg-secondary rounded-md border p-base">
      <h3 className="text-lg font-medium text-high mb-1">世界时间线</h3>
      <div className="max-h-64 overflow-y-auto space-y-0.5">
        {events.map((event) => {
          const style = TYPE_STYLE[event.type] ?? { icon: '·', color: 'text-low' };
          return (
            <div key={event.id} className="flex items-start gap-1.5 text-sm">
              <span className={`shrink-0 w-5 text-center ${style.color}`}>
                {style.icon}
              </span>
              <span className="text-low shrink-0 font-ibm-plex-mono w-16">
                {formatTime(event.timestamp)}
              </span>
              <span className="text-normal">{humanize(event)}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
