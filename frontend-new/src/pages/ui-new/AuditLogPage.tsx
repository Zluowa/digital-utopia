// @input: useAuditLog hook
// @output: /world/activity 路由页面
// @position: page container — connects data hook to stateless AuditLogList view

import { useAuditLog } from '@/hooks/useAuditLog';
import { AuditLogList } from '@/components/ui-new/views/AuditLogList';

export function AuditLogPage() {
  const { entries, agentIds, isLoading, error, filters, setFilters, refresh } = useAuditLog();

  return (
    <AuditLogList
      entries={entries}
      agentIds={agentIds}
      isLoading={isLoading}
      error={error}
      filters={filters}
      onFiltersChange={setFilters}
      onRefresh={refresh}
    />
  );
}
