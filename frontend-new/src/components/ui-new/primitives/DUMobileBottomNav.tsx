// @input: useLocation for active state detection
// @output: Fixed bottom nav bar visible only on small screens (md:hidden)
// @position: Mobile layout — replaces AppBar on small screens

import { useLocation, useNavigate } from 'react-router-dom';
import {
  HouseIcon,
  GlobeIcon,
  TreeStructureIcon,
  ListChecksIcon,
  ClockCounterClockwiseIcon,
  type Icon,
} from '@phosphor-icons/react';
import { cn } from '@/lib/utils';

interface BottomNavItem {
  label: string;
  href: string;
  icon: Icon;
  matchPrefix?: string;
}

const ITEMS: BottomNavItem[] = [
  { label: '首页', href: '/worlds', icon: HouseIcon },
  { label: '世界', href: '/world', icon: GlobeIcon, matchPrefix: '/world' },
  { label: '架构', href: '/world/org', icon: TreeStructureIcon },
  { label: '审批', href: '/world/approvals', icon: ListChecksIcon },
  { label: '记录', href: '/world/activity', icon: ClockCounterClockwiseIcon },
];

function isActive(item: BottomNavItem, pathname: string): boolean {
  if (item.matchPrefix) return pathname.startsWith(item.matchPrefix);
  return pathname === item.href;
}

export function DUMobileBottomNav() {
  const location = useLocation();
  const navigate = useNavigate();

  return (
    <nav
      className={cn(
        'fixed bottom-0 left-0 right-0 z-30 md:hidden',
        'border-t border-border bg-secondary/95 backdrop-blur',
        'pb-[env(safe-area-inset-bottom)]'
      )}
      aria-label="移动端底部导航"
    >
      <div className="grid h-14 grid-cols-5 px-1">
        {ITEMS.map((item) => {
          const active = isActive(item, location.pathname);
          const Icon = item.icon;
          return (
            <button
              key={item.href}
              type="button"
              onClick={() => navigate(item.href)}
              className={cn(
                'flex flex-col items-center justify-center gap-0.5',
                'text-[10px] font-medium transition-colors',
                active ? 'text-high' : 'text-low hover:text-normal'
              )}
            >
              <Icon className={cn('size-[18px]', active && 'text-brand')} />
              <span>{item.label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
