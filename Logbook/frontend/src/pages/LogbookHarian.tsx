import { useEffect, useRef, useState } from 'react';
import { ArrowDownAZ, ArrowUpZA, Plus, Search, Trash2 } from 'lucide-react';
import { useParams } from 'react-router-dom';
import GlassCard from '../components/ui/GlassCard';
import { useLogbookEntries } from '../hooks/useLogbookEntries';
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
  data: {
    batchId: string;
    category: string;
    sheetName: string;
    sourceFileName: string;
    sourcePeriod: string | null;
    totalRows: number;
    validRows: number;
    invalidRows: number;
    insertedRows: number;
  };
};

type LogbookImportResponse = TeknikImportResponse;

export default function LogbookHarian() {
  const { category } = useParams<{ category: string }>();
  const [sortOrder, setSortOrder] = useState<'desc' | 'asc'>('desc');
  const [selectedYear, setSelectedYear] = useState<number | null>(null);
  const [selectedMonth, setSelectedMonth] = useState<number | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [uploadMessage, setUploadMessage] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
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
    setSelectedYear(null);
    setSelectedMonth(null);
    setSortOrder('desc');
    setCurrentPage(1);
    setUploadMessage(null);
    setUploadError(null);
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

  const handleImportClick = () => {
    if (!canImportExcel || isUploading) {
      return;
    }
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
      setUploadMessage(
        `Import berhasil: ${result.data.insertedRows} baris masuk dari ${result.data.totalRows} baris pada sheet ${result.data.sheetName}.`
      );
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
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-white mb-2">Logbook - {categoryName}</h1>
          <p className="text-gray-400">Data logbook hasil import yang tersimpan di database</p>
        </div>
        <input
          ref={fileInputRef}
          type="file"
          accept=".xlsx"
          className="hidden"
          onChange={handleFileChange}
        />
        <button
          type="button"
          onClick={handleImportClick}
          disabled={!canImportExcel || isUploading}
          className={`px-6 py-3 border rounded-lg text-white font-medium flex items-center gap-2 justify-center transition-all duration-300 ${
            canImportExcel && !isUploading
              ? 'bg-purple-500/80 border-purple-400/50 hover:bg-purple-500 hover:shadow-lg hover:shadow-purple-500/20'
              : 'bg-purple-500/60 border-purple-400/30 opacity-70 cursor-not-allowed'
          }`}
        >
          <Plus className="w-5 h-5" />
          {isUploading ? 'Mengimpor Excel...' : 'Import Excel Segera'}
        </button>
      </div>

      {(uploadMessage || uploadError || deleteMessage || deleteError) && (
        <GlassCard className="p-4">
          {uploadMessage ? <p className="text-sm text-emerald-300">{uploadMessage}</p> : null}
          {uploadError ? <p className="text-sm text-red-300">{uploadError}</p> : null}
          {deleteMessage ? <p className="text-sm text-emerald-300">{deleteMessage}</p> : null}
          {deleteError ? <p className="text-sm text-red-300">{deleteError}</p> : null}
        </GlassCard>
      )}

      <GlassCard className="p-4 lg:p-6">
        <div className="flex flex-col sm:flex-row gap-3 mb-6">
          <select
            value={selectedYear ?? ''}
            onChange={(event) =>
              setSelectedYear(event.target.value ? Number.parseInt(event.target.value, 10) : null)
            }
            className="px-4 py-3 min-w-[140px] bg-slate-800 border border-violet-300/25 rounded-lg text-white focus:outline-none focus:border-violet-300/50 focus:bg-slate-800 transition-all duration-300"
          >
            <option value="" className="bg-slate-800 text-white">
              Semua Tahun
            </option>
            {meta.availableYears.map((year) => (
              <option key={year} value={year} className="bg-slate-800 text-white">
                {year}
              </option>
            ))}
          </select>
          <select
            value={selectedMonth ?? ''}
            onChange={(event) =>
              setSelectedMonth(event.target.value ? Number.parseInt(event.target.value, 10) : null)
            }
            className="px-4 py-3 min-w-[150px] bg-slate-800 border border-violet-300/25 rounded-lg text-white focus:outline-none focus:border-violet-300/50 focus:bg-slate-800 transition-all duration-300"
          >
            <option value="" className="bg-slate-800 text-white">
              Semua Bulan
            </option>
            {MONTH_OPTIONS.filter((month) => meta.availableMonths.includes(month.value)).map((month) => (
              <option key={month.value} value={month.value} className="bg-slate-800 text-white">
                {month.label}
              </option>
            ))}
          </select>
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              placeholder={
                isTeknik
                  ? 'Cari peralatan, freq, atau kejadian...'
                  : 'Cari operation type, facility, call sign, atau keterangan...'
              }
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              className="w-full pl-10 pr-4 py-3 bg-white/5 border border-violet-300/25 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-violet-300/50 focus:bg-white/10 transition-all duration-300"
            />
          </div>
          <div className="p-1 bg-white/5 border border-violet-300/25 rounded-xl flex items-center gap-1">
            <button
              type="button"
              onClick={() => setSortOrder('desc')}
              className={`px-3 py-2 rounded-lg text-sm font-medium flex items-center gap-2 transition-all duration-300 ${
                sortOrder === 'desc'
                  ? 'bg-violet-500/80 text-white shadow-lg shadow-violet-500/20'
                  : 'text-gray-300 hover:bg-white/10'
              }`}
            >
              <ArrowDownAZ className="w-4 h-4" />
              Terbaru
            </button>
            <button
              type="button"
              onClick={() => setSortOrder('asc')}
              className={`px-3 py-2 rounded-lg text-sm font-medium flex items-center gap-2 transition-all duration-300 ${
                sortOrder === 'asc'
                  ? 'bg-violet-500/80 text-white shadow-lg shadow-violet-500/20'
                  : 'text-gray-300 hover:bg-white/10'
              }`}
            >
              <ArrowUpZA className="w-4 h-4" />
              Terlama
            </button>
          </div>
          <button
            type="button"
            onClick={handleDeleteAll}
            disabled={isDeleting}
            className={`px-4 py-3 rounded-lg border flex items-center gap-2 justify-center transition-all duration-300 ${
              isDeleting
                ? 'bg-red-500/20 border-red-400/20 text-red-200 opacity-70 cursor-not-allowed'
                : 'bg-red-500/15 border-red-400/30 text-red-200 hover:bg-red-500/25 hover:border-red-400/50'
            }`}
          >
            <Trash2 className="w-5 h-5" />
            <span className="hidden sm:inline">
              {isDeleting ? 'Menghapus...' : 'Hapus Semua Data'}
            </span>
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[860px]">
            <thead>
              <tr className="border-b border-violet-300/18">
                {isTeknik ? (
                  <>
                    <th className="px-4 py-3 text-left text-gray-400 font-medium text-sm">NO</th>
                    <th className="px-4 py-3 text-left text-gray-400 font-medium text-sm">TANGGAL</th>
                    <th className="px-4 py-3 text-left text-gray-400 font-medium text-sm">JAM</th>
                    <th className="px-4 py-3 text-left text-gray-400 font-medium text-sm">Peralatan</th>
                    <th className="px-4 py-3 text-left text-gray-400 font-medium text-sm">Freq / Bagian</th>
                    <th className="px-4 py-3 text-left text-gray-400 font-medium text-sm">Kejadian</th>
                  </>
                ) : (
                  <>
                    <th className="px-4 py-3 text-left text-gray-400 font-medium text-sm">No.</th>
                    <th className="px-4 py-3 text-left text-gray-400 font-medium text-sm">Tanggal</th>
                    <th className="px-4 py-3 text-left text-gray-400 font-medium text-sm">Jam</th>
                    <th className="px-4 py-3 text-left text-gray-400 font-medium text-sm">Operation Type</th>
                    <th className="px-4 py-3 text-left text-gray-400 font-medium text-sm">Facility</th>
                    <th className="px-4 py-3 text-left text-gray-400 font-medium text-sm">Call Sign</th>
                    <th className="px-4 py-3 text-left text-gray-400 font-medium text-sm">Keterangan</th>
                  </>
                )}
              </tr>
            </thead>
            <tbody>
              {entries.map((entry) =>
                isTeknik ? (
                  <tr key={entry.id} className="border-b border-violet-300/10 hover:bg-white/5 transition-colors duration-200">
                    <td className="px-4 py-4 text-gray-300 text-sm">{entry.entryNo}</td>
                    <td className="px-4 py-4 text-gray-300 text-sm">{entry.dateLabel}</td>
                    <td className="px-4 py-4 text-gray-300 text-sm">{entry.entryTime}</td>
                    <td className="px-4 py-4 text-white font-medium">{entry.title}</td>
                    <td className="px-4 py-4 text-gray-300 text-sm">{entry.subtitle}</td>
                    <td className="px-4 py-4 text-gray-300 text-sm">{entry.description}</td>
                  </tr>
                ) : (
                  <tr key={entry.id} className="border-b border-violet-300/10 hover:bg-white/5 transition-colors duration-200">
                    <td className="px-4 py-4 text-gray-300 text-sm">{entry.entryNo}</td>
                    <td className="px-4 py-4 text-gray-300 text-sm">{entry.dateLabel}</td>
                    <td className="px-4 py-4 text-gray-300 text-sm">{entry.entryTime}</td>
                    <td className="px-4 py-4 text-white font-medium">{entry.title}</td>
                    <td className="px-4 py-4 text-gray-300 text-sm">{entry.subtitle}</td>
                    <td className="px-4 py-4 text-gray-300 text-sm">
                      {'callSign' in entry.detail ? entry.detail.callSign : '-'}
                    </td>
                    <td className="px-4 py-4 text-gray-300 text-sm">{entry.description}</td>
                  </tr>
                )
              )}
            </tbody>
          </table>
        </div>

        {activeCategory && meta.total > 0 && (
          <div className="mt-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <p className="text-sm text-gray-400">
              Menampilkan {Math.min((currentPage - 1) * PAGE_SIZE + 1, meta.total)}-
              {Math.min((currentPage - 1) * PAGE_SIZE + entries.length, meta.total)} dari {meta.total} data
            </p>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setCurrentPage((page) => Math.max(1, page - 1))}
                disabled={currentPage === 1}
                className={`px-3 py-2 rounded-lg border text-sm transition-all duration-300 ${
                  currentPage === 1
                    ? 'bg-white/5 border-violet-300/10 text-gray-500 cursor-not-allowed'
                    : 'bg-white/5 border-violet-300/25 text-gray-200 hover:bg-white/10 hover:border-violet-300/40'
                }`}
              >
                Sebelumnya
              </button>
              <span className="px-3 py-2 text-sm text-gray-300">
                Halaman {currentPage} / {totalPages}
              </span>
              <button
                type="button"
                onClick={() => setCurrentPage((page) => Math.min(totalPages, page + 1))}
                disabled={currentPage === totalPages}
                className={`px-3 py-2 rounded-lg border text-sm transition-all duration-300 ${
                  currentPage === totalPages
                    ? 'bg-white/5 border-violet-300/10 text-gray-500 cursor-not-allowed'
                    : 'bg-white/5 border-violet-300/25 text-gray-200 hover:bg-white/10 hover:border-violet-300/40'
                }`}
              >
                Berikutnya
              </button>
            </div>
          </div>
        )}

        {!activeCategory && (
          <div className="text-center py-12">
            <p className="text-gray-400">Kategori logbook tidak dikenali.</p>
          </div>
        )}

        {activeCategory && meta.total === 0 && !isLoading && (
          <div className="text-center py-12">
            <p className="text-gray-400">Tidak ada data yang ditemukan</p>
            {error && <p className="text-sm text-red-300 mt-2">{error}</p>}
          </div>
        )}

        {activeCategory && isLoading && (
          <div className="text-center py-12">
            <p className="text-gray-400">Memuat data logbook...</p>
          </div>
        )}

        {activeCategory && error && meta.total > 0 && !isLoading && (
          <div className="mt-4">
            <p className="text-sm text-red-300">{error}</p>
          </div>
        )}
      </GlassCard>
    </div>
  );
}
