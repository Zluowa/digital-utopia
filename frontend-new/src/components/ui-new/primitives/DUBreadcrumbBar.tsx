// @input: BreadcrumbContext — breadcrumbs array
// @output: Top bar showing "Home > World > Org Chart" trail
// @position: Layout header — rendered inside SharedAppLayout content column

import { Link } from 'react-router-dom';
import { useBreadcrumbs } from '@/contexts/BreadcrumbContext';
import { CaretRightIcon } from '@phosphor-icons/react';

export function DUBreadcrumbBar() {
  const { breadcrumbs } = useBreadcrumbs();

  if (breadcrumbs.length === 0) return null;

  // Single crumb = page title
  if (breadcrumbs.length === 1) {
    return (
      <div className="border-b border-border px-double h-10 shrink-0 flex items-center">
        <h1 className="text-sm font-medium text-high uppercase tracking-wider truncate">
          {breadcrumbs[0].label}
        </h1>
      </div>
    );
  }

  return (
    <div className="border-b border-border px-double h-10 shrink-0 flex items-center gap-1 min-w-0 overflow-hidden">
      {breadcrumbs.map((crumb, i) => {
        const isLast = i === breadcrumbs.length - 1;
        return (
          <span key={i} className="flex items-center gap-1 shrink-0 last:min-w-0 last:shrink last:overflow-hidden">
            {i > 0 && (
              <CaretRightIcon className="size-3 text-low shrink-0" />
            )}
            {isLast || !crumb.href ? (
              <span className={`text-sm truncate ${isLast ? 'text-high font-medium' : 'text-low'}`}>
                {crumb.label}
              </span>
            ) : (
              <Link
                to={crumb.href}
                className="text-sm text-low hover:text-normal transition-colors"
              >
                {crumb.label}
              </Link>
            )}
          </span>
        );
      })}
    </div>
  );
}
