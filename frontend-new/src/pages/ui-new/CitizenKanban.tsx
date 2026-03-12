// @input: WorldData hook (agents + actions)
// @output: Citizen classification kanban page
// @position: Page-level component at /world/citizens

import { useWorldData } from '@/hooks/useWorldData';
import { CitizenKanbanContainer } from '@/components/ui-new/containers/CitizenKanbanContainer';
import type { CitizenEntry } from '@/types/citizen';

function toCitizen(agent: {
  id: string;
  type: string;
  status: string;
  tokenBalance: number;
  lastAwakened: string;
  inboxCount: number;
  identity?: string;
  currentGoal?: string;
  economicNiche?: string;
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

export function CitizenKanban() {
  const { snapshot, isLoading, error, awakenAgent, stopAgent } = useWorldData();

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

  const citizens = snapshot.agents.map(toCitizen);

  return (
    <div className="flex flex-col h-full">
      <div className="px-double pt-double pb-base shrink-0">
        <h1 className="text-xl font-medium text-high">Citizens</h1>
        <div className="text-sm text-low mt-half">
          {snapshot.aliveAgents} alive · {snapshot.totalAgents} total · {snapshot.worldName}
        </div>
      </div>

      <CitizenKanbanContainer
        citizens={citizens}
        totalCount={citizens.length}
        onAwaken={(id) => void awakenAgent(id)}
        onStop={(id) => void stopAgent(id)}
      />
    </div>
  );
}
