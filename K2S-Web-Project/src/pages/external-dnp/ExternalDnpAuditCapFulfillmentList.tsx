import { SelfAssessmentCapSessionList } from '../SelfAssessmentCapSessionList';
import {
  fetchExternalDnpSyncJobStatus,
  fetchExternalDnpCapSessions,
  initExternalDnpSync,
  runExternalDnpSync,
  startExternalDnpSyncJob,
} from '@/lib/externalDnp';

export function ExternalDnpAuditCapFulfillmentList() {
  return (
    <SelfAssessmentCapSessionList
      scope="audit"
      title="Data Pemenuhan CAP"
      mode="pemenuhan"
      basePath="external-dnp"
      fetchSessions={fetchExternalDnpCapSessions}
      syncInit={initExternalDnpSync}
      syncRun={(payload) => runExternalDnpSync({ ...payload, scope: 'audit' })}
      syncStart={(payload) => startExternalDnpSyncJob({ ...payload, scope: 'audit' })}
      syncJobStatus={fetchExternalDnpSyncJobStatus}
    />
  );
}
