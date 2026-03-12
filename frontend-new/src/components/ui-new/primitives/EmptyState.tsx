// @input: icon, message, optional action button props
// @output: Centered empty-state placeholder with icon + text + optional CTA
// @position: Leaf primitive; use inside any list/table/panel that may be empty

import type { Icon } from '@phosphor-icons/react';
import { PlusIcon } from '@phosphor-icons/react';
import { cn } from '@/lib/utils';

interface EmptyStateProps {
  icon: Icon;
  message: string;
  description?: string;
  action?: string;
  onAction?: () => void;
  className?: string;
}

export function EmptyState({
  icon: IconComp,
  message,
  description,
  action,
  onAction,
  className,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center py-16 text-center gap-3',
        className
      )}
    >
      <div className="bg-panel rounded-sm p-4">
        <IconComp className="size-icon-xl text-low" weight="regular" />
      </div>

      <div className="space-y-1">
        <p className="text-base text-normal font-medium">{message}</p>
        {description && (
          <p className="text-sm text-low max-w-xs">{description}</p>
        )}
      </div>

      {action && onAction && (
        <button
          onClick={onAction}
          className={cn(
            'inline-flex items-center gap-half',
            'px-base py-half rounded-sm',
            'bg-secondary border border-border',
            'text-sm text-normal font-medium',
            'hover:text-high transition-colors'
          )}
        >
          <PlusIcon className="size-icon-sm" weight="bold" />
          {action}
        </button>
      )}
    </div>
  );
}
