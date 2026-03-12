// @input: Engine SSE chat endpoint (GM or Agent)
// @output: 消息列表 + 流状态 + sendMessage() + 对话管理
// @position: 所有Agent对话的通用数据层（按世界隔离）

import { useState, useCallback, useRef } from 'react';
import { useChatStore, type ChatConversation } from '@/stores/useChatStore';
import { useActiveWorld } from '@/contexts/ActiveWorldContext';

export interface GMMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
  actions?: ActionEvent[];
}

export interface ActionEvent {
  action: string;
  params: Record<string, unknown>;
  result?: { success: boolean; summary: string };
}

export interface UseAgentChatReturn {
  messages: GMMessage[];
  isStreaming: boolean;
  error: string | null;
  sendMessage: (text: string) => void;
  stopStreaming: () => void;
  newConversation: () => void;
  switchConversation: (id: string) => void;
  deleteConversation: (id: string) => void;
  activeConversation: ChatConversation | undefined;
  conversationList: ChatConversation[];
}

const MAX_HISTORY = 20;

/** GM Chat (mastermind) */
export function useGMChat(): UseAgentChatReturn {
  return useAgentChat('/api/gm/chat');
}

/** Any agent chat by endpoint — automatically scoped to current world */
export function useAgentChat(endpoint: string): UseAgentChatReturn {
  const { worldName } = useActiveWorld();

  const conversations = useChatStore((s) => s.conversations);
  const activeIds = useChatStore((s) => s.activeIds);
  const storePush = useChatStore((s) => s.pushMessage);
  const storeUpdate = useChatStore((s) => s.updateMessage);
  const storeCreate = useChatStore((s) => s.createConversation);
  const storeSwitch = useChatStore((s) => s.switchConversation);
  const storeDelete = useChatStore((s) => s.deleteConversation);

  // World-scoped conversation resolution
  const rawConvId = activeIds[endpoint] ?? null;
  const rawConv = rawConvId ? conversations.find((c) => c.id === rawConvId) : undefined;
  const convId = rawConv && (!worldName || !rawConv.worldName || rawConv.worldName === worldName) ? rawConvId : null;
  const activeConversation = convId ? rawConv : undefined;
  const messages = activeConversation?.messages ?? [];
  const conversationList = conversations.filter(
    (c) => c.endpoint === endpoint && (!worldName || !c.worldName || c.worldName === worldName),
  );

  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const streamConvRef = useRef<string | null>(null);

  const sendMessage = useCallback(
    (text: string) => {
      if (!text.trim() || isStreaming) return;

      let id = convId;
      if (!id) id = storeCreate(endpoint, worldName);
      streamConvRef.current = id;

      storePush(id, { id: crypto.randomUUID(), role: 'user', content: text, timestamp: Date.now() });
      setIsStreaming(true);
      setError(null);

      const conv = useChatStore.getState().conversations.find((c) => c.id === id);
      const history = (conv?.messages ?? []).slice(-MAX_HISTORY).map((m) => ({ role: m.role, content: m.content }));

      const assistantId = crypto.randomUUID();
      let content = '';
      const actions: ActionEvent[] = [];
      storePush(id, { id: assistantId, role: 'assistant', content: '...', timestamp: Date.now() });

      const ctrl = new AbortController();
      abortRef.current = ctrl;

      fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: text, history }),
        signal: ctrl.signal,
      })
        .then(async (res) => {
          if (!res.ok) throw new Error(`Engine error: ${res.status}`);
          const reader = res.body?.getReader();
          if (!reader) throw new Error('No response stream');
          const decoder = new TextDecoder();
          let buffer = '';
          const cid = streamConvRef.current!;
          const update = () =>
            storeUpdate(cid, assistantId, { content: content || '...', actions: [...actions] });

          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split('\n');
            buffer = lines.pop() ?? '';

            for (const line of lines) {
              const trimmed = line.trim();
              if (!trimmed.startsWith('data:')) continue;
              const json = trimmed.slice(trimmed.indexOf('{'));
              if (!json) continue;
              try {
                const ev = JSON.parse(json) as {
                  type: string; content?: string; action?: string;
                  params?: Record<string, unknown>; success?: boolean;
                  summary?: string; message?: string;
                };
                if (ev.type === 'done') break;
                if (ev.type === 'error') { setError(ev.message ?? 'Unknown error'); break; }
                if (ev.type === 'text') { content = ev.content ?? ''; update(); }
                else if (ev.type === 'action') {
                  actions.push({ action: ev.action ?? 'unknown', params: ev.params ?? {} });
                  update();
                } else if (ev.type === 'action_result') {
                  const last = actions[actions.length - 1];
                  if (last) last.result = { success: ev.success ?? true, summary: ev.summary ?? '' };
                  update();
                }
              } catch { /* skip bad JSON */ }
            }
          }
        })
        .catch((err) => {
          if (err.name !== 'AbortError') setError(err.message);
        })
        .finally(() => {
          setIsStreaming(false);
          abortRef.current = null;
        });
    },
    [isStreaming, convId, endpoint, worldName, storeCreate, storePush, storeUpdate],
  );

  const stopStreaming = useCallback(() => {
    abortRef.current?.abort();
    setIsStreaming(false);
  }, []);

  const newConversation = useCallback(() => {
    const active = useChatStore.getState().getActiveForEndpoint(endpoint, worldName);
    if (active && active.messages.length === 0) return;
    abortRef.current?.abort();
    setIsStreaming(false);
    setError(null);
    storeCreate(endpoint, worldName);
  }, [storeCreate, endpoint, worldName]);

  const handleSwitch = useCallback(
    (id: string) => {
      if (isStreaming) return;
      if (convId && convId !== id) {
        const cur = useChatStore.getState().conversations.find((c) => c.id === convId);
        if (cur && cur.messages.length === 0) storeDelete(convId);
      }
      storeSwitch(endpoint, id);
    },
    [isStreaming, convId, storeSwitch, storeDelete, endpoint],
  );

  const handleDelete = useCallback(
    (id: string) => { if (!isStreaming) storeDelete(id); },
    [isStreaming, storeDelete],
  );

  return {
    messages, isStreaming, error, sendMessage, stopStreaming,
    newConversation, switchConversation: handleSwitch, deleteConversation: handleDelete,
    activeConversation, conversationList,
  };
}
