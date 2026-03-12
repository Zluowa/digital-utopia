// @input: transactions[] + agents[] + economySummary from useWorldData
// @output: 经济概览 bar chart 组件（token 流速、财富分布）
// @position: Dashboard 经济区块的图表子组件，零依赖纯展示

interface Transaction {
  id: string;
  from: string;
  to: string;
  amount: number;
  reason: string;
  timestamp: string;
  type: string;
}

interface AgentEntry {
  id: string;
  tokenBalance: number;
  identity?: string;
}

function getLast14Days(): string[] {
  return Array.from({ length: 14 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (13 - i));
    return d.toISOString().slice(0, 10);
  });
}

function formatDayLabel(dateStr: string): string {
  const d = new Date(dateStr + 'T12:00:00');
  return `${d.getMonth() + 1}/${d.getDate()}`;
}

// ── Token flow bar chart (transactions per day) ──────────────────

interface TokenFlowChartProps {
  transactions: Transaction[];
}

export function TokenFlowChart({ transactions }: TokenFlowChartProps) {
  const days = getLast14Days();

  const countsByDay = new Map<string, number>(days.map((d) => [d, 0]));
  for (const tx of transactions) {
    const day = new Date(tx.timestamp).toISOString().slice(0, 10);
    if (countsByDay.has(day)) countsByDay.set(day, countsByDay.get(day)! + 1);
  }

  const max = Math.max(...Array.from(countsByDay.values()), 1);
  const hasData = Array.from(countsByDay.values()).some((v) => v > 0);

  if (!hasData) {
    return <p className="text-sm text-low">暂无交易数据</p>;
  }

  return (
    <div>
      <div className="flex items-end gap-[3px] h-16">
        {days.map((day) => {
          const count = countsByDay.get(day) ?? 0;
          const heightPct = (count / max) * 100;
          return (
            <div
              key={day}
              className="flex-1 h-full flex flex-col justify-end"
              title={`${day}: ${count} 笔`}
            >
              {count > 0 ? (
                <div
                  className="bg-brand/70 rounded-sm"
                  style={{ height: `${heightPct}%`, minHeight: 2 }}
                />
              ) : (
                <div className="bg-secondary rounded-sm" style={{ height: 2 }} />
              )}
            </div>
          );
        })}
      </div>
      <div className="flex gap-[3px] mt-1">
        {days.map((day, i) => (
          <div key={day} className="flex-1 text-center">
            {(i === 0 || i === 6 || i === 13) ? (
              <span className="text-xs text-low">{formatDayLabel(day)}</span>
            ) : null}
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Wealth distribution bar chart ────────────────────────────────

interface WealthDistributionChartProps {
  agents: AgentEntry[];
}

export function WealthDistributionChart({ agents }: WealthDistributionChartProps) {
  if (agents.length === 0) {
    return <p className="text-sm text-low">暂无 Agent 数据</p>;
  }

  const sorted = [...agents].sort((a, b) => b.tokenBalance - a.tokenBalance).slice(0, 8);
  const max = Math.max(...sorted.map((a) => a.tokenBalance), 1);

  return (
    <div className="space-y-1">
      {sorted.map((agent) => {
        const pct = (agent.tokenBalance / max) * 100;
        const name = agent.identity ?? agent.id.slice(0, 8);
        return (
          <div key={agent.id} className="flex items-center gap-2 text-sm">
            <span className="text-low w-20 truncate shrink-0" title={name}>
              {name}
            </span>
            <div className="flex-1 h-3 bg-secondary rounded-sm overflow-hidden">
              <div
                className="h-full bg-brand/60 rounded-sm transition-all duration-500"
                style={{ width: `${Math.max(pct, 1)}%` }}
              />
            </div>
            <span className="font-ibm-plex-mono text-high text-xs shrink-0 w-16 text-right">
              {agent.tokenBalance.toLocaleString()} T
            </span>
          </div>
        );
      })}
    </div>
  );
}
