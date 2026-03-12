interface Distribution {
  id: string;
  balance: number;
  pct: number;
}

interface Transaction {
  id: string;
  from: string;
  to: string;
  amount: number;
  reason: string;
  timestamp: string;
  type: string;
}

interface Props {
  treasuryBalance: number;
  circulation: number;
  distribution: Distribution[];
  transactions: Transaction[];
}

function shortTime(iso: string): string {
  try {
    return new Date(iso).toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return '';
  }
}

export function EconomyPanel({
  treasuryBalance,
  circulation,
  distribution,
  transactions,
}: Props) {
  return (
    <div className="bg-secondary rounded-md border p-base">
      <h3 className="text-lg font-medium text-high mb-base">经济面板</h3>

      <div className="grid grid-cols-2 gap-half mb-base">
        <div className="bg-primary rounded p-half">
          <div className="text-xs text-low">国库余额</div>
          <div className="text-lg font-ibm-plex-mono text-high">
            {treasuryBalance.toLocaleString()} T
          </div>
        </div>
        <div className="bg-primary rounded p-half">
          <div className="text-xs text-low">流通总量</div>
          <div className="text-lg font-ibm-plex-mono text-high">
            {circulation.toLocaleString()} T
          </div>
        </div>
      </div>

      {distribution.length > 0 && (
        <div className="mb-base">
          <div className="text-sm text-low mb-1">代币分布</div>
          <div className="space-y-1">
            {distribution.map((item) => (
              <div key={item.id}>
                <div className="flex items-center justify-between text-sm mb-0.5">
                  <span className="text-normal truncate">{item.id}</span>
                  <span className="font-ibm-plex-mono text-high shrink-0 ml-1">
                    {item.balance.toLocaleString()} T
                  </span>
                </div>
                <div className="h-1.5 bg-primary rounded-full overflow-hidden">
                  <div
                    className="h-full bg-brand/60 rounded-full transition-all duration-500"
                    style={{ width: `${Math.max(item.pct, 2)}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div>
        <div className="text-sm text-low mb-1">最近交易</div>
        {transactions.length === 0 ? (
          <div className="text-xs text-low">暂无可用交易数据</div>
        ) : (
          <div className="space-y-0.5 max-h-48 overflow-y-auto">
            {transactions.slice(0, 12).map((tx) => (
              <div key={tx.id} className="flex items-center gap-1 text-xs">
                <span className="text-low w-12 shrink-0">
                  {shortTime(tx.timestamp)}
                </span>
                <span className="text-normal truncate">
                  {tx.from}
                  {' -> '}
                  {tx.to}
                </span>
                <span className="font-ibm-plex-mono text-brand shrink-0">
                  {tx.amount}T
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
