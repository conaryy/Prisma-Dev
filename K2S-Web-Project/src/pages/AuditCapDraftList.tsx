import { SelfAssessmentCapSessionList } from './SelfAssessmentCapSessionList';

export function AuditCapDraftList() {
  return (
    <SelfAssessmentCapSessionList
      scope="audit"
      title="Data Penyusunan CAP"
      mode="penyusunan"
    />
  );
}
