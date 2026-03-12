import { useParams } from 'react-router-dom';
import { SelfAssessmentCapDraft } from './SelfAssessmentCapDraft';

export function AuditCapDraft() {
  const { sessionAreaId = '' } = useParams();
  return (
    <SelfAssessmentCapDraft
      scope="audit"
      sessionAreaId={sessionAreaId}
      enableQuestionPagination
      questionPageSize={8}
    />
  );
}
