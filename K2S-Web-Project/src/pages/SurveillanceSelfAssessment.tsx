import { useEffect, useMemo, useState } from 'react';
import { InspeksiSelfAssessment } from './InspeksiSelfAssessment';
import { LoadingState } from '@/components/states/LoadingState';
import {
  fetchSelfAssessmentQuestions,
  fetchSelfAssessmentSessions,
  type SelfAssessmentSession,
} from '@/lib/selfAssessment';

type ProtocolQuestion = {
  id: string;
  text: string;
  section: string;
  reference: string;
  key: string;
};

type AreaOption = {
  id: string;
  label: string;
  header: string;
  questions: ProtocolQuestion[];
};

const buildAreas = (items: Array<{ code: string; text: string; category: string | null; reference: string | null; question_category?: string | null }>) => {
  const map = new Map<string, ProtocolQuestion[]>();
  items.forEach((item) => {
    const category = item.category?.trim() || 'Umum';
    const section = item.question_category?.trim() || item.reference?.trim() || 'Lainnya';
    const question: ProtocolQuestion = {
      id: item.code,
      text: item.text,
      section,
      reference: section,
      key: `${category}-${item.code}`,
    };
    if (!map.has(category)) {
      map.set(category, []);
    }
    map.get(category)!.push(question);
  });

  return Array.from(map.entries()).map(([category, questions]) => ({
    id: category,
    label: category,
    header: category,
    questions,
  }));
};

export function SurveillanceSelfAssessment() {
  const [areas, setAreas] = useState<AreaOption[]>([]);
  const [sessions, setSessions] = useState<SelfAssessmentSession[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      fetchSelfAssessmentQuestions('surveillance'),
      fetchSelfAssessmentSessions('surveillance'),
    ])
      .then(([items, sessionItems]) => {
        setAreas(buildAreas(items));
        setSessions(sessionItems);
      })
      .finally(() => setIsLoading(false));
  }, []);

  const resolvedAreas = useMemo(() => areas, [areas]);

  if (isLoading) {
    return <LoadingState message="Memuat pertanyaan surveillance..." />;
  }

  return (
    <InspeksiSelfAssessment
      scope="surveillance"
      scopeLabel="Surveillance"
      areas={resolvedAreas}
      sessions={sessions}
    />
  );
}
