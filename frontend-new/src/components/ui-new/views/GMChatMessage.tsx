// @input: GMMessage (from useGMChat hook)
// @output: 对话条目（复用 vibe-kanban 对话原语）
// @position: 主脑/居民对话渲染单元

import type { GMMessage, ActionEvent } from '@/hooks/useGMChat';
import { ChatAssistantMessage } from '../primitives/conversation/ChatAssistantMessage';
import { ChatUserMessage } from '../primitives/conversation/ChatUserMessage';
import { ChatToolSummary } from '../primitives/conversation/ChatToolSummary';
import type { ToolStatus } from 'shared/types';

function toToolStatus(event: ActionEvent): ToolStatus {
  if (!event.result) return { status: 'created' };
  return event.result.success
    ? { status: 'success' }
    : { status: 'failed' };
}

function toActionType(action: string): string {
  if (action === 'Read' || action === 'Glob') return 'file_read';
  if (action === 'Grep') return 'search';
  if (action === 'WebFetch' || action === 'WebSearch') return 'web_fetch';
  return 'tool';
}

function toolSummary(event: ActionEvent): string {
  const p = event.params;
  if (p.file_path) return String(p.file_path);
  if (p.command) return String(p.command).slice(0, 80);
  if (p.pattern) return String(p.pattern);
  if (p.query) return String(p.query);
  if (p.url) return String(p.url);
  return event.action;
}

export function GMChatMessage({ message }: { message: GMMessage }) {
  if (message.role === 'user') {
    return <ChatUserMessage content={message.content} expanded />;
  }

  return (
    <>
      {message.actions?.map((a, i) => (
        <ChatToolSummary
          key={i}
          summary={toolSummary(a)}
          status={toToolStatus(a)}
          toolName={a.action}
          actionType={toActionType(a.action)}
        />
      ))}
      {message.content && message.content !== '...' && (
        <ChatAssistantMessage content={message.content} />
      )}
    </>
  );
}
