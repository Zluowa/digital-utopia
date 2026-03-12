// @input: localStorage key + item IDs
// @output: dismissed Set + dismiss(id) callback
// @position: Utility hook — persistent dismiss state for any list-like UI

import { useCallback, useState } from 'react';

function load(key: string): Set<string> {
  try {
    const raw = localStorage.getItem(key);
    return raw ? new Set(JSON.parse(raw) as string[]) : new Set();
  } catch {
    return new Set();
  }
}

function save(key: string, ids: Set<string>): void {
  localStorage.setItem(key, JSON.stringify([...ids]));
}

export function useDismissed(storageKey: string) {
  const [dismissed, setDismissed] = useState<Set<string>>(() => load(storageKey));

  const dismiss = useCallback((id: string) => {
    setDismissed((prev) => {
      const next = new Set(prev);
      next.add(id);
      save(storageKey, next);
      return next;
    });
  }, [storageKey]);

  const restore = useCallback((id: string) => {
    setDismissed((prev) => {
      const next = new Set(prev);
      next.delete(id);
      save(storageKey, next);
      return next;
    });
  }, [storageKey]);

  return { dismissed, dismiss, restore };
}
