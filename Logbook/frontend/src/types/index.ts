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

export interface ImportBatchSummary {
  id: string;
  sourceCategory: LogbookCategory;
  sourcePeriod: string | null;
  reimportOfBatchId: string | null;
  isActive: boolean;
  sourceFileName: string;
  status: 'pending' | 'processing' | 'completed' | 'failed' | string;
  totalRows: number;
  validRows: number;
  invalidRows: number;
  sheetName: string | null;
  notes: string | null;
  importedBy: string | null;
  startedAt: string;
  completedAt: string | null;
}

export interface ImportBatchesResponse {
  data: ImportBatchSummary[];
  meta: {
    total: number;
    page: number;
    pageSize: number;
    totalPages: number;
    category: LogbookCategory | null;
    status: string | null;
    search: string;
  };
}

export interface ImportBatchError {
  id: string;
  rowNumber: number;
  fieldName: string;
  errorCode: string;
  errorMessage: string;
  rawPayload: string;
}

export interface ImportBatchDetail extends ImportBatchSummary {
  summary: {
    sourceRows: number;
    errorCount: number;
    recordCount: number;
    auditCount: number;
  };
  sampleSourceRows: Array<{
    rowNumber: number;
    rawDateValue: string | null;
    rawTimeValue: string | null;
    rawPayload: string;
    errorCount: number;
  }>;
  auditTrail: Array<{
    id: string;
    action: string;
    actorId: string;
    metadata: Record<string, unknown> | null;
    createdAt: string;
  }>;
}

export interface PaginationMeta {
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface SemanticSearchResult {
  sourceType: LogbookCategory;
  sourceId: string;
  entryNo: number;
  entryDate: string;
  entryTime: string;
  title: string;
  content: string;
  subtitle: string;
  score: number;
  semanticScore: number;
  lexicalBoost: number;
  queryMode: string;
  appliedFilters: {
    sourceType?: LogbookCategory;
    startDate?: string;
    endDate?: string;
  };
}

export interface SemanticSearchResponse {
  data: SemanticSearchResult[];
  meta: {
    limit: number;
    filters: {
      sourceType?: LogbookCategory;
      startDate?: string;
      endDate?: string;
    };
  };
}
