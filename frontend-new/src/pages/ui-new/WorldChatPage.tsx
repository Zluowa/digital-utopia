// @input: useWorldData + GMChatPanel
// @output: /world/chat 完整GM对话页
// @position: 独立GM对话入口

import { useWorldData } from '@/hooks/useWorldData';
import { GMChatPanel } from '@/components/ui-new/views/GMChatPanel';

export function WorldChatPage() {
  const { snapshot } = useWorldData();
  return <GMChatPanel snapshot={snapshot} />;
}
