// @input: WorldSnapshot agents array
// @output: Filtered and grouped citizens for kanban/list view
// @position: State management hook for citizen classification

import { useState, useMemo, useCallback } from 'react';
import type {
  CitizenEntry,
  CitizenColumn,
  CitizenFilterState,
  GroupByMode,
  ViewMode,
  AgentStatus,
  AgentType,
} from '@/types/citizen';

const STATUS_CONFIG: Record<AgentStatus, { label: string; color: string }> = {
  alive:     { label: 'Alive',      color: '#4ade80' },
  awakening: { label: 'Awakening',  color: '#facc15' },
  sleeping:  { label: 'Sleeping',   color: '#60a5fa' },
  dead:      { label: 'Dead',       color: '#f87171' },
};

const TYPE_CONFIG: Record<AgentType, { label: string; color: string }> = {
  mastermind:    { label: 'Mastermind',    color: '#c084fc' },
  'world-keeper':{ label: 'World Keeper',  color: '#f97316' },
  'zone-keeper': { label: 'Zone Keeper',   color: '#06b6d4' },
  resident:      { label: 'Resident',      color: '#84cc16' },
  observer:      { label: 'Observer',      color: '#94a3b8' },
};

const DEFAULT_FILTERS: CitizenFilterState = {
  searchQuery: '',
  statuses: [],
  types: [],
};

export function useCitizenKanban(citizens: CitizenEntry[]) {
  const [viewMode, setViewMode] = useState<ViewMode>('kanban');
  const [groupBy, setGroupBy] = useState<GroupByMode>('status');
  const [filters, setFilters] = useState<CitizenFilterState>(DEFAULT_FILTERS);

  const filtered = useMemo(() => {
    return citizens.filter((c) => {
      if (filters.statuses.length > 0 && !filters.statuses.includes(c.status)) return false;
      if (filters.types.length > 0 && !filters.types.includes(c.type)) return false;
      if (filters.searchQuery) {
        const q = filters.searchQuery.toLowerCase();
        const name = (c.identity || c.id).toLowerCase();
        const niche = (c.economicNiche || '').toLowerCase();
        if (!name.includes(q) && !niche.includes(q)) return false;
      }
      return true;
    });
  }, [citizens, filters]);

  const columns = useMemo((): CitizenColumn[] => {
    if (groupBy === 'status') {
      return (Object.keys(STATUS_CONFIG) as AgentStatus[]).map((status) => ({
        id: status,
        label: STATUS_CONFIG[status].label,
        color: STATUS_CONFIG[status].color,
        citizens: filtered.filter((c) => c.status === status),
      }));
    }
    return (Object.keys(TYPE_CONFIG) as AgentType[]).map((type) => ({
      id: type,
      label: TYPE_CONFIG[type].label,
      color: TYPE_CONFIG[type].color,
      citizens: filtered.filter((c) => c.type === type),
    }));
  }, [filtered, groupBy]);

  const clearFilters = useCallback(() => setFilters(DEFAULT_FILTERS), []);

  const hasActiveFilters =
    filters.searchQuery.length > 0 ||
    filters.statuses.length > 0 ||
    filters.types.length > 0;

  return {
    viewMode,
    setViewMode,
    groupBy,
    setGroupBy,
    filters,
    setFilters,
    columns,
    filteredCount: filtered.length,
    hasActiveFilters,
    clearFilters,
    STATUS_CONFIG,
    TYPE_CONFIG,
  };
}
