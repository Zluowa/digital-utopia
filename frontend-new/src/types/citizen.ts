// @input: Engine AgentEntry types
// @output: Citizen classification types for kanban view
// @position: Type layer for resident management UI

export type AgentStatus = 'alive' | 'dead' | 'awakening' | 'sleeping';
export type AgentType = 'mastermind' | 'world-keeper' | 'zone-keeper' | 'resident' | 'observer';

export type GroupByMode = 'status' | 'type';
export type ViewMode = 'kanban' | 'list';

export interface CategoryTag {
  id: string;
  name: string;
  color: string;
}

export interface CitizenEntry {
  id: string;
  type: AgentType;
  status: AgentStatus;
  tokenBalance: number;
  lastAwakened: string;
  inboxCount: number;
  identity?: string;
  currentGoal?: string;
  economicNiche?: string;
  categories?: CategoryTag[];
}

export interface CitizenColumn {
  id: string;
  label: string;
  color: string;
  citizens: CitizenEntry[];
}

export interface CitizenFilterState {
  searchQuery: string;
  statuses: AgentStatus[];
  types: AgentType[];
}
