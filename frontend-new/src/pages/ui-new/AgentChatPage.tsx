// @input: agentId from route params
// @output: 全屏Agent对话界面（复用GMChatMessage样式）
// @position: 居民个人对话页面

import { useRef, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeftIcon, PaperPlaneRightIcon, StopIcon } from '@phosphor-icons/react';
import { ConversationHeader } from '@/components/ui-new/views/ConversationHeader';
import { useAgentChat } from '@/hooks/useGMChat';
import { GMChatMessage } from '@/components/ui-new/views/GMChatMessage';
import { AutoResizeTextarea } from '@/components/ui-new/primitives/AutoResizeTextarea';

interface Props {
  agentId: string;
}

export function AgentChatPage({ agentId }: Props) {
  const chat = useAgentChat(`/api/agents/${agentId}/chat`);
  const [draft, setDraft] = useState('');
  const listRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const shouldAutoScroll = useRef(true);
  const navigate = useNavigate();

  useEffect(() => {
    if (shouldAutoScroll.current) {
      listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: 'smooth' });
    }
  }, [chat.messages]);

  useEffect(() => {
    setDraft('');
    shouldAutoScroll.current = true;
    inputRef.current?.focus();
  }, [chat.activeConversation?.id]);

  const handleSend = () => {
    if (!draft.trim() || chat.isStreaming) return;
    chat.sendMessage(draft.trim());
    setDraft('');
    inputRef.current?.focus();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); }
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <ConversationHeader
        title={chat.activeConversation?.title ?? agentId}
        activeId={chat.activeConversation?.id}
        list={chat.conversationList}
        onNew={chat.newConversation}
        onSwitch={chat.switchConversation}
        onDelete={chat.deleteConversation}
        leftSlot={
          <button
            onClick={() => navigate('/world/residents')}
            className="p-1 rounded-sm hover:bg-secondary transition-colors"
          >
            <ArrowLeftIcon className="size-icon-sm" />
          </button>
        }
      />

      {/* Messages */}
      <div ref={listRef} className="flex-1 overflow-y-auto" onScroll={() => {
        const el = listRef.current;
        if (el) shouldAutoScroll.current = el.scrollHeight - el.scrollTop - el.clientHeight < 100;
      }}>
        <div className="max-w-[700px] mx-auto px-base py-base">
          {chat.messages.length === 0 ? (
            <div className="flex items-center justify-center min-h-[50vh] text-low text-sm">
              Start a conversation with {agentId}
            </div>
          ) : (
            <div className="space-y-base pt-double">
              {chat.messages.map((msg) => (
                <GMChatMessage key={msg.id} message={msg} />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Error */}
      {chat.error && (
        <div className="max-w-[700px] mx-auto w-full px-base">
          <div className="py-half bg-error/10 text-error text-xs rounded-sm px-base mb-1">
            {chat.error}
          </div>
        </div>
      )}

      {/* Input */}
      <div className="border-t border-border py-base">
        <div className="max-w-[700px] mx-auto px-base">
          <div className="flex gap-half items-end rounded-sm border border-border bg-panel p-half">
            <AutoResizeTextarea
              ref={inputRef}
              value={draft}
              onChange={setDraft}
              onKeyDown={handleKeyDown}
              preventNewlines={false}
              placeholder={`Talk to ${agentId}...`}
              rows={1}
              disabled={chat.isStreaming}
              className="flex-1 px-half py-half text-sm text-normal placeholder:text-low min-h-[36px] max-h-[200px]"
            />
            {chat.isStreaming ? (
              <button
                onClick={chat.stopStreaming}
                className="h-cta w-cta shrink-0 rounded-sm flex items-center justify-center bg-error/10 text-error hover:bg-error/20 transition-colors"
              >
                <StopIcon className="size-icon-sm" weight="fill" />
              </button>
            ) : (
              <button
                onClick={handleSend}
                disabled={!draft.trim()}
                className="h-cta w-cta shrink-0 rounded-sm flex items-center justify-center bg-brand text-on-brand hover:bg-brand-hover disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                <PaperPlaneRightIcon className="size-icon-xs" weight="bold" />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
