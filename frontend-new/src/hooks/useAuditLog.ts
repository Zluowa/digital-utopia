// @input: /api/economy/transactions + /api/snapshot (logs array)
// @output: unified AuditEntry list, filters, search state
// @position: data layer for AuditLogPage — merges two sources into one timeline

import { useCallback, useEffect, useMemo, useState } from 'react';

export type AuditEntryKind = 'awaken' | 'message' | 'transfer' | 'file' | 'error' | 'system';

export interface AuditEntry {
  id: string;
  kind: AuditEntryKind;
  agentId: string;
  description: string;
  timestamp: string;
  meta?: Record<string, unknown>;
}

export interface AuditFilters {
  agentId: string;
  kind: AuditEntryKind | '';
  search: string;
}

const DEFAULT_FILTERS: AuditFilters = { agentId: '', kind: '', search: '' };

// Classify a timeline/log event type into AuditEntryKind
function classifyKind(type: string): AuditEntryKind {
  if (type.includes('awaken') || type.includes('slept') || type.includes('created')) return 'awaken';
  if (type.includes('message') || type.includes('inbox') || type.includes('chat')) return 'message';
  if (type.includes('economy') || type.includes('transfer') || type.includes('credit')) return 'transfer';
  if (type.includes('file')) return 'file';
  if (type.includes('error') || type.includes('fail')) return 'error';
  return 'system';
}

interface RawTransaction {
  id: string;
  from: string;
  to: string;
  amount: number;
  reason: string;
  timestamp: string;
  type: string;
}

interface RawLogEntry {
  id?: string;
  type: string;
  message: string;
  timestamp: string;
  agentId?: string;
}

interface RawSnapshot {
  agents?: { id: string; logs?: RawLogEntry[] }[];
  logs?: RawLogEntry[];
}

function txToEntry(tx: RawTransaction): AuditEntry {
  return {
    id: `tx-${tx.id}`,
    kind: 'transfer',
    agentId: tx.from,
    description: `${tx.from} → ${tx.to}  ${tx.amount}T  ${tx.reason}`,
    timestamp: tx.timestamp,
    meta: { amount: tx.amount, to: tx.to, reason: tx.reason },
  };
}

function logToEntry(log: RawLogEntry, agentId: string): AuditEntry {
  return {
    id: log.id ?? `log-${agentId}-${log.timestamp}`,
    kind: classifyKind(log.type),
    agentId,
    description: log.message,
    timestamp: log.timestamp,
  };
}

function unwrap<T>(payload: unknown): T | null {
  if (payload == null) return null;
  if (Array.isArray(payload) || typeof payload !== 'object') return payload as T;
  const r = payload as Record<string, unknown>;
  if ('result' in r && r.result !== undefined) return r.result as T;
  if ('data' in r && r.data !== undefined) return r.data as T;
  return payload as T;
}

export function useAuditLog() {
  const [entries, setEntries] = useState<AuditEntry[]>([]);
  const [agentIds, setAgentIds] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFilters] = useState<AuditFilters>(DEFAULT_FILTERS);

  const fetchAll = useCallback(async () => {
    setIsLoading(true);
    try {
      const [txRes, snapRes] = await Promise.all([
        fetch('/api/economy/transactions?limit=50'),
        fetch('/api/snapshot'),
      ]);

      const txData = unwrap<RawTransaction[]>(await txRes.json()) ?? [];
      const snapData = unwrap<RawSnapshot>(await snapRes.json());

      const txEntries = Array.isArray(txData) ? txData.map(txToEntry) : [];

      const logEntries: AuditEntry[] = [];
      const agents = snapData?.agents ?? [];

      for (const agent of agents) {
        for (const log of agent.logs ?? []) {
          logEntries.push(logToEntry(log, agent.id));
        }
      }
      for (const log of snapData?.logs ?? []) {
        logEntries.push(logToEntry(log, log.agentId ?? 'system'));
      }

      const merged = [...txEntries, ...logEntries].sort(
        (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
      );

      setEntries(merged);
      setAgentIds([...new Set(merged.map((e) => e.agentId).filter(Boolean))].sort());
      setError(null);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchAll();
  }, [fetchAll]);

  const filtered = useMemo(() => {
    const { agentId, kind, search } = filters;
    const q = search.toLowerCase();
    return entries.filter((e) => {
      if (agentId && e.agentId !== agentId) return false;
      if (kind && e.kind !== kind) return false;
      if (q && !e.description.toLowerCase().includes(q) && !e.agentId.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [entries, filters]);

  return { entries: filtered, agentIds, isLoading, error, filters, setFilters, refresh: fetchAll };
}
