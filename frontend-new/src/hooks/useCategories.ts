// @input: Engine /api/categories + /api/agents/:id/categories/:catId
// @output: Categories data + assign/remove actions
// @position: Data hook for resident category tags

import { useState, useEffect, useCallback } from 'react';

export interface Category {
  id: string;
  name: string;
  color: string;
  description?: string;
}

export function useCategories() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchCategories = useCallback(async () => {
    try {
      const res = await fetch('/api/categories');
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      // Handle both { result: [...] } and plain array
      setCategories(Array.isArray(data) ? data : (data.result ?? []));
      setError(null);
    } catch (e) {
      setError((e as Error).message);
      setCategories([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchCategories();
  }, [fetchCategories]);

  const assignCategory = useCallback(async (agentId: string, categoryId: string) => {
    const res = await fetch(`/api/agents/${agentId}/categories/${categoryId}`, {
      method: 'PUT',
    });
    if (!res.ok) throw new Error(`Failed to assign category: HTTP ${res.status}`);
  }, []);

  const removeCategory = useCallback(async (agentId: string, categoryId: string) => {
    const res = await fetch(`/api/agents/${agentId}/categories/${categoryId}`, {
      method: 'DELETE',
    });
    if (!res.ok) throw new Error(`Failed to remove category: HTTP ${res.status}`);
  }, []);

  return {
    categories,
    isLoading,
    error,
    refresh: fetchCategories,
    assignCategory,
    removeCategory,
  };
}
