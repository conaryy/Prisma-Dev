import { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Clock3,
  Database,
  FileSpreadsheet,
  Filter,
  History,
  Search,
} from 'lucide-react';
import GlassCard from '../components/ui/GlassCard';
import StatCard from '../components/ui/StatCard';
import { invalidateLogbookData, useImportBatchDetail, useImportBatches } from '../hooks/useLogbookEntries';
import { getCategoryLabel, rollbackImportBatch } from '../lib/logbook';
import type { LogbookCategory } from '../types';

const PAGE_SIZE = 12;
const CATEGORY_OPTIONS: Array<{ value: LogbookCategory | 'all'; label: string }> = [
  { value: 'all', label: 'Semua Kategori' },
  { value: 'tower', label: 'Tower' },
  { value: 'app', label: 'App' },
  { value: 'teknik', label: 'Teknik' },
];

const STATUS_OPTIONS: Array<{ value: 'all' | 'pending' | 'processing' | 'completed' | 'failed'; label: string }> = [
  { value: 'all', label: 'Semua Status' },
  { value: 'pending', label: 'Pending' },
  { value: 'processing', label: 'Processing' },
  { value: 'completed', label: 'Completed' },
  { value: 'failed', label: 'Failed' },
];

function formatDateTime(value: string | null) {
  if (!value) {
    return '-';
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat('id-ID', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date);
}

function getStatusTone(status: string) {
  if (status === 'completed') {
    return {
      label: 'Completed',
      className: 'border-emerald-400/30 bg-emerald-500/12 text-emerald-200',
    };
  }

  if (status === 'failed') {
    return {
      label: 'Failed',
      className: 'border-red-400/30 bg-red-500/12 text-red-200',
    };
  }

  if (status === 'processing') {
    return {
      label: 'Processing',
      className: 'border-amber-400/30 bg-amber-500/12 text-amber-100',
    };
  }

  return {
    label: 'Pending',
    className: 'border-cyan-400/30 bg-cyan-500/12 text-cyan-100',
  };
}

export default function ImportManagement() {
  const [currentPage, setCurrentPage] = useState(1);
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<LogbookCategory | 'all'>('all');
  const [selectedStatus, setSelectedStatus] = useState<
    'all' | 'pending' | 'processing' | 'completed' | 'failed'
  >('all');
  const [selectedBatchId, setSelectedBatchId] = useState<string | null>(null);
  const [rollbackMessage, setRollbackMessage] = useState<string | null>(null);
  const [rollbackError, setRollbackError] = useState<string | null>(null);
  const [isRollingBack, setIsRollingBack] = useState(false);

  const categoryFilter = selectedCategory === 'all' ? null : selectedCategory;
  const statusFilter = selectedStatus === 'all' ? null : selectedStatus;

  const { batches, meta, isLoading, error, refresh } = useImportBatches({
    page: currentPage,
    pageSize: PAGE_SIZE,
    search: debouncedSearchTerm,
    category: categoryFilter,
    status: statusFilter,
  });

  const {
    detail,
    errors,
    detailMeta,
    errorMeta,
    isLoading: isDetailLoading,
    error: detailError,
    refresh: refreshDetail,
    setSourcePage,
    setAuditPage,
    setErrorPage,
  } = useImportBatchDetail(selectedBatchId);

  async function handleRollback() {
    if (!detail || detail.isActive || detail.status !== 'completed') {
      return;
    }

    const confirmed = window.confirm(
      `Aktifkan kembali batch ${detail.sourceFileName} untuk periode ${detail.sourcePeriod || '-'}? Batch aktif saat ini pada periode yang sama akan diarsipkan.`
    );
    if (!confirmed) {
      return;
    }

    setIsRollingBack(true);
    setRollbackError(null);
    setRollbackMessage(null);

    try {
      const result = await rollbackImportBatch(detail.id);
      invalidateLogbookData();
      refresh();
      refreshDetail();
      setRollbackMessage(
        result.replacedBatchId
          ? `Batch berhasil diaktifkan kembali. Batch ${result.replacedBatchId} dipindahkan ke archived.`
          : 'Batch berhasil diaktifkan kembali.'
      );
    } catch (err) {
      setRollbackError(err instanceof Error ? err.message : 'Rollback batch gagal diproses.');
    } finally {
      setIsRollingBack(false);
    }
  }

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      setDebouncedSearchTerm(searchTerm.trim());
    }, 350);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [searchTerm]);

  useEffect(() => {
    setCurrentPage(1);
  }, [debouncedSearchTerm, selectedCategory, selectedStatus]);

  useEffect(() => {
    if (!selectedBatchId && batches[0]?.id) {
      setSelectedBatchId(batches[0].id);
      return;
    }

    if (selectedBatchId && batches.length > 0 && !batches.some((batch) => batch.id === selectedBatchId)) {
      setSelectedBatchId(batches[0].id);
    }
  }, [batches, selectedBatchId]);

  useEffect(() => {
    setRollbackError(null);
    setRollbackMessage(null);
  }, [selectedBatchId]);

  useEffect(() => {
    setSourcePage(1);
    setAuditPage(1);
    setErrorPage(1);
  }, [selectedBatchId, setAuditPage, setErrorPage, setSourcePage]);

  const stats = useMemo(() => {
    const completed = batches.filter((batch) => batch.status === 'completed').length;
    const failed = batches.filter((batch) => batch.status === 'failed').length;
    const totalInvalidRows = batches.reduce((sum, batch) => sum + batch.invalidRows, 0);

    return {
      completed,
      failed,
      totalInvalidRows,
    };
  }, [batches]);

  const totalPages = Math.max(1, meta.totalPages || 1);

  function renderPager(metaValue: { page: number; totalPages: number }, onChange: (page: number) => void) {
    if (metaValue.totalPages <= 1) {
      return null;
    }

    return (
      <div className="mt-4 flex items-center justify-between gap-3">
        <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
          Halaman {metaValue.page} / {metaValue.totalPages}
        </p>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => onChange(Math.max(1, metaValue.page - 1))}
            disabled={metaValue.page === 1}
            className="rounded-lg border px-3 py-2 text-xs disabled:cursor-not-allowed disabled:opacity-60"
            style={{ borderColor: 'var(--border-soft)', color: 'var(--text-secondary)' }}
          >
            Sebelumnya
          </button>
          <button
            type="button"
            onClick={() => onChange(Math.min(metaValue.totalPages, metaValue.page + 1))}
            disabled={metaValue.page === metaValue.totalPages}
            className="rounded-lg border px-3 py-2 text-xs disabled:cursor-not-allowed disabled:opacity-60"
            style={{ borderColor: 'var(--border-soft)', color: 'var(--text-secondary)' }}
          >
            Berikutnya
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="theme-page-title mb-2 text-3xl font-bold">Import Center</h1>
          <p className="theme-page-subtitle">
            Pantau riwayat import, status batch, error parsing, dan jejak audit dari backend Logbook.
          </p>
        </div>
        <div className="theme-soft-panel rounded-xl border px-4 py-3 text-sm" style={{ color: 'var(--text-secondary)' }}>
          Fokus tahap ini: observability import sebelum reimport workflow dibuka.
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard title="Batch Terlihat" value={isLoading ? '...' : meta.total} icon={FileSpreadsheet} trend="Sesuai filter aktif" />
        <StatCard title="Completed" value={isLoading ? '...' : stats.completed} icon={CheckCircle2} trend="Batch sukses pada halaman ini" />
        <StatCard title="Failed" value={isLoading ? '...' : stats.failed} icon={AlertTriangle} trend="Batch gagal pada halaman ini" />
        <StatCard title="Invalid Rows" value={isLoading ? '...' : stats.totalInvalidRows} icon={Database} trend="Akumulasi baris invalid" />
      </div>

      <GlassCard className="p-4 lg:p-5">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2" style={{ color: 'var(--text-muted)' }} />
            <input
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              className="theme-control w-full rounded-xl py-3 pl-10 pr-4 text-sm"
              placeholder="Cari file, periode, sheet, atau imported by..."
            />
          </div>
          <div className="flex flex-col gap-3 sm:flex-row">
            <label className="theme-soft-panel flex items-center gap-2 rounded-xl border px-3 py-3 text-sm">
              <Filter className="h-4 w-4" style={{ color: 'var(--text-muted)' }} />
              <select
                value={selectedCategory}
                onChange={(event) => setSelectedCategory(event.target.value as LogbookCategory | 'all')}
                className="bg-transparent outline-none"
                style={{ color: 'var(--text-primary)' }}
              >
                {CATEGORY_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value} style={{ color: '#111827' }}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="theme-soft-panel flex items-center gap-2 rounded-xl border px-3 py-3 text-sm">
              <Clock3 className="h-4 w-4" style={{ color: 'var(--text-muted)' }} />
              <select
                value={selectedStatus}
                onChange={(event) =>
                  setSelectedStatus(
                    event.target.value as 'all' | 'pending' | 'processing' | 'completed' | 'failed'
                  )
                }
                className="bg-transparent outline-none"
                style={{ color: 'var(--text-primary)' }}
              >
                {STATUS_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value} style={{ color: '#111827' }}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </div>
      </GlassCard>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(300px,0.95fr)_minmax(0,1.45fr)]">
        <GlassCard className="min-w-0 p-4 lg:p-5">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h2 className="theme-page-title text-xl font-semibold">Daftar Batch</h2>
              <p className="theme-page-subtitle text-sm">Klik satu batch untuk melihat detail sumber, error, dan audit.</p>
            </div>
            <span className="text-sm" style={{ color: 'var(--text-muted)' }}>
              {meta.total} total
            </span>
          </div>

          <div className="space-y-3">
            {batches.map((batch) => {
              const tone = getStatusTone(batch.status);
              const isActive = batch.id === selectedBatchId;

              return (
                <button
                  key={batch.id}
                  type="button"
                  onClick={() => setSelectedBatchId(batch.id)}
                  className={`w-full rounded-2xl border p-4 text-left transition-all duration-300 ${
                    isActive ? 'shadow-lg' : ''
                  }`}
                  style={{
                    background: isActive ? 'var(--surface-strong)' : 'var(--surface-soft)',
                    borderColor: isActive ? 'var(--border-strong)' : 'var(--border-soft)',
                  }}
                >
                  <div className="mb-3 flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
                        {batch.sourceFileName}
                      </p>
                      <p className="mt-1 text-xs" style={{ color: 'var(--text-muted)' }}>
                        {getCategoryLabel(batch.sourceCategory)}{batch.sourcePeriod ? ` • ${batch.sourcePeriod}` : ''}{batch.sheetName ? ` • ${batch.sheetName}` : ''}
                      </p>
                    </div>
                    <div className="flex flex-col items-end gap-2">
                      <span className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold ${tone.className}`}>
                        {tone.label}
                      </span>
                      <span
                        className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold ${
                          batch.isActive
                            ? 'border-cyan-400/30 bg-cyan-500/12 text-cyan-100'
                            : 'border-slate-400/20 bg-white/5 text-slate-300'
                        }`}
                      >
                        {batch.isActive ? 'Active' : 'Archived'}
                      </span>
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-2 text-xs">
                    <div className="rounded-xl border px-3 py-2" style={{ borderColor: 'var(--border-soft)' }}>
                      <p style={{ color: 'var(--text-muted)' }}>Rows</p>
                      <p className="mt-1 font-semibold" style={{ color: 'var(--text-primary)' }}>{batch.totalRows}</p>
                    </div>
                    <div className="rounded-xl border px-3 py-2" style={{ borderColor: 'var(--border-soft)' }}>
                      <p style={{ color: 'var(--text-muted)' }}>Valid</p>
                      <p className="mt-1 font-semibold text-emerald-300">{batch.validRows}</p>
                    </div>
                    <div className="rounded-xl border px-3 py-2" style={{ borderColor: 'var(--border-soft)' }}>
                      <p style={{ color: 'var(--text-muted)' }}>Invalid</p>
                      <p className="mt-1 font-semibold text-amber-300">{batch.invalidRows}</p>
                    </div>
                  </div>

                  <div className="mt-3 text-xs" style={{ color: 'var(--text-muted)' }}>
                    <span>Mulai: {formatDateTime(batch.startedAt)}</span>
                    <span className="mx-2">•</span>
                    <span>Selesai: {formatDateTime(batch.completedAt)}</span>
                  </div>
                  {batch.reimportOfBatchId ? (
                    <p className="mt-2 text-xs" style={{ color: 'var(--text-muted)' }}>
                      Reimport dari batch {batch.reimportOfBatchId}
                    </p>
                  ) : null}
                </button>
              );
            })}
          </div>

          {!batches.length && (
            <div className="py-12 text-center">
              <p style={{ color: 'var(--text-muted)' }}>
                {isLoading ? 'Memuat batch import...' : error ?? 'Belum ada batch yang cocok dengan filter.'}
              </p>
            </div>
          )}

          {batches.length > 0 && (
            <div className="mt-5 flex items-center justify-between gap-3">
              <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
                Halaman {currentPage} / {totalPages}
              </p>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setCurrentPage((page) => Math.max(1, page - 1))}
                  disabled={currentPage === 1}
                  className="rounded-lg border px-3 py-2 text-sm disabled:cursor-not-allowed disabled:opacity-60"
                  style={{ borderColor: 'var(--border-soft)', color: 'var(--text-secondary)' }}
                >
                  Sebelumnya
                </button>
                <button
                  type="button"
                  onClick={() => setCurrentPage((page) => Math.min(totalPages, page + 1))}
                  disabled={currentPage === totalPages}
                  className="rounded-lg border px-3 py-2 text-sm disabled:cursor-not-allowed disabled:opacity-60"
                  style={{ borderColor: 'var(--border-soft)', color: 'var(--text-secondary)' }}
                >
                  Berikutnya
                </button>
              </div>
            </div>
          )}
        </GlassCard>

        <div className="min-w-0 space-y-6">
          <GlassCard className="min-w-0 p-4 lg:p-5">
            <div className="mb-4 flex items-start justify-between gap-3">
              <div>
                <h2 className="theme-page-title text-xl font-semibold">Detail Batch</h2>
                <p className="theme-page-subtitle text-sm">Ringkasan sumber, jumlah error, dan audit trail batch terpilih.</p>
              </div>
              {detail ? (
                <span className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold ${getStatusTone(detail.status).className}`}>
                  {getStatusTone(detail.status).label}
                </span>
              ) : null}
            </div>

            {!selectedBatchId && (
              <p style={{ color: 'var(--text-muted)' }}>Pilih batch dari panel kiri untuk melihat detail.</p>
            )}

            {selectedBatchId && isDetailLoading && (
              <p style={{ color: 'var(--text-muted)' }}>Memuat detail batch...</p>
            )}

            {selectedBatchId && !isDetailLoading && detailError && (
              <p className="text-sm text-red-300">{detailError}</p>
            )}

            {rollbackError ? <p className="text-sm text-red-300">{rollbackError}</p> : null}
            {rollbackMessage ? <p className="text-sm text-emerald-300">{rollbackMessage}</p> : null}

            {detail && !isDetailLoading && (
              <div className="space-y-5">
                {!detail.isActive && detail.status === 'completed' ? (
                  <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border px-4 py-3" style={{ borderColor: 'var(--border-soft)' }}>
                    <div>
                      <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
                        Batch archived ini bisa dijadikan batch aktif lagi.
                      </p>
                      <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                        Sistem akan mengarsipkan batch aktif saat ini untuk kategori dan periode yang sama.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={handleRollback}
                      disabled={isRollingBack}
                      className="inline-flex items-center gap-2 rounded-xl border px-4 py-2 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-60"
                      style={{ borderColor: 'var(--border-soft)', color: 'var(--text-primary)' }}
                    >
                      <History className="h-4 w-4" />
                      {isRollingBack ? 'Memproses...' : 'Rollback Batch'}
                    </button>
                  </div>
                ) : null}

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 2xl:grid-cols-4">
                  <div className="theme-soft-panel rounded-xl border p-3">
                    <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Source Rows</p>
                    <p className="mt-1 text-xl font-semibold" style={{ color: 'var(--text-primary)' }}>{detail.summary.sourceRows}</p>
                  </div>
                  <div className="theme-soft-panel rounded-xl border p-3">
                    <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Errors</p>
                    <p className="mt-1 text-xl font-semibold text-amber-300">{detail.summary.errorCount}</p>
                  </div>
                  <div className="theme-soft-panel rounded-xl border p-3">
                    <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Integrity</p>
                    <p className="mt-1 text-xl font-semibold" style={{ color: 'var(--text-primary)' }}>{detail.summary.recordCount}</p>
                  </div>
                  <div className="theme-soft-panel rounded-xl border p-3">
                    <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Imported By</p>
                    <p className="mt-1 text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
                      {detail.importedBy || 'system'}
                    </p>
                  </div>
                </div>

                <div className="grid gap-4 2xl:grid-cols-2">
                  <div className="theme-soft-panel min-w-0 rounded-2xl border p-4">
                    <p className="mb-2 text-xs uppercase tracking-[0.16em]" style={{ color: 'var(--text-muted)' }}>
                      Ringkasan Batch
                    </p>
                    <div className="space-y-2 text-sm" style={{ color: 'var(--text-secondary)' }}>
                      <p>File: <span style={{ color: 'var(--text-primary)' }}>{detail.sourceFileName}</span></p>
                      <p>Kategori: <span style={{ color: 'var(--text-primary)' }}>{getCategoryLabel(detail.sourceCategory)}</span></p>
                      <p>Periode: <span style={{ color: 'var(--text-primary)' }}>{detail.sourcePeriod || '-'}</span></p>
                      <p>Status Aktif: <span style={{ color: 'var(--text-primary)' }}>{detail.isActive ? 'Active' : 'Archived'}</span></p>
                      <p>Reimport Of: <span style={{ color: 'var(--text-primary)' }}>{detail.reimportOfBatchId || '-'}</span></p>
                      <p>Sheet: <span style={{ color: 'var(--text-primary)' }}>{detail.sheetName || '-'}</span></p>
                      <p>Mulai: <span style={{ color: 'var(--text-primary)' }}>{formatDateTime(detail.startedAt)}</span></p>
                      <p>Selesai: <span style={{ color: 'var(--text-primary)' }}>{formatDateTime(detail.completedAt)}</span></p>
                      <p>Catatan: <span style={{ color: 'var(--text-primary)' }}>{detail.notes || '-'}</span></p>
                    </div>
                  </div>

                  <div className="theme-soft-panel min-w-0 rounded-2xl border p-4">
                    <p className="mb-2 text-xs uppercase tracking-[0.16em]" style={{ color: 'var(--text-muted)' }}>
                      Audit Trail
                    </p>
                    <div className="space-y-3">
                      {detail.auditTrail.length === 0 ? (
                        <p className="text-sm" style={{ color: 'var(--text-muted)' }}>Belum ada event audit pada batch ini.</p>
                      ) : (
                        detail.auditTrail.map((item) => (
                          <div key={item.id} className="min-w-0 rounded-xl border px-3 py-3 text-sm" style={{ borderColor: 'var(--border-soft)' }}>
                            <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between sm:gap-3">
                              <span className="break-words font-semibold" style={{ color: 'var(--text-primary)' }}>{item.action}</span>
                              <span style={{ color: 'var(--text-muted)' }}>{formatDateTime(item.createdAt)}</span>
                            </div>
                            <p className="mt-1" style={{ color: 'var(--text-secondary)' }}>
                              Actor: {item.actorId}
                            </p>
                            {item.metadata ? (
                              <pre
                                className="mt-2 overflow-x-auto rounded-xl border p-3 text-xs"
                                style={{
                                  borderColor: 'var(--border-soft)',
                                  background: 'var(--surface-card)',
                                  color: 'var(--text-secondary)',
                                }}
                              >
                                {JSON.stringify(item.metadata, null, 2)}
                              </pre>
                            ) : null}
                          </div>
                        ))
                      )}
                    </div>
                    {renderPager(detailMeta.auditTrail, setAuditPage)}
                  </div>
                </div>
              </div>
            )}
          </GlassCard>

          <GlassCard className="min-w-0 p-4 lg:p-5">
            <h2 className="theme-page-title mb-4 text-xl font-semibold">Error Parsing</h2>
            {!detail && <p style={{ color: 'var(--text-muted)' }}>Detail error akan muncul setelah batch dipilih.</p>}
            {detail && errors.length === 0 && !isDetailLoading && (
              <p style={{ color: 'var(--text-muted)' }}>Batch ini tidak memiliki error parsing yang tersimpan.</p>
            )}
            {errors.length > 0 && (
              <div className="space-y-3">
                {errors.map((item) => (
                  <div key={item.id} className="rounded-2xl border p-4" style={{ borderColor: 'var(--border-soft)' }}>
                    <div className="flex flex-wrap items-center gap-2 text-xs">
                      <span className="rounded-full border border-amber-400/30 bg-amber-500/12 px-2.5 py-1 text-amber-100">
                        Row {item.rowNumber}
                      </span>
                      <span className="rounded-full border border-red-400/30 bg-red-500/12 px-2.5 py-1 text-red-100">
                        {item.errorCode}
                      </span>
                      <span className="rounded-full border px-2.5 py-1" style={{ borderColor: 'var(--border-soft)', color: 'var(--text-secondary)' }}>
                        {item.fieldName}
                      </span>
                    </div>
                    <p className="mt-3 text-sm" style={{ color: 'var(--text-primary)' }}>{item.errorMessage}</p>
                    <pre
                      className="mt-3 overflow-x-auto rounded-xl border p-3 text-xs"
                      style={{
                        borderColor: 'var(--border-soft)',
                        background: 'var(--surface-card)',
                        color: 'var(--text-secondary)',
                      }}
                    >
                      {item.rawPayload}
                    </pre>
                  </div>
                ))}
              </div>
            )}
            {renderPager(errorMeta, setErrorPage)}
          </GlassCard>

          <GlassCard className="min-w-0 p-4 lg:p-5">
            <h2 className="theme-page-title mb-4 text-xl font-semibold">Sample Source Rows</h2>
            {!detail && <p style={{ color: 'var(--text-muted)' }}>Preview source row akan muncul setelah batch dipilih.</p>}
            {detail && (
              <div className="space-y-3">
                {detail.sampleSourceRows.map((row) => (
                  <div key={row.rowNumber} className="rounded-2xl border p-4" style={{ borderColor: 'var(--border-soft)' }}>
                    <div className="mb-2 flex items-center justify-between gap-3">
                      <span className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
                        Row {row.rowNumber}
                      </span>
                      <span className="text-xs" style={{ color: row.errorCount > 0 ? '#fcd34d' : 'var(--text-muted)' }}>
                        {row.errorCount > 0 ? `${row.errorCount} error` : 'clean'}
                      </span>
                    </div>
                    <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                      Raw Date: {row.rawDateValue || '-'} • Raw Time: {row.rawTimeValue || '-'}
                    </p>
                    <pre
                      className="mt-3 overflow-x-auto rounded-xl border p-3 text-xs"
                      style={{
                        borderColor: 'var(--border-soft)',
                        background: 'var(--surface-card)',
                        color: 'var(--text-secondary)',
                      }}
                    >
                      {row.rawPayload}
                    </pre>
                  </div>
                ))}
              </div>
            )}
            {renderPager(detailMeta.sourceRows, setSourcePage)}
          </GlassCard>
        </div>
      </div>
    </div>
  );
}
