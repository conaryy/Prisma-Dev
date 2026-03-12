import { SelfAssessmentCapSessionList } from '../SelfAssessmentCapSessionList';
import {
  fetchExternalDnpSyncJobStatus,
  fetchExternalDnpCapSessions,
  initExternalDnpSync,
  runExternalDnpSync,
  startExternalDnpSyncJob,
} from '@/lib/externalDnp';

export function ExternalDnpSurveillanceCapFulfillmentList() {
  return (
    <SelfAssessmentCapSessionList
      scope="surveillance"
      title="Data Pemenuhan CAP"
      mode="pemenuhan"
      basePath="external-dnp"
      fetchSessions={fetchExternalDnpCapSessions}
      syncInit={initExternalDnpSync}
      syncRun={(payload) => runExternalDnpSync({ ...payload, scope: 'surveillance' })}
      syncStart={(payload) => startExternalDnpSyncJob({ ...payload, scope: 'surveillance' })}
      syncJobStatus={fetchExternalDnpSyncJobStatus}
    />
  );
}
