// @input: inbox sections data + tab state + callbacks (markProcessed, dismiss)
// @output: Tabbed inbox UI with section grouping and per-item dismiss
// @position: Pure view — no data fetching, driven entirely by props

import { Link } from 'react-router-dom';
import {
  TrayIcon,
  EnvelopeIcon,
  CheckCircleIcon,
  WarningCircleIcon,
  ClockIcon,
  XIcon,
  ArrowClockwiseIcon,
} from '@phosphor-icons/react';
import type { GmMessage } from '@/hooks/useGlobalInbox';
import type { AgentEntry } from '@/hooks/useWorldData';

// ── Types ──────────────────────────────────────────────────────────

export type InboxTab = 'pending' | 'all';

export interface InboxViewProps {
  tab: InboxTab;
  onTabChange: (tab: InboxTab) => void;
  pendingCount: number;
  gmMessages: GmMessage[];
  agents: AgentEntry[];
  dismissed: Set<string>;
  isLoading: boolean;
  error: string | null;
  onMarkProcessed: (id: string) => void;
  onDismiss: (key: string) => void;
  onRefresh: () => void;
}

// ── Helpers ────────────────────────────────────────────────────────

const PRIORITY_COLOR: Record<string, string> = {
  urgent: 'text-error',
  high: 'text-brand',
  normal: 'text-low',
};

function formatTime(iso: string): string {
  try {
    const d = new Date(iso);
    const isToday = d.toDateString() === new Date().toDateString();
    return isToday
      ? d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      : d.toLocaleDateString([], { month: 'short', day: 'numeric' });
  } catch {
    return '';
  }
}

function staleSince(iso: string): string {
  try {
    const hours = Math.round((Date.now() - new Date(iso).getTime()) / 3_600_000);
    if (hours < 24) return `${hours}h 前活跃`;
    return `${Math.round(hours / 24)}d 前活跃`;
  } catch {
    return '';
  }
}

// ── Sub-components ────────────────────────────────────────────────

function SectionHeader({ icon, label, count }: { icon: React.ReactNode; label: string; count: number }) {
  return (
    <div className="flex items-center gap-2 mb-2">
      <span className="text-low">{icon}</span>
      <span className="text-xs font-medium text-low uppercase tracking-wide">{label}</span>
      <span className="text-xs text-low bg-secondary rounded px-1">{count}</span>
    </div>
  );
}

function DismissButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="opacity-0 group-hover:opacity-100 transition-opacity p-0.5 rounded hover:bg-primary text-low hover:text-normal"
      aria-label="忽略"
    >
      <XIcon className="size-3.5" />
    </button>
  );
}

function EmptyState({ label }: { label: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-double gap-2 text-low">
      <TrayIcon className="size-8 opacity-30" />
      <span className="text-sm">{label}</span>
    </div>
  );
}

// ── GM Message Row ─────────────────────────────────────────────────

function GmMessageRow({
  msg,
  onMarkProcessed,
  onDismiss,
}: {
  msg: GmMessage;
  onMarkProcessed: (id: string) => void;
  onDismiss: (key: string) => void;
}) {
  const priorityColor = PRIORITY_COLOR[msg.priority] ?? PRIORITY_COLOR.normal;

  return (
    <div className="group flex items-start gap-2 px-base py-2 hover:bg-primary/50 transition-colors">
      <span className={`text-xs mt-0.5 shrink-0 font-bold w-2 text-center ${priorityColor}`}>
        {msg.priority === 'urgent' ? '!' : msg.priority === 'high' ? '↑' : '·'}
      </span>
      <div className="min-w-0 flex-1">
        <div className="text-sm text-high font-medium truncate">{msg.subject}</div>
        <div className="text-xs text-low mt-0.5">
          来自 <span className="text-normal">{msg.from}</span>
        </div>
        {msg.content && (
          <div className="text-xs text-low mt-1 line-clamp-2">
            {typeof msg.content === 'string' ? msg.content : '(非文本内容)'}
          </div>
        )}
      </div>
      <div className="flex flex-col items-end gap-1 shrink-0">
        <span className="text-xs text-low">{formatTime(msg.timestamp)}</span>
        <div className="flex items-center gap-1">
          {!msg.processed && (
            <button
              onClick={() => onMarkProcessed(msg.id)}
              className="text-xs text-brand hover:underline flex items-center gap-0.5"
            >
              <CheckCircleIcon className="size-3" />
              已处理
            </button>
          )}
          <DismissButton onClick={() => onDismiss(`gm:${msg.id}`)} />
        </div>
      </div>
    </div>
  );
}

// ── Agent Alert Row ────────────────────────────────────────────────

function AgentInboxRow({
  agent,
  onDismiss,
}: {
  agent: AgentEntry;
  onDismiss: (key: string) => void;
}) {
  return (
    <div className="group flex items-center gap-2 px-base py-2 hover:bg-primary/50 transition-colors">
      <span className={`size-2 rounded-full shrink-0 ${agent.status === 'alive' ? 'bg-success' : 'bg-low'}`} />
      <Link
        to={`/world/agents/${agent.id}`}
        className="flex-1 min-w-0 text-sm text-normal hover:text-high no-underline truncate"
      >
        {agent.identity ?? agent.id}
      </Link>
      <span className="text-xs font-ibm-plex-mono text-brand bg-brand/10 px-1.5 py-0.5 rounded shrink-0">
        {agent.inboxCount} 条
      </span>
      <DismissButton onClick={() => onDismiss(`agent-inbox:${agent.id}`)} />
    </div>
  );
}

// ── Stale Agent Row ────────────────────────────────────────────────

function StaleAgentRow({
  agent,
  onDismiss,
}: {
  agent: AgentEntry;
  onDismiss: (key: string) => void;
}) {
  return (
    <div className="group flex items-center gap-2 px-base py-2 hover:bg-primary/50 transition-colors">
      <ClockIcon className="size-4 text-low shrink-0" />
      <Link
        to={`/world/agents/${agent.id}`}
        className="flex-1 min-w-0 text-sm text-normal hover:text-high no-underline truncate"
      >
        {agent.identity ?? agent.id}
      </Link>
      <span className="text-xs text-low shrink-0">{staleSince(agent.lastAwakened)}</span>
      <DismissButton onClick={() => onDismiss(`stale:${agent.id}`)} />
    </div>
  );
}

// ── Section ────────────────────────────────────────────────────────

function InboxSection({ children }: { children: React.ReactNode }) {
  return (
    <div className="border border-border rounded-sm divide-y divide-border">{children}</div>
  );
}

// ── Tab Bar ────────────────────────────────────────────────────────

function TabBar({
  tab,
  pendingCount,
  onTabChange,
}: {
  tab: InboxTab;
  pendingCount: number;
  onTabChange: (t: InboxTab) => void;
}) {
  const tabs: { value: InboxTab; label: React.ReactNode }[] = [
    {
      value: 'pending',
      label: (
        <>
          待处理
          {pendingCount > 0 && (
            <span className="ml-1.5 rounded-full bg-brand/20 px-1.5 py-0.5 text-[9px] font-medium text-brand">
              {pendingCount}
            </span>
          )}
        </>
      ),
    },
    { value: 'all', label: '全部' },
  ];

  return (
    <div className="flex gap-1 border-b border-border shrink-0">
      {tabs.map(({ value, label }) => (
        <button
          key={value}
          onClick={() => onTabChange(value)}
          className={`flex items-center px-base py-1 text-sm transition-colors -mb-px border-b-2 ${
            tab === value
              ? 'text-high border-brand'
              : 'text-low border-transparent hover:text-normal'
          }`}
        >
          {label}
        </button>
      ))}
    </div>
  );
}

// ── Main View ─────────────────────────────────────────────────────

export function GlobalInboxView({
  tab,
  onTabChange,
  pendingCount,
  gmMessages,
  agents,
  dismissed,
  isLoading,
  error,
  onMarkProcessed,
  onDismiss,
  onRefresh,
}: InboxViewProps) {
  // derive visible items based on tab + dismissed
  const STALE_THRESHOLD_MS = 24 * 60 * 60 * 1000;
  const now = Date.now();

  const pendingGm = gmMessages.filter(
    (m) => !m.processed && !dismissed.has(`gm:${m.id}`),
  );
  const allGm = gmMessages.filter((m) => !dismissed.has(`gm:${m.id}`));

  const agentsWithInbox = agents.filter(
    (a) => a.inboxCount > 0 && !dismissed.has(`agent-inbox:${a.id}`),
  );

  const staleAgents = agents.filter(
    (a) =>
      a.status === 'sleeping' &&
      now - new Date(a.lastAwakened).getTime() > STALE_THRESHOLD_MS &&
      !dismissed.has(`stale:${a.id}`),
  );

  const visibleGm = tab === 'pending' ? pendingGm : allGm;

  const isEmpty = visibleGm.length === 0 && agentsWithInbox.length === 0 && staleAgents.length === 0;

  return (
    <div className="h-full flex flex-col p-base overflow-hidden gap-base">
      {/* Header */}
      <div className="flex items-center justify-between shrink-0">
        <div>
          <h1 className="text-xl font-medium text-high">消息收件箱</h1>
          <div className="text-sm text-low">
            {pendingCount > 0 ? `${pendingCount} 项待处理` : '全部已处理'}
          </div>
        </div>
        <button
          onClick={onRefresh}
          className="flex items-center gap-1 px-base py-1 bg-secondary border rounded text-sm text-low hover:text-normal transition-colors"
        >
          <ArrowClockwiseIcon className="size-3.5" />
          刷新
        </button>
      </div>

      {/* Tab Bar */}
      <TabBar tab={tab} pendingCount={pendingCount} onTabChange={onTabChange} />

      {/* Content */}
      <div className="flex-1 overflow-y-auto space-y-base">
        {isLoading && (
          <div className="text-sm text-low py-4">加载中...</div>
        )}
        {error && !isLoading && (
          <div className="text-sm text-error">{error}</div>
        )}
        {!isLoading && !error && isEmpty && (
          <EmptyState
            label={tab === 'pending' ? '暂无待处理项' : '收件箱为空'}
          />
        )}

        {/* GM 消息 */}
        {visibleGm.length > 0 && (
          <div>
            <SectionHeader
              icon={<EnvelopeIcon className="size-3.5" />}
              label="GM 消息"
              count={visibleGm.length}
            />
            <InboxSection>
              {visibleGm.map((msg, i) => (
                <GmMessageRow
                  key={msg.id ?? `gm-${i}`}
                  msg={msg}
                  onMarkProcessed={onMarkProcessed}
                  onDismiss={onDismiss}
                />
              ))}
            </InboxSection>
          </div>
        )}

        {/* Agent 收件箱 */}
        {agentsWithInbox.length > 0 && (
          <div>
            <SectionHeader
              icon={<EnvelopeIcon className="size-3.5" />}
              label="居民消息"
              count={agentsWithInbox.length}
            />
            <InboxSection>
              {agentsWithInbox.map((agent) => (
                <AgentInboxRow
                  key={agent.id}
                  agent={agent}
                  onDismiss={onDismiss}
                />
              ))}
            </InboxSection>
          </div>
        )}

        {/* 停滞居民 */}
        {staleAgents.length > 0 && (
          <div>
            <SectionHeader
              icon={<WarningCircleIcon className="size-3.5" />}
              label="停滞任务"
              count={staleAgents.length}
            />
            <InboxSection>
              {staleAgents.map((agent) => (
                <StaleAgentRow
                  key={agent.id}
                  agent={agent}
                  onDismiss={onDismiss}
                />
              ))}
            </InboxSection>
          </div>
        )}
      </div>
    </div>
  );
}
