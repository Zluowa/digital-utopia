// @input: Pages calling useBreadcrumbs().set(crumbs)
// @output: Current breadcrumb trail for the topbar
// @position: App-level context — page location awareness

import {
  createContext,
  useCallback,
  useContext,
  useState,
  type ReactNode,
} from 'react';

export interface Breadcrumb {
  label: string;
  href?: string;
}

interface BreadcrumbContextValue {
  breadcrumbs: Breadcrumb[];
  setBreadcrumbs: (crumbs: Breadcrumb[]) => void;
}

const Ctx = createContext<BreadcrumbContextValue>({
  breadcrumbs: [],
  setBreadcrumbs: () => {},
});

export function BreadcrumbProvider({ children }: { children: ReactNode }) {
  const [breadcrumbs, setBreadcrumbsState] = useState<Breadcrumb[]>([]);
  const setBreadcrumbs = useCallback(
    (crumbs: Breadcrumb[]) => setBreadcrumbsState(crumbs),
    []
  );
  return (
    <Ctx.Provider value={{ breadcrumbs, setBreadcrumbs }}>
      {children}
    </Ctx.Provider>
  );
}

export function useBreadcrumbs() {
  return useContext(Ctx);
}
