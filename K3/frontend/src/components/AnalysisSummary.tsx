import { useDeferredValue, useState, type KeyboardEvent, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { buildEvidenceMonitoringSummary } from '@/lib/evidence';
import type { EvidenceMonitoringEntry } from '@/lib/evidence';
import type { AuditAnalysis } from '@/types';

type Props = {
  analysis: AuditAnalysis;
};

type PaginatedTableProps<T> = {
  rows: T[];
  itemLabel: string;
  emptyState: string;
  children: (visibleRows: T[]) => ReactNode;
};

const DASHBOARD_PAGE_SIZE = 5;

function formatPercent(value: number) {
  return `${value.toFixed(2)}%`;
}

function formatDateTime(value: string) {
  return new Date(value).toLocaleString('id-ID', {
    dateStyle: 'medium',
    timeStyle: 'short',
  });
}

function formatRatio(current: number, total: number) {
  return `${current} / ${total}`;
}

function formatProgress(current: number, total: number) {
  if (total <= 0) {
    return 0;
  }

  return Number(((current / total) * 100).toFixed(2));
}

function renderEvidenceList(entries: string[], emptyLabel: string) {
  if (entries.length === 0) {
    return <p className="summary-table-copy">{emptyLabel}</p>;
  }

  return (
    <ul className="summary-bullet-list">
      {entries.map((entry, index) => (
        <li key={`${entry}-${index}`}>{entry}</li>
      ))}
    </ul>
  );
}

function renderPendingFiles(entry: EvidenceMonitoringEntry) {
  if (entry.pendingDriveFiles.length === 0) {
    return <p className="summary-table-copy">Semua file pada item ini sudah tersinkron ke Google Drive.</p>;
  }

  return (
    <ul className="summary-bullet-list">
      {entry.pendingDriveFiles.map((file) => (
        <li key={file.id}>
          {file.name}
          <span className="summary-table-copy">Tersimpan lokal, belum dikirim ke Drive.</span>
        </li>
      ))}
    </ul>
  );
}

function matchesEvidenceMonitoringQuery(entry: EvidenceMonitoringEntry, normalizedQuery: string) {
  if (!normalizedQuery) {
    return true;
  }

  const haystack = [
    entry.label,
    entry.title,
    entry.sectionLabel,
    entry.description,
    ...entry.questionCodes,
    ...entry.evidence,
    ...entry.uploadedFiles.map((file) => file.name),
    ...entry.pendingDriveFiles.map((file) => file.name),
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();

  return haystack.includes(normalizedQuery);
}

function buildChecklistQuestionLink(documentId: string | undefined, entry: EvidenceMonitoringEntry) {
  const targetQuestionCode = entry.questionCodes[0];

  if (!documentId || !targetQuestionCode) {
    return null;
  }

  const params = new URLSearchParams({
    document: documentId,
    question: targetQuestionCode,
  });

  return `/checklist-audit?${params.toString()}`;
}

function handleSummaryRowKeyDown(event: KeyboardEvent<HTMLTableRowElement>, onActivate: () => void) {
  if (event.key !== 'Enter' && event.key !== ' ') {
    return;
  }

  event.preventDefault();
  onActivate();
}

function renderEntryContent(entry: EvidenceMonitoringEntry, details: ReactNode, isClickable: boolean) {
  return (
    <>
      <strong>{entry.label}</strong>
      {isClickable ? <span className="summary-link-copy">Buka upload evidence</span> : null}
      {details}
    </>
  );
}

function PaginatedTable<T,>({ rows, itemLabel, emptyState, children }: PaginatedTableProps<T>) {
  const [page, setPage] = useState(1);
  const totalPages = Math.max(Math.ceil(rows.length / DASHBOARD_PAGE_SIZE), 1);
  const currentPage = Math.min(page, totalPages);
  const startIndex = (currentPage - 1) * DASHBOARD_PAGE_SIZE;
  const visibleRows = rows.slice(startIndex, startIndex + DASHBOARD_PAGE_SIZE);
  const startNumber = rows.length === 0 ? 0 : startIndex + 1;
  const endNumber = Math.min(startIndex + DASHBOARD_PAGE_SIZE, rows.length);

  if (rows.length === 0) {
    return <p className="detail-empty-copy">{emptyState}</p>;
  }

  return (
    <>
      {children(visibleRows)}

      {totalPages > 1 && (
        <div className="pagination-bar">
          <p className="pagination-copy">
            Menampilkan {startNumber}-{endNumber} dari {rows.length} {itemLabel}.
          </p>

          <div className="pagination-actions">
            <button
              type="button"
              className="secondary-action pagination-button"
              onClick={() => setPage(Math.max(currentPage - 1, 1))}
              disabled={currentPage === 1}
            >
              Sebelumnya
            </button>
            <span className="pagination-page-indicator">
              Halaman {currentPage} / {totalPages}
            </span>
            <button
              type="button"
              className="secondary-action pagination-button"
              onClick={() => setPage(Math.min(currentPage + 1, totalPages))}
              disabled={currentPage === totalPages}
            >
              Berikutnya
            </button>
          </div>
        </div>
      )}
    </>
  );
}

export function AnalysisSummary({ analysis }: Props) {
  const navigate = useNavigate();
  const [missingFileQuery, setMissingFileQuery] = useState('');
  const [pendingDriveQuery, setPendingDriveQuery] = useState('');
  const deferredMissingFileQuery = useDeferredValue(missingFileQuery);
  const deferredPendingDriveQuery = useDeferredValue(pendingDriveQuery);
  const evidenceMonitoring = buildEvidenceMonitoringSummary(analysis);
  const evidenceCoverage = formatProgress(
    evidenceMonitoring.totals.withFiles,
    evidenceMonitoring.totals.evidenceTargets
  );
  const driveSyncCoverage = formatProgress(
    evidenceMonitoring.totals.syncedDriveFiles,
    evidenceMonitoring.totals.uploadedFiles
  );
  const normalizedMissingFileQuery = deferredMissingFileQuery.trim().toLowerCase();
  const normalizedPendingDriveQuery = deferredPendingDriveQuery.trim().toLowerCase();
  const filteredMissingFileEntries = normalizedMissingFileQuery
    ? evidenceMonitoring.missingFileEntries.filter((entry) =>
        matchesEvidenceMonitoringQuery(entry, normalizedMissingFileQuery)
      )
    : evidenceMonitoring.missingFileEntries;
  const filteredPendingDriveEntries = normalizedPendingDriveQuery
    ? evidenceMonitoring.pendingDriveEntries.filter((entry) =>
        matchesEvidenceMonitoringQuery(entry, normalizedPendingDriveQuery)
      )
    : evidenceMonitoring.pendingDriveEntries;

  return (
    <div className="content-stack">
      <section className="overview-banner">
        <div>
          <p className="panel-kicker">Monitoring evidence audit</p>
          <h3 className="overview-banner-title">{analysis.metadata.branch || 'Cabang belum terdeteksi'}</h3>
          <p className="overview-banner-copy">
            Dokumen <strong>{analysis.fileName}</strong> sedang dipantau untuk tindak lanjut evidence. Saat ini ada{' '}
            <strong>{evidenceMonitoring.totals.withoutFiles}</strong> butir atau kelompok yang belum memiliki file dan{' '}
            <strong>{evidenceMonitoring.totals.pendingDriveFiles}</strong> file lokal yang belum dikirim ke Google Drive.
          </p>
        </div>

        <div className="overview-banner-score">
          <span>Action Needed</span>
          <strong>{evidenceMonitoring.totals.actionRequired}</strong>
          <small>
            {evidenceMonitoring.totals.actionRequired > 0
              ? 'Fokus pada item yang belum punya file atau belum sinkron ke Drive.'
              : 'Semua item yang terdeteksi sudah memiliki file dan sinkron Drive.'}
          </small>
        </div>
      </section>

      <section className="metric-grid">
        <article className="metric-card">
          <p className="metric-label">Perlu Evidence</p>
          <p className="metric-value">{evidenceMonitoring.totals.evidenceTargets}</p>
          <p className="metric-note">Butir atau kelompok yang memiliki kebutuhan evidence dari dokumen.</p>
        </article>
        <article className="metric-card">
          <p className="metric-label">Sudah Ada File</p>
          <p className="metric-value">{evidenceMonitoring.totals.withFiles}</p>
          <p className="metric-note">Evidence yang sudah terisi minimal satu file.</p>
        </article>
        <article className="metric-card">
          <p className="metric-label">Belum Ada File</p>
          <p className="metric-value">{evidenceMonitoring.totals.withoutFiles}</p>
          <p className="metric-note">Perlu upload file evidence dari checklist.</p>
        </article>
        <article className="metric-card">
          <p className="metric-label">File Belum Up Drive</p>
          <p className="metric-value">{evidenceMonitoring.totals.pendingDriveFiles}</p>
          <p className="metric-note">File lokal yang masih menunggu sinkron ke Google Drive.</p>
        </article>
        <article className="metric-card">
          <p className="metric-label">Sudah Sync Drive</p>
          <p className="metric-value">{evidenceMonitoring.totals.syncedDriveFiles}</p>
          <p className="metric-note">Jumlah file yang sudah tercatat tersinkron ke Google Drive.</p>
        </article>
        <article className="metric-card">
          <p className="metric-label">Penerapan</p>
          <p className="metric-value">{formatPercent(analysis.totals.compliancePercentage)}</p>
          <p className="metric-note">Tetap ditampilkan sebagai konteks hasil audit keseluruhan.</p>
        </article>
      </section>

      <section className="dashboard-grid">
        <article className="panel">
          <div className="panel-header">
            <div>
              <p className="panel-kicker">Dokumen</p>
              <h3 className="panel-title">Ringkasan Dokumen</h3>
              <p className="panel-description">
                Metadata audit tetap ditampilkan agar mudah mencocokkan hasil evidence dengan dokumen sumbernya.
              </p>
            </div>
          </div>

          <div className="meta-stack">
            <div className="meta-item">
              <p className="meta-label">Nama File</p>
              <p className="meta-value">{analysis.fileName}</p>
            </div>
            <div className="meta-item">
              <p className="meta-label">Cabang</p>
              <p className="meta-value">{analysis.metadata.branch || '-'}</p>
            </div>
            <div className="meta-item">
              <p className="meta-label">Nomor Dokumen</p>
              <p className="meta-value">{analysis.metadata.documentNumber || '-'}</p>
            </div>
            <div className="meta-item">
              <p className="meta-label">Tanggal Audit</p>
              <p className="meta-value">{analysis.metadata.auditDate || '-'}</p>
            </div>
            <div className="meta-item">
              <p className="meta-label">Terakhir Diproses</p>
              <p className="meta-value">{formatDateTime(analysis.analyzedAt)}</p>
            </div>
          </div>
        </article>

        <article className="panel">
          <div className="panel-header">
            <div>
              <p className="panel-kicker">Progress</p>
              <h3 className="panel-title">Progress Evidence</h3>
              <p className="panel-description">
                Fokus dashboard dialihkan ke kelengkapan file evidence dan status sinkron Google Drive.
              </p>
            </div>
          </div>

          <div className="progress-stack">
            <div className="progress-row">
              <div className="meta-copy">Butir atau kelompok yang sudah punya file</div>
              <strong>
                {formatRatio(evidenceMonitoring.totals.withFiles, evidenceMonitoring.totals.evidenceTargets)}
              </strong>
              <div className="progress-track">
                <div className="progress-bar" style={{ width: `${Math.min(evidenceCoverage, 100)}%` }} />
              </div>
            </div>

            <div className="progress-row">
              <div className="meta-copy">File evidence yang sudah sinkron ke Drive</div>
              <strong>
                {formatRatio(evidenceMonitoring.totals.syncedDriveFiles, evidenceMonitoring.totals.uploadedFiles)}
              </strong>
              <div className="progress-track">
                <div className="progress-bar" style={{ width: `${Math.min(driveSyncCoverage, 100)}%` }} />
              </div>
            </div>
          </div>

          <div className="status-chips">
            <span className="status-chip is-good">Sudah ada file {evidenceMonitoring.totals.withFiles}</span>
            <span className="status-chip is-danger">Belum ada file {evidenceMonitoring.totals.withoutFiles}</span>
            <span className="status-chip is-warning">Belum up Drive {evidenceMonitoring.totals.pendingDriveFiles}</span>
            <span className="status-chip is-neutral">Sync Drive {evidenceMonitoring.totals.syncedDriveFiles}</span>
          </div>

          <div className="attention-grid">
            <div className="attention-card">
              <span className="attention-label">Perlu Action</span>
              <strong>{evidenceMonitoring.totals.actionRequired}</strong>
            </div>
            <div className="attention-card">
              <span className="attention-label">File Tersimpan</span>
              <strong>{evidenceMonitoring.totals.uploadedFiles}</strong>
            </div>
          </div>
        </article>
      </section>

      <section className="evidence-grid">
        <article className="panel">
          <div className="panel-header">
            <div>
              <p className="panel-kicker">Prioritas</p>
              <h3 className="panel-title">Evidence Belum Diisi File</h3>
            </div>
          </div>

          <div className="summary-panel-toolbar">
            <input
              className="criteria-search"
              type="search"
              value={missingFileQuery}
              onChange={(event) => setMissingFileQuery(event.target.value)}
              placeholder="Cari butir, bab, atau kebutuhan evidence..."
            />
          </div>

          <PaginatedTable
            rows={filteredMissingFileEntries}
            itemLabel="item prioritas"
            emptyState={
              normalizedMissingFileQuery
                ? 'Tidak ada item prioritas yang cocok dengan pencarian.'
                : 'Semua kebutuhan evidence yang terbaca sudah memiliki file.'
            }
          >
            {(visibleRows) => (
              <div className="table-wrapper">
                <table>
                  <thead>
                    <tr>
                      <th>Butir / Kelompok</th>
                      <th>Bab</th>
                      <th>Kebutuhan Evidence</th>
                    </tr>
                  </thead>
                  <tbody>
                    {visibleRows.map((entry) => {
                      const targetUrl = buildChecklistQuestionLink(analysis.documentId, entry);

                      return (
                        <tr
                          key={entry.id}
                          className={targetUrl ? 'summary-entry-row is-clickable' : 'summary-entry-row'}
                          role={targetUrl ? 'link' : undefined}
                          tabIndex={targetUrl ? 0 : undefined}
                          onClick={targetUrl ? () => navigate(targetUrl) : undefined}
                          onKeyDown={
                            targetUrl
                              ? (event) => handleSummaryRowKeyDown(event, () => navigate(targetUrl))
                              : undefined
                          }
                        >
                          <td className="summary-entry-cell">
                            <div className="summary-entry-link">
                              {renderEntryContent(
                                entry,
                                <>
                                  <span className="summary-table-copy">{entry.title}</span>
                                  <span className="summary-table-copy">{entry.description}</span>
                                </>,
                                Boolean(targetUrl)
                              )}
                            </div>
                          </td>
                          <td>{entry.sectionLabel}</td>
                          <td>
                            {renderEvidenceList(entry.evidence, 'Belum ada evidence bawaan yang berhasil dibaca.')}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </PaginatedTable>
        </article>

        <article className="panel">
          <div className="panel-header">
            <div>
              <p className="panel-kicker">Drive</p>
              <h3 className="panel-title">File Lokal Belum Up ke Drive</h3>
            </div>
          </div>

          <div className="summary-panel-toolbar">
            <input
              className="criteria-search"
              type="search"
              value={pendingDriveQuery}
              onChange={(event) => setPendingDriveQuery(event.target.value)}
              placeholder="Cari butir, bab, atau nama file..."
            />
          </div>

          <PaginatedTable
            rows={filteredPendingDriveEntries}
            itemLabel="item drive"
            emptyState={
              normalizedPendingDriveQuery
                ? 'Tidak ada item drive yang cocok dengan pencarian.'
                : 'Tidak ada file lokal yang menunggu sinkron ke Google Drive.'
            }
          >
            {(visibleRows) => (
              <div className="table-wrapper">
                <table>
                  <thead>
                    <tr>
                      <th>Butir / Kelompok</th>
                      <th>Bab</th>
                      <th>File Menunggu Drive</th>
                    </tr>
                  </thead>
                  <tbody>
                    {visibleRows.map((entry) => {
                      const targetUrl = buildChecklistQuestionLink(analysis.documentId, entry);

                      return (
                        <tr
                          key={entry.id}
                          className={targetUrl ? 'summary-entry-row is-clickable' : 'summary-entry-row'}
                          role={targetUrl ? 'link' : undefined}
                          tabIndex={targetUrl ? 0 : undefined}
                          onClick={targetUrl ? () => navigate(targetUrl) : undefined}
                          onKeyDown={
                            targetUrl
                              ? (event) => handleSummaryRowKeyDown(event, () => navigate(targetUrl))
                              : undefined
                          }
                        >
                          <td className="summary-entry-cell">
                            <div className="summary-entry-link">
                              {renderEntryContent(
                                entry,
                                <>
                                  <span className="summary-table-copy">{entry.title}</span>
                                  <span className="summary-table-copy">
                                    {entry.pendingDriveFiles.length} file lokal masih menunggu sinkronisasi.
                                  </span>
                                </>,
                                Boolean(targetUrl)
                              )}
                            </div>
                          </td>
                          <td>{entry.sectionLabel}</td>
                          <td>{renderPendingFiles(entry)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </PaginatedTable>
        </article>
      </section>

      <article className="panel">
        <div className="panel-header">
          <div>
            <p className="panel-kicker">Monitoring</p>
            <h3 className="panel-title">Rekap per Bab</h3>
            <p className="panel-description">
              Rekap nilai audit per bab tetap tersedia sebagai konteks ketika menindaklanjuti evidence yang belum
              lengkap.
            </p>
          </div>
        </div>

        <div className="table-wrapper">
          <table>
            <thead>
              <tr>
                <th>Bab</th>
                <th>Uraian</th>
                <th>Total</th>
                <th>V</th>
                <th>M</th>
                <th>m</th>
                <th>X</th>
                <th>Penerapan</th>
              </tr>
            </thead>
            <tbody>
              {analysis.sectionSummary.map((section) => (
                <tr key={section.sectionCode}>
                  <td>{section.sectionCode}</td>
                  <td>{section.sectionTitle}</td>
                  <td>{section.total}</td>
                  <td>{section.sesuai}</td>
                  <td>{section.major}</td>
                  <td>{section.minor}</td>
                  <td>{section.tidakBerlaku}</td>
                  <td>{formatPercent(section.percentage)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </article>
    </div>
  );
}
