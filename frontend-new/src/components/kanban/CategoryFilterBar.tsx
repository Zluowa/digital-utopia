// @input: Filter state + category list + view/group controls
// @output: Toolbar: search, category chips, group-by, view-mode toggles
// @position: Top bar for ResidentsPage

import type { CitizenFilterState, GroupByMode, ViewMode } from '@/types/citizen';
import type { Category } from '@/hooks/useCategories';

interface CategoryFilterBarProps {
  filters: CitizenFilterState;
  onSearchChange: (q: string) => void;
  categories: Category[];
  selectedCategoryIds: string[];
  onCategoryToggle: (id: string) => void;
  groupBy: GroupByMode;
  onGroupByChange: (mode: GroupByMode) => void;
  viewMode: ViewMode;
  onViewModeChange: (mode: ViewMode) => void;
  hasActiveFilters: boolean;
  onClearFilters: () => void;
  totalCount: number;
  filteredCount: number;
}

function ToggleGroup({ options, value, onChange }: {
  options: { id: string; label: string }[];
  value: string;
  onChange: (id: string) => void;
}) {
  return (
    <div className="flex items-center bg-secondary rounded border overflow-hidden">
      {options.map((opt) => (
        <button
          key={opt.id}
          onClick={() => onChange(opt.id)}
          className={`px-base py-half text-sm transition-colors
            ${value === opt.id ? 'bg-brand/20 text-brand' : 'text-low hover:text-normal'}`}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}

export function CategoryFilterBar({
  filters,
  onSearchChange,
  categories,
  selectedCategoryIds,
  onCategoryToggle,
  groupBy,
  onGroupByChange,
  viewMode,
  onViewModeChange,
  hasActiveFilters,
  onClearFilters,
  totalCount,
  filteredCount,
}: CategoryFilterBarProps) {
  return (
    <div className="flex flex-wrap items-center gap-base">
      {/* Search */}
      <input
        type="text"
        value={filters.searchQuery}
        onChange={(e) => onSearchChange(e.target.value)}
        placeholder="Search residents..."
        className="px-base bg-secondary rounded border text-base text-normal
          placeholder:text-low focus:outline-none focus:ring-1 focus:ring-brand w-44"
      />

      {/* Category chips */}
      {categories.map((cat) => {
        const active = selectedCategoryIds.includes(cat.id);
        return (
          <button
            key={cat.id}
            onClick={() => onCategoryToggle(cat.id)}
            className={`px-base py-half text-xs rounded border transition-colors
              ${active ? 'text-white border-transparent' : 'text-low hover:text-normal'}`}
            style={active ? { backgroundColor: cat.color, borderColor: cat.color } : undefined}
          >
            {cat.name}
          </button>
        );
      })}

      {/* Group by */}
      <ToggleGroup
        options={[
          { id: 'status', label: 'By Status' },
          { id: 'type',   label: 'By Role' },
        ]}
        value={groupBy}
        onChange={(v) => onGroupByChange(v as GroupByMode)}
      />

      {/* View mode */}
      <ToggleGroup
        options={[
          { id: 'kanban', label: 'Kanban' },
          { id: 'list',   label: 'List' },
        ]}
        value={viewMode}
        onChange={(v) => onViewModeChange(v as ViewMode)}
      />

      {/* Count */}
      <span className="text-sm text-low">
        {filteredCount !== totalCount ? `${filteredCount}/${totalCount}` : `${totalCount}`}
      </span>

      {hasActiveFilters && (
        <button onClick={onClearFilters} className="text-sm text-low hover:text-normal">
          Clear
        </button>
      )}
    </div>
  );
}
