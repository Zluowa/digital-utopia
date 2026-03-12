// @input: useApprovals hook (bounties + GM inbox)
// @output: Full approval workflow page at /world/approvals
// @position: Container page — wires data hook to ApprovalsPanel view

import { useApprovals } from '@/hooks/useApprovals';
import { ApprovalsPanel } from '@/components/ui-new/views/ApprovalsPanel';

export function ApprovalsPage() {
  const { columns, isLoading, error, approve, reject, refresh } = useApprovals();

  const totalPending = columns.pending.length + columns.in_review.length;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full text-low">
        正在加载审批队列...
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-2">
        <div className="text-error">无法连接引擎</div>
        <div className="text-sm text-low">{error}</div>
        <button
          onClick={refresh}
          className="px-base py-1 bg-secondary border rounded text-sm text-low hover:text-normal"
        >
          重试
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full p-base overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between mb-base shrink-0">
        <div>
          <h1 className="text-xl font-medium text-high">审批工作流</h1>
          <div className="text-sm text-low">
            {totalPending > 0
              ? `${totalPending} 项待处理`
              : '暂无待审批项目'}
          </div>
        </div>
        <button
          onClick={refresh}
          className="px-base py-1 bg-secondary border rounded text-sm text-low hover:text-normal transition-colors"
        >
          刷新
        </button>
      </div>

      {/* Three-column board */}
      <div className="flex-1 overflow-hidden">
        <ApprovalsPanel
          columns={columns}
          onApprove={(item) => void approve(item)}
          onReject={(item) => void reject(item)}
        />
      </div>
    </div>
  );
}
