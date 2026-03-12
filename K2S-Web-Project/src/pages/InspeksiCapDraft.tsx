import { useParams } from 'react-router-dom';
import { SelfAssessmentCapDraft } from './SelfAssessmentCapDraft';

export function InspeksiCapDraft() {
  const { sessionAreaId = '' } = useParams();
  return (
    <SelfAssessmentCapDraft
      scope="inspeksi"
      sessionAreaId={sessionAreaId}
      enableQuestionPagination
      questionPageSize={8}
    />
  );
}
