// @input: Engine /api/agents/:id/files and /api/agents/:id/file
// @output: File tree navigation + content loading
// @position: Data hook for FileExplorer page

import { useState, useCallback, useEffect } from 'react';

export interface FileEntry {
  name: string;
  type: 'dir' | 'file';
}

export interface FileContent {
  path: string;
  content: string;
}

function unwrapApi<T>(payload: unknown): T | null {
  if (payload == null) return null;
  if (Array.isArray(payload) || typeof payload !== 'object') return payload as T;
  const record = payload as Record<string, unknown>;
  if ('result' in record && record.result !== undefined) return record.result as T;
  if ('data' in record && record.data !== undefined) return record.data as T;
  return payload as T;
}

export function useFileTree(agentId: string | null) {
  const [entries, setEntries] = useState<FileEntry[]>([]);
  const [currentPath, setCurrentPath] = useState('.');
  const [file, setFile] = useState<FileContent | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setEntries([]);
    setCurrentPath('.');
    setFile(null);
    setError(null);
    setIsLoading(false);
  }, [agentId]);

  const browse = useCallback(async (path: string) => {
    if (!agentId) return;
    setIsLoading(true);
    try {
      const res = await fetch(`/api/agents/${agentId}/files?path=${encodeURIComponent(path)}`);
      const data = await res.json();
      const entriesData = unwrapApi<FileEntry[]>(data);
      setEntries(Array.isArray(entriesData) ? entriesData : []);
      setCurrentPath(path);
      setError(null);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setIsLoading(false);
    }
  }, [agentId]);

  const readFile = useCallback(async (path: string) => {
    if (!agentId) return;
    setIsLoading(true);
    try {
      const res = await fetch(`/api/agents/${agentId}/file?path=${encodeURIComponent(path)}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      const fileData = unwrapApi<FileContent>(data);
      setFile(fileData ?? null);
      setError(null);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setIsLoading(false);
    }
  }, [agentId]);

  const navigateUp = useCallback(() => {
    if (currentPath === '.') return;
    const parts = currentPath.split('/');
    parts.pop();
    void browse(parts.length === 0 ? '.' : parts.join('/'));
  }, [currentPath, browse]);

  return { entries, currentPath, file, isLoading, error, browse, readFile, navigateUp };
}
