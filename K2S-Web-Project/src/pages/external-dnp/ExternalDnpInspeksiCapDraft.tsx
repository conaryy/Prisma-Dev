import { useParams } from 'react-router-dom';
import { SelfAssessmentCapDraft } from '../SelfAssessmentCapDraft';
import { fetchExternalDnpCap, submitExternalDnpCap } from '@/lib/externalDnp';

export function ExternalDnpInspeksiCapDraft() {
  const { sessionAreaId = '' } = useParams();
  return (
    <SelfAssessmentCapDraft
      scope="inspeksi"
      sessionAreaId={sessionAreaId}
      fetchCap={fetchExternalDnpCap}
      submitCap={submitExternalDnpCap}
      allowSend={false}
      enableQuestionPagination
      questionPageSize={8}
    />
  );
}
