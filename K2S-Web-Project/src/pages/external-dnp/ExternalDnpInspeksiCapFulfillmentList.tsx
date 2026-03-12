import { SelfAssessmentCapSessionList } from '../SelfAssessmentCapSessionList';
import {
  fetchExternalDnpSyncJobStatus,
  fetchExternalDnpCapSessions,
  initExternalDnpSync,
  runExternalDnpSync,
  startExternalDnpSyncJob,
} from '@/lib/externalDnp';

export function ExternalDnpInspeksiCapFulfillmentList() {
  return (
    <SelfAssessmentCapSessionList
      scope="inspeksi"
      title="Data Pemenuhan CAP"
      mode="pemenuhan"
      basePath="external-dnp"
      fetchSessions={fetchExternalDnpCapSessions}
      syncInit={initExternalDnpSync}
      syncRun={(payload) => runExternalDnpSync({ ...payload, scope: 'inspeksi' })}
      syncStart={(payload) => startExternalDnpSyncJob({ ...payload, scope: 'inspeksi' })}
      syncJobStatus={fetchExternalDnpSyncJobStatus}
    />
  );
}
