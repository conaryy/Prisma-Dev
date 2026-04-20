import { SelfAssessmentReviews } from './SelfAssessmentReviews';

export function SelfAssessmentImportDnp() {
  return (
    <SelfAssessmentReviews
      title="Import DNP"
      description="Semua sesi self assessment yang terbuka dari seluruh akun. Klik area untuk membuka form pengisian."
      reviewLabel="Buka Sesi"
      showResultSubmissionSection={false}
      detailPanelMode="importDnp"
    />
  );
}
