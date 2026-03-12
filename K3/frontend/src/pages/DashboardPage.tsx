import { useEffect, useState } from 'react';
import { AnalysisSummary } from '@/components/AnalysisSummary';
import { EmptyState } from '@/components/EmptyState';
import { fetchLatestChecklist } from '@/lib/api';
import type { AuditAnalysis } from '@/types';

export function DashboardPage() {
  const [analysis, setAnalysis] = useState<AuditAnalysis | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let ignore = false;

    fetchLatestChecklist()
      .then((payload) => {
        if (ignore) return;
        setAnalysis(payload.data);
        setError(null);
      })
      .catch((reason) => {
        if (ignore) return;
        setError(reason instanceof Error ? reason.message : 'Gagal memuat dashboard.');
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

  if (isLoading) {
    return (
      <EmptyState
        title="Memuat ringkasan audit"
        description="Dashboard sedang mengambil hasil upload Word terakhir dari backend NestJS."
      />
    );
  }

  if (error) {
    return <EmptyState title="Dashboard belum siap" description={error} />;
  }

  if (!analysis) {
    return (
      <EmptyState
        title="Upload template audit terlebih dahulu"
        description="Buka menu Checklist Audit, pilih file Word audit SMK3, lalu dashboard ini akan otomatis menampilkan ringkasannya."
      />
    );
  }

  return <AnalysisSummary analysis={analysis} />;
}
