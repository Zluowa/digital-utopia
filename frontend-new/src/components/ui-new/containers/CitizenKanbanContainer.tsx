// @input: WorldSnapshot agents + awaken/stop callbacks
// @output: Full citizen classification kanban with filter bar
// @position: Container bridging useWorldData and citizen views

import { useCitizenKanban } from '@/hooks/useCitizenKanban';
import { CitizenFilterBar } from '@/components/ui-new/views/CitizenFilterBar';
import { CitizenKanbanView } from '@/components/ui-new/views/CitizenKanbanView';
import { CitizenListView } from '@/components/ui-new/views/CitizenListView';
import type { CitizenEntry } from '@/types/citizen';

interface CitizenKanbanContainerProps {
  citizens: CitizenEntry[];
  totalCount: number;
  onAwaken?: (id: string) => void;
  onStop?: (id: string) => void;
}

export function CitizenKanbanContainer({
  citizens,
  totalCount,
  onAwaken,
  onStop,
}: CitizenKanbanContainerProps) {
  const {
    viewMode,
    setViewMode,
    groupBy,
    setGroupBy,
    filters,
    setFilters,
    columns,
    filteredCount,
    hasActiveFilters,
    clearFilters,
  } = useCitizenKanban(citizens);

  return (
    <div className="flex flex-col h-full">
      <div className="px-double pt-double pb-base shrink-0">
        <CitizenFilterBar
          filters={filters}
          onSearchChange={(q) => setFilters((f) => ({ ...f, searchQuery: q }))}
          groupBy={groupBy}
          onGroupByChange={setGroupBy}
          viewMode={viewMode}
          onViewModeChange={setViewMode}
          hasActiveFilters={hasActiveFilters}
          onClearFilters={clearFilters}
          totalCount={totalCount}
          filteredCount={filteredCount}
        />
      </div>

      <div className="flex-1 overflow-hidden border-t">
        {viewMode === 'kanban' ? (
          <CitizenKanbanView
            columns={columns}
            onAwaken={onAwaken}
            onStop={onStop}
          />
        ) : (
          <CitizenListView
            columns={columns}
            onAwaken={onAwaken}
            onStop={onStop}
          />
        )}
      </div>
    </div>
  );
}
