import { useParams } from 'react-router-dom';
import { SelfAssessmentCapDraft } from './SelfAssessmentCapDraft';

export function SurveillanceCapDraft() {
  const { sessionAreaId = '' } = useParams();
  return (
    <SelfAssessmentCapDraft
      scope="surveillance"
      sessionAreaId={sessionAreaId}
      enableQuestionPagination
      questionPageSize={8}
    />
  );
}
