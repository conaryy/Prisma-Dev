import { apiFetch } from './api';
import type {
  ImportBatchDetail,
  ImportBatchError,
  ImportBatchesResponse,
  ImportBatchSummary,
  LogbookCategory,
  LogbookEntryRecord,
  LogbookListResponse,
  PaginationMeta,
  PaginatedLogbookEntries,
  LogbookSummaryItem,
  TeknikEntryRecord,
  TowerOrAppEntryRecord,
  UnifiedLogbookEntry,
  SemanticSearchResponse,
} from '../types';

export const LOGBOOK_CATEGORIES: LogbookCategory[] = ['tower', 'app', 'teknik'];

export function isLogbookCategory(value: string | undefined): value is LogbookCategory {
  return LOGBOOK_CATEGORIES.includes((value ?? '').toLowerCase() as LogbookCategory);
}

export function getCategoryLabel(category: LogbookCategory | string | undefined) {
  const normalized = (category ?? '').toLowerCase();
  if (normalized === 'tower') return 'Tower';
  if (normalized === 'app') return 'App';
  if (normalized === 'teknik') return 'Teknik';
  return 'Logbook';
}

function formatDate(dateValue: string) {
  const match = dateValue.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) {
    return dateValue;
  }

  const [, yearText, monthText, dayText] = match;
  const year = Number.parseInt(yearText, 10);
  const month = Number.parseInt(monthText, 10);
  const day = Number.parseInt(dayText, 10);
  const monthLabel = new Intl.DateTimeFormat('id-ID', { month: 'short', timeZone: 'UTC' }).format(
    new Date(Date.UTC(year, month - 1, 1))
  );

  return `${String(day).padStart(2, '0')} ${monthLabel} ${year}`;
}

function toSortDate(dateValue: string, timeValue: string) {
  const dateMatch = dateValue.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  const timeMatch = (timeValue || '00:00').match(/^(\d{1,2}):(\d{2})$/);

  if (dateMatch) {
    const [, yearText, monthText, dayText] = dateMatch;
    const hours = timeMatch ? Number.parseInt(timeMatch[1], 10) : 0;
    const minutes = timeMatch ? Number.parseInt(timeMatch[2], 10) : 0;

    return new Date(
      Date.UTC(
        Number.parseInt(yearText, 10),
        Number.parseInt(monthText, 10) - 1,
        Number.parseInt(dayText, 10),
        hours,
        minutes
      )
    );
  }

  const date = new Date(dateValue);
  if (!Number.isNaN(date.getTime())) {
    return date;
  }

  return new Date(0);
}

function isTeknikEntryRecord(entry: LogbookEntryRecord): entry is TeknikEntryRecord {
  return 'equipment' in entry && 'incident' in entry;
}

function isTowerOrAppEntryRecord(entry: LogbookEntryRecord): entry is TowerOrAppEntryRecord {
  return 'operationType' in entry && 'facility' in entry;
}

export function toUnifiedLogbookEntry(
  category: LogbookCategory,
  entry: LogbookEntryRecord
): UnifiedLogbookEntry {
  if (category === 'teknik' && isTeknikEntryRecord(entry)) {
    return {
      id: entry.id,
      category,
      entryNo: entry.no,
      entryDate: entry.date,
      entryTime: entry.time,
      dateLabel: formatDate(entry.date),
      sortDate: toSortDate(entry.date, entry.time),
      title: entry.equipment,
      subtitle: entry.frequencyOrSection,
      description: entry.incident,
      searchText: `${entry.no} ${entry.date} ${entry.time} ${entry.equipment} ${entry.frequencyOrSection} ${entry.incident}`.toLowerCase(),
      detail: {
        equipment: entry.equipment,
        frequencySection: entry.frequencyOrSection,
        incident: entry.incident,
      },
    };
  }

  if (!isTowerOrAppEntryRecord(entry)) {
    throw new Error('Format data logbook tidak sesuai dengan kategori yang diminta.');
  }

  return {
    id: entry.id,
    category,
    entryNo: entry.no,
    entryDate: entry.date,
    entryTime: entry.time,
    dateLabel: formatDate(entry.date),
    sortDate: toSortDate(entry.date, entry.time),
    title: entry.operationType,
    subtitle: entry.facility,
    description: entry.description,
    searchText:
      `${entry.no} ${entry.date} ${entry.time} ${entry.operationType} ${entry.facility} ${entry.callSign} ${entry.description}`.toLowerCase(),
    detail: {
      operationType: entry.operationType,
      facility: entry.facility,
      callSign: entry.callSign,
      description: entry.description,
    },
  };
}

type FetchLogbookEntriesParams = {
  category: LogbookCategory;
  page?: number;
  pageSize?: number;
  search?: string;
  sort?: 'desc' | 'asc';
  year?: number | null;
  month?: number | null;
};

export async function fetchLogbookEntries({
  category,
  page = 1,
  pageSize = 20,
  search = '',
  sort = 'desc',
  year = null,
  month = null,
}: FetchLogbookEntriesParams): Promise<PaginatedLogbookEntries> {
  const params = new URLSearchParams({
    category,
    page: String(page),
    pageSize: String(pageSize),
    sort,
  });

  if (search.trim()) {
    params.set('search', search.trim());
  }
  if (year) {
    params.set('year', String(year));
  }
  if (month) {
    params.set('month', String(month));
  }

  const response = await apiFetch<LogbookListResponse>(`/logbook/entries?${params.toString()}`);

  return {
    entries: response.data.map((entry) => toUnifiedLogbookEntry(category, entry)),
    meta: response.meta,
  };
}

export async function fetchLogbookOverview() {
  const results = await Promise.all(
    LOGBOOK_CATEGORIES.map(async (category) => ({
      category,
      entries: (await fetchLogbookEntries({ category, page: 1, pageSize: 200 })).entries,
    }))
  );

  const summaries: LogbookSummaryItem[] = results.map(({ category, entries }) => ({
    category,
    label: getCategoryLabel(category),
    total: entries.length,
  }));

  const allEntries = results
    .flatMap((item) => item.entries)
    .sort((left, right) => right.sortDate.getTime() - left.sortDate.getTime());

  return {
    summaries,
    allEntries,
    totalEntries: allEntries.length,
  };
}

type SearchSemanticParams = {
  query: string;
  limit?: number;
  sourceType?: LogbookCategory;
  startDate?: string;
  endDate?: string;
};

export async function searchSemanticLogbook({
  query,
  limit = 8,
  sourceType,
  startDate,
  endDate,
}: SearchSemanticParams): Promise<SemanticSearchResponse> {
  return apiFetch<SemanticSearchResponse>('/logbook/search/semantic', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      query,
      limit,
      sourceType,
      startDate,
      endDate,
    }),
  });
}

export function getPeriodStart(period: 'hari' | 'minggu' | 'bulan' | 'tahun') {
  const now = new Date();
  const start = new Date(now);

  if (period === 'hari') {
    start.setHours(0, 0, 0, 0);
    return start;
  }

  if (period === 'minggu') {
    const day = start.getDay();
    const offset = day === 0 ? 6 : day - 1;
    start.setDate(start.getDate() - offset);
    start.setHours(0, 0, 0, 0);
    return start;
  }

  if (period === 'bulan') {
    start.setDate(1);
    start.setHours(0, 0, 0, 0);
    return start;
  }

  start.setMonth(0, 1);
  start.setHours(0, 0, 0, 0);
  return start;
}

export function groupEntriesForRekap(entries: UnifiedLogbookEntry[]) {
  const grouped = new Map<string, number>();

  for (const entry of entries) {
    const key = entry.title.trim() || 'Tanpa Kategori';
    grouped.set(key, (grouped.get(key) ?? 0) + 1);
  }

  return Array.from(grouped.entries())
    .map(([label, total]) => ({ label, total }))
    .sort((left, right) => right.total - left.total);
}

type FetchImportBatchesParams = {
  page?: number;
  pageSize?: number;
  search?: string;
  category?: LogbookCategory | null;
  status?: 'pending' | 'processing' | 'completed' | 'failed' | null;
};

export async function fetchImportBatches({
  page = 1,
  pageSize = 20,
  search = '',
  category = null,
  status = null,
}: FetchImportBatchesParams): Promise<ImportBatchesResponse> {
  const params = new URLSearchParams({
    page: String(page),
    pageSize: String(pageSize),
  });

  if (search.trim()) {
    params.set('search', search.trim());
  }
  if (category) {
    params.set('category', category);
  }
  if (status) {
    params.set('status', status);
  }

  return apiFetch<ImportBatchesResponse>(`/logbook/import-batches?${params.toString()}`);
}

export async function fetchImportBatchDetail(
  batchId: string,
  params?: {
    sourcePage?: number;
    sourcePageSize?: number;
    auditPage?: number;
    auditPageSize?: number;
  }
) {
  const searchParams = new URLSearchParams();
  if (params?.sourcePage) searchParams.set('sourcePage', String(params.sourcePage));
  if (params?.sourcePageSize) searchParams.set('sourcePageSize', String(params.sourcePageSize));
  if (params?.auditPage) searchParams.set('auditPage', String(params.auditPage));
  if (params?.auditPageSize) searchParams.set('auditPageSize', String(params.auditPageSize));

  const response = await apiFetch<{
    data: ImportBatchDetail;
    meta: {
      sourceRows: PaginationMeta;
      auditTrail: PaginationMeta;
    };
  }>(`/logbook/import-batches/${batchId}${searchParams.toString() ? `?${searchParams.toString()}` : ''}`);

  return response;
}

export async function fetchImportBatchErrors(
  batchId: string,
  params?: {
    page?: number;
    pageSize?: number;
  }
) {
  const searchParams = new URLSearchParams();
  if (params?.page) searchParams.set('page', String(params.page));
  if (params?.pageSize) searchParams.set('pageSize', String(params.pageSize));

  return apiFetch<{
    data: ImportBatchError[];
    meta: PaginationMeta;
  }>(`/logbook/import-batches/${batchId}/errors${searchParams.toString() ? `?${searchParams.toString()}` : ''}`);
}

export async function rollbackImportBatch(batchId: string) {
  const response = await apiFetch<{
    data: {
      batchId: string;
      isActive: boolean;
      replacedBatchId: string | null;
      sourceCategory: LogbookCategory;
      sourcePeriod: string | null;
    };
  }>(`/logbook/import-batches/${batchId}/rollback`, {
    method: 'POST',
  });
  return response.data;
}
