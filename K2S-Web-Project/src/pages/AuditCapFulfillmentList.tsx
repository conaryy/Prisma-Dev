import { SelfAssessmentCapSessionList } from './SelfAssessmentCapSessionList';

export function AuditCapFulfillmentList() {
  return (
    <SelfAssessmentCapSessionList
      scope="audit"
      title="Data Pemenuhan CAP"
      mode="pemenuhan"
    />
  );
}
