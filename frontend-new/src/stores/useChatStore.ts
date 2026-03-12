// @input: 对话消息数据
// @output: 持久化到 localStorage 的对话列表 + CRUD
// @position: 全局状态——GM/Agent 对话存储（按世界隔离）

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { GMMessage } from '@/hooks/useGMChat';

export interface ChatConversation {
  id: string;
  title: string;
  endpoint: string;
  worldName: string;
  messages: GMMessage[];
  createdAt: number;
  updatedAt: number;
}

interface ChatState {
  conversations: ChatConversation[];
  activeIds: Record<string, string>; // endpoint → activeConversationId

  createConversation: (endpoint: string, worldName: string) => string;
  switchConversation: (endpoint: string, id: string) => void;
  deleteConversation: (id: string) => void;
  pushMessage: (id: string, msg: GMMessage) => void;
  updateMessage: (id: string, msgId: string, patch: Partial<GMMessage>) => void;
  getActiveForEndpoint: (endpoint: string, worldName?: string) => ChatConversation | undefined;
  listForEndpoint: (endpoint: string, worldName?: string) => ChatConversation[];
}

export const useChatStore = create<ChatState>()(
  persist(
    (set, get) => ({
      conversations: [],
      activeIds: {},

      createConversation: (endpoint, worldName) => {
        const id = crypto.randomUUID();
        const conv: ChatConversation = {
          id,
          title: '新对话',
          endpoint,
          worldName,
          messages: [],
          createdAt: Date.now(),
          updatedAt: Date.now(),
        };
        set((s) => ({
          conversations: [conv, ...s.conversations],
          activeIds: { ...s.activeIds, [endpoint]: id },
        }));
        return id;
      },

      switchConversation: (endpoint, id) => {
        set((s) => ({ activeIds: { ...s.activeIds, [endpoint]: id } }));
      },

      deleteConversation: (id) => {
        set((s) => {
          const next = s.conversations.filter((c) => c.id !== id);
          const activeIds = { ...s.activeIds };
          for (const [ep, aid] of Object.entries(activeIds)) {
            if (aid === id) delete activeIds[ep];
          }
          return { conversations: next, activeIds };
        });
      },

      pushMessage: (id, msg) => {
        set((s) => ({
          conversations: s.conversations.map((c) => {
            if (c.id !== id) return c;
            const title =
              c.messages.length === 0 && msg.role === 'user'
                ? msg.content.slice(0, 20) || '新对话'
                : c.title;
            return { ...c, title, messages: [...c.messages, msg], updatedAt: Date.now() };
          }),
        }));
      },

      updateMessage: (id, msgId, patch) => {
        set((s) => ({
          conversations: s.conversations.map((c) => {
            if (c.id !== id) return c;
            return {
              ...c,
              messages: c.messages.map((m) => (m.id === msgId ? { ...m, ...patch } : m)),
              updatedAt: Date.now(),
            };
          }),
        }));
      },

      getActiveForEndpoint: (endpoint, worldName) => {
        const s = get();
        const aid = s.activeIds[endpoint];
        if (!aid) return undefined;
        const conv = s.conversations.find((c) => c.id === aid);
        if (!conv) return undefined;
        if (worldName && conv.worldName && conv.worldName !== worldName) return undefined;
        return conv;
      },

      listForEndpoint: (endpoint, worldName) => {
        return get().conversations.filter(
          (c) => c.endpoint === endpoint && (!worldName || !c.worldName || c.worldName === worldName),
        );
      },
    }),
    {
      name: 'du:chat-conversations',
      partialize: (s) => ({
        conversations: s.conversations,
        activeIds: s.activeIds,
      }),
    },
  ),
);
