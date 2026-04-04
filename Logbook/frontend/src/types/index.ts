export interface MenuItem {
  id: string;
  label: string;
  icon?: string;
  submenu?: SubMenuItem[];
}

export interface SubMenuItem {
  id: string;
  label: string;
  path: string;
}

export interface LogbookEntry {
  id: string;
  date: string;
  time: string;
  activity: string;
  category: string;
  status: string;
  notes?: string;
}

export interface RekapData {
  category: string;
  total: number;
  completed: number;
  pending: number;
}

export type LogbookCategory = 'tower' | 'app' | 'teknik';

export type TowerOrAppEntryRecord = {
  id: string;
  no: number;
  date: string;
  time: string;
  operationType: string;
  facility: string;
  callSign: string;
  description: string;
  sourceType?: string;
};

export type TeknikEntryRecord = {
  id: string;
  no: number;
  date: string;
  time: string;
  equipment: string;
  frequencyOrSection: string;
  incident: string;
  sourceType?: string;
};

export type LogbookEntryRecord = TowerOrAppEntryRecord | TeknikEntryRecord;

export interface LogbookListResponse {
  data: LogbookEntryRecord[];
  meta: {
    category: string;
    total: number;
    page: number;
    pageSize: number;
    totalPages: number;
    search: string;
    sort: 'desc' | 'asc';
    year: number | null;
    month: number | null;
    availableYears: number[];
    availableMonths: number[];
  };
}

export interface PaginatedLogbookEntries {
  entries: UnifiedLogbookEntry[];
  meta: LogbookListResponse['meta'];
}

export interface UnifiedLogbookEntry {
  id: string;
  category: LogbookCategory;
  entryNo: number;
  entryDate: string;
  entryTime: string;
  dateLabel: string;
  sortDate: Date;
  title: string;
  subtitle: string;
  description: string;
  searchText: string;
  detail:
    | {
        operationType: string;
        facility: string;
        callSign: string;
        description: string;
      }
    | {
        equipment: string;
        frequencySection: string;
        incident: string;
      };
}

export interface LogbookSummaryItem {
  category: LogbookCategory;
  label: string;
  total: number;
}

export interface LogbookOverview {
  summaries: LogbookSummaryItem[];
  allEntries: UnifiedLogbookEntry[];
  totalEntries: number;
}
