// @input: useOrgChart hook providing tree + world metadata
// @output: /world/org route page with org chart visualization
// @position: page at /world/org — org chart view for AI civilization

import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useOrgChart } from '@/hooks/useOrgChart';
import { OrgChartCanvas } from '@/components/ui-new/views/OrgChartCanvas';
import { useAgentPanel } from '@/contexts/AgentPanelContext';
import { useBreadcrumbs } from '@/contexts/BreadcrumbContext';
import type { AgentEntry } from '@/hooks/useWorldData';

export function OrgChartPage() {
  const { tree, snapshot, isLoading, error } = useOrgChart();
  const { openPanel } = useAgentPanel();
  const { setBreadcrumbs } = useBreadcrumbs();

  useEffect(() => {
    setBreadcrumbs([
      { label: 'Home', href: '/worlds' },
      { label: '世界', href: '/world' },
      { label: '组织架构' },
    ]);
    return () => setBreadcrumbs([]);
  }, [setBreadcrumbs]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full text-low">
        正在连接世界引擎...
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-2 text-low">
        <div className="text-error">引擎离线</div>
        <div className="text-sm">{error}</div>
      </div>
    );
  }

  const aliveCount = snapshot?.agents.filter(
    (a) => a.status === 'alive' || a.status === 'awakening'
  ).length ?? 0;

  function handleAgentSelect(agent: AgentEntry) {
    openPanel(agent);
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-double pt-double pb-base shrink-0">
        <div className="flex items-baseline gap-base mb-base">
          <h1 className="text-xl font-medium text-high">组织架构</h1>
          <span className="text-sm text-low">
            {aliveCount} 在线 · {snapshot?.totalAgents ?? 0} 总计
            {snapshot?.worldName && ` · ${snapshot.worldName}`}
          </span>
        </div>
        <div className="flex items-center gap-base">
          <Link
            to="/world/dashboard"
            className="text-sm text-low hover:text-normal transition-colors"
          >
            ← 仪表盘
          </Link>
          <Link
            to="/world/residents"
            className="px-base py-1 bg-secondary text-low rounded-md text-sm hover:text-normal hover:bg-secondary/80 transition-colors border"
          >
            居民看板
          </Link>
        </div>
      </div>

      {/* Chart */}
      <div className="flex-1 overflow-auto px-double pb-double">
        <OrgChartCanvas tree={tree} onAgentSelect={handleAgentSelect} />
      </div>
    </div>
  );
}
