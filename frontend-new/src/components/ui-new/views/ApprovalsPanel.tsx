// @input: ApprovalItem[] grouped by column + approve/reject callbacks
// @output: Three-column kanban view with expandable detail cards
// @position: Pure view component — no data fetching, no side effects

import { useState } from 'react';
import { CheckIcon, XIcon, CaretDownIcon, CaretUpIcon, ClockIcon } from '@phosphor-icons/react';
import type { ApprovalItem } from '@/hooks/useApprovals';

interface CardProps {
  item: ApprovalItem;
  onApprove: (item: ApprovalItem) => void;
  onReject: (item: ApprovalItem) => void;
}

function shortTime(iso: string): string {
  try {
    return new Date(iso).toLocaleString([], {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return '';
  }
}

const REQUEST_TYPE_LABEL: Record<string, string> = {
  payment: '支付请求',
  spawn: '孵化请求',
  resource: '资源申请',
  message: '消息通知',
};

function ApprovalCard({ item, onApprove, onReject }: CardProps) {
  const [expanded, setExpanded] = useState(false);
  const isResolved = item.status === 'resolved';
  const canApprove = !isResolved;
  const canReject = !isResolved && item.source === 'inbox';

  const typeLabel = REQUEST_TYPE_LABEL[item.requestType] ?? item.requestType;

  return (
    <div className="bg-secondary rounded-md border overflow-hidden">
      {/* Card header */}
      <div
        className="p-base cursor-pointer select-none"
        onClick={() => setExpanded((v) => !v)}
      >
        <div className="flex items-start justify-between gap-half mb-half">
          <span className="text-sm font-medium text-high truncate">{item.agentName}</span>
          <div className="flex items-center gap-1 shrink-0">
            {item.amount > 0 && (
              <span className="font-ibm-plex-mono text-brand text-sm">
                {item.amount.toLocaleString()} T
              </span>
            )}
            {expanded ? (
              <CaretUpIcon className="size-3 text-low" />
            ) : (
              <CaretDownIcon className="size-3 text-low" />
            )}
          </div>
        </div>

        <div className="flex items-center gap-half mb-half">
          <span className="text-xs bg-primary text-low px-1 py-0.5 rounded">{typeLabel}</span>
          <span className="text-xs text-low flex items-center gap-0.5">
            <ClockIcon className="size-3" />
            {shortTime(item.timestamp)}
          </span>
        </div>

        <p className="text-xs text-normal line-clamp-2">{item.description}</p>
      </div>

      {/* Expanded detail */}
      {expanded && item.deliverable && (
        <div className="px-base pb-base">
          <div className="text-xs text-low mb-1">交付物预览</div>
          <pre className="text-xs text-normal bg-primary rounded p-half overflow-auto max-h-32 whitespace-pre-wrap break-words">
            {item.deliverable}
          </pre>
        </div>
      )}

      {/* Action buttons */}
      {(canApprove || canReject) && (
        <div className="flex border-t">
          {canApprove && (
            <button
              onClick={(e) => { e.stopPropagation(); onApprove(item); }}
              className="flex-1 flex items-center justify-center gap-1 py-1.5 text-xs text-success hover:bg-success/10 transition-colors"
            >
              <CheckIcon className="size-3" weight="bold" />
              批准
            </button>
          )}
          {canReject && (
            <button
              onClick={(e) => { e.stopPropagation(); onReject(item); }}
              className="flex-1 flex items-center justify-center gap-1 py-1.5 text-xs text-error hover:bg-error/10 transition-colors border-l"
            >
              <XIcon className="size-3" weight="bold" />
              拒绝
            </button>
          )}
        </div>
      )}

      {isResolved && (
        <div className="px-base py-1.5 border-t text-xs text-low text-center">
          已处理 · {item.rawStatus}
        </div>
      )}
    </div>
  );
}

const COLUMN_META = [
  { key: 'pending' as const, label: '待审批', dotClass: 'bg-brand' },
  { key: 'in_review' as const, label: '审核中', dotClass: 'bg-yellow-400' },
  { key: 'resolved' as const, label: '已完结', dotClass: 'bg-success' },
];

interface Props {
  columns: Record<'pending' | 'in_review' | 'resolved', ApprovalItem[]>;
  onApprove: (item: ApprovalItem) => void;
  onReject: (item: ApprovalItem) => void;
}

export function ApprovalsPanel({ columns, onApprove, onReject }: Props) {
  return (
    <div className="grid grid-cols-3 gap-base h-full overflow-hidden">
      {COLUMN_META.map(({ key, label, dotClass }) => (
        <div key={key} className="flex flex-col overflow-hidden">
          {/* Column header */}
          <div className="flex items-center gap-half mb-base shrink-0">
            <span className={`size-2 rounded-full ${dotClass}`} />
            <span className="text-sm font-medium text-high">{label}</span>
            <span className="text-xs text-low ml-auto">{columns[key].length}</span>
          </div>

          {/* Card list */}
          <div className="flex-1 overflow-y-auto space-y-half pr-half">
            {columns[key].length === 0 ? (
              <div className="text-xs text-low text-center py-double">暂无记录</div>
            ) : (
              columns[key].map((item) => (
                <ApprovalCard
                  key={item.id}
                  item={item}
                  onApprove={onApprove}
                  onReject={onReject}
                />
              ))
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
