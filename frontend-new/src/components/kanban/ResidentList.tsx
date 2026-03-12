// @input: CitizenColumn array + action callbacks
// @output: Grouped collapsible list of residents
// @position: List view for ResidentsPage

import { useState } from 'react';
import type { CitizenColumn, CitizenEntry } from '@/types/citizen';
import { ResidentCard } from './ResidentCard';

interface SectionProps {
  column: CitizenColumn;
  onAwaken?: (id: string) => void;
  onStop?: (id: string) => void;
}

function ListSection({ column, onAwaken, onStop }: SectionProps) {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <div>
      <button
        onClick={() => setCollapsed((v) => !v)}
        className="w-full flex items-center gap-2 px-double py-half
          text-left hover:bg-secondary transition-colors"
      >
        <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: column.color }} />
        <span className="text-sm font-medium text-normal">{column.label}</span>
        <span className="text-sm text-low">{column.citizens.length}</span>
        <span className="ml-auto text-low text-xs">{collapsed ? '▸' : '▾'}</span>
      </button>

      {!collapsed && (
        <div className="px-double pb-base grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-half">
          {column.citizens.map((c: CitizenEntry) => (
            <ResidentCard key={c.id} resident={c} onAwaken={onAwaken} onStop={onStop} />
          ))}
          {column.citizens.length === 0 && (
            <div className="col-span-full text-sm text-low py-half">No residents</div>
          )}
        </div>
      )}
    </div>
  );
}

interface ResidentListProps {
  columns: CitizenColumn[];
  onAwaken?: (id: string) => void;
  onStop?: (id: string) => void;
}

export function ResidentList({ columns, onAwaken, onStop }: ResidentListProps) {
  return (
    <div className="h-full overflow-y-auto divide-y">
      {columns.map((col) => (
        <ListSection key={col.id} column={col} onAwaken={onAwaken} onStop={onStop} />
      ))}
    </div>
  );
}
