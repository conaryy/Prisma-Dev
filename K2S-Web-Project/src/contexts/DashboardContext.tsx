import { createContext, useContext, useState, ReactNode } from 'react';
import { FilterState, HSECase } from '@/types/hse';
import { mockCases } from '@/data/mockData';

interface DashboardContextType {
  cases: HSECase[];
  filteredCases: HSECase[];
  filters: FilterState;
  setFilters: (filters: FilterState) => void;
  selectedCase: HSECase | null;
  setSelectedCase: (caseItem: HSECase | null) => void;
  drillDownFilter: Partial<FilterState> | null;
  setDrillDownFilter: (filter: Partial<FilterState> | null) => void;
  isDetailOpen: boolean;
  setIsDetailOpen: (open: boolean) => void;
  isFilterActive: boolean;
  resetFilters: () => void;
  lastUpdated: Date;
  refreshData: () => void;
}

const DashboardContext = createContext<DashboardContextType | undefined>(undefined);

const initialFilters: FilterState = {
  dateRange: { from: undefined, to: undefined },
  branches: [],
  locations: [],
  categories: [],
  statuses: [],
  pics: [],
  search: '',
};

export function DashboardProvider({ children }: { children: ReactNode }) {
  const [cases] = useState<HSECase[]>(mockCases);
  const [filters, setFilters] = useState<FilterState>(initialFilters);
  const [selectedCase, setSelectedCase] = useState<HSECase | null>(null);
  const [drillDownFilter, setDrillDownFilter] = useState<Partial<FilterState> | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [lastUpdated, setLastUpdated] = useState(new Date());

  const applyFilters = (casesToFilter: HSECase[], activeFilters: FilterState) => {
    return casesToFilter.filter((caseItem) => {
      if (activeFilters.dateRange.from && activeFilters.dateRange.to) {
        const caseDate = new Date(caseItem.reportedDate);
        if (caseDate < activeFilters.dateRange.from || caseDate > activeFilters.dateRange.to) {
          return false;
        }
      }

      if (activeFilters.branches.length > 0 && !activeFilters.branches.includes(caseItem.branch)) {
        return false;
      }

      if (activeFilters.locations.length > 0 && !activeFilters.locations.includes(caseItem.location)) {
        return false;
      }

      if (activeFilters.categories.length > 0 && !activeFilters.categories.includes(caseItem.category)) {
        return false;
      }

      if (activeFilters.statuses.length > 0 && !activeFilters.statuses.includes(caseItem.status)) {
        return false;
      }

      if (activeFilters.pics.length > 0 && !activeFilters.pics.includes(caseItem.assignedTo)) {
        return false;
      }

      if (activeFilters.search) {
        const searchLower = activeFilters.search.toLowerCase();
        const searchable = [
          caseItem.caseNumber,
          caseItem.title,
          caseItem.description,
          caseItem.reportedBy,
          caseItem.assignedTo,
        ]
          .join(' ')
          .toLowerCase();
        if (!searchable.includes(searchLower)) {
          return false;
        }
      }

      return true;
    });
  };

  const mergedFilters = drillDownFilter ? { ...filters, ...drillDownFilter } : filters;
  const filteredCases = applyFilters(cases, mergedFilters);

  const isFilterActive =
    filters.branches.length > 0 ||
    filters.locations.length > 0 ||
    filters.categories.length > 0 ||
    filters.statuses.length > 0 ||
    filters.pics.length > 0 ||
    filters.search !== '' ||
    filters.dateRange.from !== undefined ||
    filters.dateRange.to !== undefined ||
    drillDownFilter !== null;

  const resetFilters = () => {
    setFilters(initialFilters);
    setDrillDownFilter(null);
  };

  const refreshData = () => {
    setLastUpdated(new Date());
  };

  return (
    <DashboardContext.Provider
      value={{
        cases,
        filteredCases,
        filters,
        setFilters,
        selectedCase,
        setSelectedCase,
        drillDownFilter,
        setDrillDownFilter,
        isDetailOpen,
        setIsDetailOpen,
        isFilterActive,
        resetFilters,
        lastUpdated,
        refreshData,
      }}
    >
      {children}
    </DashboardContext.Provider>
  );
}

export function useDashboard() {
  const context = useContext(DashboardContext);
  if (context === undefined) {
    throw new Error('useDashboard must be used within a DashboardProvider');
  }
  return context;
}
