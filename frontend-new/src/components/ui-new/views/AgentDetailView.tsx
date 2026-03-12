// @input: AgentDetailData (agent, files, recentEvents) + action callbacks
// @output: Agent 详情视图 — 身份/状态/代币/消息/文件/活动
// @position: 纯展示层，由 AgentDetailPage container 注入数据

import type { AgentEntry, TimelineEvent } from '@/hooks/useWorldData';
import type { FileEntry } from '@/hooks/useAgentDetail';

const STATUS_LABEL: Record<string, { text: string; dot: string }> = {
  alive:     { text: '在线',  dot: 'bg-green-400 animate-pulse' },
  awakening: { text: '唤醒中', dot: 'bg-yellow-400 animate-pulse' },
  sleeping:  { text: '休眠',  dot: 'bg-blue-400' },
  dead:      { text: '停机',  dot: 'bg-red-400' },
};

function timeAgo(iso: string): string {
  if (!iso) return '未启动';
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return '刚刚';
  if (mins < 60) return `${mins} 分钟前`;
  const hrs = Math.floor(mins / 60);
  return hrs < 24 ? `${hrs} 小时前` : `${Math.floor(hrs / 24)} 天前`;
}

function formatTime(iso: string): string {
  try {
    return new Date(iso).toLocaleTimeString([], {
      hour: '2-digit', minute: '2-digit', second: '2-digit',
    });
  } catch {
    return '';
  }
}

// ── Section Card ─────────────────────────────────────────────────

function SectionCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-secondary rounded-md border p-base">
      <h3 className="text-sm font-medium text-high mb-base">{title}</h3>
      {children}
    </div>
  );
}

// ── Property Row ─────────────────────────────────────────────────

function PropRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center gap-base py-1 border-b border-border/50 last:border-0">
      <span className="text-xs text-low w-20 shrink-0">{label}</span>
      <span className="text-sm text-normal flex-1">{value}</span>
    </div>
  );
}

// ── File List ────────────────────────────────────────────────────

function FileList({ files }: { files: FileEntry[] }) {
  if (files.length === 0) {
    return <p className="text-sm text-low">暂无文件</p>;
  }
  return (
    <div className="space-y-0.5 max-h-48 overflow-y-auto">
      {files.map((f) => (
        <div key={f.name} className="flex items-center gap-2 text-sm py-0.5">
          <span className="text-low text-xs shrink-0">
            {f.type === 'dir' ? '📁' : '📄'}
          </span>
          <span className="text-normal font-ibm-plex-mono truncate">{f.name}</span>
        </div>
      ))}
    </div>
  );
}

// ── Event Feed ───────────────────────────────────────────────────

const EVENT_ICON: Record<string, string> = {
  'agent-awakened': '⚡',
  'agent-slept':    '💤',
  'economy-credit': '💰',
  'message-sent':   '✉',
  'gm-inbox':       '📬',
  'error':          '❌',
};

function EventFeed({ events }: { events: TimelineEvent[] }) {
  if (events.length === 0) {
    return <p className="text-sm text-low">暂无活动记录</p>;
  }
  return (
    <div className="space-y-0.5 max-h-48 overflow-y-auto">
      {events.map((ev) => (
        <div key={ev.id} className="flex items-start gap-2 text-sm">
          <span className="text-low shrink-0 w-5 text-center">
            {EVENT_ICON[ev.type] ?? '·'}
          </span>
          <span className="text-low font-ibm-plex-mono text-xs shrink-0 w-16">
            {formatTime(ev.timestamp)}
          </span>
          <span className="text-normal text-xs">{ev.message}</span>
        </div>
      ))}
    </div>
  );
}

// ── Main View ────────────────────────────────────────────────────

interface Props {
  agent: AgentEntry;
  files: FileEntry[];
  recentEvents: TimelineEvent[];
  onAwaken: () => void;
  onStop: () => void;
}

export function AgentDetailView({ agent, files, recentEvents, onAwaken, onStop }: Props) {
  const statusCfg = STATUS_LABEL[agent.status] ?? STATUS_LABEL.sleeping;
  const isActive = agent.status === 'alive' || agent.status === 'awakening';
  const name = agent.identity ?? agent.id;

  return (
    <div className="space-y-base">
      {/* Hero header */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <span className={`w-3 h-3 rounded-full shrink-0 ${statusCfg.dot}`} />
          <div>
            <h1 className="text-xl font-medium text-high">{name}</h1>
            <div className="text-sm text-low">
              {agent.economicNiche ?? agent.type} · {statusCfg.text}
            </div>
          </div>
        </div>
        <div className="flex gap-2">
          {!isActive && (
            <button
              onClick={onAwaken}
              className="px-base py-1 bg-brand/10 text-brand rounded-md text-sm hover:bg-brand/20 transition-colors"
            >
              唤醒
            </button>
          )}
          {isActive && (
            <button
              onClick={onStop}
              className="px-base py-1 bg-error/10 text-error rounded-md text-sm hover:bg-error/20 transition-colors"
            >
              停止
            </button>
          )}
        </div>
      </div>

      {/* Two-column grid */}
      <div className="grid md:grid-cols-2 gap-base">
        {/* Left: Identity + Token */}
        <div className="space-y-base">
          <SectionCard title="身份信息">
            <PropRow label="ID" value={<span className="font-ibm-plex-mono text-xs">{agent.id}</span>} />
            <PropRow label="类型" value={agent.type} />
            <PropRow label="状态" value={statusCfg.text} />
            <PropRow label="最后活动" value={timeAgo(agent.lastAwakened)} />
            {agent.currentGoal && (
              <PropRow label="当前目标" value={agent.currentGoal} />
            )}
          </SectionCard>

          <SectionCard title="代币余额">
            <div className="text-2xl font-ibm-plex-mono text-high mb-1">
              {agent.tokenBalance.toLocaleString()} T
            </div>
            {agent.inboxCount > 0 && (
              <div className="text-sm text-brand">{agent.inboxCount} 条待处理消息</div>
            )}
          </SectionCard>
        </div>

        {/* Right: Files + Activity */}
        <div className="space-y-base">
          <SectionCard title={`工作目录 (${files.length})`}>
            <FileList files={files} />
          </SectionCard>

          <SectionCard title="最近活动">
            <EventFeed events={recentEvents} />
          </SectionCard>
        </div>
      </div>
    </div>
  );
}
