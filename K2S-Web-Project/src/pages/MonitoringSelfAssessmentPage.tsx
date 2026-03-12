import { useEffect, useState } from 'react';
import { AuditSelfAssessment } from './AuditSelfAssessment';
import { LoadingState } from '@/components/states/LoadingState';
import {
  fetchSelfAssessmentQuestions,
  fetchSelfAssessmentSessions,
  type SelfAssessmentSession,
} from '@/lib/selfAssessment';

type ProtocolQuestion = {
  id: string;
  text: string;
  reference?: string;
  category?: string | null;
  questionCategory?: string | null;
  questionCategoryPrefix?: string | null;
};

export function MonitoringSelfAssessmentPage() {
  const [questions, setQuestions] = useState<ProtocolQuestion[]>([]);
  const [sessions, setSessions] = useState<SelfAssessmentSession[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      fetchSelfAssessmentQuestions('monitoring'),
      fetchSelfAssessmentSessions('monitoring'),
    ])
      .then(([items, sessionItems]) => {
        setQuestions(
          items.map((item) => ({
            id: item.code,
            text: item.text,
            reference: item.reference ?? undefined,
            category: item.category ?? null,
            questionCategory: item.question_category ?? null,
            questionCategoryPrefix: item.question_category_prefix ?? null,
          }))
        );
        setSessions(sessionItems);
      })
      .finally(() => setIsLoading(false));
  }, []);

  if (isLoading) {
    return <LoadingState message="Memuat pertanyaan monitoring..." />;
  }

  return (
    <AuditSelfAssessment
      scope="monitoring"
      scopeLabel="Monitoring"
      questions={questions}
      sessions={sessions}
    />
  );
}
