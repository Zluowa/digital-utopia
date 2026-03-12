import { useCallback, useEffect, useRef, useState } from 'react';
import { closeSocketSafely } from '@/lib/realtime/wsLifecycle';

export interface AgentEntry {
  id: string;
  type: string;
  status: 'alive' | 'dead' | 'awakening' | 'sleeping';
  tokenBalance: number;
  lastAwakened: string;
  inboxCount: number;
  identity?: string;
  currentGoal?: string;
  economicNiche?: string;
}

interface EconomySummary {
  treasuryBalance: number;
  circulation: number;
  transactionCount: number;
  distribution: { id: string; balance: number; pct: number }[];
}

export interface WorldSnapshot {
  worldId: string;
  worldName: string;
  worldTheme?: string;
  timestamp: string;
  totalAgents: number;
  aliveAgents: number;
  totalTokens: number;
  agents: AgentEntry[];
  economySummary?: EconomySummary;
}

export interface TimelineEvent {
  id: string;
  type: string;
  message: string;
  timestamp: string;
  agentId?: string;
}

export interface Transaction {
  id: string;
  from: string;
  to: string;
  amount: number;
  reason: string;
  timestamp: string;
  type: string;
}

function unwrapApi<T>(payload: unknown): T | null {
  if (payload == null) return null;
  if (Array.isArray(payload) || typeof payload !== 'object') return payload as T;
  const record = payload as Record<string, unknown>;
  if ('result' in record && record.result !== undefined) return record.result as T;
  if ('data' in record && record.data !== undefined) return record.data as T;
  return payload as T;
}

export interface WorldData {
  snapshot: WorldSnapshot | null;
  timeline: TimelineEvent[];
  transactions: Transaction[];
  isLoading: boolean;
  error: string | null;
  refresh: () => void;
  awakenAll: () => Promise<void>;
  awakenAgent: (id: string) => Promise<void>;
  stopAgent: (id: string) => Promise<void>;
}

export function useWorldData(): WorldData {
  const [snapshot, setSnapshot] = useState<WorldSnapshot | null>(null);
  const [timeline, setTimeline] = useState<TimelineEvent[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const wsRef = useRef<WebSocket | null>(null);

  const fetchSnapshot = useCallback(async () => {
    try {
      const res = await fetch('/api/snapshot');
      const data = await res.json();
      const snap = unwrapApi<WorldSnapshot>(data);
      if (snap) setSnapshot(snap);
      setError(null);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const fetchTransactions = useCallback(async () => {
    try {
      const res = await fetch('/api/economy/transactions?limit=20');
      const data = await res.json();
      const tx = unwrapApi<Transaction[]>(data);
      if (Array.isArray(tx)) setTransactions(tx);
    } catch (error) {
      void error;
    }
  }, []);

  const refresh = useCallback(() => {
    void fetchSnapshot();
    void fetchTransactions();
  }, [fetchSnapshot, fetchTransactions]);

  // Initial fetch + polling
  useEffect(() => {
    void fetchSnapshot();
    void fetchTransactions();
    const iv = setInterval(refresh, 15_000);
    return () => clearInterval(iv);
  }, [fetchSnapshot, fetchTransactions, refresh]);

  // WebSocket for real-time events with auto-reconnect
  useEffect(() => {
    const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${proto}//${window.location.host}/ws`;
    let disposed = false;
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;

    const connect = () => {
      if (disposed) return;
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onmessage = (e) => {
        try {
          const msg = JSON.parse(e.data);
          if (msg.type === 'snapshot') {
            const snap = unwrapApi<WorldSnapshot>(msg.data) ?? msg.data;
            if (snap) setSnapshot(snap);
          }
          if (msg.type === 'timeline') {
            const events = unwrapApi<TimelineEvent[]>(msg.data) ?? msg.data;
            if (Array.isArray(events)) setTimeline(events);
          }
          if (msg.type === 'event') {
            const event = msg.data as TimelineEvent | undefined;
            if (!event) return;
            setTimeline(prev => [...prev.slice(-199), event]);

            if (
              ['agent-awakened', 'agent-slept', 'economy-credit', 'world-started', 'world-stopped'].includes(
                event.type
              )
            ) {
              void fetchSnapshot();
            }
            if (event.type === 'economy-credit') {
              void fetchTransactions();
            }
          }
        } catch (error) {
          void error;
        }
      };

      ws.onclose = () => {
        if (wsRef.current === ws) wsRef.current = null;
        if (disposed) return;
        reconnectTimer = setTimeout(() => {
          void refresh();
          connect();
        }, 3000);
      };
    };

    connect();

    return () => {
      disposed = true;
      if (reconnectTimer) clearTimeout(reconnectTimer);
      const current = wsRef.current;
      wsRef.current = null;
      if (current) closeSocketSafely(current);
    };
  }, [fetchSnapshot, fetchTransactions, refresh]);

  const awakenAll = useCallback(async () => {
    await fetch('/api/world/awaken-all', { method: 'POST' });
    setTimeout(refresh, 1000);
  }, [refresh]);

  const awakenAgent = useCallback(async (id: string) => {
    await fetch(`/api/agents/${id}/awaken`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reason: 'manual-dashboard' }),
    });
    setTimeout(refresh, 1000);
  }, [refresh]);

  const stopAgent = useCallback(async (id: string) => {
    await fetch(`/api/agents/${id}/toggle-active`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ active: false }),
    });
    setTimeout(refresh, 1000);
  }, [refresh]);

  return { snapshot, timeline, transactions, isLoading, error, refresh, awakenAll, awakenAgent, stopAgent };
}
