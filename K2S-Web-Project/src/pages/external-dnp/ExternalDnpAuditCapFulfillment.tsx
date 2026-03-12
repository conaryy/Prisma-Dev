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

export function ExternalDnpAuditCapFulfillment() {
  const { sessionAreaId = '' } = useParams();
  return (
    <SelfAssessmentCapFulfillment
      scope="audit"
      sessionAreaId={sessionAreaId}
      fetchCap={fetchExternalDnpCap}
      submitFulfillment={submitExternalDnpCapFulfillment}
      submitExtensionHandler={submitExternalDnpCapExtension}
      deleteFulfillmentFileHandler={deleteExternalDnpCapFulfillmentFile}
      syncInit={initExternalDnpSync}
      syncRun={(payload) => runExternalDnpSync({ ...payload, scope: 'audit' })}
      syncStatus={fetchExternalDnpSyncStatus}
      requireCapReview={false}
      allowSend={false}
      enableQuestionPagination
      questionPageSize={8}
    />
  );
}
