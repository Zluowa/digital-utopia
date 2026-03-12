// @input: CitizenColumn array (grouped) + action callbacks
// @output: Grouped list view for citizens
// @position: List layout view for citizen classification

import { useState } from 'react';
import type { CitizenColumn } from '@/types/citizen';
import { CitizenListRow } from './CitizenListRow';

interface CitizenListViewProps {
  columns: CitizenColumn[];
  onAwaken?: (id: string) => void;
  onStop?: (id: string) => void;
}

function ListSection({ column, onAwaken, onStop }: {
  column: CitizenColumn;
  onAwaken?: (id: string) => void;
  onStop?: (id: string) => void;
}) {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <div>
      <button
        onClick={() => setCollapsed((v) => !v)}
        className="w-full flex items-center gap-2 px-double py-half
          text-left hover:bg-secondary transition-colors"
      >
        <span
          className="w-2 h-2 rounded-full shrink-0"
          style={{ backgroundColor: column.color }}
        />
        <span className="text-sm font-medium text-normal">{column.label}</span>
        <span className="text-sm text-low ml-1">{column.citizens.length}</span>
        <span className="ml-auto text-low text-xs">{collapsed ? '▸' : '▾'}</span>
      </button>

      {!collapsed && column.citizens.map((c) => (
        <CitizenListRow key={c.id} citizen={c} onAwaken={onAwaken} onStop={onStop} />
      ))}

      {!collapsed && column.citizens.length === 0 && (
        <div className="px-double py-half text-sm text-low">No citizens</div>
      )}
    </div>
  );
}

export function CitizenListView({ columns, onAwaken, onStop }: CitizenListViewProps) {
  return (
    <div className="h-full overflow-y-auto divide-y">
      {columns.map((col) => (
        <ListSection key={col.id} column={col} onAwaken={onAwaken} onStop={onStop} />
      ))}
    </div>
  );
}
