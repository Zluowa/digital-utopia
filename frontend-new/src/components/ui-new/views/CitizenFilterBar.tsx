// @input: Filter state + column config
// @output: Filter bar with search, group-by, view-mode toggles
// @position: Toolbar above the citizen kanban/list

import type { CitizenFilterState, GroupByMode, ViewMode } from '@/types/citizen';

interface CitizenFilterBarProps {
  filters: CitizenFilterState;
  onSearchChange: (q: string) => void;
  groupBy: GroupByMode;
  onGroupByChange: (mode: GroupByMode) => void;
  viewMode: ViewMode;
  onViewModeChange: (mode: ViewMode) => void;
  hasActiveFilters: boolean;
  onClearFilters: () => void;
  totalCount: number;
  filteredCount: number;
}

export function CitizenFilterBar({
  filters,
  onSearchChange,
  groupBy,
  onGroupByChange,
  viewMode,
  onViewModeChange,
  hasActiveFilters,
  onClearFilters,
  totalCount,
  filteredCount,
}: CitizenFilterBarProps) {
  return (
    <div className="flex flex-wrap items-center gap-base">
      {/* Search */}
      <input
        type="text"
        value={filters.searchQuery}
        onChange={(e) => onSearchChange(e.target.value)}
        placeholder="Search citizens..."
        className="px-base bg-secondary rounded border text-base text-normal
          placeholder:text-low focus:outline-none focus:ring-1 focus:ring-brand
          w-48"
      />

      {/* Group by */}
      <div className="flex items-center gap-1 bg-secondary rounded border overflow-hidden">
        <button
          onClick={() => onGroupByChange('status')}
          className={`px-base py-half text-sm transition-colors
            ${groupBy === 'status' ? 'bg-brand/20 text-brand' : 'text-low hover:text-normal'}`}
        >
          By Status
        </button>
        <button
          onClick={() => onGroupByChange('type')}
          className={`px-base py-half text-sm transition-colors
            ${groupBy === 'type' ? 'bg-brand/20 text-brand' : 'text-low hover:text-normal'}`}
        >
          By Type
        </button>
      </div>

      {/* View mode */}
      <div className="flex items-center gap-1 bg-secondary rounded border overflow-hidden">
        <button
          onClick={() => onViewModeChange('kanban')}
          className={`px-base py-half text-sm transition-colors
            ${viewMode === 'kanban' ? 'bg-brand/20 text-brand' : 'text-low hover:text-normal'}`}
        >
          Kanban
        </button>
        <button
          onClick={() => onViewModeChange('list')}
          className={`px-base py-half text-sm transition-colors
            ${viewMode === 'list' ? 'bg-brand/20 text-brand' : 'text-low hover:text-normal'}`}
        >
          List
        </button>
      </div>

      {/* Count */}
      <span className="text-sm text-low">
        {filteredCount !== totalCount
          ? `${filteredCount} / ${totalCount}`
          : `${totalCount} citizens`}
      </span>

      {/* Clear filters */}
      {hasActiveFilters && (
        <button
          onClick={onClearFilters}
          className="text-sm text-low hover:text-normal transition-colors"
        >
          Clear
        </button>
      )}
    </div>
  );
}
