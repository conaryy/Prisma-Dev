import { apiFetch } from './api';
import type {
  LogbookCategory,
  LogbookEntryRecord,
  LogbookListResponse,
  LogbookSummaryItem,
  TeknikEntryRecord,
  TowerOrAppEntryRecord,
  UnifiedLogbookEntry,
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
  const date = new Date(dateValue);
  if (Number.isNaN(date.getTime())) {
    return dateValue;
  }

  return new Intl.DateTimeFormat('id-ID', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(date);
}

function toSortDate(dateValue: string, timeValue: string) {
  const combined = new Date(`${dateValue}T${timeValue}`);
  if (!Number.isNaN(combined.getTime())) {
    return combined;
  }

  const date = new Date(dateValue);
  if (!Number.isNaN(date.getTime())) {
    return date;
  }

  return new Date(0);
}

function isTeknikEntryRecord(entry: LogbookEntryRecord): entry is TeknikEntryRecord {
  return 'equipment' in entry;
}

function isTowerOrAppEntryRecord(entry: LogbookEntryRecord): entry is TowerOrAppEntryRecord {
  return 'operationType' in entry;
}

export function toUnifiedLogbookEntry(
  category: LogbookCategory,
  entry: LogbookEntryRecord
): UnifiedLogbookEntry {
  if (category === 'teknik' && isTeknikEntryRecord(entry)) {
    return {
      id: entry.id,
      category,
      entryNo: entry.entryNo,
      entryDate: entry.entryDate,
      entryTime: entry.entryTime,
      dateLabel: formatDate(entry.entryDate),
      sortDate: toSortDate(entry.entryDate, entry.entryTime),
      title: entry.equipment,
      subtitle: entry.frequencySection,
      description: entry.incident,
      searchText: `${entry.equipment} ${entry.frequencySection} ${entry.incident}`.toLowerCase(),
      detail: {
        equipment: entry.equipment,
        frequencySection: entry.frequencySection,
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
    entryNo: entry.entryNo,
    entryDate: entry.entryDate,
    entryTime: entry.entryTime,
    dateLabel: formatDate(entry.entryDate),
    sortDate: toSortDate(entry.entryDate, entry.entryTime),
    title: entry.operationType,
    subtitle: entry.facility,
    description: entry.description,
    searchText:
      `${entry.operationType} ${entry.facility} ${entry.callSign} ${entry.description}`.toLowerCase(),
    detail: {
      operationType: entry.operationType,
      facility: entry.facility,
      callSign: entry.callSign,
      description: entry.description,
    },
  };
}

export async function fetchLogbookEntries(category: LogbookCategory, limit = 500) {
  const response = await apiFetch<LogbookListResponse>(`/logbook/entries?category=${category}&limit=${limit}`);
  return response.data.map((entry) => toUnifiedLogbookEntry(category, entry));
}

export async function fetchLogbookOverview() {
  const results = await Promise.all(
    LOGBOOK_CATEGORIES.map(async (category) => ({
      category,
      entries: await fetchLogbookEntries(category, 200),
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
