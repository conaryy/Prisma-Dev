import { useParams } from 'react-router-dom';
import { SelfAssessmentCapFulfillment } from './SelfAssessmentCapFulfillment';
import { deleteSelfAssessmentCapFulfillmentFile } from '@/lib/selfAssessment';

export function AuditCapFulfillment() {
  const { sessionAreaId = '' } = useParams();
  return (
    <SelfAssessmentCapFulfillment
      scope="audit"
      sessionAreaId={sessionAreaId}
      deleteFulfillmentFileHandler={deleteSelfAssessmentCapFulfillmentFile}
      enableQuestionPagination
      questionPageSize={8}
    />
  );
}
