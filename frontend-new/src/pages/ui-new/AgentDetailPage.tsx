// @input: :agentId from URL params → useAgentDetail hook
// @output: /world/agents/:agentId 页面 container
// @position: Container 层，唯一持有 useAgentDetail 状态，向 AgentDetailView 注入数据

import { useParams, Link } from 'react-router-dom';
import { useAgentDetail } from '@/hooks/useAgentDetail';
import { AgentDetailView } from '@/components/ui-new/views/AgentDetailView';

export function AgentDetailPage() {
  const { agentId } = useParams<{ agentId: string }>();

  if (!agentId) {
    return (
      <div className="flex items-center justify-center h-full text-low">
        缺少居民 ID
      </div>
    );
  }

  return <AgentDetailInner agentId={agentId} />;
}

function AgentDetailInner({ agentId }: { agentId: string }) {
  const { agent, files, recentEvents, isLoading, error, awaken, stop } = useAgentDetail(agentId);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full text-low">
        正在加载居民数据...
      </div>
    );
  }

  if (error || !agent) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-2">
        <div className="text-error">{error ?? '找不到该居民'}</div>
        <Link to="/world" className="text-sm text-low hover:text-normal">
          返回世界总览
        </Link>
      </div>
    );
  }

  return (
    <div className="h-full overflow-auto p-base">
      {/* Breadcrumb */}
      <div className="flex items-center gap-1 text-xs text-low mb-base">
        <Link to="/world" className="hover:text-normal">世界总览</Link>
        <span>/</span>
        <Link to="/world/residents" className="hover:text-normal">居民</Link>
        <span>/</span>
        <span className="text-normal">{agent.identity ?? agentId}</span>
      </div>

      <AgentDetailView
        agent={agent}
        files={files}
        recentEvents={recentEvents}
        onAwaken={() => void awaken()}
        onStop={() => void stop()}
      />
    </div>
  );
}
