// @input: /api/gm/inbox API endpoint
// @output: GlobalInboxData — GM 消息列表 + 已处理标记操作
// @position: Inbox 页面数据层，轮询 GM inbox

import { useCallback, useEffect, useState } from 'react';

export interface GmMessage {
  id: string;
  from: string;
  to: string;
  subject: string;
  content: string;
  priority: 'normal' | 'high' | 'urgent';
  timestamp: string;
  processed?: boolean;
}

export interface GlobalInboxData {
  messages: GmMessage[];
  isLoading: boolean;
  error: string | null;
  refresh: () => void;
  markProcessed: (id: string) => Promise<void>;
}

function unwrapApi<T>(payload: unknown): T | null {
  if (payload == null) return null;
  if (Array.isArray(payload) || typeof payload !== 'object') return payload as T;
  const r = payload as Record<string, unknown>;
  if ('result' in r && r.result !== undefined) return r.result as T;
  if ('data' in r && r.data !== undefined) return r.data as T;
  return payload as T;
}

export function useGlobalInbox(): GlobalInboxData {
  const [messages, setMessages] = useState<GmMessage[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchMessages = useCallback(async () => {
    try {
      const res = await fetch('/api/gm/inbox');
      const data = await res.json();
      const list = unwrapApi<GmMessage[]>(data);
      if (Array.isArray(list)) setMessages(list);
      setError(null);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const refresh = useCallback(() => void fetchMessages(), [fetchMessages]);

  useEffect(() => {
    void fetchMessages();
    const iv = setInterval(fetchMessages, 10_000);
    return () => clearInterval(iv);
  }, [fetchMessages]);

  const markProcessed = useCallback(async (id: string) => {
    await fetch(`/api/gm/inbox/${encodeURIComponent(id)}/processed`, { method: 'POST' });
    setMessages((prev) => prev.map((m) => m.id === id ? { ...m, processed: true } : m));
  }, []);

  return { messages, isLoading, error, refresh, markProcessed };
}
