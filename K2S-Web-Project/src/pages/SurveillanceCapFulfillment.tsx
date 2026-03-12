import { useParams } from 'react-router-dom';
import { SelfAssessmentCapFulfillment } from './SelfAssessmentCapFulfillment';
import { deleteSelfAssessmentCapFulfillmentFile } from '@/lib/selfAssessment';

export function SurveillanceCapFulfillment() {
  const { sessionAreaId = '' } = useParams();
  return (
    <SelfAssessmentCapFulfillment
      scope="surveillance"
      sessionAreaId={sessionAreaId}
      deleteFulfillmentFileHandler={deleteSelfAssessmentCapFulfillmentFile}
      enableQuestionPagination
      questionPageSize={8}
    />
  );
}
