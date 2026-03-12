import { SelfAssessmentCapSessionList } from '../SelfAssessmentCapSessionList';
import { fetchExternalDnpCapSessions } from '@/lib/externalDnp';

export function ExternalDnpAuditCapDraftList() {
  return (
    <SelfAssessmentCapSessionList
      scope="audit"
      title="Data Penyusunan CAP"
      mode="penyusunan"
      basePath="external-dnp"
      fetchSessions={fetchExternalDnpCapSessions}
    />
  );
}
