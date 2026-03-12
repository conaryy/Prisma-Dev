import { useParams } from 'react-router-dom';
import { SelfAssessmentCapFulfillment } from '../SelfAssessmentCapFulfillment';
import {
  deleteExternalDnpCapFulfillmentFile,
  fetchExternalDnpCap,
  fetchExternalDnpSyncStatus,
  initExternalDnpSync,
  runExternalDnpSync,
  submitExternalDnpCapExtension,
  submitExternalDnpCapFulfillment,
} from '@/lib/externalDnp';

export function ExternalDnpSurveillanceCapFulfillment() {
  const { sessionAreaId = '' } = useParams();
  return (
    <SelfAssessmentCapFulfillment
      scope="surveillance"
      sessionAreaId={sessionAreaId}
      fetchCap={fetchExternalDnpCap}
      submitFulfillment={submitExternalDnpCapFulfillment}
      submitExtensionHandler={submitExternalDnpCapExtension}
      deleteFulfillmentFileHandler={deleteExternalDnpCapFulfillmentFile}
      syncInit={initExternalDnpSync}
      syncRun={(payload) => runExternalDnpSync({ ...payload, scope: 'surveillance' })}
      syncStatus={fetchExternalDnpSyncStatus}
      requireCapReview={false}
      allowSend={false}
      enableQuestionPagination
      questionPageSize={8}
    />
  );
}
