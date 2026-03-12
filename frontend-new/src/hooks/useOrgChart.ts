// @input: useWorldData hook providing AgentEntry[]
// @output: org chart tree data — world node, dept nodes, agent nodes
// @position: data layer for OrgChartCanvas; pure transformation, no UI

import { useMemo } from 'react';
import { useWorldData } from './useWorldData';
import type { AgentEntry } from './useWorldData';

export interface DeptConfig {
  id: string;
  label: string;
  agentIds: string[];
}

export interface OrgNode {
  id: string;
  label: string;
  kind: 'world' | 'dept' | 'agent';
  agent?: AgentEntry;
  dept?: DeptConfig;
  children: OrgNode[];
}

const DEPT_CONFIG: DeptConfig[] = [
  { id: 'content',   label: '内容部',  agentIds: ['aria', 'sage'] },
  { id: 'ops',       label: '运营部',  agentIds: ['cruz', 'nova'] },
  { id: 'intel',     label: '情报部',  agentIds: ['echo', 'iris'] },
  { id: 'dev',       label: '开发部',  agentIds: ['rune', 'vex']  },
];

function buildTree(agents: AgentEntry[]): OrgNode {
  const agentMap = new Map(agents.map((a) => [a.id, a]));

  const deptNodes: OrgNode[] = DEPT_CONFIG.map((dept) => ({
    id: dept.id,
    label: dept.label,
    kind: 'dept',
    dept,
    children: dept.agentIds.map((agentId) => ({
      id: agentId,
      label: agentId,
      kind: 'agent',
      agent: agentMap.get(agentId),
      children: [],
    })),
  }));

  return {
    id: 'tishi-branch',
    label: 'Tishi Branch',
    kind: 'world',
    children: deptNodes,
  };
}

export function useOrgChart() {
  const { snapshot, isLoading, error } = useWorldData();

  const tree = useMemo(
    () => buildTree(snapshot?.agents ?? []),
    [snapshot?.agents]
  );

  return { tree, snapshot, isLoading, error };
}
