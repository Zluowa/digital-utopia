// @input: agentId from URL params，轮询 /api/snapshot + /api/agents/:id/files
// @output: AgentDetailData — Agent 实体 + 文件列表 + 最近 timeline 事件
// @position: useWorldData 的单 Agent 细化视图，供 AgentDetailPage 使用

import { useCallback, useEffect, useState } from 'react';
import type { AgentEntry, TimelineEvent } from './useWorldData';

export interface FileEntry {
  name: string;
  type: 'file' | 'dir';
}

export interface AgentDetailData {
  agent: AgentEntry | null;
  files: FileEntry[];
  recentEvents: TimelineEvent[];
  isLoading: boolean;
  error: string | null;
  refresh: () => void;
  awaken: () => Promise<void>;
  stop: () => Promise<void>;
}

function unwrapApi<T>(payload: unknown): T | null {
  if (payload == null) return null;
  if (Array.isArray(payload) || typeof payload !== 'object') return payload as T;
  const r = payload as Record<string, unknown>;
  if ('result' in r && r.result !== undefined) return r.result as T;
  if ('data' in r && r.data !== undefined) return r.data as T;
  return payload as T;
}

export function useAgentDetail(agentId: string): AgentDetailData {
  const [agent, setAgent] = useState<AgentEntry | null>(null);
  const [files, setFiles] = useState<FileEntry[]>([]);
  const [recentEvents, setRecentEvents] = useState<TimelineEvent[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchAgent = useCallback(async () => {
    try {
      const res = await fetch('/api/snapshot');
      const data = await res.json();
      const snap = unwrapApi<{ agents: AgentEntry[] }>(data);
      const found = snap?.agents?.find((a) => a.id === agentId) ?? null;
      setAgent(found);
      setError(found ? null : '找不到该居民');
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setIsLoading(false);
    }
  }, [agentId]);

  const fetchFiles = useCallback(async () => {
    try {
      const res = await fetch(`/api/agents/${encodeURIComponent(agentId)}/files`);
      const data = await res.json();
      const list = unwrapApi<FileEntry[]>(data);
      if (Array.isArray(list)) setFiles(list);
    } catch {
      // non-critical
    }
  }, [agentId]);

  const refresh = useCallback(() => {
    void fetchAgent();
    void fetchFiles();
  }, [fetchAgent, fetchFiles]);

  useEffect(() => {
    refresh();
    const iv = setInterval(refresh, 15_000);
    return () => clearInterval(iv);
  }, [refresh]);

  // Subscribe to WS for timeline events scoped to this agent
  useEffect(() => {
    const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const ws = new WebSocket(`${proto}//${window.location.host}/ws`);
    let disposed = false;

    ws.onmessage = (e) => {
      try {
        const msg = JSON.parse(e.data);
        if (msg.type === 'snapshot') {
          const snap = unwrapApi<{ agents: AgentEntry[] }>(msg.data) ?? msg.data;
          const found = snap?.agents?.find((a: AgentEntry) => a.id === agentId);
          if (found) setAgent(found);
        }
        if (msg.type === 'event') {
          const ev = msg.data as TimelineEvent;
          if (!ev) return;
          if (ev.agentId === agentId || !ev.agentId) {
            setRecentEvents((prev) => [ev, ...prev].slice(0, 50));
          }
          if (['agent-awakened', 'agent-slept'].includes(ev.type) && ev.agentId === agentId) {
            void fetchAgent();
          }
        }
      } catch {
        // ignore
      }
    };

    ws.onclose = () => {
      if (!disposed) setTimeout(refresh, 3000);
    };

    return () => {
      disposed = true;
      ws.close();
    };
  }, [agentId, fetchAgent, refresh]);

  const awaken = useCallback(async () => {
    await fetch(`/api/agents/${encodeURIComponent(agentId)}/awaken`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reason: 'manual-detail' }),
    });
    setTimeout(refresh, 1000);
  }, [agentId, refresh]);

  const stop = useCallback(async () => {
    await fetch(`/api/agents/${encodeURIComponent(agentId)}/toggle-active`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ active: false }),
    });
    setTimeout(refresh, 1000);
  }, [agentId, refresh]);

  return { agent, files, recentEvents, isLoading, error, refresh, awaken, stop };
}
