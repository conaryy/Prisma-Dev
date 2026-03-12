import { SelfAssessmentCapSessionList } from './SelfAssessmentCapSessionList';

export function SurveillanceCapDraftList() {
  return (
    <SelfAssessmentCapSessionList
      scope="surveillance"
      title="Data Penyusunan CAP"
      mode="penyusunan"
    />
  );
}
