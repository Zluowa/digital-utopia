// @input: CitizenColumn array + action callbacks
// @output: Multi-column kanban board for citizens
// @position: Kanban layout view (no drag-drop, read-only)

import type { CitizenColumn, CitizenEntry } from '@/types/citizen';
import { CitizenCard } from './CitizenCard';

interface CitizenKanbanViewProps {
  columns: CitizenColumn[];
  onAwaken?: (id: string) => void;
  onStop?: (id: string) => void;
}

function ColumnHeader({ label, color, count }: { label: string; color: string; count: number }) {
  return (
    <div className="sticky top-0 z-10 flex items-center gap-2 p-base bg-primary border-b">
      <span
        className="w-2 h-2 rounded-full shrink-0"
        style={{ backgroundColor: color }}
      />
      <span className="text-sm text-normal">{label}</span>
      <span className="text-sm text-low ml-auto">{count}</span>
    </div>
  );
}

function KanbanColumn({ column, onAwaken, onStop }: {
  column: CitizenColumn;
  onAwaken?: (id: string) => void;
  onStop?: (id: string) => void;
}) {
  return (
    <div className="flex flex-col min-w-[200px] max-w-[320px] border-r last:border-r-0">
      <ColumnHeader
        label={column.label}
        color={column.color}
        count={column.citizens.length}
      />
      <div className="flex-1 overflow-y-auto p-base space-y-half">
        {column.citizens.length === 0 && (
          <div className="text-sm text-low text-center py-double">Empty</div>
        )}
        {column.citizens.map((c: CitizenEntry) => (
          <CitizenCard key={c.id} citizen={c} onAwaken={onAwaken} onStop={onStop} />
        ))}
      </div>
    </div>
  );
}

export function CitizenKanbanView({ columns, onAwaken, onStop }: CitizenKanbanViewProps) {
  return (
    <div className="flex h-full overflow-x-auto">
      {columns.map((col) => (
        <KanbanColumn key={col.id} column={col} onAwaken={onAwaken} onStop={onStop} />
      ))}
    </div>
  );
}
