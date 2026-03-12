// @input: AuditEntry[], AuditFilters, agentIds list
// @output: filterable timeline list of audit events
// @position: stateless view — all data/state passed via props from AuditLogPage

import {
  LightningIcon,
  ChatCircleDotsIcon,
  ArrowsLeftRightIcon,
  FileIcon,
  WarningCircleIcon,
  GlobeIcon,
  MagnifyingGlassIcon,
  FunnelIcon,
  ArrowClockwiseIcon,
} from '@phosphor-icons/react';
import type { AuditEntry, AuditEntryKind, AuditFilters } from '@/hooks/useAuditLog';

// ── kind metadata (data-driven, no switch) ──────────────────────────────────
const KIND_META: Record<AuditEntryKind, { Icon: React.ElementType; color: string; label: string }> = {
  awaken:   { Icon: LightningIcon,       color: 'text-green-400',  label: '唤醒' },
  message:  { Icon: ChatCircleDotsIcon,  color: 'text-blue-400',   label: '消息' },
  transfer: { Icon: ArrowsLeftRightIcon, color: 'text-yellow-400', label: '转账' },
  file:     { Icon: FileIcon,            color: 'text-purple-400', label: '文件' },
  error:    { Icon: WarningCircleIcon,   color: 'text-error',      label: '错误' },
  system:   { Icon: GlobeIcon,           color: 'text-low',        label: '系统' },
};

const KIND_OPTIONS = Object.entries(KIND_META) as [AuditEntryKind, typeof KIND_META[AuditEntryKind]][];

// ── helpers ──────────────────────────────────────────────────────────────────
function formatDateTime(iso: string): string {
  try {
    return new Date(iso).toLocaleString('zh-CN', {
      month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', second: '2-digit',
    });
  } catch {
    return iso;
  }
}

// ── sub-components ───────────────────────────────────────────────────────────
interface ToolbarProps {
  filters: AuditFilters;
  agentIds: string[];
  total: number;
  onFiltersChange: (f: AuditFilters) => void;
  onRefresh: () => void;
}

function Toolbar({ filters, agentIds, total, onFiltersChange, onRefresh }: ToolbarProps) {
  return (
    <div className="flex items-center gap-half flex-wrap">
      {/* Search */}
      <div className="flex items-center gap-1 bg-secondary border rounded px-half h-7 flex-1 min-w-0">
        <MagnifyingGlassIcon className="size-3.5 text-low shrink-0" />
        <input
          value={filters.search}
          onChange={(e) => onFiltersChange({ ...filters, search: e.target.value })}
          placeholder="搜索描述或 agent..."
          className="flex-1 bg-transparent text-sm text-normal placeholder:text-low outline-none min-w-0"
        />
      </div>

      {/* Agent filter */}
      <div className="flex items-center gap-1 bg-secondary border rounded px-half h-7">
        <FunnelIcon className="size-3.5 text-low shrink-0" />
        <select
          value={filters.agentId}
          onChange={(e) => onFiltersChange({ ...filters, agentId: e.target.value })}
          className="bg-transparent text-sm text-normal outline-none pr-1"
        >
          <option value="">全部 Agent</option>
          {agentIds.map((id) => (
            <option key={id} value={id}>{id}</option>
          ))}
        </select>
      </div>

      {/* Kind filter */}
      <div className="flex items-center gap-1">
        {KIND_OPTIONS.map(([kind, meta]) => (
          <button
            key={kind}
            onClick={() => onFiltersChange({ ...filters, kind: filters.kind === kind ? '' : kind })}
            className={`flex items-center gap-0.5 px-1.5 h-7 rounded border text-xs transition-colors ${
              filters.kind === kind
                ? 'bg-panel border-brand text-normal'
                : 'bg-secondary border-transparent text-low hover:text-normal'
            }`}
            title={meta.label}
          >
            <meta.Icon className={`size-3.5 ${meta.color}`} weight="bold" />
            <span className="hidden sm:inline">{meta.label}</span>
          </button>
        ))}
      </div>

      {/* Count + refresh */}
      <span className="text-xs text-low shrink-0">{total} 条</span>
      <button
        onClick={onRefresh}
        className="flex items-center justify-center size-7 bg-secondary border rounded text-low hover:text-normal transition-colors"
        title="刷新"
      >
        <ArrowClockwiseIcon className="size-3.5" />
      </button>
    </div>
  );
}

interface EntryRowProps {
  entry: AuditEntry;
}

function EntryRow({ entry }: EntryRowProps) {
  const meta = KIND_META[entry.kind];
  return (
    <div className="flex items-start gap-half py-1 border-b border-primary last:border-0">
      {/* Timeline connector */}
      <div className="flex flex-col items-center shrink-0 pt-0.5">
        <meta.Icon className={`size-4 ${meta.color}`} weight="bold" />
        <div className="w-px flex-1 bg-primary mt-0.5 min-h-[12px]" />
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-half flex-wrap">
          <span className="text-xs text-low font-ibm-plex-mono shrink-0">
            {formatDateTime(entry.timestamp)}
          </span>
          {entry.agentId && entry.agentId !== 'system' && (
            <span className="text-xs text-brand bg-brand/10 px-1 rounded shrink-0">
              {entry.agentId}
            </span>
          )}
        </div>
        <p className="text-sm text-normal mt-0.5 break-all">{entry.description}</p>
      </div>
    </div>
  );
}

// ── main export ──────────────────────────────────────────────────────────────
interface Props {
  entries: AuditEntry[];
  agentIds: string[];
  isLoading: boolean;
  error: string | null;
  filters: AuditFilters;
  onFiltersChange: (f: AuditFilters) => void;
  onRefresh: () => void;
}

export function AuditLogList({
  entries, agentIds, isLoading, error, filters, onFiltersChange, onRefresh,
}: Props) {
  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-double pt-double pb-base shrink-0">
        <h1 className="text-xl font-medium text-high mb-base">审计日志</h1>
        <Toolbar
          filters={filters}
          agentIds={agentIds}
          total={entries.length}
          onFiltersChange={onFiltersChange}
          onRefresh={onRefresh}
        />
      </div>

      {/* Feed */}
      <div className="flex-1 overflow-y-auto px-double pb-double">
        {isLoading && (
          <div className="flex items-center justify-center py-double text-low text-sm">
            加载中...
          </div>
        )}
        {!isLoading && error && (
          <div className="flex flex-col items-center justify-center py-double gap-2">
            <div className="text-error">引擎离线</div>
            <div className="text-sm text-low">{error}</div>
          </div>
        )}
        {!isLoading && !error && entries.length === 0 && (
          <div className="flex items-center justify-center py-double text-low text-sm">
            暂无匹配记录
          </div>
        )}
        {!isLoading && !error && entries.length > 0 && (
          <div className="bg-secondary border rounded-md p-base">
            {entries.map((entry) => (
              <EntryRow key={entry.id} entry={entry} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
