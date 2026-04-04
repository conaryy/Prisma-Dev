import { useCallback, useEffect, useState } from 'react';
import { fetchLogbookEntries, fetchLogbookOverview } from '../lib/logbook';
import type {
  LogbookCategory,
  LogbookListResponse,
  LogbookOverview,
  UnifiedLogbookEntry,
} from '../types';

const EMPTY_META: LogbookListResponse['meta'] = {
  category: '',
  total: 0,
  page: 1,
  pageSize: 20,
  totalPages: 1,
  search: '',
  sort: 'desc',
  year: null,
  month: null,
  availableYears: [],
  availableMonths: [],
};

const logbookEntriesCache = new Map<
  string,
  {
    entries: UnifiedLogbookEntry[];
    meta: LogbookListResponse['meta'];
  }
>();

type UseLogbookEntriesParams = {
  category: LogbookCategory | null;
  page: number;
  pageSize?: number;
  search?: string;
  sort?: 'desc' | 'asc';
  year?: number | null;
  month?: number | null;
};

export function useLogbookEntries({
  category,
  page,
  pageSize = 20,
  search = '',
  sort = 'desc',
  year = null,
  month = null,
}: UseLogbookEntriesParams) {
  const [entries, setEntries] = useState<UnifiedLogbookEntry[]>([]);
  const [meta, setMeta] = useState<LogbookListResponse['meta']>(EMPTY_META);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const refresh = useCallback(() => {
    setReloadKey((value) => value + 1);
  }, []);

  useEffect(() => {
    if (!category) {
      setEntries([]);
      setMeta(EMPTY_META);
      setIsLoading(false);
      setError(null);
      return;
    }

    const cacheKey = JSON.stringify({
      category,
      page,
      pageSize,
      search,
      sort,
      year,
      month,
    });
    const cached = logbookEntriesCache.get(cacheKey);
    let cancelled = false;
    if (cached) {
      setEntries(cached.entries);
      setMeta(cached.meta);
      setIsLoading(false);
    } else {
      setIsLoading(true);
    }
    setError(null);

    fetchLogbookEntries({ category, page, pageSize, search, sort, year, month })
      .then((result) => {
        if (!cancelled) {
          setEntries(result.entries);
          setMeta(result.meta);
          logbookEntriesCache.set(cacheKey, {
            entries: result.entries,
            meta: result.meta,
          });
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
  }, [category, page, pageSize, search, sort, year, month, reloadKey]);

  return {
    entries,
    meta,
    isLoading,
    error,
    refresh,
  };
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
