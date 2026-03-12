import { useParams } from 'react-router-dom';
import { SelfAssessmentCapFulfillment } from './SelfAssessmentCapFulfillment';
import { deleteSelfAssessmentCapFulfillmentFile } from '@/lib/selfAssessment';

export function InspeksiCapFulfillment() {
  const { sessionAreaId = '' } = useParams();
  return (
    <SelfAssessmentCapFulfillment
      scope="inspeksi"
      sessionAreaId={sessionAreaId}
      deleteFulfillmentFileHandler={deleteSelfAssessmentCapFulfillmentFile}
      enableQuestionPagination
      questionPageSize={8}
    />
  );
}
