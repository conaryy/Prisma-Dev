import { SelfAssessmentCapSessionList } from './SelfAssessmentCapSessionList';

export function SurveillanceCapFulfillmentList() {
  return (
    <SelfAssessmentCapSessionList
      scope="surveillance"
      title="Data Pemenuhan CAP"
      mode="pemenuhan"
    />
  );
}
