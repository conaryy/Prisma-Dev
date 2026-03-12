import { useParams } from 'react-router-dom';
import { SelfAssessmentCapDraft } from '../SelfAssessmentCapDraft';
import { fetchExternalDnpCap, submitExternalDnpCap } from '@/lib/externalDnp';

export function ExternalDnpAuditCapDraft() {
  const { sessionAreaId = '' } = useParams();
  return (
    <SelfAssessmentCapDraft
      scope="audit"
      sessionAreaId={sessionAreaId}
      fetchCap={fetchExternalDnpCap}
      submitCap={submitExternalDnpCap}
      allowSend={false}
      enableQuestionPagination
      questionPageSize={8}
    />
  );
}
