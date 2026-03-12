// @input: /api/economy/bounties + /api/gm/inbox endpoints
// @output: approval items grouped by column + approve/reject actions
// @position: Data layer for ApprovalsPage, polls engine at 10s interval

import { useCallback, useEffect, useState } from 'react';

export type BountyStatus = 'open' | 'claimed' | 'verified' | 'paid' | 'expired';

export interface Bounty {
  id: string;
  agentId: string;
  requestType: string;
  description: string;
  amount: number;
  createdAt: string;
  status: BountyStatus;
  deliverable?: string;
}

export interface InboxItem {
  id: string;
  from: string;
  subject: string;
  body: string;
  requestedAt: string;
  processed: boolean;
}

export interface ApprovalItem {
  id: string;
  source: 'bounty' | 'inbox';
  agentName: string;
  requestType: string;
  description: string;
  amount: number;
  timestamp: string;
  deliverable?: string;
  status: 'pending' | 'in_review' | 'resolved';
  rawStatus: string;
}

export interface ApprovalsData {
  columns: Record<'pending' | 'in_review' | 'resolved', ApprovalItem[]>;
  isLoading: boolean;
  error: string | null;
  approve: (item: ApprovalItem) => Promise<void>;
  reject: (item: ApprovalItem) => Promise<void>;
  refresh: () => void;
}

const BOUNTY_COLUMN: Record<BountyStatus, ApprovalItem['status']> = {
  open: 'pending',
  claimed: 'in_review',
  verified: 'in_review',
  paid: 'resolved',
  expired: 'resolved',
};

function bountyToItem(b: Bounty): ApprovalItem {
  return {
    id: `bounty:${b.id}`,
    source: 'bounty',
    agentName: b.agentId,
    requestType: b.requestType,
    description: b.description,
    amount: b.amount,
    timestamp: b.createdAt,
    deliverable: b.deliverable,
    status: BOUNTY_COLUMN[b.status] ?? 'pending',
    rawStatus: b.status,
  };
}

function inboxToItem(item: InboxItem): ApprovalItem {
  return {
    id: `inbox:${item.id}`,
    source: 'inbox',
    agentName: item.from,
    requestType: item.subject,
    description: item.body,
    amount: 0,
    timestamp: item.requestedAt,
    status: item.processed ? 'resolved' : 'pending',
    rawStatus: item.processed ? 'processed' : 'pending',
  };
}

function groupByColumn(items: ApprovalItem[]) {
  const columns: Record<ApprovalItem['status'], ApprovalItem[]> = {
    pending: [],
    in_review: [],
    resolved: [],
  };
  for (const item of items) {
    columns[item.status].push(item);
  }
  return columns;
}

async function fetchJson<T>(url: string): Promise<T | null> {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const data = await res.json();
    if (Array.isArray(data)) return data as T;
    if (data?.result !== undefined) return data.result as T;
    if (data?.data !== undefined) return data.data as T;
    return data as T;
  } catch {
    return null;
  }
}

export function useApprovals(): ApprovalsData {
  const [items, setItems] = useState<ApprovalItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const [bounties, inbox] = await Promise.all([
        fetchJson<Bounty[]>('/api/economy/bounties'),
        fetchJson<InboxItem[]>('/api/gm/inbox'),
      ]);

      const bountyItems = (bounties ?? []).map(bountyToItem);
      const inboxItems = (inbox ?? []).map(inboxToItem);

      setItems([...bountyItems, ...inboxItems]);
      setError(null);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
    const iv = setInterval(() => void load(), 10_000);
    return () => clearInterval(iv);
  }, [load]);

  const approve = useCallback(async (item: ApprovalItem) => {
    const rawId = item.id.split(':')[1];
    if (item.source === 'bounty') {
      await fetch(`/api/economy/bounties/${rawId}/pay`, { method: 'POST' });
    } else {
      await fetch(`/api/gm/inbox/${rawId}/processed`, { method: 'POST' });
    }
    await load();
  }, [load]);

  const reject = useCallback(async (item: ApprovalItem) => {
    if (item.source === 'inbox') {
      const rawId = item.id.split(':')[1];
      await fetch(`/api/gm/inbox/${rawId}/processed`, { method: 'POST' });
      await load();
    }
  }, [load]);

  return {
    columns: groupByColumn(items),
    isLoading,
    error,
    approve,
    reject,
    refresh: () => void load(),
  };
}
