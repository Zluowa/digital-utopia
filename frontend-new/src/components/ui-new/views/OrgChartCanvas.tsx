// @input: OrgNode tree + selectedId + onSelect callback
// @output: SVG-connected org chart, pure presentational
// @position: core visual for OrgChartPage; stateless view component

import { useRef, useLayoutEffect, useState, useCallback } from 'react';
import type { OrgNode } from '@/hooks/useOrgChart';
import type { AgentEntry } from '@/hooks/useWorldData';

// ─── status styling ───────────────────────────────────────────────────────────

const STATUS_DOT: Record<string, string> = {
  alive:     'bg-green-400 animate-pulse',
  awakening: 'bg-yellow-400 animate-pulse',
  sleeping:  'bg-neutral-400',
  dead:      'bg-red-500',
};

const STATUS_LABEL: Record<string, string> = {
  alive: '在线', awakening: '唤醒中', sleeping: '休眠', dead: '停机',
};

// ─── node components ─────────────────────────────────────────────────────────

function WorldNode({ node }: { node: OrgNode }) {
  return (
    <div className="flex flex-col items-center justify-center bg-panel border border-brand/40 rounded-md px-double py-base min-w-32 shadow-sm">
      <div className="text-xs text-brand font-ibm-plex-mono uppercase tracking-widest mb-0.5">World</div>
      <div className="text-lg font-medium text-high">{node.label}</div>
    </div>
  );
}

function DeptNode({ node }: { node: OrgNode }) {
  return (
    <div className="flex flex-col items-center justify-center bg-secondary border rounded-md px-base py-half min-w-24">
      <div className="text-sm font-medium text-normal">{node.label}</div>
      <div className="text-xs text-low">{node.children.length} 人</div>
    </div>
  );
}

interface AgentNodeProps {
  node: OrgNode;
  selected: boolean;
  onSelect: (id: string, agent?: AgentEntry) => void;
}

function AgentNode({ node, selected, onSelect }: AgentNodeProps) {
  const agent = node.agent;
  const status = agent?.status ?? 'sleeping';
  const dotCls = STATUS_DOT[status] ?? STATUS_DOT.sleeping;
  const label = STATUS_LABEL[status] ?? '未知';

  return (
    <div
      onClick={() => onSelect(node.id, agent ?? undefined)}
      className={`
        bg-secondary border rounded-md p-base cursor-pointer transition-all min-w-28
        ${selected ? 'border-brand shadow-[0_0_0_1px] shadow-brand/30' : 'hover:border-brand/50'}
        ${status === 'dead' ? 'opacity-50' : ''}
      `}
    >
      <div className="flex items-center gap-1.5 mb-0.5">
        <span className={`w-2 h-2 rounded-full shrink-0 ${dotCls}`} />
        <span className="text-base font-medium text-high capitalize">{node.id}</span>
      </div>
      <div className="text-xs text-low mb-1">{agent?.economicNiche ?? agent?.type ?? '—'}</div>
      <div className="flex items-center justify-between">
        <span className="text-xs font-ibm-plex-mono text-normal">
          {(agent?.tokenBalance ?? 0).toLocaleString()} T
        </span>
        <span className="text-xs text-low">{label}</span>
      </div>
      {selected && agent && <AgentDetail agent={agent} />}
    </div>
  );
}

function AgentDetail({ agent }: { agent: AgentEntry }) {
  return (
    <div className="mt-base pt-base border-t space-y-1.5">
      {agent.currentGoal && (
        <div>
          <div className="text-xs text-low mb-0.5">当前使命</div>
          <div className="text-xs text-normal leading-relaxed">{agent.currentGoal}</div>
        </div>
      )}
      {agent.economicNiche && (
        <div>
          <div className="text-xs text-low mb-0.5">经济定位</div>
          <div className="text-xs text-normal">{agent.economicNiche}</div>
        </div>
      )}
      {agent.inboxCount > 0 && (
        <div className="text-xs text-brand">{agent.inboxCount} 条待处理消息</div>
      )}
    </div>
  );
}

// ─── layout + SVG connector ───────────────────────────────────────────────────

interface Point { x: number; y: number }

function cubicPath(from: Point, to: Point): string {
  const midY = (from.y + to.y) / 2;
  return `M ${from.x} ${from.y} C ${from.x} ${midY}, ${to.x} ${midY}, ${to.x} ${to.y}`;
}

interface ConnectorProps {
  containerRef: React.RefObject<HTMLDivElement | null>;
  fromId: string;
  toId: string;
}

function Connector({ containerRef, fromId, toId }: ConnectorProps) {
  const [path, setPath] = useState('');

  useLayoutEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const from = container.querySelector(`[data-node-id="${fromId}"]`);
    const to   = container.querySelector(`[data-node-id="${toId}"]`);
    if (!from || !to) return;

    const containerRect = container.getBoundingClientRect();
    const fromRect = from.getBoundingClientRect();
    const toRect   = to.getBoundingClientRect();

    const fromPoint: Point = {
      x: fromRect.left + fromRect.width / 2 - containerRect.left,
      y: fromRect.bottom - containerRect.top,
    };
    const toPoint: Point = {
      x: toRect.left + toRect.width / 2 - containerRect.left,
      y: toRect.top - containerRect.top,
    };

    setPath(cubicPath(fromPoint, toPoint));
  });

  if (!path) return null;

  return (
    <path
      d={path}
      fill="none"
      stroke="currentColor"
      strokeWidth={1}
      strokeDasharray="none"
      className="text-neutral-600 dark:text-neutral-500"
      opacity={0.5}
    />
  );
}

// ─── main canvas ──────────────────────────────────────────────────────────────

interface OrgChartCanvasProps {
  tree: OrgNode;
  /** Optional external handler — called when an agent node is clicked */
  onAgentSelect?: (agent: AgentEntry) => void;
}

export function OrgChartCanvas({ tree, onAgentSelect }: OrgChartCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const handleSelect = useCallback((id: string, agent?: AgentEntry) => {
    setSelectedId((prev) => (prev === id ? null : id));
    if (agent) onAgentSelect?.(agent);
  }, [onAgentSelect]);

  const depts = tree.children;

  // Collect all parent→child edge pairs for SVG lines
  const edges: Array<[string, string]> = [
    ...depts.map((d) => [tree.id, d.id] as [string, string]),
    ...depts.flatMap((d) => d.children.map((a) => [d.id, a.id] as [string, string])),
  ];

  return (
    <div ref={containerRef} className="relative w-full">
      {/* SVG overlay for connectors */}
      <svg
        className="absolute inset-0 w-full h-full pointer-events-none"
        style={{ zIndex: 0 }}
      >
        {edges.map(([from, to]) => (
          <Connector
            key={`${from}-${to}`}
            containerRef={containerRef}
            fromId={from}
            toId={to}
          />
        ))}
      </svg>

      {/* Nodes layout */}
      <div className="relative flex flex-col items-center gap-8" style={{ zIndex: 1 }}>
        {/* World root */}
        <div data-node-id={tree.id}>
          <WorldNode node={tree} />
        </div>

        {/* Department row */}
        <div className="flex gap-8 flex-wrap justify-center">
          {depts.map((dept) => (
            <div key={dept.id} className="flex flex-col items-center gap-6">
              <div data-node-id={dept.id}>
                <DeptNode node={dept} />
              </div>

              {/* Agent row under each dept */}
              <div className="flex gap-3">
                {dept.children.map((agentNode) => (
                  <div key={agentNode.id} data-node-id={agentNode.id}>
                    <AgentNode
                      node={agentNode}
                      selected={selectedId === agentNode.id}
                      onSelect={handleSelect}
                    />
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
