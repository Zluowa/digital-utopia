// @input: status string (any entity type: agent, issue, run, approval, goal)
// @output: Inline badge chip with semantic color, rounded pill shape
// @position: Leaf primitive; replaces ad-hoc inline status styling across the app

import { cn } from '@/lib/utils';
import { statusBadgeClasses, statusBadgeDefault } from '@/lib/status-colors';

interface StatusBadgeProps {
  status: string;
  className?: string;
}

export function StatusBadge({ status, className }: StatusBadgeProps) {
  const colorClasses = statusBadgeClasses[status] ?? statusBadgeDefault;
  const label = status.replace(/_/g, ' ');

  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-base py-half',
        'text-sm font-medium whitespace-nowrap shrink-0',
        colorClasses,
        className
      )}
    >
      {label}
    </span>
  );
}
