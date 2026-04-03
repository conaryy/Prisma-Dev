import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { AnalysisSummary } from '@/components/AnalysisSummary';
import { EmptyState } from '@/components/EmptyState';
import { fetchChecklistDocument, fetchChecklistDocuments } from '@/lib/api';
import { buildEvidenceMonitoringSummary } from '@/lib/evidence';
import type { AuditAnalysis, ChecklistDocumentSummary } from '@/types';

export function DashboardPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const requestedDocumentId = searchParams.get('document') ?? '';
  const [documents, setDocuments] = useState<ChecklistDocumentSummary[]>([]);
  const [selectedDocumentId, setSelectedDocumentId] = useState('');
  const [analysis, setAnalysis] = useState<AuditAnalysis | null>(null);
  const [isLoadingDocuments, setIsLoadingDocuments] = useState(true);
  const [isLoadingAnalysis, setIsLoadingAnalysis] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let ignore = false;

    fetchChecklistDocuments()
      .then((payload) => {
        if (ignore) {
          return;
        }

        setDocuments(payload.data);
        setError(null);
      })
      .catch((reason) => {
        if (ignore) {
          return;
        }

        setError(reason instanceof Error ? reason.message : 'Gagal memuat daftar dokumen audit.');
      })
      .finally(() => {
        if (!ignore) {
          setIsLoadingDocuments(false);
        }
      });

    return () => {
      ignore = true;
    };
  }, []);

  useEffect(() => {
    if (documents.length === 0) {
      setSelectedDocumentId('');
      setAnalysis(null);
      return;
    }

    const requestedExists = requestedDocumentId
      ? documents.some((document) => document.id === requestedDocumentId)
      : false;
    const currentExists = selectedDocumentId
      ? documents.some((document) => document.id === selectedDocumentId)
      : false;
    const nextDocumentId = requestedExists
      ? requestedDocumentId
      : currentExists
        ? selectedDocumentId
        : documents[0]?.id ?? '';

    if (nextDocumentId !== selectedDocumentId) {
      setSelectedDocumentId(nextDocumentId);
    }

    if (nextDocumentId && nextDocumentId !== requestedDocumentId) {
      setSearchParams({ document: nextDocumentId }, { replace: true });
    }
  }, [documents, requestedDocumentId, selectedDocumentId, setSearchParams]);

  useEffect(() => {
    if (!selectedDocumentId) {
      setAnalysis(null);
      return;
    }

    let ignore = false;
    setIsLoadingAnalysis(true);
    setAnalysis(null);
    setError(null);

    fetchChecklistDocument(selectedDocumentId)
      .then((payload) => {
        if (ignore) {
          return;
        }

        if (!payload.data) {
          setError('Dokumen audit yang dipilih tidak ditemukan.');
          return;
        }

        setAnalysis(payload.data);
      })
      .catch((reason) => {
        if (ignore) {
          return;
        }

        setError(reason instanceof Error ? reason.message : 'Gagal memuat dokumen audit terpilih.');
      })
      .finally(() => {
        if (!ignore) {
          setIsLoadingAnalysis(false);
        }
      });

    return () => {
      ignore = true;
    };
  }, [selectedDocumentId]);

  const selectedDocumentSummary =
    documents.find((document) => document.id === selectedDocumentId) ?? null;
  const evidenceMonitoring = analysis ? buildEvidenceMonitoringSummary(analysis) : null;

  return (
    <div className="content-stack page-scroll">
      <section className="workspace-toolbar checklist-overview-strip">
        <div className="workspace-toolbar-stats checklist-overview-grid">
          <div className="mini-stat checklist-mini-stat">
            <span>Perlu Evidence</span>
            <strong>{evidenceMonitoring?.totals.evidenceTargets ?? 0}</strong>
          </div>
          <div className="mini-stat checklist-mini-stat">
            <span>Belum Ada File</span>
            <strong>{evidenceMonitoring?.totals.withoutFiles ?? 0}</strong>
          </div>
          <div className="mini-stat checklist-mini-stat">
            <span>Belum Up Drive</span>
            <strong>{evidenceMonitoring?.totals.pendingDriveFiles ?? 0}</strong>
          </div>
          <div className="mini-stat checklist-mini-stat">
            <span>Penerapan</span>
            <strong>
              {analysis
                ? `${analysis.totals.compliancePercentage.toFixed(2)}%`
                : selectedDocumentSummary
                  ? `${selectedDocumentSummary.compliancePercentage.toFixed(2)}%`
                  : '0.00%'}
            </strong>
          </div>
        </div>

        {error && <p className="feedback-line is-error checklist-feedback">{error}</p>}
      </section>

      {isLoadingDocuments || (selectedDocumentId !== '' && isLoadingAnalysis && !analysis) ? (
        <EmptyState
          title="Memuat ringkasan audit"
          description="Dashboard sedang mengambil daftar dokumen dan hasil analisis dari backend NestJS."
        />
      ) : documents.length === 0 ? (
        <EmptyState
          title="Belum ada dokumen audit"
          description="Buka menu Upload Dokumen untuk menyimpan file Word audit, lalu pilih dokumen yang ingin ditampilkan di dashboard."
        />
      ) : !analysis ? (
        <EmptyState
          title="Pilih dokumen audit terlebih dahulu"
          description="Gunakan selector dokumen di topbar untuk membuka ringkasan audit yang ingin ditampilkan."
        />
      ) : (
        <AnalysisSummary analysis={analysis} />
      )}
    </div>
  );
}
