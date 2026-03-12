// @input: array of active filters (key+label+value), remove/clear callbacks
// @output: Horizontal row of removable filter chips + "Clear all" button
// @position: Leaf primitive; render below a search bar when filters are active

import { XIcon } from '@phosphor-icons/react';
import { cn } from '@/lib/utils';

export interface FilterValue {
  key: string;
  label: string;
  value: string;
}

interface FilterBarProps {
  filters: FilterValue[];
  onRemove: (key: string) => void;
  onClear: () => void;
  className?: string;
}

export function FilterBar({ filters, onRemove, onClear, className }: FilterBarProps) {
  if (filters.length === 0) return null;

  return (
    <div className={cn('flex items-center gap-base flex-wrap', className)}>
      {filters.map((f) => (
        <span
          key={f.key}
          className={cn(
            'inline-flex items-center gap-half',
            'h-5 px-base rounded-full',
            'bg-panel border border-border',
            'text-sm text-normal'
          )}
        >
          <span className="text-low">{f.label}:</span>
          <span>{f.value}</span>
          <button
            onClick={() => onRemove(f.key)}
            className="ml-half rounded-full text-low hover:text-normal transition-colors"
            aria-label={`Remove ${f.label} filter`}
          >
            <XIcon className="size-icon-xs" weight="bold" />
          </button>
        </span>
      ))}

      <button
        onClick={onClear}
        className="text-sm text-low hover:text-normal transition-colors"
      >
        Clear all
      </button>
    </div>
  );
}
