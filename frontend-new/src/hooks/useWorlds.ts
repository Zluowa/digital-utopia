// @input: /api/worlds endpoint
// @output: world list + CRUD operations
// @position: multi-world data layer

import { useState, useEffect, useCallback } from 'react';

export interface WorldInfo {
  name: string;
  displayName: string;
  theme: string;
  agentCount: number;
  createdAt: string;
  isActive: boolean;
}

function unwrap<T>(payload: unknown): T | null {
  if (payload == null) return null;
  const rec = payload as Record<string, unknown>;
  if ('result' in rec) return rec.result as T;
  if ('data' in rec) return rec.data as T;
  return payload as T;
}

export function useWorlds() {
  const [worlds, setWorlds] = useState<WorldInfo[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchWorlds = useCallback(async () => {
    try {
      const res = await fetch('/api/worlds');
      if (!res.ok) throw new Error(`Failed to load worlds: ${res.status}`);
      const data = unwrap<WorldInfo[]>(await res.json());
      if (Array.isArray(data)) setWorlds(data);
      setError(null);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => { void fetchWorlds(); }, [fetchWorlds]);

  const createWorld = useCallback(async (input: { name: string; theme?: string }) => {
    const res = await fetch('/api/worlds', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: input.name, theme: input.theme ?? '', agents: [] }),
    });
    if (!res.ok) throw new Error(`Create failed: ${res.status}`);
    await fetchWorlds();
  }, [fetchWorlds]);

  const activateWorld = useCallback(async (worldName: string) => {
    const res = await fetch(`/api/worlds/${encodeURIComponent(worldName)}/activate`, { method: 'POST' });
    if (!res.ok) throw new Error(`Activate failed: ${res.status}`);
    await fetchWorlds();
  }, [fetchWorlds]);

  const deleteWorld = useCallback(async (worldName: string) => {
    const res = await fetch(`/api/worlds/${encodeURIComponent(worldName)}`, { method: 'DELETE' });
    if (!res.ok) throw new Error(`Delete failed: ${res.status}`);
    await fetchWorlds();
  }, [fetchWorlds]);

  const updateWorld = useCallback(async (worldName: string, updates: { name?: string; theme?: string }) => {
    const res = await fetch(`/api/worlds/${encodeURIComponent(worldName)}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates),
    });
    if (!res.ok) throw new Error(`Update failed: ${res.status}`);
    await fetchWorlds();
  }, [fetchWorlds]);

  return { worlds, isLoading, error, createWorld, activateWorld, deleteWorld, updateWorld, refresh: fetchWorlds };
}
