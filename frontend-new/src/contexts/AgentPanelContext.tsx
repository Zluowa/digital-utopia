// @input: OrgChartPage / AgentCard calling openPanel(agent)
// @output: Selected agent + panel open state for PropertiesPanel
// @position: App-level context — agent properties panel state

import {
  createContext,
  useCallback,
  useContext,
  useState,
  type ReactNode,
} from 'react';
import type { AgentEntry } from '@/hooks/useWorldData';

interface AgentPanelContextValue {
  selectedAgent: AgentEntry | null;
  panelOpen: boolean;
  openPanel: (agent: AgentEntry) => void;
  closePanel: () => void;
}

const Ctx = createContext<AgentPanelContextValue>({
  selectedAgent: null,
  panelOpen: false,
  openPanel: () => {},
  closePanel: () => {},
});

export function AgentPanelProvider({ children }: { children: ReactNode }) {
  const [selectedAgent, setSelectedAgent] = useState<AgentEntry | null>(null);
  const [panelOpen, setPanelOpen] = useState(false);

  const openPanel = useCallback((agent: AgentEntry) => {
    setSelectedAgent(agent);
    setPanelOpen(true);
  }, []);

  const closePanel = useCallback(() => {
    setPanelOpen(false);
  }, []);

  return (
    <Ctx.Provider value={{ selectedAgent, panelOpen, openPanel, closePanel }}>
      {children}
    </Ctx.Provider>
  );
}

export function useAgentPanel() {
  return useContext(Ctx);
}
