// @input: useWorldData hook (snapshot, timeline, transactions)
// @output: 世界总览页 — MetricCards + Agent 面板 + 世界动态 + 经济摘要
// @position: /world 落地页，世界状态一屏全知

import { useState, useRef } from 'react';
import { Link } from 'react-router-dom';
import {
  ChatCircleDotsIcon,
  CoinIcon,
  GlobeIcon,
  PaperPlaneRightIcon,
  StopIcon,
  TrayIcon,
  UsersIcon,
} from '@phosphor-icons/react';
import { useWorldData } from '@/hooks/useWorldData';
import { useGMChat } from '@/hooks/useGMChat';
import { ActiveAgentsPanel } from '@/components/ui-new/views/ActiveAgentsPanel';
import { WorldPulse } from '@/components/ui-new/views/WorldPulse';
import { cn } from '@/lib/utils';

// ── GM command bar ──────────────────────────────────────────────────────────

function MiniGMInput() {
  const { messages, isStreaming, sendMessage, stopStreaming } = useGMChat();
  const [draft, setDraft] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const lastAssistant = [...messages].reverse().find((m) => m.role === 'assistant');

  const handleSend = () => {
    if (!draft.trim() || isStreaming) return;
    sendMessage(draft.trim());
    setDraft('');
  };

  return (
    <div className="bg-secondary rounded-md border p-half">
      <div className="flex items-center gap-half">
        <ChatCircleDotsIcon className="size-4 text-low shrink-0" />
        <input
          ref={inputRef}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSend()}
          placeholder="对世界下达指令... 创建Agent / 调整经济 / 发送消息"
          disabled={isStreaming}
          className="flex-1 bg-transparent text-sm text-normal placeholder:text-low outline-none"
        />
        {isStreaming ? (
          <button onClick={stopStreaming} className="shrink-0 p-0.5 text-error hover:bg-error/10 rounded">
            <StopIcon className="size-3.5" weight="fill" />
          </button>
        ) : (
          <button
            onClick={handleSend}
            disabled={!draft.trim()}
            className="shrink-0 p-0.5 text-brand hover:bg-brand/10 rounded disabled:opacity-30"
          >
            <PaperPlaneRightIcon className="size-3.5" weight="bold" />
          </button>
        )}
        <Link to="/world/chat" className="shrink-0 text-xs text-low hover:text-normal">
          完整对话
        </Link>
      </div>
      {isStreaming && lastAssistant && (
        <div className="mt-half text-xs text-low truncate pl-5">
          {lastAssistant.content.slice(0, 120)}...
        </div>
      )}
    </div>
  );
}

// ── Metric card (Paperclip-style: icon + value + label + description) ───────

interface MetricCardProps {
  icon: React.ElementType;
  label: string;
  value: string | number;
  description?: React.ReactNode;
  to?: string;
}

function MetricCard({ icon: Icon, label, value, description, to }: MetricCardProps) {
  const inner = (
    <div className={cn(
      'bg-secondary rounded-md border p-base transition-colors',
      to && 'hover:border-brand/30 cursor-pointer',
    )}>
      <div className="flex items-center gap-1.5 mb-1">
        <Icon className="size-3.5 text-low" />
        <span className="text-xs text-low">{label}</span>
      </div>
      <div className="text-xl font-ibm-plex-mono text-high">{value}</div>
      {description && <div className="text-xs text-low mt-0.5">{description}</div>}
    </div>
  );
  if (to) return <Link to={to} className="no-underline text-inherit">{inner}</Link>;
  return inner;
}

// ── Compact economy summary ─────────────────────────────────────────────────

interface EconomySummaryProps {
  treasuryBalance: number;
  circulation: number;
  agents: { id: string; tokenBalance: number }[];
  transactions: { id: string; from: string; to: string; amount: number; timestamp: string }[];
}

function shortTime(iso: string): string {
  try {
    return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  } catch {
    return '';
  }
}

function EconomySummary({ treasuryBalance, circulation, agents, transactions }: EconomySummaryProps) {
  const sorted = [...agents].sort((a, b) => b.tokenBalance - a.tokenBalance).slice(0, 6);
  const max = Math.max(...sorted.map((a) => a.tokenBalance), 1);

  return (
    <div className="bg-secondary rounded-md border p-base space-y-3">
      <h3 className="text-lg font-medium text-high">经济概览</h3>

      {/* Treasury + Circulation */}
      <div className="grid grid-cols-2 gap-half">
        <div className="bg-primary rounded p-half">
          <div className="text-[10px] text-low">国库</div>
          <div className="text-base font-ibm-plex-mono text-high">
            {treasuryBalance.toLocaleString()} T
          </div>
        </div>
        <div className="bg-primary rounded p-half">
          <div className="text-[10px] text-low">流通</div>
          <div className="text-base font-ibm-plex-mono text-high">
            {circulation.toLocaleString()} T
          </div>
        </div>
      </div>

      {/* Wealth distribution (compact bars) */}
      <div>
        <div className="text-[10px] text-low uppercase tracking-wide mb-1">代币分布</div>
        <div className="space-y-0.5">
          {sorted.map((a) => (
            <div key={a.id} className="flex items-center gap-1.5 text-sm">
              <span className="text-normal w-14 truncate shrink-0">{a.id}</span>
              <div className="flex-1 h-2 bg-primary rounded-sm overflow-hidden">
                <div
                  className="h-full bg-brand/50 rounded-sm"
                  style={{ width: `${(a.tokenBalance / max) * 100}%` }}
                />
              </div>
              <span className="font-ibm-plex-mono text-low text-[10px] shrink-0 w-14 text-right">
                {a.tokenBalance.toLocaleString()}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Recent transactions */}
      {transactions.length > 0 && (
        <div>
          <div className="text-[10px] text-low uppercase tracking-wide mb-1">最近交易</div>
          <div className="space-y-0.5 max-h-32 overflow-y-auto">
            {transactions.slice(0, 8).map((tx) => (
              <div key={tx.id} className="flex items-center gap-1 text-xs">
                <span className="text-low w-10 shrink-0">{shortTime(tx.timestamp)}</span>
                <span className="text-normal truncate">{tx.from} → {tx.to}</span>
                <span className="font-ibm-plex-mono text-brand shrink-0">{tx.amount}T</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Dashboard ───────────────────────────────────────────────────────────────

export function WorldDashboard() {
  const {
    snapshot, timeline, transactions, isLoading, error,
    awakenAll, awakenAgent, stopAgent,
  } = useWorldData();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full text-low">
        正在连接世界引擎...
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-2 text-low">
        <div className="text-error text-lg">引擎离线</div>
        <div className="text-sm">{error}</div>
        <div className="text-xs">启动命令: cd engine && npx tsx src/start.ts genesis</div>
      </div>
    );
  }

  if (!snapshot) return null;

  const agents = snapshot.agents ?? [];
  const economy = snapshot.economySummary;
  const aliveCount = agents.filter((a) => a.status === 'alive' || a.status === 'awakening').length;
  const totalTokens = agents.reduce((s, a) => s + a.tokenBalance, 0);
  const pendingInbox = agents.reduce((s, a) => s + a.inboxCount, 0);

  return (
    <div className="h-full overflow-auto p-base space-y-base">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-medium text-high">{snapshot.worldName}</h1>
          <div className="text-sm text-low">
            {aliveCount} 在线 · {agents.length} 总计
            {snapshot.worldTheme && ` · ${snapshot.worldTheme}`}
          </div>
        </div>
        <div className="flex gap-2">
          <Link
            to="/world/residents"
            className="px-base py-1 bg-secondary text-low rounded-md text-sm hover:text-normal hover:bg-secondary/80 transition-colors border"
          >
            居民看板
          </Link>
          <button
            onClick={() => void awakenAll()}
            className="px-base py-1 bg-brand/10 text-brand rounded-md text-sm hover:bg-brand/20 transition-colors"
          >
            唤醒全部
          </button>
        </div>
      </div>

      {/* GM Command Input */}
      <MiniGMInput />

      {/* Metric Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        <MetricCard
          icon={UsersIcon}
          label="在线居民"
          value={aliveCount}
          description={<span>{agents.length} 总计，{agents.length - aliveCount} 休眠</span>}
          to="/world/residents"
        />
        <MetricCard
          icon={CoinIcon}
          label="代币流通"
          value={totalTokens.toLocaleString() + ' T'}
          description={economy ? <span>国库 {economy.treasuryBalance.toLocaleString()} T</span> : undefined}
        />
        <MetricCard
          icon={GlobeIcon}
          label="交易笔数"
          value={economy?.transactionCount ?? transactions.length}
          description={<span>{transactions.length} 条近期记录</span>}
        />
        <MetricCard
          icon={TrayIcon}
          label="待处理消息"
          value={pendingInbox}
          description={<span>全局收件箱</span>}
          to="/world/inbox"
        />
      </div>

      {/* Active Agents Panel */}
      <div>
        <h3 className="text-sm font-medium text-low uppercase tracking-wide mb-2">居民状态</h3>
        <ActiveAgentsPanel agents={agents} onAwaken={awakenAgent} onStop={stopAgent} />
      </div>

      {/* WorldPulse + Economy — two column */}
      <div className="grid md:grid-cols-2 gap-base">
        <WorldPulse events={timeline} agents={agents} />
        <EconomySummary
          treasuryBalance={economy?.treasuryBalance ?? 0}
          circulation={economy?.circulation ?? 0}
          agents={agents}
          transactions={transactions}
        />
      </div>
    </div>
  );
}
