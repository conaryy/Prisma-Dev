import { useEffect, useRef, useState } from 'react';
import { ArrowDownAZ, ArrowUpZA, ChevronDown, Plus, Search, Trash2 } from 'lucide-react';
import { useParams } from 'react-router-dom';
import GlassCard from '../components/ui/GlassCard';
import { invalidateLogbookData, useLogbookEntries, useSemanticSearch } from '../hooks/useLogbookEntries';
import { apiDelete, apiUploadForm } from '../lib/api';
import { getCategoryLabel, isLogbookCategory } from '../lib/logbook';
import type { LogbookCategory } from '../types';

const PAGE_SIZE = 20;
const MONTH_OPTIONS = [
  { value: 1, label: 'Januari' },
  { value: 2, label: 'Februari' },
  { value: 3, label: 'Maret' },
  { value: 4, label: 'April' },
  { value: 5, label: 'Mei' },
  { value: 6, label: 'Juni' },
  { value: 7, label: 'Juli' },
  { value: 8, label: 'Agustus' },
  { value: 9, label: 'September' },
  { value: 10, label: 'Oktober' },
  { value: 11, label: 'November' },
  { value: 12, label: 'Desember' },
] as const;

type TeknikImportResponse = {
  message: string;
  data:
    | {
        batchId: string;
        category: string;
        sheetName: string;
        sourceFileName: string;
        sourcePeriod: string | null;
        reimportOfBatchId?: string | null;
        isActive?: boolean;
        totalRows: number;
        validRows: number;
        invalidRows: number;
        insertedRows: number;
      }
    | {
        mode: 'auto';
        category: string;
        sheetName: string;
        sourceFileName: string;
        createdBatches: Array<{
          batchId: string;
          sourcePeriod: string | null;
          insertedRows: number;
          totalRows: number;
          invalidRows: number;
        }>;
        skippedPeriods: string[];
        discoveredPeriods: string[];
        unassignedRows: number;
        totalRows: number;
      };
};

type LogbookImportResponse = TeknikImportResponse;

type FilterOption = {
  value: number | '';
  label: string;
};

type UploadIntent = 'new' | 'revision';
type ViewMode = 'table' | 'search';

type SingleImportData = Extract<
  TeknikImportResponse['data'],
  {
    batchId: string;
  }
>;

type AutoImportData = Extract<
  TeknikImportResponse['data'],
  {
    mode: 'auto';
  }
>;

type FilterDropdownProps = {
  value: number | null;
  placeholder: string;
  options: FilterOption[];
  minWidthClassName: string;
  onChange: (value: number | null) => void;
};

function FilterDropdown({
  value,
  placeholder,
  options,
  minWidthClassName,
  onChange,
}: FilterDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const selectedLabel =
    options.find((option) => option.value !== '' && option.value === value)?.label ?? placeholder;

  useEffect(() => {
    function handleOutside(event: MouseEvent) {
      if (!containerRef.current?.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    function handleEscape(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setIsOpen(false);
      }
    }

    document.addEventListener('mousedown', handleOutside);
    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('mousedown', handleOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, []);

  return (
    <div ref={containerRef} className={`relative ${minWidthClassName}`}>
      <button
        type="button"
        onClick={() => setIsOpen((open) => !open)}
        className="theme-control flex w-full items-center justify-between rounded-lg px-4 py-3 text-left transition-all duration-300"
        aria-haspopup="listbox"
        aria-expanded={isOpen}
      >
        <span className="truncate">{selectedLabel}</span>
        <ChevronDown
          className={`h-4 w-4 shrink-0 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}
          style={{ color: 'var(--text-muted)' }}
        />
      </button>

      {isOpen && (
        <div
          className="absolute left-0 right-0 top-[calc(100%+0.4rem)] z-30 max-h-72 overflow-y-auto rounded-xl border py-2 shadow-2xl backdrop-blur-xl"
          style={{
            background: 'linear-gradient(180deg, rgba(36, 20, 81, 0.98) 0%, rgba(24, 14, 54, 0.98) 100%)',
            borderColor: 'rgba(196, 181, 253, 0.24)',
            boxShadow: '0 22px 50px rgba(8, 6, 24, 0.55)',
          }}
          role="listbox"
        >
          <button
            type="button"
            onClick={() => {
              onChange(null);
              setIsOpen(false);
            }}
            className="flex w-full items-center px-4 py-2.5 text-left text-sm transition-colors duration-200"
            style={{
              color: value === null ? '#f5e8ff' : 'rgba(248, 250, 252, 0.92)',
              background: value === null ? 'rgba(168, 85, 247, 0.26)' : 'transparent',
            }}
          >
            {placeholder}
          </button>

          {options
            .filter((option) => option.value !== '')
            .map((option) => {
              const isSelected = option.value === value;
              return (
                <button
                  key={String(option.value)}
                  type="button"
                  onClick={() => {
                    onChange(typeof option.value === 'number' ? option.value : null);
                    setIsOpen(false);
                  }}
                  className="flex w-full items-center px-4 py-2.5 text-left text-sm transition-colors duration-200"
                  style={{
                    color: isSelected ? '#f5e8ff' : 'rgba(248, 250, 252, 0.92)',
                    background: isSelected ? 'rgba(168, 85, 247, 0.26)' : 'transparent',
                  }}
                  role="option"
                  aria-selected={isSelected}
                >
                  {option.label}
                </button>
              );
            })}
        </div>
      )}
    </div>
  );
}

function buildSourcePeriod(year: number | null, month: number | null) {
  if (!year || !month) {
    return null;
  }

  return `${year}-${String(month).padStart(2, '0')}`;
}

function isAutoImportData(data: TeknikImportResponse['data']): data is AutoImportData {
  return 'mode' in data && data.mode === 'auto';
}

function formatSemanticDateRange(year: number | null, month: number | null) {
  if (!year) {
    return {};
  }

  const monthValue = month ?? null;
  const startDate = `${year}-${String(monthValue ?? 1).padStart(2, '0')}-01`;
  const endDate = `${year}-${String(monthValue ?? 12).padStart(2, '0')}-31`;

  return { startDate, endDate };
}

export default function LogbookHarian() {
  const { category } = useParams<{ category: string }>();
  const [sortOrder, setSortOrder] = useState<'desc' | 'asc'>('desc');
  const [selectedYear, setSelectedYear] = useState<number | null>(null);
  const [selectedMonth, setSelectedMonth] = useState<number | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState('');
  const [viewMode, setViewMode] = useState<ViewMode>('table');
  const [semanticQuery, setSemanticQuery] = useState('');
  const [debouncedSemanticQuery, setDebouncedSemanticQuery] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [uploadMessage, setUploadMessage] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploadYear, setUploadYear] = useState<number | null>(null);
  const [uploadMonth, setUploadMonth] = useState<number | null>(null);
  const [uploadIntent, setUploadIntent] = useState<UploadIntent>('new');
  const [isRevisionMode, setIsRevisionMode] = useState(false);
  const [deleteMessage, setDeleteMessage] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const normalizedCategory = (category ?? '').toLowerCase();
  const activeCategory = (isLogbookCategory(normalizedCategory) ? normalizedCategory : null) as LogbookCategory | null;
  const categoryName = getCategoryLabel(activeCategory ?? category);
  const isTeknik = activeCategory === 'teknik';
  const isApp = activeCategory === 'app';
  const isTower = activeCategory === 'tower';
  const canImportExcel = isTeknik || isApp || isTower;
  const { entries, meta, isLoading, error, refresh } = useLogbookEntries({
    category: activeCategory,
    page: currentPage,
    pageSize: PAGE_SIZE,
    search: debouncedSearchTerm,
    sort: sortOrder,
    year: selectedYear,
    month: selectedMonth,
  });
  const { startDate: semanticStartDate, endDate: semanticEndDate } = formatSemanticDateRange(
    selectedYear,
    selectedMonth
  );
  const {
    results: semanticResults,
    isLoading: isSemanticLoading,
    error: semanticError,
  } = useSemanticSearch({
    query: debouncedSemanticQuery,
    sourceType: activeCategory,
    startDate: semanticStartDate,
    endDate: semanticEndDate,
    enabled: viewMode === 'search' && Boolean(activeCategory),
  });
  const yearOptions: FilterOption[] = meta.availableYears.map((year) => ({
    value: year,
    label: String(year),
  }));
  const monthOptions: FilterOption[] = MONTH_OPTIONS.filter((month) =>
    meta.availableMonths.includes(month.value)
  ).map((month) => ({
    value: month.value,
    label: month.label,
  }));
  const currentYear = new Date().getFullYear();
  const uploadYearOptions: FilterOption[] = Array.from({ length: 7 }, (_, index) => {
    const year = currentYear - 3 + index;
    return {
      value: year,
      label: String(year),
    };
  }).reverse();
  const totalPages = Math.max(1, meta.totalPages || 1);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      setDebouncedSearchTerm(searchTerm.trim());
    }, 400);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [searchTerm]);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      setDebouncedSemanticQuery(semanticQuery.trim());
    }, 400);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [semanticQuery]);

  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, totalPages]);

  useEffect(() => {
    setCurrentPage(1);
  }, [debouncedSearchTerm, activeCategory, sortOrder, selectedYear, selectedMonth]);

  useEffect(() => {
    setSearchTerm('');
    setDebouncedSearchTerm('');
    setSemanticQuery('');
    setDebouncedSemanticQuery('');
    setViewMode('table');
    setSelectedYear(null);
    setSelectedMonth(null);
    setSortOrder('desc');
    setCurrentPage(1);
    setUploadMessage(null);
    setUploadError(null);
    setUploadYear(null);
    setUploadMonth(null);
    setUploadIntent('new');
    setIsRevisionMode(false);
    setDeleteMessage(null);
    setDeleteError(null);
    refresh();
  }, [activeCategory, refresh]);

  useEffect(() => {
    if (selectedYear && meta.availableYears.length > 0 && !meta.availableYears.includes(selectedYear)) {
      setSelectedYear(null);
    }
  }, [meta.availableYears, selectedYear]);

  useEffect(() => {
    if (selectedMonth && meta.availableMonths.length > 0 && !meta.availableMonths.includes(selectedMonth)) {
      setSelectedMonth(null);
    }
  }, [meta.availableMonths, selectedMonth]);

  const handleImportClick = (intent: UploadIntent) => {
    if (!canImportExcel || isUploading) {
      return;
    }

    if (intent === 'revision' && (!uploadYear || !uploadMonth)) {
      setUploadError(
        'Pilih tahun dan bulan yang direvisi sebelum mengunggah file.'
      );
      setUploadMessage(null);
      return;
    }

    setUploadIntent(intent);
    fileInputRef.current?.click();
  };

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';

    if (!file || !canImportExcel || !activeCategory) {
      return;
    }

    if (!file.name.toLowerCase().endsWith('.xlsx')) {
      setUploadError('File yang dipilih harus berformat .xlsx');
      setUploadMessage(null);
      return;
    }

    const formData = new FormData();
    formData.append('file', file);
    if (uploadIntent === 'revision') {
      const sourcePeriod = buildSourcePeriod(uploadYear, uploadMonth);
      if (!sourcePeriod) {
        setUploadError('Periode revisi belum lengkap. Pilih tahun dan bulan terlebih dahulu.');
        setUploadMessage(null);
        return;
      }

      formData.append('sourcePeriod', sourcePeriod);
      formData.append('allowReimport', 'true');
    }

    setIsUploading(true);
    setUploadError(null);
    setUploadMessage(null);
    setDeleteMessage(null);
    setDeleteError(null);

    try {
      const importPath =
        activeCategory === 'app'
          ? '/logbook/import/app'
          : activeCategory === 'tower'
            ? '/logbook/import/tower'
            : '/logbook/import/teknik';
      const result = await apiUploadForm<LogbookImportResponse>(importPath, formData);
      invalidateLogbookData();
      if (isAutoImportData(result.data)) {
        const createdPeriods = result.data.createdBatches
          .map((batch) => batch.sourcePeriod)
          .filter((value): value is string => Boolean(value));
        const createdSummary =
          createdPeriods.length > 0
            ? `Periode baru yang dibuat: ${createdPeriods.join(', ')}.`
            : 'Tidak ada periode baru yang dibuat.';
        const skippedSummary =
          result.data.skippedPeriods.length > 0
            ? ` Dilewati karena sudah ada: ${result.data.skippedPeriods.join(', ')}.`
            : '';
        const unassignedSummary =
          result.data.unassignedRows > 0
            ? ` ${result.data.unassignedRows} baris tidak memiliki periode yang bisa dideteksi otomatis.`
            : '';

        setUploadMessage(
          `Tambah data baru selesai. ${result.data.createdBatches.length} batch dibuat dari ${result.data.discoveredPeriods.length} periode yang terdeteksi pada sheet ${result.data.sheetName}. ${createdSummary}${skippedSummary}${unassignedSummary}`
        );
      } else {
        const singleResult: SingleImportData = result.data;
        setUploadMessage(
          singleResult.reimportOfBatchId
            ? `Upload revisi berhasil: batch baru aktif dan menggantikan batch ${singleResult.reimportOfBatchId}. ${singleResult.insertedRows} baris masuk dari ${singleResult.totalRows} baris pada sheet ${singleResult.sheetName}.`
            : `Tambah data baru berhasil: ${singleResult.insertedRows} baris masuk dari ${singleResult.totalRows} baris pada sheet ${singleResult.sheetName}.`
        );
      }
      setCurrentPage(1);
      refresh();
    } catch (err: unknown) {
      setUploadError(
        err instanceof Error ? err.message : `Gagal mengimpor file Logbook ${categoryName}.`
      );
    } finally {
      setIsUploading(false);
    }
  };

  const handleDeleteAll = async () => {
    if (isDeleting) {
      return;
    }

    const confirmed = window.confirm(
      'Tindakan ini akan menghapus semua data logbook yang ada di database. Lanjutkan?'
    );
    if (!confirmed) {
      return;
    }

    setIsDeleting(true);
    setDeleteError(null);
    setDeleteMessage(null);
    setUploadMessage(null);
    setUploadError(null);

    try {
      const result = await apiDelete<{ message: string }>('/logbook/purge');
      invalidateLogbookData();
      setDeleteMessage(result.message || 'Seluruh data logbook berhasil dihapus.');
      setCurrentPage(1);
      refresh();
    } catch (err: unknown) {
      setDeleteError(err instanceof Error ? err.message : 'Gagal menghapus seluruh data logbook.');
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <h1 className="theme-page-title mb-2 text-3xl font-bold">Logbook - {categoryName}</h1>
          <p className="theme-page-subtitle">Data logbook hasil import yang tersimpan di database</p>
        </div>
        <div className="xl:min-w-[500px] xl:max-w-[620px]">
          <input
            ref={fileInputRef}
            type="file"
            accept=".xlsx"
            className="hidden"
            onChange={handleFileChange}
          />
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-end">
            {isRevisionMode ? (
              <div className="grid gap-3 sm:grid-cols-2 lg:w-[320px]">
                <FilterDropdown
                  value={uploadYear}
                  placeholder="Tahun"
                  options={uploadYearOptions}
                  minWidthClassName="min-w-0"
                  onChange={setUploadYear}
                />
                <FilterDropdown
                  value={uploadMonth}
                  placeholder="Bulan"
                  options={MONTH_OPTIONS.map((month) => ({
                    value: month.value,
                    label: month.label,
                  }))}
                  minWidthClassName="min-w-0"
                  onChange={setUploadMonth}
                />
              </div>
            ) : null}

            <div className="flex gap-3 lg:shrink-0">
              <button
                type="button"
                onClick={() => {
                  if (isUploading) {
                    return;
                  }

                  if (!isRevisionMode) {
                    setIsRevisionMode(true);
                    setUploadIntent('revision');
                    setUploadError(null);
                    setUploadMessage(null);
                    return;
                  }

                  handleImportClick('revision');
                }}
                disabled={!canImportExcel || isUploading}
                className={`flex items-center justify-center gap-2 rounded-xl border px-5 py-3 font-medium transition-all duration-300 ${
                  canImportExcel && !isUploading ? '' : 'cursor-not-allowed opacity-70'
                }`}
                style={
                  canImportExcel && !isUploading
                    ? isRevisionMode
                      ? {
                          background: 'var(--surface-soft)',
                          borderColor: 'var(--border-strong)',
                          color: 'var(--text-primary)',
                        }
                      : {
                          background: 'var(--surface-card)',
                          borderColor: 'var(--border-soft)',
                          color: 'var(--text-primary)',
                        }
                    : {
                        background: 'var(--surface-soft)',
                        borderColor: 'var(--border-soft)',
                        color: 'var(--text-muted)',
                      }
                }
              >
                <Plus className="h-5 w-5" />
                {isUploading && uploadIntent === 'revision'
                  ? 'Mengunggah...'
                  : isRevisionMode
                    ? 'Upload Revisi'
                    : 'Revisi'}
              </button>

              <button
                type="button"
                onClick={() => {
                  setIsRevisionMode(false);
                  handleImportClick('new');
                }}
                disabled={!canImportExcel || isUploading}
                className={`flex items-center justify-center gap-2 rounded-xl border px-5 py-3 font-medium transition-all duration-300 ${
                  canImportExcel && !isUploading
                    ? 'theme-primary-button'
                    : 'cursor-not-allowed opacity-70'
                }`}
                style={
                  canImportExcel && !isUploading
                    ? undefined
                    : {
                        background: 'color-mix(in srgb, var(--accent) 70%, transparent 30%)',
                        borderColor: 'var(--border-soft)',
                        color: 'var(--accent-text)',
                      }
                }
              >
                <Plus className="h-5 w-5" />
                {isUploading && uploadIntent === 'new' ? 'Mengunggah...' : 'Tambah Data'}
              </button>
            </div>
          </div>
        </div>
      </div>

      {(uploadMessage || uploadError || deleteMessage || deleteError) && (
        <GlassCard className="p-4">
          {uploadMessage ? (
            <p className="break-words text-sm leading-6" style={{ color: 'var(--success-text)' }}>
              {uploadMessage}
            </p>
          ) : null}
          {uploadError ? <p className="text-sm text-red-300">{uploadError}</p> : null}
          {deleteMessage ? <p className="text-sm" style={{ color: 'var(--success-text)' }}>{deleteMessage}</p> : null}
          {deleteError ? <p className="text-sm text-red-300">{deleteError}</p> : null}
        </GlassCard>
      )}

      <GlassCard className="p-4 lg:p-6">
        <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="theme-soft-panel inline-flex items-center gap-1 rounded-xl p-1">
            <button
              type="button"
              onClick={() => setViewMode('table')}
              className={`rounded-lg px-4 py-2 text-sm font-medium transition-all duration-300 ${
                viewMode === 'table' ? 'theme-primary-button shadow-lg' : ''
              }`}
              style={viewMode === 'table' ? undefined : { color: 'var(--text-secondary)' }}
            >
              Tabel
            </button>
            <button
              type="button"
              onClick={() => setViewMode('search')}
              className={`rounded-lg px-4 py-2 text-sm font-medium transition-all duration-300 ${
                viewMode === 'search' ? 'theme-primary-button shadow-lg' : ''
              }`}
              style={viewMode === 'search' ? undefined : { color: 'var(--text-secondary)' }}
            >
              Cari Cepat
            </button>
          </div>
          {viewMode === 'search' ? (
            <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
              Hasil memakai ranking hybrid semantic dan lexical.
            </p>
          ) : null}
        </div>

        <div className="flex flex-col sm:flex-row gap-3 mb-6">
          <FilterDropdown
            value={selectedYear}
            placeholder="Semua Tahun"
            options={yearOptions}
            minWidthClassName="min-w-[140px]"
            onChange={setSelectedYear}
          />
          <FilterDropdown
            value={selectedMonth}
            placeholder="Semua Bulan"
            options={monthOptions}
            minWidthClassName="min-w-[150px]"
            onChange={setSelectedMonth}
          />
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5" style={{ color: 'var(--text-muted)' }} />
            <input
              type="text"
              placeholder={
                viewMode === 'search'
                  ? isTeknik
                    ? 'Cari kejadian, equipment, atau bagian...'
                    : 'Cari kejadian, facility, call sign, atau operasi...'
                  : isTeknik
                    ? 'Cari peralatan, freq, atau kejadian...'
                    : 'Cari operation type, facility, call sign, atau keterangan...'
              }
              value={viewMode === 'search' ? semanticQuery : searchTerm}
              onChange={(event) =>
                viewMode === 'search'
                  ? setSemanticQuery(event.target.value)
                  : setSearchTerm(event.target.value)
              }
              className="theme-control w-full rounded-lg py-3 pl-10 pr-4 transition-all duration-300"
            />
          </div>
          {viewMode === 'table' ? (
            <>
              <div className="theme-soft-panel flex items-center gap-1 rounded-xl p-1">
                <button
                  type="button"
                  onClick={() => setSortOrder('desc')}
                  className={`px-3 py-2 rounded-lg text-sm font-medium flex items-center gap-2 transition-all duration-300 ${
                    sortOrder === 'desc' ? 'theme-primary-button shadow-lg' : ''
                  }`}
                  style={sortOrder === 'desc' ? undefined : { color: 'var(--text-secondary)' }}
                >
                  <ArrowDownAZ className="w-4 h-4" />
                  Terbaru
                </button>
                <button
                  type="button"
                  onClick={() => setSortOrder('asc')}
                  className={`px-3 py-2 rounded-lg text-sm font-medium flex items-center gap-2 transition-all duration-300 ${
                    sortOrder === 'asc' ? 'theme-primary-button shadow-lg' : ''
                  }`}
                  style={sortOrder === 'asc' ? undefined : { color: 'var(--text-secondary)' }}
                >
                  <ArrowUpZA className="w-4 h-4" />
                  Terlama
                </button>
              </div>
              <button
                type="button"
                onClick={handleDeleteAll}
                disabled={isDeleting}
                className={`theme-danger-button flex items-center justify-center gap-2 rounded-lg border px-4 py-3 transition-all duration-300 ${
                  isDeleting ? 'cursor-not-allowed opacity-70' : ''
                }`}
              >
                <Trash2 className="w-5 h-5" />
                <span className="hidden sm:inline">
                  {isDeleting ? 'Menghapus...' : 'Hapus Semua Data'}
                </span>
              </button>
            </>
          ) : null}
        </div>

        {viewMode === 'table' ? (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[860px]">
              <thead>
                <tr className="border-b border-violet-300/18">
                  {isTeknik ? (
                    <>
                      <th className="px-4 py-3 text-left text-sm font-medium" style={{ color: 'var(--text-muted)' }}>NO</th>
                      <th className="px-4 py-3 text-left text-sm font-medium" style={{ color: 'var(--text-muted)' }}>TANGGAL</th>
                      <th className="px-4 py-3 text-left text-sm font-medium" style={{ color: 'var(--text-muted)' }}>JAM</th>
                      <th className="px-4 py-3 text-left text-sm font-medium" style={{ color: 'var(--text-muted)' }}>Peralatan</th>
                      <th className="px-4 py-3 text-left text-sm font-medium" style={{ color: 'var(--text-muted)' }}>Freq / Bagian</th>
                      <th className="px-4 py-3 text-left text-sm font-medium" style={{ color: 'var(--text-muted)' }}>Kejadian</th>
                    </>
                  ) : (
                    <>
                      <th className="px-4 py-3 text-left text-sm font-medium" style={{ color: 'var(--text-muted)' }}>No.</th>
                      <th className="px-4 py-3 text-left text-sm font-medium" style={{ color: 'var(--text-muted)' }}>Tanggal</th>
                      <th className="px-4 py-3 text-left text-sm font-medium" style={{ color: 'var(--text-muted)' }}>Jam</th>
                      <th className="px-4 py-3 text-left text-sm font-medium" style={{ color: 'var(--text-muted)' }}>Operation Type</th>
                      <th className="px-4 py-3 text-left text-sm font-medium" style={{ color: 'var(--text-muted)' }}>Facility</th>
                      <th className="px-4 py-3 text-left text-sm font-medium" style={{ color: 'var(--text-muted)' }}>Call Sign</th>
                      <th className="px-4 py-3 text-left text-sm font-medium" style={{ color: 'var(--text-muted)' }}>Keterangan</th>
                    </>
                  )}
                </tr>
              </thead>
              <tbody>
                {entries.map((entry) =>
                  isTeknik ? (
                    <tr key={entry.id} className="theme-data-row transition-colors duration-200">
                      <td className="px-4 py-4 text-sm" style={{ color: 'var(--text-secondary)' }}>{entry.entryNo}</td>
                      <td className="px-4 py-4 text-sm" style={{ color: 'var(--text-secondary)' }}>{entry.dateLabel}</td>
                      <td className="px-4 py-4 text-sm" style={{ color: 'var(--text-secondary)' }}>{entry.entryTime}</td>
                      <td className="px-4 py-4 font-medium theme-page-title">{entry.title}</td>
                      <td className="px-4 py-4 text-sm" style={{ color: 'var(--text-secondary)' }}>{entry.subtitle}</td>
                      <td className="px-4 py-4 text-sm" style={{ color: 'var(--text-secondary)' }}>{entry.description}</td>
                    </tr>
                  ) : (
                    <tr key={entry.id} className="theme-data-row transition-colors duration-200">
                      <td className="px-4 py-4 text-sm" style={{ color: 'var(--text-secondary)' }}>{entry.entryNo}</td>
                      <td className="px-4 py-4 text-sm" style={{ color: 'var(--text-secondary)' }}>{entry.dateLabel}</td>
                      <td className="px-4 py-4 text-sm" style={{ color: 'var(--text-secondary)' }}>{entry.entryTime}</td>
                      <td className="px-4 py-4 font-medium theme-page-title">{entry.title}</td>
                      <td className="px-4 py-4 text-sm" style={{ color: 'var(--text-secondary)' }}>{entry.subtitle}</td>
                      <td className="px-4 py-4 text-sm" style={{ color: 'var(--text-secondary)' }}>
                        {'callSign' in entry.detail ? entry.detail.callSign : '-'}
                      </td>
                      <td className="px-4 py-4 text-sm" style={{ color: 'var(--text-secondary)' }}>{entry.description}</td>
                    </tr>
                  )
                )}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="space-y-4">
            {!debouncedSemanticQuery ? (
              <div className="py-10 text-center">
                <p style={{ color: 'var(--text-muted)' }}>
                  Ketik kata kunci untuk mencari kejadian, facility, call sign, equipment, atau insiden.
                </p>
              </div>
            ) : null}

            {semanticResults.map((result) => (
              <div
                key={`${result.sourceType}:${result.sourceId}`}
                className="rounded-2xl border p-5"
                style={{
                  background: 'color-mix(in srgb, var(--surface-card) 88%, transparent 12%)',
                  borderColor: 'var(--border-soft)',
                }}
              >
                <div className="mb-3 flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                  <div>
                    <p className="theme-page-title text-lg font-semibold">{result.title}</p>
                    <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                      {result.sourceType.toUpperCase()} • {result.entryDate} • {result.entryTime}
                      {result.subtitle ? ` • ${result.subtitle}` : ''}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 text-xs">
                    <span
                      className="rounded-full border px-3 py-1"
                      style={{
                        borderColor: 'var(--border-soft)',
                        color: 'var(--text-secondary)',
                      }}
                    >
                      score {result.score.toFixed(3)}
                    </span>
                    <span
                      className="rounded-full border px-3 py-1"
                      style={{
                        borderColor: 'rgba(168, 85, 247, 0.28)',
                        color: 'var(--accent)',
                      }}
                    >
                      {result.queryMode}
                    </span>
                  </div>
                </div>
                <p className="text-sm leading-6" style={{ color: 'var(--text-secondary)' }}>
                  {result.content || 'Tidak ada deskripsi tambahan.'}
                </p>
              </div>
            ))}
          </div>
        )}

        {viewMode === 'table' && activeCategory && meta.total > 0 && (
          <div className="mt-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
              Menampilkan {Math.min((currentPage - 1) * PAGE_SIZE + 1, meta.total)}-
              {Math.min((currentPage - 1) * PAGE_SIZE + entries.length, meta.total)} dari {meta.total} data
            </p>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setCurrentPage((page) => Math.max(1, page - 1))}
                disabled={currentPage === 1}
                className={`rounded-lg border px-3 py-2 text-sm transition-all duration-300 ${
                  currentPage === 1
                    ? 'cursor-not-allowed'
                    : ''
                }`}
                style={
                  currentPage === 1
                    ? { background: 'var(--surface-soft)', borderColor: 'var(--border-soft)', color: 'var(--text-muted)' }
                    : { background: 'var(--surface-soft)', borderColor: 'var(--border-strong)', color: 'var(--text-secondary)' }
                }
              >
                Sebelumnya
              </button>
              <span className="px-3 py-2 text-sm" style={{ color: 'var(--text-secondary)' }}>
                Halaman {currentPage} / {totalPages}
              </span>
              <button
                type="button"
                onClick={() => setCurrentPage((page) => Math.min(totalPages, page + 1))}
                disabled={currentPage === totalPages}
                className={`rounded-lg border px-3 py-2 text-sm transition-all duration-300 ${
                  currentPage === totalPages
                    ? 'cursor-not-allowed'
                    : ''
                }`}
                style={
                  currentPage === totalPages
                    ? { background: 'var(--surface-soft)', borderColor: 'var(--border-soft)', color: 'var(--text-muted)' }
                    : { background: 'var(--surface-soft)', borderColor: 'var(--border-strong)', color: 'var(--text-secondary)' }
                }
              >
                Berikutnya
              </button>
            </div>
          </div>
        )}

        {!activeCategory && (
          <div className="text-center py-12">
            <p style={{ color: 'var(--text-muted)' }}>Kategori logbook tidak dikenali.</p>
          </div>
        )}

        {viewMode === 'table' && activeCategory && meta.total === 0 && !isLoading && (
          <div className="text-center py-12">
            <p style={{ color: 'var(--text-muted)' }}>Tidak ada data yang ditemukan</p>
            {error && <p className="text-sm text-red-300 mt-2">{error}</p>}
          </div>
        )}

        {viewMode === 'table' && activeCategory && isLoading && (
          <div className="text-center py-12">
            <p style={{ color: 'var(--text-muted)' }}>Memuat data logbook...</p>
          </div>
        )}

        {viewMode === 'table' && activeCategory && error && meta.total > 0 && !isLoading && (
          <div className="mt-4">
            <p className="text-sm text-red-300">{error}</p>
          </div>
        )}

        {viewMode === 'search' && debouncedSemanticQuery && isSemanticLoading && (
          <div className="py-10 text-center">
            <p style={{ color: 'var(--text-muted)' }}>Mencari data paling relevan...</p>
          </div>
        )}

        {viewMode === 'search' && semanticError && (
          <div className="py-10 text-center">
            <p className="text-sm text-red-300">{semanticError}</p>
          </div>
        )}

        {viewMode === 'search' &&
          debouncedSemanticQuery &&
          !isSemanticLoading &&
          !semanticError &&
          semanticResults.length === 0 && (
            <div className="py-10 text-center">
              <p style={{ color: 'var(--text-muted)' }}>Tidak ada hasil yang cocok untuk pencarian ini.</p>
            </div>
          )}
      </GlassCard>
    </div>
  );
}
