import { SelfAssessmentCapFulfillmentList } from './SelfAssessmentCapFulfillmentList';

export function MonitoringReviews() {
  return (
    <SelfAssessmentCapFulfillmentList
      hideScopeFilter
      groupLabel="Admin / Monitoring"
      title="Review Monitoring Self Assessment"
      description="Lihat data kirim monitoring, review, lalu kirim hasil monitoring ke user."
      emptyMessage="Belum ada data pemenuhan monitoring yang dikirim."
      detailBasePath="/admin/monitoring-reviews"
      showUserColumn
      userColumnLabel="User Pengirim"
      searchPlaceholder="Cari area, ketua tim, atau user..."
      openedOnly
    />
  );
}
