import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { getApiUrl } from '../lib/api';
import { useAuth } from './AuthContext';

type SavedContextValue = {
  savedIds: Set<string>;
  isSaved: (id: string) => boolean;
  toggleSaved: (id: string) => Promise<boolean | null>;
  refresh: () => Promise<void>;
  loading: boolean;
};

const SavedContext = createContext<SavedContextValue | null>(null);

function listingIdFrom(item: unknown): string | null {
  if (!item) return null;
  if (typeof item === 'string') return item;
  if (typeof item === 'object' && item !== null && '_id' in item) {
    const id = (item as { _id?: unknown })._id;
    return typeof id === 'string' ? id : id != null ? String(id) : null;
  }
  return null;
}

export function SavedProvider({ children }: { children: React.ReactNode }) {
  const { token } = useAuth();
  const [savedIds, setSavedIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    if (!token) {
      setSavedIds(new Set());
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(getApiUrl('saved'), {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json().catch(() => []);
      const list = Array.isArray(data) ? data : [];
      setSavedIds(new Set(list.map(listingIdFrom).filter((id): id is string => Boolean(id))));
    } catch {
      setSavedIds(new Set());
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const isSaved = useCallback((id: string) => savedIds.has(id), [savedIds]);

  const toggleSaved = useCallback(
    async (id: string): Promise<boolean | null> => {
      if (!token) return null;
      setSavedIds((prev) => {
        const next = new Set(prev);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        return next;
      });
      try {
        const res = await fetch(getApiUrl('saved'), {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ listingId: id }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          setSavedIds((prev) => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
          });
          return null;
        }
        const saved = Boolean(data.saved);
        setSavedIds((prev) => {
          const next = new Set(prev);
          if (saved) next.add(id);
          else next.delete(id);
          return next;
        });
        return saved;
      } catch {
        setSavedIds((prev) => {
          const next = new Set(prev);
          if (next.has(id)) next.delete(id);
          else next.add(id);
          return next;
        });
        return null;
      }
    },
    [token]
  );

  const value = useMemo(
    () => ({ savedIds, isSaved, toggleSaved, refresh, loading }),
    [savedIds, isSaved, toggleSaved, refresh, loading]
  );

  return <SavedContext.Provider value={value}>{children}</SavedContext.Provider>;
}

export function useSaved(): SavedContextValue {
  const ctx = useContext(SavedContext);
  if (!ctx) throw new Error('useSaved must be used within SavedProvider');
  return ctx;
}
