// @input: 路由 active 状态、badges counts、导航回调、worldName
// @output: 可折叠的左侧文字导航栏（w-56），配合 AppBar 使用
// @position: SharedAppLayout 中 AppBar 右侧，仅 desktop 可见

import { useCallback, useState } from 'react';
import {
  ChatCircleDotsIcon,
  ClockCounterClockwiseIcon,
  FileTextIcon,
  GlobeIcon,
  TrayIcon,
  KanbanIcon,
  LayoutIcon,
  ListChecksIcon,
  MagnifyingGlassIcon,
  GearIcon,
  SidebarSimpleIcon,
  TreeStructureIcon,
} from '@phosphor-icons/react';
import { cn } from '@/lib/utils';

const STORAGE_KEY = 'du-sidebar-open';

interface NavItemConfig {
  icon: React.ElementType;
  label: string;
  isActive: boolean;
  onClick: () => void;
  badge?: number;
}

interface DUSidebarProps {
  worldName?: string;
  isOpen: boolean;
  onToggle: () => void;

  // Active states
  isWorldActive: boolean;
  isChatActive: boolean;
  isResidentsActive: boolean;
  isOrgActive: boolean;
  isApprovalsActive: boolean;
  isActivityActive: boolean;
  isFilesActive: boolean;
  isInboxActive: boolean;
  isWorkspacesActive: boolean;

  // Counts / badges (optional)
  residentCount?: number;
  pendingApprovalsCount?: number;
  unreadInboxCount?: number;

  // Handlers
  onWorldClick: () => void;
  onChatClick: () => void;
  onResidentsClick: () => void;
  onOrgClick: () => void;
  onApprovalsClick: () => void;
  onActivityClick: () => void;
  onFilesClick: () => void;
  onInboxClick: () => void;
  onWorkspacesClick: () => void;
  onSearchClick?: () => void;
  onSettingsClick?: () => void;
}

// ── Section label ────────────────────────────────────────────────────────────

function SectionLabel({ children }: { children: string }) {
  return (
    <div className="px-3 pt-3 pb-1 text-[9px] font-medium uppercase tracking-widest text-low">
      {children}
    </div>
  );
}

// ── Single nav item ──────────────────────────────────────────────────────────

function NavItem({ icon: Icon, label, isActive, onClick, badge }: NavItemConfig) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'flex items-center gap-2 w-full px-3 py-1.5 rounded text-sm transition-colors',
        'focus:outline-none focus-visible:ring-1 focus-visible:ring-brand',
        isActive
          ? 'bg-brand/10 text-high'
          : 'text-normal hover:bg-panel hover:text-high'
      )}
    >
      <Icon className="size-4 shrink-0" weight={isActive ? 'fill' : 'regular'} />
      <span className="flex-1 truncate text-left">{label}</span>
      {badge != null && badge > 0 && (
        <span className="ml-auto rounded-full bg-brand/20 text-high px-1.5 py-0.5 text-[10px] leading-none font-medium">
          {badge > 99 ? '99+' : badge}
        </span>
      )}
    </button>
  );
}

// ── Main export ──────────────────────────────────────────────────────────────

export function DUSidebar({
  worldName,
  isOpen,
  onToggle,
  isWorldActive,
  isChatActive,
  isResidentsActive,
  isOrgActive,
  isApprovalsActive,
  isActivityActive,
  isFilesActive,
  isInboxActive,
  isWorkspacesActive,
  residentCount,
  pendingApprovalsCount,
  unreadInboxCount,
  onWorldClick,
  onChatClick,
  onResidentsClick,
  onOrgClick,
  onApprovalsClick,
  onActivityClick,
  onFilesClick,
  onInboxClick,
  onWorkspacesClick,
  onSearchClick,
  onSettingsClick,
}: DUSidebarProps) {
  const worldNavItems: NavItemConfig[] = [
    { icon: GlobeIcon,                  label: '仪表盘',   isActive: isWorldActive,      onClick: onWorldClick },
    { icon: ChatCircleDotsIcon,         label: '对话',     isActive: isChatActive,       onClick: onChatClick },
    { icon: KanbanIcon,                 label: '居民',     isActive: isResidentsActive,  onClick: onResidentsClick, badge: residentCount },
    { icon: TreeStructureIcon,          label: '组织',     isActive: isOrgActive,        onClick: onOrgClick },
    { icon: ListChecksIcon,             label: '审批',     isActive: isApprovalsActive,  onClick: onApprovalsClick, badge: pendingApprovalsCount },
    { icon: ClockCounterClockwiseIcon,  label: '动态',     isActive: isActivityActive,   onClick: onActivityClick },
    { icon: FileTextIcon,               label: '文件',     isActive: isFilesActive,      onClick: onFilesClick },
    { icon: TrayIcon,                    label: '收件箱',   isActive: isInboxActive,      onClick: onInboxClick, badge: unreadInboxCount },
  ];

  return (
    <div
      className={cn(
        'overflow-hidden transition-[width] duration-150 ease-out shrink-0 h-full',
        isOpen ? 'w-56' : 'w-0'
      )}
    >
      {/* Inner container keeps fixed width so content never wraps during animation */}
      <aside className="w-56 h-full flex flex-col bg-secondary border-r border-border">

        {/* Top: world name + search */}
        <div className="flex items-center gap-1 px-3 h-11 shrink-0 border-b border-border">
          <span className="flex-1 text-sm font-semibold text-high truncate">
            {worldName || '世界'}
          </span>
          {onSearchClick && (
            <button
              type="button"
              onClick={onSearchClick}
              className="p-1 rounded text-low hover:text-normal hover:bg-panel transition-colors focus:outline-none focus-visible:ring-1 focus-visible:ring-brand"
              aria-label="搜索"
            >
              <MagnifyingGlassIcon className="size-4" />
            </button>
          )}
        </div>

        {/* Navigation */}
        <nav className="flex-1 min-h-0 overflow-y-auto py-1 px-1">

          {/* Workspaces (top-level, outside world section) */}
          <NavItem
            icon={LayoutIcon}
            label="工作空间"
            isActive={isWorkspacesActive}
            onClick={onWorkspacesClick}
          />

          <SectionLabel>世界</SectionLabel>

          {worldNavItems.map((item) => (
            <NavItem key={item.label} {...item} />
          ))}

          <SectionLabel>公司</SectionLabel>

          <NavItem
            icon={GearIcon}
            label="设置"
            isActive={false}
            onClick={onSettingsClick ?? (() => {})}
          />
        </nav>

        {/* Toggle button at bottom */}
        <div className="shrink-0 border-t border-border px-3 py-2 flex justify-end">
          <button
            type="button"
            onClick={onToggle}
            className="p-1 rounded text-low hover:text-normal hover:bg-panel transition-colors focus:outline-none focus-visible:ring-1 focus-visible:ring-brand"
            aria-label="折叠侧边栏"
          >
            <SidebarSimpleIcon className="size-3.5" aria-hidden="true" />
          </button>
        </div>
      </aside>
    </div>
  );
}

// ── localStorage hook (extracted so Layout can use it) ────────────────────────

export function useDUSidebarState() {
  const [isOpen, setIsOpen] = useState<boolean>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      return stored === null ? true : stored === 'true';
    } catch {
      return true;
    }
  });

  const toggle = useCallback(() => {
    setIsOpen((prev) => {
      const next = !prev;
      try { localStorage.setItem(STORAGE_KEY, String(next)); } catch { /* ignore */ }
      return next;
    });
  }, []);

  return { isOpen, toggle };
}
