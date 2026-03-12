// @input: useWorldData + useCategories hooks
// @output: Full residents management page with kanban + list + category filters
// @position: Page at /world/residents — canonical resident management UI

import { useState, useMemo, useCallback } from 'react';
import { useWorldData } from '@/hooks/useWorldData';
import { useCategories } from '@/hooks/useCategories';
import { useCitizenKanban } from '@/hooks/useCitizenKanban';
import { CategoryFilterBar } from '@/components/kanban/CategoryFilterBar';
import { ResidentKanban } from '@/components/kanban/ResidentKanban';
import { ResidentList } from '@/components/kanban/ResidentList';
import type { CitizenEntry } from '@/types/citizen';

function toCitizen(agent: {
  id: string; type: string; status: string;
  tokenBalance: number; lastAwakened: string; inboxCount: number;
  identity?: string; currentGoal?: string; economicNiche?: string;
}): CitizenEntry {
  return {
    id: agent.id,
    type: agent.type as CitizenEntry['type'],
    status: agent.status as CitizenEntry['status'],
    tokenBalance: agent.tokenBalance,
    lastAwakened: agent.lastAwakened,
    inboxCount: agent.inboxCount,
    identity: agent.identity,
    currentGoal: agent.currentGoal,
    economicNiche: agent.economicNiche,
  };
}

export function ResidentsPage() {
  const { snapshot, isLoading, error, awakenAgent, stopAgent } = useWorldData();
  const { categories } = useCategories();
  const [selectedCategoryIds, setSelectedCategoryIds] = useState<string[]>([]);

  const allCitizens = useMemo(
    () => (snapshot?.agents ?? []).map(toCitizen),
    [snapshot]
  );

  // Filter by selected category tags (client-side, as /api/snapshot has all agents)
  const citizensForKanban = useMemo(() => {
    if (selectedCategoryIds.length === 0) return allCitizens;
    return allCitizens.filter((c) =>
      c.categories?.some((tag) => selectedCategoryIds.includes(tag.id))
    );
  }, [allCitizens, selectedCategoryIds]);

  const {
    viewMode, setViewMode,
    groupBy, setGroupBy,
    filters, setFilters,
    columns,
    filteredCount,
    hasActiveFilters,
    clearFilters,
  } = useCitizenKanban(citizensForKanban);

  const handleCategoryToggle = useCallback((id: string) => {
    setSelectedCategoryIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  }, []);

  const handleClearAll = useCallback(() => {
    clearFilters();
    setSelectedCategoryIds([]);
  }, [clearFilters]);

  const hasAnyFilter = hasActiveFilters || selectedCategoryIds.length > 0;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full text-low">
        Connecting to world engine...
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-2">
        <div className="text-error">Engine offline</div>
        <div className="text-sm text-low">{error}</div>
      </div>
    );
  }

  if (!snapshot) return null;

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-double pt-double pb-base shrink-0">
        <div className="flex items-baseline gap-base mb-base">
          <h1 className="text-xl font-medium text-high">Residents</h1>
          <span className="text-sm text-low">
            {snapshot.aliveAgents} alive · {snapshot.totalAgents} total · {snapshot.worldName}
          </span>
        </div>

        <CategoryFilterBar
          filters={filters}
          onSearchChange={(q) => setFilters((f) => ({ ...f, searchQuery: q }))}
          categories={categories}
          selectedCategoryIds={selectedCategoryIds}
          onCategoryToggle={handleCategoryToggle}
          groupBy={groupBy}
          onGroupByChange={setGroupBy}
          viewMode={viewMode}
          onViewModeChange={setViewMode}
          hasActiveFilters={hasAnyFilter}
          onClearFilters={handleClearAll}
          totalCount={allCitizens.length}
          filteredCount={filteredCount}
        />
      </div>

      {/* Board */}
      <div className="flex-1 overflow-hidden border-t">
        {viewMode === 'kanban' ? (
          <ResidentKanban
            columns={columns}
            onAwaken={(id) => void awakenAgent(id)}
            onStop={(id) => void stopAgent(id)}
          />
        ) : (
          <ResidentList
            columns={columns}
            onAwaken={(id) => void awakenAgent(id)}
            onStop={(id) => void stopAgent(id)}
          />
        )}
      </div>
    </div>
  );
}
