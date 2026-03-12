// @input: NavigationState（url/canGoBack/canGoForward）+ 回调
// @output: 浏览器风格的前进/后退导航按钮组
// @position: PreviewBrowser 工具栏子组件

import { ArrowLeftIcon, ArrowRightIcon } from '@phosphor-icons/react';
import type { NavigationState } from '@/types/previewDevTools';

interface PreviewNavigationProps {
  navigation: NavigationState | null;
  onBack: () => void;
  onForward: () => void;
  disabled?: boolean;
}

export function PreviewNavigation({ navigation, onBack, onForward, disabled }: PreviewNavigationProps) {
  const canBack = !disabled && (navigation?.canGoBack ?? false);
  const canForward = !disabled && (navigation?.canGoForward ?? false);

  return (
    <div className="flex items-center gap-half">
      <button
        type="button"
        onClick={onBack}
        disabled={!canBack}
        className="p-half rounded-sm text-low hover:text-normal disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
        aria-label="Navigate back"
        title="Back"
      >
        <ArrowLeftIcon className="size-icon-sm" />
      </button>
      <button
        type="button"
        onClick={onForward}
        disabled={!canForward}
        className="p-half rounded-sm text-low hover:text-normal disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
        aria-label="Navigate forward"
        title="Forward"
      >
        <ArrowRightIcon className="size-icon-sm" />
      </button>
    </div>
  );
}
