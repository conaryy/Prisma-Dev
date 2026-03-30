import { useEffect, useState } from 'react';
import { fetchLogbookEntries, fetchLogbookOverview } from '../lib/logbook';
import type { LogbookCategory, LogbookOverview, UnifiedLogbookEntry } from '../types';

export function useLogbookEntries(category: LogbookCategory | null, limit = 500) {
  const [entries, setEntries] = useState<UnifiedLogbookEntry[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!category) {
      setEntries([]);
      setIsLoading(false);
      setError(null);
      return;
    }

    let cancelled = false;
    setIsLoading(true);
    setError(null);

    fetchLogbookEntries(category, limit)
      .then((result) => {
        if (!cancelled) {
          setEntries(result);
        }
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Gagal memuat data logbook.');
        }
      })
      .finally(() => {
        if (!cancelled) {
          setIsLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [category, limit]);

  return { entries, isLoading, error };
}

export function useLogbookOverview() {
  const [overview, setOverview] = useState<LogbookOverview | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    setError(null);

    fetchLogbookOverview()
      .then((result) => {
        if (!cancelled) {
          setOverview(result);
        }
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Gagal memuat ringkasan logbook.');
        }
      })
      .finally(() => {
        if (!cancelled) {
          setIsLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  return { overview, isLoading, error };
}
