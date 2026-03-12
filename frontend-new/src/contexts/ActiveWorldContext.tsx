// @input: /api/worlds (初始化)，WorldsListPage (切换)
// @output: 当前世界名 + switchWorld 回调
// @position: 全局上下文——所有世界感知组件的数据源

import { createContext, useContext, useState, useCallback, useEffect, type ReactNode } from 'react';

interface ActiveWorldState {
  worldName: string;
  switchWorld: (name: string) => void;
}

const Ctx = createContext<ActiveWorldState>({ worldName: '', switchWorld: () => {} });

export function ActiveWorldProvider({ children }: { children: ReactNode }) {
  const [worldName, setWorldName] = useState('');

  useEffect(() => {
    fetch('/api/worlds')
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        const list = data?.data ?? data?.result ?? data;
        if (!Array.isArray(list)) return;
        const active = list.find((w: { isActive?: boolean }) => w.isActive);
        if (active?.name) setWorldName(active.name);
      })
      .catch(() => {});
  }, []);

  const switchWorld = useCallback((name: string) => setWorldName(name), []);

  return <Ctx.Provider value={{ worldName, switchWorld }}>{children}</Ctx.Provider>;
}

export function useActiveWorld() {
  return useContext(Ctx);
}
