import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useOutletContext } from 'react-router-dom';
import type { AppShellOutletContext } from '@/components/AppShell';
import { EmptyState } from '@/components/EmptyState';
import { deleteChecklistDocument, fetchChecklistDocuments, uploadChecklistDocument } from '@/lib/api';
import type { ChecklistDocumentSummary } from '@/types';

function formatDateTime(value: string) {
  return new Date(value).toLocaleString('id-ID', {
    dateStyle: 'medium',
    timeStyle: 'short',
  });
}

export function UploadDocumentsPage() {
  const { setTopbarContent } = useOutletContext<AppShellOutletContext>();
  const [documents, setDocuments] = useState<ChecklistDocumentSummary[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isUploading, setIsUploading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [deletingDocumentId, setDeletingDocumentId] = useState<string | null>(null);
  const defaultFeedback =
    'Upload dokumen Word audit untuk menyimpannya ke database dan memakainya ulang di dashboard maupun checklist.';
  const [feedback, setFeedback] = useState(defaultFeedback);
  const [feedbackTone, setFeedbackTone] = useState<'success' | 'error' | 'neutral'>('neutral');
  const [highlightedDocumentId, setHighlightedDocumentId] = useState<string | null>(null);

  useEffect(() => {
    let ignore = false;

    fetchChecklistDocuments()
      .then((payload) => {
        if (ignore) {
          return;
        }

        setDocuments(payload.data);
      })
      .catch((reason) => {
        if (ignore) {
          return;
        }

        setFeedback(reason instanceof Error ? reason.message : 'Gagal memuat daftar dokumen audit.');
        setFeedbackTone('error');
      })
      .finally(() => {
        if (!ignore) {
          setIsLoading(false);
        }
      });

    return () => {
      ignore = true;
    };
  }, []);

  const refreshDocuments = async () => {
    const payload = await fetchChecklistDocuments();
    setDocuments(payload.data);
  };

  const handleUpload = async (file: File | null) => {
    if (!file) {
      setFeedback('Pilih file Word terlebih dahulu.');
      setFeedbackTone('error');
      return;
    }

    setIsUploading(true);
    setFeedback(`Memproses ${file.name}...`);
    setFeedbackTone('neutral');

    try {
      const payload = await uploadChecklistDocument(file);
      await refreshDocuments();
      setHighlightedDocumentId(payload.document?.id ?? payload.data.documentId ?? null);
      setFeedback(payload.message);
      setFeedbackTone('success');
    } catch (reason) {
      setFeedback(reason instanceof Error ? reason.message : 'Terjadi kesalahan saat upload dokumen.');
      setFeedbackTone('error');
    } finally {
      setIsUploading(false);
    }
  };

  const handleDeleteDocument = async (document: ChecklistDocumentSummary) => {
    const isConfirmed = window.confirm(`Hapus dokumen "${document.fileName}" dari database dan penyimpanan lokal?`);
    if (!isConfirmed) {
      return;
    }

    setDeletingDocumentId(document.id);
    setFeedback(`Menghapus ${document.fileName}...`);
    setFeedbackTone('neutral');

    try {
      const payload = await deleteChecklistDocument(document.id);
      setDocuments((current) => current.filter((entry) => entry.id !== document.id));
      setHighlightedDocumentId((current) => (current === document.id ? null : current));
      setFeedback(payload.message);
      setFeedbackTone('success');
    } catch (reason) {
      setFeedback(reason instanceof Error ? reason.message : 'Terjadi kesalahan saat menghapus dokumen.');
      setFeedbackTone('error');
    } finally {
      setDeletingDocumentId(null);
    }
  };

  const latestDocument = documents[0] ?? null;
  const normalizedSearchQuery = searchQuery.trim().toLowerCase();
  const filteredDocuments =
    normalizedSearchQuery.length === 0
      ? documents
      : documents.filter((document) =>
          [
            document.fileName,
            document.branch,
            document.documentNumber,
            document.auditDate,
            formatDateTime(document.analyzedAt),
          ]
            .filter(Boolean)
            .some((value) => value!.toLowerCase().includes(normalizedSearchQuery))
        );
  const shouldShowFeedback = feedbackTone !== 'neutral' || feedback !== defaultFeedback;
  const topbarContent = useMemo(
    () => (
      <div className="topbar-upload-tools">
        <div className="topbar-search">
          <input
            id="document-search-library"
            type="search"
            className="criteria-search topbar-search-input"
            placeholder="Cari nama file, cabang, no. dokumen, atau tanggal"
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            aria-label="Cari dokumen audit"
          />
        </div>

        <label className="primary-upload topbar-upload-action" htmlFor="document-upload-library">
          <input
            id="document-upload-library"
            type="file"
            accept=".doc,.docx"
            disabled={isUploading}
            onChange={(event) => {
              const file = event.target.files?.[0] ?? null;
              void handleUpload(file);
              event.target.value = '';
            }}
          />
          <span>{isUploading ? 'Memproses dokumen...' : 'Upload Dokumen'}</span>
        </label>
      </div>
    ),
    [isUploading, searchQuery]
  );

  useEffect(() => {
    setTopbarContent(topbarContent);

    return () => {
      setTopbarContent(null);
    };
  }, [setTopbarContent, topbarContent]);

  return (
    <div className="content-stack page-scroll">
      <section className="workspace-toolbar checklist-overview-strip">
        <div className="workspace-toolbar-stats checklist-overview-grid">
          <div className="mini-stat checklist-mini-stat">
            <span>Total Dokumen</span>
            <strong>{documents.length}</strong>
          </div>
          <div className="mini-stat checklist-mini-stat">
            <span>Terdeteksi</span>
            <strong>{latestDocument?.detectedCriteria ?? 0}</strong>
          </div>
          <div className="mini-stat checklist-mini-stat">
            <span>Penerapan</span>
            <strong>
              {latestDocument ? `${latestDocument.compliancePercentage.toFixed(2)}%` : '0.00%'}
            </strong>
          </div>
          <div className="mini-stat checklist-mini-stat">
            <span>Kelompok</span>
            <strong>{latestDocument?.groupCount ?? 0}</strong>
          </div>
        </div>

        {shouldShowFeedback && (
          <p className={`feedback-line checklist-feedback${feedbackTone !== 'neutral' ? ` is-${feedbackTone}` : ''}`}>
            {feedback}
          </p>
        )}
      </section>

      {isLoading ? (
        <EmptyState
          title="Memuat daftar dokumen"
          description="Daftar dokumen audit tersimpan sedang diambil dari backend."
        />
      ) : documents.length === 0 ? (
        <EmptyState
          title="Belum ada dokumen audit"
          description="Upload dokumen Word pertama Anda dari panel di atas. Setelah tersimpan, dokumen akan bisa dipilih di dashboard maupun menu Checklist Audit."
        />
      ) : filteredDocuments.length === 0 ? (
        <EmptyState
          title="Dokumen tidak ditemukan"
          description={`Tidak ada dokumen yang cocok dengan kata kunci "${searchQuery.trim()}".`}
        />
      ) : (
        <section className="document-library-grid">
          {filteredDocuments.map((document) => (
            <article
              key={document.id}
              className={`document-library-card${highlightedDocumentId === document.id ? ' is-highlighted' : ''}`}
            >
              <div className="document-library-card-head">
                <h3 className="document-library-card-title" title={document.fileName}>
                  {document.fileName}
                </h3>
                <span className="question-group-badge">{formatDateTime(document.analyzedAt)}</span>
              </div>

              <div className="document-library-meta-grid">
                <div className="meta-item">
                  <span className="meta-label">Cabang</span>
                  <p className="meta-value" title={document.branch || '-'}>
                    {document.branch || '-'}
                  </p>
                </div>
                <div className="meta-item">
                  <span className="meta-label">No. Dok</span>
                  <p className="meta-value" title={document.documentNumber || '-'}>
                    {document.documentNumber || '-'}
                  </p>
                </div>
                <div className="meta-item">
                  <span className="meta-label">Audit</span>
                  <p className="meta-value" title={document.auditDate || '-'}>
                    {document.auditDate || '-'}
                  </p>
                </div>
                <div className="meta-item">
                  <span className="meta-label">Terdeteksi</span>
                  <p className="meta-value">{document.detectedCriteria}</p>
                </div>
                <div className="meta-item">
                  <span className="meta-label">Penerapan</span>
                  <p className="meta-value">{document.compliancePercentage.toFixed(2)}%</p>
                </div>
                <div className="meta-item">
                  <span className="meta-label">Kelompok</span>
                  <p className="meta-value">{document.groupCount}</p>
                </div>
              </div>

              <div className="document-library-actions">
                <Link to={`/?document=${document.id}`} className="secondary-action">
                  Lihat Dashboard
                </Link>
                <a href={document.documentUrl} target="_blank" rel="noreferrer" className="secondary-action">
                  Buka Dokumen
                </a>
                <Link to={`/checklist-audit?document=${document.id}`} className="primary-action">
                  Pakai di Checklist
                </Link>
                <button
                  type="button"
                  className="secondary-action danger-action"
                  disabled={deletingDocumentId === document.id}
                  onClick={() => {
                    void handleDeleteDocument(document);
                  }}
                >
                  {deletingDocumentId === document.id ? 'Menghapus...' : 'Hapus Dokumen'}
                </button>
              </div>
            </article>
          ))}
        </section>
      )}
    </div>
  );
}
