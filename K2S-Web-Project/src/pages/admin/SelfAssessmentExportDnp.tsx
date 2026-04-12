import { SelfAssessmentReviews } from './SelfAssessmentReviews';

export function SelfAssessmentExportDnp() {
  return (
    <SelfAssessmentReviews
      title="Export DNP Self Assessment"
      description="Siapkan data self assessment lokal sebagai basis export dan merger ke DNP."
      reviewLabel="Export DNP"
      showResultSubmissionSection={false}
      detailPanelMode="assessment"
    />
  );
}
