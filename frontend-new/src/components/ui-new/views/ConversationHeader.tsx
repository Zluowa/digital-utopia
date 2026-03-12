// @input: conversation list + callbacks
// @output: 对话管理 header bar（新建 + 标题 + 时间分组历史列表）
// @position: GM/Agent 对话页共用

import { useState, type ReactNode } from 'react';
import { PlusIcon, ClockCounterClockwiseIcon, TrashIcon } from '@phosphor-icons/react';
import type { ChatConversation } from '@/stores/useChatStore';

interface Props {
  title: string;
  activeId?: string;
  list: ChatConversation[];
  onNew: () => void;
  onSwitch: (id: string) => void;
  onDelete: (id: string) => void;
  leftSlot?: ReactNode;
}

function timeAgo(ts: number): string {
  const diff = Date.now() - ts;
  const min = 60000, hour = 3600000, day = 86400000;
  if (diff < min) return '刚刚';
  if (diff < hour) return `${Math.floor(diff / min)}分钟前`;
  if (diff < day) return `${Math.floor(diff / hour)}小时前`;
  return `${Math.floor(diff / day)}天前`;
}

interface TimeGroup { label: string; items: ChatConversation[] }

function groupByTime(list: ChatConversation[]): TimeGroup[] {
  const day = 86400000, now = Date.now();
  const buckets: Record<string, ChatConversation[]> = {};
  const sorted = [...list].sort((a, b) => b.updatedAt - a.updatedAt);

  for (const c of sorted) {
    const diff = now - c.updatedAt;
    const label = diff < day ? '今天' : diff < 2 * day ? '昨天' : diff < 7 * day ? '近7天' : '更早';
    (buckets[label] ??= []).push(c);
  }
  return ['今天', '昨天', '近7天', '更早'].filter((l) => buckets[l]).map((l) => ({ label: l, items: buckets[l]! }));
}

export function ConversationHeader({ title, activeId, list, onNew, onSwitch, onDelete, leftSlot }: Props) {
  const [open, setOpen] = useState(false);

  return (
    <div className="flex items-center gap-half px-base py-half border-b border-border">
      {leftSlot}
      <button onClick={onNew} className="p-1 rounded-sm text-low hover:text-high hover:bg-secondary transition-colors" title="新对话">
        <PlusIcon className="size-icon-sm" />
      </button>
      <div className="flex-1 text-center text-sm text-high font-medium truncate">{title}</div>
      <div className="relative">
        <button
          onClick={() => setOpen(!open)}
          className={`p-1 rounded-sm transition-colors ${open ? 'bg-secondary text-high' : 'text-low hover:text-high hover:bg-secondary'}`}
          title="历史对话"
        >
          <ClockCounterClockwiseIcon className="size-icon-sm" />
        </button>
        {open && (
          <HistoryDropdown groups={groupByTime(list)} activeId={activeId} onSwitch={onSwitch} onDelete={onDelete} onClose={() => setOpen(false)} />
        )}
      </div>
    </div>
  );
}

function HistoryDropdown({ groups, activeId, onSwitch, onDelete, onClose }: {
  groups: TimeGroup[]; activeId?: string;
  onSwitch: (id: string) => void; onDelete: (id: string) => void; onClose: () => void;
}) {
  return (
    <>
      <div className="fixed inset-0 z-40" onClick={onClose} />
      <div className="absolute right-0 top-full mt-1 w-72 bg-panel border border-border rounded-sm shadow-lg z-50 max-h-96 overflow-y-auto py-1">
        {groups.length === 0 ? (
          <div className="px-base py-double text-sm text-low text-center">还没有对话记录</div>
        ) : (
          groups.map((g) => (
            <div key={g.label}>
              <div className="px-base pt-2 pb-1 text-xs text-low font-medium uppercase tracking-wide">{g.label}</div>
              {g.items.map((c) => (
                <ConversationItem key={c.id} conv={c} isActive={c.id === activeId} onSwitch={onSwitch} onDelete={onDelete} onClose={onClose} />
              ))}
            </div>
          ))
        )}
      </div>
    </>
  );
}

function ConversationItem({ conv, isActive, onSwitch, onDelete, onClose }: {
  conv: ChatConversation; isActive: boolean;
  onSwitch: (id: string) => void; onDelete: (id: string) => void; onClose: () => void;
}) {
  const count = conv.messages.length;
  return (
    <div
      className={`group flex items-center gap-2 px-base py-1.5 cursor-pointer transition-colors ${
        isActive ? 'bg-brand/8 border-l-2 border-brand' : 'border-l-2 border-transparent hover:bg-secondary'
      }`}
      onClick={() => { onSwitch(conv.id); onClose(); }}
    >
      <div className="flex-1 min-w-0">
        <div className="text-sm text-normal truncate">{conv.title}</div>
        <div className="text-xs text-low">
          {count === 0 ? '空对话' : `${count}条消息`} · {timeAgo(conv.updatedAt)}
        </div>
      </div>
      <button
        onClick={(e) => { e.stopPropagation(); onDelete(conv.id); }}
        className="p-0.5 rounded-sm opacity-0 group-hover:opacity-100 hover:bg-error/10 text-low hover:text-error transition-all shrink-0"
      >
        <TrashIcon className="size-icon-xs" />
      </button>
    </div>
  );
}
