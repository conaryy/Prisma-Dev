import { SelfAssessmentCapSessionList } from '../SelfAssessmentCapSessionList';
import { fetchExternalDnpCapSessions } from '@/lib/externalDnp';

export function ExternalDnpInspeksiCapDraftList() {
  return (
    <SelfAssessmentCapSessionList
      scope="inspeksi"
      title="Data Penyusunan CAP"
      mode="penyusunan"
      basePath="external-dnp"
      fetchSessions={fetchExternalDnpCapSessions}
    />
  );
}
