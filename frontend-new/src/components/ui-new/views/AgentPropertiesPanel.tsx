// @input: AgentPanelContext — selectedAgent + panelOpen + closePanel
// @output: Right-side slide-in panel showing agent status, token balance, goal, etc.
// @position: World layout overlay — rendered in SharedAppLayout content column

import { XIcon } from '@phosphor-icons/react';
import { useAgentPanel } from '@/contexts/AgentPanelContext';
import { cn } from '@/lib/utils';

const STATUS_COLORS: Record<string, string> = {
  alive: 'text-emerald-400',
  awakening: 'text-amber-400',
  sleeping: 'text-low',
  dead: 'text-error',
};

const STATUS_LABELS: Record<string, string> = {
  alive: '在线',
  awakening: '唤醒中',
  sleeping: '休眠',
  dead: '离线',
};

function PropertyRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-xs text-low uppercase tracking-wide">{label}</span>
      <span className="text-sm text-normal">{value}</span>
    </div>
  );
}

export function AgentPropertiesPanel() {
  const { selectedAgent, panelOpen, closePanel } = useAgentPanel();

  return (
    <aside
      className={cn(
        'shrink-0 border-l border-border bg-secondary flex-col overflow-hidden',
        'transition-[width,opacity] duration-200 ease-in-out',
        'hidden md:flex',
        panelOpen ? 'w-72 opacity-100' : 'w-0 opacity-0'
      )}
    >
      {selectedAgent && (
        <div className="w-72 flex flex-col h-full">
          {/* Header */}
          <div className="flex items-center justify-between px-base py-2.5 border-b border-border shrink-0">
            <div className="flex items-center gap-2 min-w-0">
              <span
                className={cn(
                  'text-sm font-medium',
                  STATUS_COLORS[selectedAgent.status] ?? 'text-normal'
                )}
              >
                {STATUS_LABELS[selectedAgent.status] ?? selectedAgent.status}
              </span>
              <span className="text-xs text-low truncate">{selectedAgent.type}</span>
            </div>
            <button
              type="button"
              onClick={closePanel}
              aria-label="关闭属性面板"
              className="p-1 rounded text-low hover:text-normal hover:bg-panel transition-colors"
            >
              <XIcon className="size-3.5" />
            </button>
          </div>

          {/* Identity */}
          <div className="px-base pt-base pb-half shrink-0">
            <h2 className="text-base font-medium text-high truncate">
              {selectedAgent.identity ?? selectedAgent.id}
            </h2>
            <p className="text-xs text-low font-mono mt-0.5 truncate">{selectedAgent.id}</p>
          </div>

          {/* Properties */}
          <div className="px-base py-base flex flex-col gap-base overflow-auto flex-1">
            <PropertyRow
              label="Token 余额"
              value={selectedAgent.tokenBalance.toLocaleString()}
            />
            <PropertyRow
              label="收件箱"
              value={`${selectedAgent.inboxCount} 条消息`}
            />
            {selectedAgent.currentGoal && (
              <PropertyRow label="当前目标" value={selectedAgent.currentGoal} />
            )}
            {selectedAgent.economicNiche && (
              <PropertyRow label="经济位置" value={selectedAgent.economicNiche} />
            )}
            <PropertyRow
              label="最近唤醒"
              value={selectedAgent.lastAwakened
                ? new Date(selectedAgent.lastAwakened).toLocaleString('zh-CN')
                : '—'
              }
            />
          </div>
        </div>
      )}
    </aside>
  );
}
