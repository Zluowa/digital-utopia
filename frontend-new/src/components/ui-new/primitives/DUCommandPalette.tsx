// @input: useCommandBarShortcut + world snapshot agents list
// @output: CMD+K dialog for navigating DU pages, searching agents, firing actions
// @position: App shell — keyboard-driven navigation layer for Digital Utopia

import { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  HouseIcon,
  GlobeIcon,
  KanbanIcon,
  TreeStructureIcon,
  ListChecksIcon,
  ClockCounterClockwiseIcon,
  UserIcon,
  ChatCircleDotsIcon,
  FileTextIcon,
  MagnifyingGlassIcon,
  XIcon,
  type Icon,
} from '@phosphor-icons/react';
import { useCommandBarShortcut } from '@/hooks/useCommandBarShortcut';
import { useWorldData } from '@/hooks/useWorldData';
import { cn } from '@/lib/utils';

interface NavItem {
  label: string;
  href: string;
  icon: Icon;
  keywords: string[];
}

const PAGES: NavItem[] = [
  { label: '世界首页', href: '/world', icon: GlobeIcon, keywords: ['world', 'dashboard', '世界', '首页'] },
  { label: '仪表盘', href: '/world/dashboard', icon: HouseIcon, keywords: ['dashboard', '仪表盘'] },
  { label: 'GM 对话', href: '/world/chat', icon: ChatCircleDotsIcon, keywords: ['chat', 'gm', '对话'] },
  { label: '居民看板', href: '/world/residents', icon: KanbanIcon, keywords: ['residents', '居民', 'kanban'] },
  { label: '组织架构', href: '/world/org', icon: TreeStructureIcon, keywords: ['org', 'chart', '组织', '架构'] },
  { label: '审批中心', href: '/world/approvals', icon: ListChecksIcon, keywords: ['approvals', '审批'] },
  { label: '活动记录', href: '/world/activity', icon: ClockCounterClockwiseIcon, keywords: ['activity', '活动', '记录', 'log'] },
  { label: '文件系统', href: '/world/files', icon: FileTextIcon, keywords: ['files', '文件'] },
  { label: '世界列表', href: '/worlds', icon: GlobeIcon, keywords: ['worlds', '世界列表'] },
];

function matches(item: { label: string; keywords: string[] }, query: string): boolean {
  const q = query.toLowerCase();
  return item.label.toLowerCase().includes(q) || item.keywords.some((k) => k.includes(q));
}

export function DUCommandPalette() {
  const [open, setOpen] = useState(false);
  useCommandBarShortcut(() => setOpen(true));

  if (!open) return null;
  return <PalettePanel onClose={() => setOpen(false)} />;
}

/** Mounted only when open — WebSocket connected only when palette is visible */
function PalettePanel({ onClose }: { onClose: () => void }) {
  const [query, setQuery] = useState('');
  const navigate = useNavigate();
  const { snapshot } = useWorldData();

  const go = useCallback((href: string) => {
    onClose();
    navigate(href);
  }, [onClose, navigate]);

  const agents = snapshot?.agents ?? [];

  const filteredPages = query
    ? PAGES.filter((p) => matches(p, query))
    : PAGES;

  const filteredAgents = agents.filter((a) => {
    if (!query) return true;
    const q = query.toLowerCase();
    return a.id.toLowerCase().includes(q) || (a.identity ?? '').toLowerCase().includes(q);
  }).slice(0, 8);

  return (
    <div
      className="fixed inset-0 z-[200] flex items-start justify-center pt-[15vh]"
      onClick={onClose}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60" />

      {/* Panel */}
      <div
        className="relative z-10 w-full max-w-lg bg-secondary border border-border rounded-md shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Input */}
        <div className="flex items-center gap-2 px-3 py-2.5 border-b border-border">
          <MagnifyingGlassIcon className="size-4 text-low shrink-0" />
          <input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="搜索页面、Agent、操作..."
            className="flex-1 bg-transparent text-sm text-normal placeholder:text-low outline-none"
          />
          <button
            type="button"
            onClick={onClose}
            className="shrink-0 p-0.5 text-low hover:text-normal"
          >
            <XIcon className="size-3.5" />
          </button>
        </div>

        {/* Results */}
        <div className="max-h-[360px] overflow-auto py-1">
          {filteredPages.length > 0 && (
            <ResultGroup label="页面">
              {filteredPages.map((page) => (
                <ResultItem
                  key={page.href}
                  icon={<page.icon className="size-4" />}
                  label={page.label}
                  hint={page.href}
                  onSelect={() => go(page.href)}
                />
              ))}
            </ResultGroup>
          )}

          {filteredAgents.length > 0 && (
            <ResultGroup label="Agents">
              {filteredAgents.map((agent) => (
                <ResultItem
                  key={agent.id}
                  icon={<UserIcon className="size-4" />}
                  label={agent.identity ?? agent.id}
                  hint={agent.status}
                  onSelect={() => go('/world/org')}
                />
              ))}
            </ResultGroup>
          )}

          {filteredPages.length === 0 && filteredAgents.length === 0 && (
            <div className="px-3 py-6 text-center text-sm text-low">未找到结果</div>
          )}
        </div>
      </div>
    </div>
  );
}

function ResultGroup({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="px-3 py-1 text-xs text-low uppercase tracking-wider">{label}</div>
      {children}
    </div>
  );
}

function ResultItem({
  icon,
  label,
  hint,
  onSelect,
}: {
  icon: React.ReactNode;
  label: string;
  hint?: string;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        'w-full flex items-center gap-2.5 px-3 py-1.5 text-sm',
        'text-normal hover:bg-panel transition-colors text-left'
      )}
    >
      <span className="text-low shrink-0">{icon}</span>
      <span className="flex-1 truncate">{label}</span>
      {hint && <span className="text-xs text-low shrink-0 truncate max-w-[120px]">{hint}</span>}
    </button>
  );
}
