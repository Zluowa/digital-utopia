// @input: useGlobalInbox hook (GM 消息) + useWorldData (agents) + useDismissed
// @output: /world/inbox 全局消息收件箱页面
// @position: Container 页面 — 数据汇聚层，将处理后的数据传给 GlobalInboxView

import { useState } from 'react';
import { useGlobalInbox } from '@/hooks/useGlobalInbox';
import { useWorldData } from '@/hooks/useWorldData';
import { useDismissed } from '@/hooks/useDismissed';
import { GlobalInboxView, type InboxTab } from '@/components/ui-new/views/GlobalInboxView';

const STALE_THRESHOLD_MS = 24 * 60 * 60 * 1000;

export function GlobalInboxPage() {
  const [tab, setTab] = useState<InboxTab>('pending');
  const { messages, isLoading, error, refresh, markProcessed } = useGlobalInbox();
  const { snapshot } = useWorldData();
  const { dismissed, dismiss } = useDismissed('du:inbox:dismissed');

  const agents = snapshot?.agents ?? [];
  const now = Date.now();

  const pendingGm = messages.filter(
    (m) => !m.processed && !dismissed.has(`gm:${m.id}`),
  );
  const agentsWithInbox = agents.filter(
    (a) => a.inboxCount > 0 && !dismissed.has(`agent-inbox:${a.id}`),
  );
  const staleAgents = agents.filter(
    (a) =>
      a.status === 'sleeping' &&
      now - new Date(a.lastAwakened).getTime() > STALE_THRESHOLD_MS &&
      !dismissed.has(`stale:${a.id}`),
  );

  const pendingCount = pendingGm.length + agentsWithInbox.length + staleAgents.length;

  return (
    <GlobalInboxView
      tab={tab}
      onTabChange={setTab}
      pendingCount={pendingCount}
      gmMessages={messages}
      agents={agents}
      dismissed={dismissed}
      isLoading={isLoading}
      error={error}
      onMarkProcessed={(id) => void markProcessed(id)}
      onDismiss={dismiss}
      onRefresh={refresh}
    />
  );
}
