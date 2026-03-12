// @input: CitizenColumn array + action callbacks
// @output: Multi-column kanban board grouped by status or role
// @position: Kanban view for ResidentsPage

import type { CitizenColumn, CitizenEntry } from '@/types/citizen';
import { ResidentCard } from './ResidentCard';

interface ColumnProps {
  column: CitizenColumn;
  onAwaken?: (id: string) => void;
  onStop?: (id: string) => void;
}

function KanbanColumn({ column, onAwaken, onStop }: ColumnProps) {
  return (
    <div className="flex flex-col min-w-[200px] max-w-[300px] border-r last:border-r-0 bg-primary">
      {/* Header */}
      <div className="sticky top-0 z-10 flex items-center gap-2 px-base py-half bg-primary border-b">
        <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: column.color }} />
        <span className="text-sm text-normal">{column.label}</span>
        <span className="text-sm text-low ml-auto">{column.citizens.length}</span>
      </div>

      {/* Cards */}
      <div className="flex-1 overflow-y-auto p-base space-y-half">
        {column.citizens.length === 0 && (
          <div className="text-sm text-low text-center py-double">Empty</div>
        )}
        {column.citizens.map((c: CitizenEntry) => (
          <ResidentCard key={c.id} resident={c} onAwaken={onAwaken} onStop={onStop} />
        ))}
      </div>
    </div>
  );
}

interface ResidentKanbanProps {
  columns: CitizenColumn[];
  onAwaken?: (id: string) => void;
  onStop?: (id: string) => void;
}

export function ResidentKanban({ columns, onAwaken, onStop }: ResidentKanbanProps) {
  return (
    <div className="flex h-full overflow-x-auto">
      {columns.map((col) => (
        <KanbanColumn key={col.id} column={col} onAwaken={onAwaken} onStop={onStop} />
      ))}
    </div>
  );
}
