// @input: useAgentChat('/api/architect/chat')
// @output: 全屏World Architect对话界面
// @position: 对话式世界创建入口

import { useRef, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeftIcon,
  PaperPlaneRightIcon,
  StopIcon,
  CompassIcon,
} from '@phosphor-icons/react';
import { ConversationHeader } from '@/components/ui-new/views/ConversationHeader';
import { useAgentChat } from '@/hooks/useGMChat';
import { GMChatMessage } from '@/components/ui-new/views/GMChatMessage';
import { AutoResizeTextarea } from '@/components/ui-new/primitives/AutoResizeTextarea';

const EXAMPLE_PROMPTS = [
  '创建一个3人AI研究团队，主题是量子计算',
  '一个中世纪王国，有国王、骑士和商人',
  '5个Agent运营一家创业公司',
  '一个小型村庄，居民互相帮助生存',
];

export function ArchitectChatPage() {
  const chat = useAgentChat('/api/architect/chat');
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

  const isEmpty = chat.messages.length === 0;

  return (
    <div className="flex flex-col h-full">
      <ConversationHeader
        title={chat.activeConversation?.title ?? 'World Architect'}
        activeId={chat.activeConversation?.id}
        list={chat.conversationList}
        onNew={chat.newConversation}
        onSwitch={chat.switchConversation}
        onDelete={chat.deleteConversation}
        leftSlot={
          <button
            onClick={() => navigate('/worlds')}
            className="p-1 rounded-sm hover:bg-secondary transition-colors"
          >
            <ArrowLeftIcon className="size-icon-sm" />
          </button>
        }
      />

      <div
        ref={listRef}
        className="flex-1 overflow-y-auto"
        onScroll={() => {
          const el = listRef.current;
          if (el) shouldAutoScroll.current = el.scrollHeight - el.scrollTop - el.clientHeight < 100;
        }}
      >
        <div className="max-w-[720px] mx-auto px-base py-base">
          {isEmpty ? (
            <EmptyState onSelect={(p) => { setDraft(p); inputRef.current?.focus(); }} />
          ) : (
            <div className="space-y-base pt-double">
              {chat.messages.map((msg) => (
                <GMChatMessage key={msg.id} message={msg} />
              ))}
            </div>
          )}
        </div>
      </div>

      {chat.error && (
        <div className="max-w-[720px] mx-auto w-full px-base">
          <div className="py-half bg-error/10 text-error text-xs rounded-sm px-base mb-1">
            {chat.error}
          </div>
        </div>
      )}

      <div className="border-t border-border py-base">
        <div className="max-w-[720px] mx-auto px-base">
          <div className="flex gap-half items-end rounded-sm border border-border bg-panel p-half">
            <AutoResizeTextarea
              ref={inputRef}
              value={draft}
              onChange={setDraft}
              onKeyDown={handleKeyDown}
              preventNewlines={false}
              placeholder="描述你想创建的世界..."
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

function EmptyState({ onSelect }: { onSelect: (p: string) => void }) {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] gap-6">
      <div className="text-center">
        <CompassIcon className="size-10 text-brand mx-auto mb-3" weight="duotone" />
        <div className="text-xl font-medium text-high mb-2">World Architect</div>
        <div className="text-sm text-low max-w-sm">
          描述你想创建的世界，Architect 会帮你设计居民、经济和文化。
        </div>
      </div>
      <div className="flex flex-col gap-2 w-full max-w-sm">
        {EXAMPLE_PROMPTS.map((prompt) => (
          <button
            key={prompt}
            onClick={() => onSelect(prompt)}
            className="text-left text-sm text-normal px-base py-half rounded-sm border border-border bg-panel hover:bg-secondary hover:border-brand/50 transition-colors cursor-pointer"
          >
            {prompt}
          </button>
        ))}
      </div>
    </div>
  );
}
