import { RefreshCw, Search } from 'lucide-react';
import type { ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

type SelfAssessmentWorkspaceProps = {
  outerIcon: ReactNode;
  outerTitle: string;
  outerContextLabel: string;
  outerCurrentLabel: string;
  headerAction?: ReactNode;
  innerIcon: ReactNode;
  innerTitle: string;
  innerDescription: string;
  innerBadge?: ReactNode;
  children: ReactNode;
};

export function SelfAssessmentWorkspace({
  outerIcon,
  outerTitle,
  outerContextLabel,
  outerCurrentLabel,
  headerAction,
  innerIcon,
  innerTitle,
  innerDescription,
  innerBadge,
  children,
}: SelfAssessmentWorkspaceProps) {
  return (
    <section className="overflow-hidden rounded-[28px] border border-slate-200/80 bg-white shadow-[0_24px_60px_rgba(15,23,42,0.08)] dark:border-slate-700/80 dark:bg-[#0b1736] dark:shadow-[0_24px_60px_rgba(2,8,28,0.55)]">
      <header className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-100 px-6 py-5 dark:border-slate-700">
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl border border-blue-200 bg-blue-50 text-blue-600 shadow-sm">
              {outerIcon}
            </span>
            <h1 className="text-lg font-semibold text-slate-800 dark:text-slate-100">
              {outerTitle}
            </h1>
          </div>
          <span className="hidden h-6 w-px bg-slate-200 dark:bg-slate-700 sm:block" />
          <div className="flex items-center gap-2 text-sm text-slate-500 dark:text-slate-300">
            <span>{outerContextLabel}</span>
            <span>/</span>
            <span className="font-semibold text-blue-600">{outerCurrentLabel}</span>
          </div>
        </div>
        {headerAction}
      </header>

      <div className="bg-blue-50/60 px-6 py-6 dark:bg-[#0d214f]">
        <section className="overflow-hidden rounded-2xl border border-blue-100/60 bg-white shadow-sm dark:border-slate-700 dark:bg-[#132754]">
          <div className="flex flex-wrap items-start justify-between gap-4 border-b border-slate-100 px-6 py-5 dark:border-slate-700">
            <div className="flex items-start gap-4">
              <span className="flex h-12 w-12 items-center justify-center rounded-full bg-blue-100 text-blue-600">
                {innerIcon}
              </span>
              <div className="space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="text-lg font-semibold text-slate-800 dark:text-slate-100">
                    {innerTitle}
                  </h2>
                  {innerBadge}
                </div>
                <p className="text-sm text-slate-500 dark:text-slate-300">
                  {innerDescription}
                </p>
              </div>
            </div>
          </div>

          {children}
        </section>
      </div>
    </section>
  );
}

type SelfAssessmentListToolbarProps = {
  children: ReactNode;
};

export function SelfAssessmentListToolbar({
  children,
}: SelfAssessmentListToolbarProps) {
  return <div className="flex flex-wrap items-center gap-4 px-6 py-5">{children}</div>;
}

type FilterOption = {
  value: string;
  label: string;
};

type SelfAssessmentListFiltersProps = {
  month: string;
  monthOptions: FilterOption[];
  onMonthChange: (value: string) => void;
  year: string;
  yearOptions: string[];
  onYearChange: (value: string) => void;
  searchText: string;
  onSearchTextChange: (value: string) => void;
  onSearch: () => void;
  onReset: () => void;
  placeholder?: string;
  leadingControls?: ReactNode;
  searchLabel?: string;
  resetLabel?: string;
  monthClassName?: string;
  yearClassName?: string;
};

export function SelfAssessmentListFilters({
  month,
  monthOptions,
  onMonthChange,
  year,
  yearOptions,
  onYearChange,
  searchText,
  onSearchTextChange,
  onSearch,
  onReset,
  placeholder = 'Cari area / ketua tim...',
  leadingControls,
  searchLabel = 'Search',
  resetLabel = 'Reset',
  monthClassName = 'h-11 w-full rounded-xl border border-input bg-white/80 px-4 text-sm text-slate-700 shadow-sm transition-colors placeholder:text-slate-400 focus:border-blue-300 focus:outline-none focus:ring-2 focus:ring-blue-200 dark:text-slate-100 sm:w-60',
  yearClassName = 'h-11 w-full rounded-xl border border-input bg-white/80 px-4 text-sm text-slate-700 shadow-sm transition-colors focus:border-blue-300 focus:outline-none focus:ring-2 focus:ring-blue-200 dark:text-slate-100 sm:w-32',
}: SelfAssessmentListFiltersProps) {
  return (
    <SelfAssessmentListToolbar>
      {leadingControls}
      <select
        className={monthClassName}
        value={month}
        onChange={(event) => onMonthChange(event.target.value)}
      >
        {monthOptions.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      <select
        className={yearClassName}
        value={year}
        onChange={(event) => onYearChange(event.target.value)}
      >
        {yearOptions.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
      <div className="relative min-w-0 flex-1 sm:min-w-[220px]">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400 dark:text-blue-200/70" />
        <Input
          value={searchText}
          onChange={(event) => onSearchTextChange(event.target.value)}
          className="h-11 rounded-xl border border-input bg-white/80 pl-9 text-slate-700 placeholder:text-slate-400 focus-visible:border-blue-300 focus-visible:ring-2 focus-visible:ring-blue-200 dark:text-slate-100"
          placeholder={placeholder}
        />
      </div>
      <Button
        type="button"
        className="h-11 rounded-xl bg-blue-500 px-5 text-white shadow-sm hover:bg-blue-600"
        onClick={onSearch}
      >
        <Search className="mr-2 h-4 w-4" />
        {searchLabel}
      </Button>
      <Button
        type="button"
        variant="outline"
        className="h-11 rounded-xl border-slate-200 px-4 text-slate-600 shadow-sm hover:border-blue-200 hover:bg-blue-50"
        onClick={onReset}
      >
        <RefreshCw className="mr-2 h-4 w-4" />
        {resetLabel}
      </Button>
    </SelfAssessmentListToolbar>
  );
}
