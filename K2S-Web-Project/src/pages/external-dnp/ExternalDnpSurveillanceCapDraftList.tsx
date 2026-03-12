import { SelfAssessmentCapSessionList } from '../SelfAssessmentCapSessionList';
import { fetchExternalDnpCapSessions } from '@/lib/externalDnp';

export function ExternalDnpSurveillanceCapDraftList() {
  return (
    <SelfAssessmentCapSessionList
      scope="surveillance"
      title="Data Penyusunan CAP"
      mode="penyusunan"
      basePath="external-dnp"
      fetchSessions={fetchExternalDnpCapSessions}
    />
  );
}
