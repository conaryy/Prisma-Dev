import { useCallback, useEffect, useState } from 'react';
import {
  fetchImportBatchDetail,
  fetchImportBatchErrors,
  fetchImportBatches,
  fetchLogbookEntries,
  fetchLogbookOverview,
  searchSemanticLogbook,
} from '../lib/logbook';
import type {
  ImportBatchDetail,
  ImportBatchError,
  ImportBatchesResponse,
  LogbookCategory,
  LogbookListResponse,
  LogbookOverview,
  PaginationMeta,
  SemanticSearchResult,
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

const LOGBOOK_DATA_INVALIDATED_EVENT = 'logbook:data-invalidated';

export function invalidateLogbookData() {
  logbookEntriesCache.clear();

  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(LOGBOOK_DATA_INVALIDATED_EVENT));
  }
}

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
    function handleInvalidation() {
      setReloadKey((value) => value + 1);
    }

    if (typeof window !== 'undefined') {
      window.addEventListener(LOGBOOK_DATA_INVALIDATED_EVENT, handleInvalidation);
    }

    return () => {
      if (typeof window !== 'undefined') {
        window.removeEventListener(LOGBOOK_DATA_INVALIDATED_EVENT, handleInvalidation);
      }
    };
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
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    function handleInvalidation() {
      setReloadKey((value) => value + 1);
    }

    if (typeof window !== 'undefined') {
      window.addEventListener(LOGBOOK_DATA_INVALIDATED_EVENT, handleInvalidation);
    }

    return () => {
      if (typeof window !== 'undefined') {
        window.removeEventListener(LOGBOOK_DATA_INVALIDATED_EVENT, handleInvalidation);
      }
    };
  }, []);

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
  }, [reloadKey]);

  return { overview, isLoading, error };
}

type UseSemanticSearchParams = {
  query: string;
  sourceType?: LogbookCategory | null;
  startDate?: string;
  endDate?: string;
  limit?: number;
  enabled?: boolean;
};

export function useSemanticSearch({
  query,
  sourceType = null,
  startDate,
  endDate,
  limit = 8,
  enabled = true,
}: UseSemanticSearchParams) {
  const [results, setResults] = useState<SemanticSearchResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!enabled) {
      setResults([]);
      setIsLoading(false);
      setError(null);
      return;
    }

    const trimmedQuery = query.trim();
    if (!trimmedQuery) {
      setResults([]);
      setIsLoading(false);
      setError(null);
      return;
    }

    let cancelled = false;
    setIsLoading(true);
    setError(null);

    searchSemanticLogbook({
      query: trimmedQuery,
      limit,
      sourceType: sourceType ?? undefined,
      startDate,
      endDate,
    })
      .then((response) => {
        if (!cancelled) {
          setResults(response.data);
        }
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Gagal menjalankan pencarian cepat.');
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
  }, [enabled, query, sourceType, startDate, endDate, limit]);

  return {
    results,
    isLoading,
    error,
  };
}

type UseImportBatchesParams = {
  page: number;
  pageSize?: number;
  search?: string;
  category?: LogbookCategory | null;
  status?: 'pending' | 'processing' | 'completed' | 'failed' | null;
};

const EMPTY_IMPORT_BATCH_META: ImportBatchesResponse['meta'] = {
  total: 0,
  page: 1,
  pageSize: 20,
  totalPages: 1,
  category: null,
  status: null,
  search: '',
};

export function useImportBatches({
  page,
  pageSize = 20,
  search = '',
  category = null,
  status = null,
}: UseImportBatchesParams) {
  const [batches, setBatches] = useState<ImportBatchesResponse['data']>([]);
  const [meta, setMeta] = useState<ImportBatchesResponse['meta']>(EMPTY_IMPORT_BATCH_META);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  const refresh = useCallback(() => {
    setReloadKey((value) => value + 1);
  }, []);

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    setError(null);

    fetchImportBatches({ page, pageSize, search, category, status })
      .then((result) => {
        if (!cancelled) {
          setBatches(result.data);
          setMeta(result.meta);
        }
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Gagal memuat batch import.');
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
  }, [page, pageSize, search, category, status, reloadKey]);

  return {
    batches,
    meta,
    isLoading,
    error,
    refresh,
  };
}

export function useImportBatchDetail(batchId: string | null) {
  const [detail, setDetail] = useState<ImportBatchDetail | null>(null);
  const [errors, setErrors] = useState<ImportBatchError[]>([]);
  const [errorMeta, setErrorMeta] = useState<PaginationMeta>({
    total: 0,
    page: 1,
    pageSize: 10,
    totalPages: 1,
  });
  const [detailMeta, setDetailMeta] = useState<{
    sourceRows: PaginationMeta;
    auditTrail: PaginationMeta;
  }>({
    sourceRows: { total: 0, page: 1, pageSize: 10, totalPages: 1 },
    auditTrail: { total: 0, page: 1, pageSize: 5, totalPages: 1 },
  });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  const refresh = useCallback(() => {
    setReloadKey((value) => value + 1);
  }, []);
  const setSourcePage = useCallback(
    (page: number) =>
      setDetailMeta((current) => ({
        ...current,
        sourceRows: { ...current.sourceRows, page },
      })),
    []
  );
  const setAuditPage = useCallback(
    (page: number) =>
      setDetailMeta((current) => ({
        ...current,
        auditTrail: { ...current.auditTrail, page },
      })),
    []
  );
  const setErrorPage = useCallback(
    (page: number) =>
      setErrorMeta((current) => ({
        ...current,
        page,
      })),
    []
  );

  useEffect(() => {
    if (!batchId) {
      setDetail(null);
      setErrors([]);
      setErrorMeta({ total: 0, page: 1, pageSize: 10, totalPages: 1 });
      setDetailMeta({
        sourceRows: { total: 0, page: 1, pageSize: 10, totalPages: 1 },
        auditTrail: { total: 0, page: 1, pageSize: 5, totalPages: 1 },
      });
      setIsLoading(false);
      setError(null);
      return;
    }

    let cancelled = false;
    setIsLoading(true);
    setError(null);

    Promise.all([
      fetchImportBatchDetail(batchId, {
        sourcePage: detailMeta.sourceRows.page,
        sourcePageSize: detailMeta.sourceRows.pageSize,
        auditPage: detailMeta.auditTrail.page,
        auditPageSize: detailMeta.auditTrail.pageSize,
      }),
      fetchImportBatchErrors(batchId, {
        page: errorMeta.page,
        pageSize: errorMeta.pageSize,
      }),
    ])
      .then(([detailResult, errorResult]) => {
        if (!cancelled) {
          setDetail(detailResult.data);
          setDetailMeta(detailResult.meta);
          setErrors(errorResult.data);
          setErrorMeta(errorResult.meta);
        }
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Gagal memuat detail batch import.');
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
  }, [
    batchId,
    reloadKey,
    detailMeta.auditTrail.page,
    detailMeta.auditTrail.pageSize,
    detailMeta.sourceRows.page,
    detailMeta.sourceRows.pageSize,
    errorMeta.page,
    errorMeta.pageSize,
  ]);

  return {
    detail,
    errors,
    detailMeta,
    errorMeta,
    isLoading,
    error,
    refresh,
    setSourcePage,
    setAuditPage,
    setErrorPage,
  };
}
