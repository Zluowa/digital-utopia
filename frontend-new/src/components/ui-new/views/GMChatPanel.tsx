// @input: useGMChat hook + snapshot metadata
// @output: 全屏Claude Code风格对话界面
// @position: /world 页面的唯一内容

import { useRef, useEffect, useState } from 'react';
import { PaperPlaneRightIcon, StopIcon } from '@phosphor-icons/react';
import { useGMChat } from '@/hooks/useGMChat';
import { AutoResizeTextarea } from '../primitives/AutoResizeTextarea';
import { GMChatMessage } from './GMChatMessage';
import { ConversationHeader } from './ConversationHeader';
import type { WorldSnapshot } from '@/hooks/useWorldData';

interface Props {
  snapshot: WorldSnapshot | null;
}

const EXAMPLE_PROMPTS = [
  '创建一个3人AI研究团队协作写论文',
  '5个Agent运营一家创业公司',
  '中世纪王国，国王和3个谋臣',
];

export function GMChatPanel({ snapshot }: Props) {
  const {
    messages, isStreaming, error, sendMessage, stopStreaming,
    newConversation, switchConversation, deleteConversation,
    activeConversation, conversationList,
  } = useGMChat();
  const [draft, setDraft] = useState('');
  const listRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const shouldAutoScroll = useRef(true);

  // Smart auto-scroll: only when user is near bottom (don't interrupt reading history)
  useEffect(() => {
    if (shouldAutoScroll.current) {
      listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: 'smooth' });
    }
  }, [messages]);

  // Reset draft + scroll on conversation switch
  useEffect(() => {
    setDraft('');
    shouldAutoScroll.current = true;
    inputRef.current?.focus();
  }, [activeConversation?.id]);

  const handleSend = () => {
    if (!draft.trim() || isStreaming) return;
    sendMessage(draft.trim());
    setDraft('');
    inputRef.current?.focus();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); }
  };

  const isEmpty = messages.length === 0;

  return (
    <div className="flex flex-col h-full">
      {/* Conversation header */}
      <ConversationHeader
        title={activeConversation?.title ?? '新对话'}
        activeId={activeConversation?.id}
        list={conversationList}
        onNew={newConversation}
        onSwitch={switchConversation}
        onDelete={deleteConversation}
      />

      {/* Messages area */}
      <div ref={listRef} className="flex-1 overflow-y-auto" onScroll={() => {
        const el = listRef.current;
        if (el) shouldAutoScroll.current = el.scrollHeight - el.scrollTop - el.clientHeight < 100;
      }}>
        <div className="max-w-[720px] mx-auto px-base py-base">
          {isEmpty ? (
            <EmptyState snapshot={snapshot} onSelect={setDraft} />
          ) : (
            <div className="space-y-base pt-double">
              {messages.map((msg) => (
                <GMChatMessage key={msg.id} message={msg} />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Error bar */}
      {error && (
        <div className="max-w-[720px] mx-auto w-full px-base">
          <div className="py-half bg-error/10 text-error text-xs rounded-sm px-base mb-1">
            {error}
          </div>
        </div>
      )}

      {/* Input area — anchored bottom */}
      <div className="border-t border-border py-base">
        <div className="max-w-[720px] mx-auto px-base">
          <div className="flex gap-half items-end rounded-sm border border-border bg-panel p-half">
            <AutoResizeTextarea
              ref={inputRef}
              value={draft}
              onChange={setDraft}
              onKeyDown={handleKeyDown}
              preventNewlines={false}
              placeholder="Tell the mastermind what you want..."
              rows={1}
              disabled={isStreaming}
              className="flex-1 px-half py-half text-sm text-normal placeholder:text-low min-h-[36px] max-h-[200px]"
            />
            {isStreaming ? (
              <button
                onClick={stopStreaming}
                className="h-cta w-cta shrink-0 rounded-sm flex items-center justify-center bg-error/10 text-error hover:bg-error/20 transition-colors"
                title="Stop"
              >
                <StopIcon className="size-icon-sm" weight="fill" />
              </button>
            ) : (
              <button
                onClick={handleSend}
                disabled={!draft.trim()}
                className="h-cta w-cta shrink-0 rounded-sm flex items-center justify-center bg-brand text-on-brand hover:bg-brand-hover disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                title="Send"
              >
                <PaperPlaneRightIcon className="size-icon-xs" weight="bold" />
              </button>
            )}
          </div>
          {snapshot && (
            <div className="flex items-center gap-2 mt-1 text-xs text-low">
              <div className="w-2 h-2 rounded-full bg-success animate-pulse" />
              <span>{snapshot.worldName} · {snapshot.aliveAgents} alive</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function EmptyState({ snapshot, onSelect }: { snapshot: WorldSnapshot | null; onSelect: (p: string) => void }) {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] gap-6">
      <div className="text-center">
        <div className="text-xl font-medium text-high mb-2">
          {snapshot ? snapshot.worldName : '你的世界还没有开始'}
        </div>
        <div className="text-sm text-low max-w-xs">
          {snapshot
            ? `${snapshot.aliveAgents} alive · ${snapshot.totalAgents} total`
            : 'Tell the mastermind what you want to build.'}
        </div>
      </div>
      <div className="flex flex-col gap-2 w-full max-w-sm">
        {EXAMPLE_PROMPTS.map((prompt) => (
          <button
            key={prompt}
            onClick={() => onSelect(prompt)}
            className="text-left text-sm text-normal px-base py-half rounded-sm border border-border bg-panel hover:bg-secondary hover:border-brand/50 transition-colors"
          >
            {prompt}
          </button>
        ))}
      </div>
    </div>
  );
}
