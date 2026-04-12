import { useEffect, useMemo, useState } from 'react';
import {
  Check,
  ClipboardCheck,
  FileText,
  SendHorizontal,
  UploadCloud,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { FormField, FormSection } from '@/components/shared/Form';
import {
  SelfAssessmentSubmissionTable,
  type SelfAssessmentSubmissionTableRow,
} from '@/components/self-assessment/SelfAssessmentSubmissionTable';
import {
  SelfAssessmentListFilters,
  SelfAssessmentWorkspace,
} from '@/components/self-assessment/SelfAssessmentWorkspace';
import { toast } from '@/hooks/use-toast';
import { resolveApiUrl } from '@/lib/api';
import { formatDateRangeIndonesian } from '@/lib/date';
import {
  SELF_ASSESSMENT_MONTH_OPTIONS as MONTH_OPTIONS,
  SELF_ASSESSMENT_YEAR_OPTIONS_WITH_ALL as YEAR_OPTIONS,
} from '@/lib/selfAssessmentFilters';
import {
  deleteSelfAssessmentEvidence,
  fetchSelfAssessmentAnswers,
  fetchSelfAssessmentEvidence,
  fetchSelfAssessmentQuestions,
  submitSelfAssessmentAnswers,
  uploadSelfAssessmentEvidence,
} from '@/lib/selfAssessment';
import { type SelfAssessmentScope } from '@/types/selfAssessment';
import cnsQuestionsText from '../../pertanyaan_inspeksi_selfassesment_cns.txt?raw';
import atsQuestionsText from '../../pertanyaan_inspeksi_selftassesment_ats.txt?raw';

const selectClassName =
  'h-11 w-full rounded-xl border border-input bg-white/80 px-4 text-sm text-slate-700 shadow-sm transition-colors placeholder:text-slate-400 focus:border-blue-300 focus:outline-none focus:ring-2 focus:ring-blue-200 dark:border-slate-700 dark:bg-slate-900/70 dark:text-slate-100 dark:placeholder:text-slate-400 dark:focus:border-blue-400 dark:focus:ring-blue-900/50 sm:w-60';

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

const extractAreaTitle = (content: string) => {
  const line = content
    .split(/\r?\n/)
    .map((item) => item.trim())
    .find((item) => item.toUpperCase().startsWith('DAFTAR PERTANYAAN'));
  if (!line) {
    return 'Protocol Question';
  }
  const prefix = 'DAFTAR PERTANYAAN ';
  const normalized = line.toUpperCase();
  return normalized.startsWith(prefix) ? line.slice(prefix.length).trim() : line;
};

const parseQuestions = (content: string, areaId: string) => {
  const lines = content
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  let currentSection = '';
  const questions: ProtocolQuestion[] = [];

  lines.forEach((line) => {
    const sectionMatch = line.match(/^([A-Z])\.\s+(.+)$/);
    if (sectionMatch) {
      currentSection = `${sectionMatch[1]}. ${sectionMatch[2].trim()}`;
      return;
    }

    const questionMatch = line.match(/^\d+\.\s+([A-Z]\.\d+):\s*(.+)$/);
    if (questionMatch) {
      const id = questionMatch[1];
      const text = questionMatch[2].trim();
      const section = currentSection || 'Lainnya';
      questions.push({
        id,
        text,
        section,
        reference: section,
        key: `${areaId}-${id}`,
      });
    }
  });

  return questions;
};

const CNS_TITLE = extractAreaTitle(cnsQuestionsText);
const ATS_TITLE = extractAreaTitle(atsQuestionsText);

const AREA_OPTIONS: AreaOption[] = [
  {
    id: 'CNS',
    label: CNS_TITLE,
    header: CNS_TITLE,
    questions: parseQuestions(cnsQuestionsText, 'CNS'),
  },
  {
    id: 'ATS',
    label: ATS_TITLE,
    header: ATS_TITLE,
    questions: parseQuestions(atsQuestionsText, 'ATS'),
  },
];

const buildAreas = (
  items: Array<{
    code: string;
    text: string;
    category: string | null;
    reference: string | null;
    question_category?: string | null;
  }>
) => {
  const map = new Map<string, ProtocolQuestion[]>();
  items.forEach((item) => {
    const category = item.category?.trim() || 'Umum';
    const section =
      item.question_category?.trim() || item.reference?.trim() || 'Lainnya';
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

const QUESTIONS_PER_PAGE = 8;

const FALLBACK_QUESTION: ProtocolQuestion = {
  id: '',
  text: '',
  section: '',
  reference: '',
  key: 'fallback',
};

const MONTH_INDEX_BY_VALUE: Record<string, number> = {
  JANUARI: 0,
  FEBRUARI: 1,
  MARET: 2,
  APRIL: 3,
  MEI: 4,
  JUNI: 5,
  JULI: 6,
  AGUSTUS: 7,
  SEPTEMBER: 8,
  OKTOBER: 9,
  NOVEMBER: 10,
  DESEMBER: 11,
};

const matchesScheduleFilter = (
  startDate: string,
  endDate: string,
  month: string,
  year: string
) => {
  const start = new Date(`${startDate}T00:00:00`);
  const end = new Date(`${endDate}T23:59:59`);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    return true;
  }

  if (year !== 'ALL') {
    const selectedYear = Number(year);
    if (
      Number.isNaN(selectedYear) ||
      (start.getFullYear() !== selectedYear && end.getFullYear() !== selectedYear)
    ) {
      return false;
    }
  }

  if (month === 'ALL') {
    return true;
  }

  const selectedMonth = MONTH_INDEX_BY_VALUE[month];
  if (selectedMonth === undefined) {
    return true;
  }

  return start.getMonth() === selectedMonth || end.getMonth() === selectedMonth;
};

type ViewMode = 'list' | 'questions';

interface InspeksiSelfAssessmentProps {
  scope?: SelfAssessmentScope;
  scopeLabel?: string;
  areas?: AreaOption[];
  sessions?: Array<{
    id: string;
    title: string | null;
    startDate: string;
    endDate: string;
    areas: Array<{
      id: string;
      category: string;
      team: {
        leader: string;
        dnp: string[];
        kobo: string[];
      } | null;
    }>;
  }>;
}

export function InspeksiSelfAssessment({
  scope = 'inspeksi',
  scopeLabel = 'Inspeksi',
  areas,
  sessions = [],
}: InspeksiSelfAssessmentProps) {
  const [areaOptions, setAreaOptions] = useState<AreaOption[]>(
    areas ?? AREA_OPTIONS
  );
  const [month, setMonth] = useState(MONTH_OPTIONS[0].value);
  const [year, setYear] = useState(YEAR_OPTIONS[0]);
  const [searchText, setSearchText] = useState('');
  const [view, setView] = useState<ViewMode>('list');
  const [selectedAreaId, setSelectedAreaId] = useState<string | null>(null);
  const [selectedAreaCategory, setSelectedAreaCategory] = useState(
    areaOptions[0]?.id ?? ''
  );
  const [questionSearch, setQuestionSearch] = useState('');
  const [questionPage, setQuestionPage] = useState(1);
  const [activeQuestionKey, setActiveQuestionKey] = useState<string | null>(
    areaOptions[0]?.questions[0]?.key ?? null
  );
  const [assessmentByQuestion, setAssessmentByQuestion] = useState<
    Record<
      string,
      { status: string; comment: string; evidence: string }
    >
  >({});
  const [reviewByQuestion, setReviewByQuestion] = useState<
    Record<string, { allowReply: boolean; isFinal: boolean }>
  >({});
  const [submittedByQuestion, setSubmittedByQuestion] = useState<Record<string, boolean>>(
    {}
  );
  const [evidenceList, setEvidenceList] = useState<
    Array<{ id: string; name: string; url: string }>
  >([]);
  const [isUploadingEvidence, setIsUploadingEvidence] = useState(false);
  const [evidenceError, setEvidenceError] = useState<string | null>(null);
  const [teamOverrides] = useState<
    Record<string, { leader: string; dnp: string[]; kobo: string[] }>
  >({});
  const [isSubmittingAnswers, setIsSubmittingAnswers] = useState(false);
  const filteredSessions = useMemo(() => {
    const term = searchText.trim().toLowerCase();

    return sessions.filter((session) => {
      const matchesSchedule =
        month === 'ALL' && year === 'ALL'
          ? true
          : matchesScheduleFilter(session.startDate, session.endDate, month, year);
      if (!matchesSchedule) {
        return false;
      }

      if (!term) {
        return true;
      }

      return session.areas.some((area) => {
        const team = teamOverrides[area.id] ?? area.team;
        const haystack = [
          area.category,
          team?.leader ?? '',
          ...(team?.dnp ?? []),
          ...(team?.kobo ?? []),
        ]
          .join(' ')
          .toLowerCase();
        return haystack.includes(term);
      });
    });
  }, [month, searchText, sessions, teamOverrides, year]);

  useEffect(() => {
    if (areas) {
      setAreaOptions(areas);
    }
  }, [areas]);

  const sessionAreas = useMemo(() => {
    return filteredSessions.flatMap((session) =>
      session.areas.map((area) => ({
        id: area.id,
        area: area.category,
        leader: teamOverrides[area.id]?.leader ?? area.team?.leader ?? '-',
        dnp: teamOverrides[area.id]?.dnp ?? area.team?.dnp ?? [],
        kobo: teamOverrides[area.id]?.kobo ?? area.team?.kobo ?? [],
        schedule: session.startDate && session.endDate
          ? `${session.startDate} - ${session.endDate}`
          : null,
      }))
    );
  }, [filteredSessions, teamOverrides]);

  useEffect(() => {
    if (!selectedAreaId) {
      return;
    }
    const area = sessionAreas.find((item) => item.id === selectedAreaId);
    if (!area) {
      return;
    }
    const matched = areaOptions.find(
      (option) => option.id.toLowerCase() === area.area.toLowerCase()
    );
    if (matched) {
      setSelectedAreaCategory(matched.id);
    }
  }, [selectedAreaId, sessionAreas, areaOptions]);

  useEffect(() => {
    if (!selectedAreaId) {
      return;
    }
    const area = sessionAreas.find((item) => item.id === selectedAreaId);
    if (!area) {
      return;
    }
    fetchSelfAssessmentQuestions(scope, area.area, selectedAreaId)
      .then((items) => setAreaOptions(buildAreas(items)))
      .catch((error: Error) => {
        const message =
          error.message || 'Gagal memuat pertanyaan sesuai sesi terpilih.';
        toast({ title: 'Gagal memuat pertanyaan', description: message });
      });
  }, [scope, selectedAreaId, sessionAreas]);

  useEffect(() => {
    if (areaOptions.length === 0) {
      return;
    }
    const hasSelected = areaOptions.some(
      (option) => option.id === selectedAreaCategory
    );
    if (!selectedAreaCategory || !hasSelected) {
      setSelectedAreaCategory(areaOptions[0]?.id ?? '');
      setActiveQuestionKey(areaOptions[0]?.questions[0]?.key ?? null);
    }
  }, [areaOptions, selectedAreaCategory]);

  const selectedMonth =
    MONTH_OPTIONS.find((option) => option.value === month) ?? MONTH_OPTIONS[0];
  const badgeLabel = `${selectedMonth.shortLabel} ${year}`;
  const submissionRows: SelfAssessmentSubmissionTableRow[] = sessionAreas.map((item) => ({
    id: item.id,
    areas: [
      {
        id: item.id,
        label: item.area,
        onClick: () => openQuestions(item.id),
      },
    ],
    leader: item.leader,
    members: item.dnp,
    auditees: item.kobo,
    schedule: item.schedule
      ? formatDateRangeIndonesian(item.schedule)
      : 'Menunggu jadwal',
  }));

  const activeArea =
    areaOptions.find((option) => option.id === selectedAreaCategory) ??
    areaOptions[0];
  const protocolQuestions = activeArea?.questions ?? [];
  const questionKeyByCode = useMemo(() => {
    const map = new Map<string, string>();
    areaOptions.forEach((area) => {
      area.questions.forEach((question) => {
        map.set(question.id, question.key);
      });
    });
    return map;
  }, [areaOptions]);

  useEffect(() => {
    if (!activeQuestionKey) {
      setActiveQuestionKey(protocolQuestions[0]?.key ?? null);
      return;
    }
    if (!protocolQuestions.some((question) => question.key === activeQuestionKey)) {
      setActiveQuestionKey(protocolQuestions[0]?.key ?? null);
    }
  }, [activeQuestionKey, protocolQuestions]);

  useEffect(() => {
    setQuestionPage(1);
  }, [questionSearch, selectedAreaId]);

  const resetFilters = () => {
    setMonth(MONTH_OPTIONS[0].value);
    setYear(YEAR_OPTIONS[0]);
    setSearchText('');
  };

  const filteredQuestions = useMemo(() => {
    const term = questionSearch.toLowerCase();
    return protocolQuestions.filter((question) =>
      `${question.id} ${question.text}`.toLowerCase().includes(term)
    );
  }, [protocolQuestions, questionSearch]);

  const totalQuestionCount = filteredQuestions.length;
  const totalQuestionPages = Math.max(
    1,
    Math.ceil(totalQuestionCount / QUESTIONS_PER_PAGE)
  );
  const safeQuestionPage = Math.min(questionPage, totalQuestionPages);

  useEffect(() => {
    if (questionPage !== safeQuestionPage) {
      setQuestionPage(safeQuestionPage);
    }
  }, [questionPage, safeQuestionPage]);

  const pagedQuestions = useMemo(() => {
    const startIndex = (safeQuestionPage - 1) * QUESTIONS_PER_PAGE;
    return filteredQuestions.slice(
      startIndex,
      startIndex + QUESTIONS_PER_PAGE
    );
  }, [filteredQuestions, safeQuestionPage]);

  const groupedQuestions = useMemo(() => {
    const groups: Array<{ section: string; questions: ProtocolQuestion[] }> = [];
    const groupMap = new Map<string, ProtocolQuestion[]>();
    pagedQuestions.forEach((question) => {
      if (!groupMap.has(question.section)) {
        const nextGroup = { section: question.section, questions: [] };
        groups.push(nextGroup);
        groupMap.set(question.section, nextGroup.questions);
      }
      groupMap.get(question.section)!.push(question);
    });
    return groups;
  }, [pagedQuestions]);

  useEffect(() => {
    if (!activeQuestionKey) {
      setActiveQuestionKey(pagedQuestions[0]?.key ?? null);
      return;
    }
    if (pagedQuestions.length === 0) {
      return;
    }
    if (!pagedQuestions.some((question) => question.key === activeQuestionKey)) {
      setActiveQuestionKey(pagedQuestions[0]?.key ?? null);
    }
  }, [activeQuestionKey, pagedQuestions]);

  useEffect(() => {
    if (!selectedAreaId) {
      setAssessmentByQuestion({});
      setReviewByQuestion({});
      return;
    }
    fetchSelfAssessmentAnswers(selectedAreaId)
      .then((items) => {
        const nextAnswers: Record<
          string,
          { status: string; comment: string; evidence: string }
        > = {};
        const nextReview: Record<string, { allowReply: boolean; isFinal: boolean }> =
          {};
        const nextSubmitted: Record<string, boolean> = {};
        items.forEach((item) => {
          const key = questionKeyByCode.get(item.questionCode);
          if (!key) {
            return;
          }
          nextAnswers[key] = {
            status: item.status,
            comment: item.comment ?? '',
            evidence: item.evidenceNote ?? '',
          };
          if (item.review) {
            nextReview[key] = {
              allowReply: item.review.allowReply,
              isFinal: item.review.isFinal,
            };
          }
          nextSubmitted[key] = item.isSubmitted;
        });
        setAssessmentByQuestion(nextAnswers);
        setReviewByQuestion(nextReview);
        setSubmittedByQuestion(nextSubmitted);
      })
      .catch(() => {
        setAssessmentByQuestion({});
        setReviewByQuestion({});
        setSubmittedByQuestion({});
      });
  }, [selectedAreaId, questionKeyByCode]);

  const activeQuestion =
    protocolQuestions.find((question) => question.key === activeQuestionKey) ??
    protocolQuestions[0] ??
    FALLBACK_QUESTION;
  const activeQuestionState = assessmentByQuestion[activeQuestion.key] ?? {
    status: 'Satisfactory',
    comment: '',
    evidence: '',
  };
  const allowReply = reviewByQuestion[activeQuestion.key]?.allowReply ?? false;
  const isSubmitted = submittedByQuestion[activeQuestion.key] ?? false;
  const isReviewLocked = reviewByQuestion[activeQuestion.key]?.isFinal ?? false;
  const isAnswerLocked = isSubmitted && !allowReply;
  const isQuestionFilled = (questionKey: string) => {
    const state = assessmentByQuestion[questionKey];
    if (!state) return false;
    return (
      state.comment.trim().length > 0 ||
      state.evidence.trim().length > 0 ||
      state.status !== 'Satisfactory'
    );
  };

  const resolveQuestionStatusTone = (questionKey: string) => {
    const status = (assessmentByQuestion[questionKey]?.status ?? '')
      .trim()
      .toLowerCase();
    if (status === 'not satisfactory') return 'not-satisfactory';
    if (status === 'not aplicable' || status === 'not applicable') return 'not-applicable';
    if (status === 'satisfactory') return 'satisfactory';
    return 'default';
  };

  const getQuestionVisual = (questionKey: string) => {
    const isSubmittedQuestion = submittedByQuestion[questionKey] ?? false;
    const isActiveQuestion = activeQuestionKey === questionKey;
    const activeRowClass =
      'bg-blue-100 text-slate-900 hover:bg-amber-300 dark:bg-blue-900/40 dark:text-slate-100 dark:hover:bg-amber-500/60';
    const neutralRowClass =
      'text-slate-700 hover:bg-amber-300 dark:text-slate-200 dark:hover:bg-amber-500/60';
    if (!isSubmittedQuestion) {
      return {
        row: isActiveQuestion ? activeRowClass : neutralRowClass,
        marker:
          'border-slate-300 bg-white text-slate-400 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-300',
      };
    }

    const tone = resolveQuestionStatusTone(questionKey);
    if (tone === 'satisfactory') {
      return {
        row: 'bg-sky-200 text-slate-900 hover:bg-amber-300 dark:bg-sky-900/45 dark:text-slate-100 dark:hover:bg-amber-500/60',
        marker:
          'border-blue-500 bg-blue-100 text-blue-700 dark:border-blue-500 dark:bg-blue-900/50 dark:text-blue-200',
      };
    }
    if (tone === 'not-satisfactory') {
      return {
        row: 'bg-red-200 text-slate-900 hover:bg-amber-300 dark:bg-red-900/55 dark:text-slate-100 dark:hover:bg-amber-500/60',
        marker:
          'border-red-600 bg-red-200 text-red-800 dark:border-red-500 dark:bg-red-900/60 dark:text-red-100',
      };
    }
    if (tone === 'not-applicable') {
      return {
        row: 'bg-violet-100 text-slate-900 hover:bg-amber-300 dark:bg-violet-900/40 dark:text-slate-100 dark:hover:bg-amber-500/60',
        marker:
          'border-violet-500 bg-violet-100 text-violet-700 dark:border-violet-500 dark:bg-violet-900/50 dark:text-violet-200',
      };
    }

    return {
      row: 'bg-amber-100 text-slate-900 hover:bg-amber-300 dark:bg-amber-900/40 dark:text-slate-100 dark:hover:bg-amber-500/60',
      marker:
        'border-amber-500 bg-amber-100 text-amber-700 dark:border-amber-600 dark:bg-amber-900/50 dark:text-amber-200',
    };
  };

  const answeredQuestionCount = filteredQuestions.filter((question) =>
    isQuestionFilled(question.key)
  ).length;
  const submittedQuestionCount = filteredQuestions.filter(
    (question) => submittedByQuestion[question.key]
  ).length;

  const openQuestions = (areaId: string | null) => {
    const assessment =
      sessionAreas.find((item) => item.id === areaId) ??
      sessionAreas[0];
    const nextAreaId = assessment?.id ?? null;
    setSelectedAreaId(nextAreaId);
    setSelectedAreaCategory(assessment?.area ?? areaOptions[0]?.id ?? '');
    setActiveQuestionKey(
      areaOptions.find((option) => option.id === (assessment?.area ?? ''))?.questions[0]?.key ??
        null
    );
    setView('questions');
  };

  useEffect(() => {
    if (!selectedAreaId || !activeQuestion) {
      setEvidenceList([]);
      return;
    }
    fetchSelfAssessmentEvidence({
      sessionAreaId: selectedAreaId,
      questionCode: activeQuestion.id,
    })
      .then((items) => setEvidenceList(items))
      .catch((error: Error) => {
        setEvidenceError(error.message || 'Gagal memuat evidence.');
      });
  }, [selectedAreaId, activeQuestion]);

  const handleEvidenceUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files ?? []);
    if (files.length === 0) {
      return;
    }
    if (!selectedAreaId || !activeQuestion) {
      setEvidenceError('Pilih area dan pertanyaan terlebih dahulu.');
      event.target.value = '';
      return;
    }
    setEvidenceError(null);
    setIsUploadingEvidence(true);
    try {
      for (const file of files) {
        await uploadSelfAssessmentEvidence({
          sessionAreaId: selectedAreaId,
          questionCode: activeQuestion.id,
          file,
        });
      }
      const items = await fetchSelfAssessmentEvidence({
        sessionAreaId: selectedAreaId,
        questionCode: activeQuestion.id,
      });
      setEvidenceList(items);
    } catch (error) {
      const message =
        error instanceof Error && error.message
          ? error.message
          : 'Gagal upload evidence.';
      setEvidenceError(message);
    } finally {
      setIsUploadingEvidence(false);
      event.target.value = '';
    }
  };

  const handleEvidenceDelete = async (id: string) => {
    if (!selectedAreaId || !activeQuestion) {
      return;
    }
    setEvidenceError(null);
    try {
      await deleteSelfAssessmentEvidence(id);
      const items = await fetchSelfAssessmentEvidence({
        sessionAreaId: selectedAreaId,
        questionCode: activeQuestion.id,
      });
      setEvidenceList(items);
    } catch (error) {
      const message =
        error instanceof Error && error.message
          ? error.message
          : 'Gagal menghapus evidence.';
      setEvidenceError(message);
    }
  };

  const handleAssessmentChange = (
    questionKey: string,
    nextValue: { status?: string; comment?: string; evidence?: string }
  ) => {
    setAssessmentByQuestion((prev) => ({
      ...prev,
      [questionKey]: {
        status: nextValue.status ?? prev[questionKey]?.status ?? 'Satisfactory',
        comment: nextValue.comment ?? prev[questionKey]?.comment ?? '',
        evidence: nextValue.evidence ?? prev[questionKey]?.evidence ?? '',
      },
    }));
  };

  const handleSendAssessment = () => {
    if (!selectedAreaId || !activeQuestionKey) {
      toast({
        title: 'Pilih area terlebih dahulu',
        description: 'Pilih area dan pertanyaan sebelum mengirim.',
      });
      return;
    }
    if (isAnswerLocked) {
      toast({
        title: 'Review sudah final',
        description: 'Jawaban tidak bisa dikirim ulang.',
      });
      return;
    }
    if (!isQuestionFilled(activeQuestionKey)) {
      toast({
        title: 'Belum ada jawaban',
        description: 'Isi jawaban sebelum mengirim.',
      });
      return;
    }
    setIsSubmittingAnswers(true);
    submitSelfAssessmentAnswers([
      {
        sessionAreaId: selectedAreaId,
        questionCode: activeQuestion.id,
        status: assessmentByQuestion[activeQuestionKey]?.status ?? 'Satisfactory',
        comment: assessmentByQuestion[activeQuestionKey]?.comment ?? '',
        evidenceNote: assessmentByQuestion[activeQuestionKey]?.evidence ?? '',
      },
    ])
      .then(() => {
        setSubmittedByQuestion((prev) => ({
          ...prev,
          [activeQuestionKey]: true,
        }));
        toast({
          title: 'Self assessment terkirim',
          description: 'Jawaban berhasil dikirim.',
        });
      })
      .catch((error: Error) => {
        toast({
          title: 'Gagal mengirim',
          description: error.message || 'Terjadi kesalahan.',
        });
      })
      .finally(() => setIsSubmittingAnswers(false));
  };

  const handleSaveDraft = () => {
    if (!selectedAreaId || !activeQuestionKey) {
      toast({
        title: 'Pilih area terlebih dahulu',
        description: 'Pilih area dan pertanyaan sebelum menyimpan draft.',
      });
      return;
    }
    if (isAnswerLocked) {
      toast({
        title: 'Review sudah final',
        description: 'Jawaban tidak bisa diubah.',
      });
      return;
    }
    if (!isQuestionFilled(activeQuestionKey)) {
      toast({
        title: 'Belum ada jawaban',
        description: 'Isi jawaban sebelum menyimpan draft.',
      });
      return;
    }
    setIsSubmittingAnswers(true);
    submitSelfAssessmentAnswers([
      {
        sessionAreaId: selectedAreaId,
        questionCode: activeQuestion.id,
        status: assessmentByQuestion[activeQuestionKey]?.status ?? 'Satisfactory',
        comment: assessmentByQuestion[activeQuestionKey]?.comment ?? '',
        submit: false,
        evidenceNote: assessmentByQuestion[activeQuestionKey]?.evidence ?? '',
      },
    ])
      .then(() => {
        setSubmittedByQuestion((prev) => ({
          ...prev,
          [activeQuestionKey]: false,
        }));
        toast({
          title: 'Draft tersimpan',
          description: 'Perubahan disimpan sebagai draft.',
        });
      })
      .catch((error: Error) => {
        toast({
          title: 'Gagal menyimpan draft',
          description: error.message || 'Terjadi kesalahan.',
        });
      })
      .finally(() => setIsSubmittingAnswers(false));
  };

  const handleSendAll = () => {
    if (!selectedAreaId) {
      toast({
        title: 'Pilih area terlebih dahulu',
        description: 'Pilih area sebelum mengirim semua.',
      });
      return;
    }
    const items = (activeArea?.questions ?? [])
      .filter(
        (question) =>
          isQuestionFilled(question.key) &&
          !(submittedByQuestion[question.key] && !reviewByQuestion[question.key]?.allowReply)
      )
      .map((question) => ({
        sessionAreaId: selectedAreaId,
        questionCode: question.id,
        status: assessmentByQuestion[question.key]?.status ?? 'Satisfactory',
        comment: assessmentByQuestion[question.key]?.comment ?? '',
        evidenceNote: assessmentByQuestion[question.key]?.evidence ?? '',
      }));
    if (items.length === 0) {
      toast({
        title: 'Belum ada jawaban',
        description: 'Isi jawaban sebelum mengirim semua.',
      });
      return;
    }
    setIsSubmittingAnswers(true);
    submitSelfAssessmentAnswers(items)
      .then(() => {
        setSubmittedByQuestion((prev) => {
          const next = { ...prev };
          items.forEach((item) => {
            const key = questionKeyByCode.get(item.questionCode);
            if (key) {
              next[key] = true;
            }
          });
          return next;
        });
        toast({
          title: 'Self assessment terkirim',
          description: 'Semua jawaban yang terisi berhasil dikirim.',
        });
      })
      .catch((error: Error) => {
        toast({
          title: 'Gagal mengirim',
          description: error.message || 'Terjadi kesalahan.',
        });
      })
      .finally(() => setIsSubmittingAnswers(false));
  };

  return (
    <div className="space-y-6">
      <SelfAssessmentWorkspace
        outerIcon={<ClipboardCheck className="h-5 w-5" />}
        outerTitle="Protocol Question (PQ)"
        outerContextLabel={scopeLabel}
        outerCurrentLabel="Protocol Question (PQ)"
        headerAction={
          view !== 'list' ? (
            <Button
              type="button"
              variant="outline"
              className="rounded-xl border-slate-200 text-slate-600 shadow-sm hover:border-blue-200 hover:bg-blue-50 dark:border-slate-700 dark:text-slate-200 dark:hover:border-slate-500 dark:hover:bg-slate-800"
              onClick={() => setView(view === 'questions' ? 'list' : 'questions')}
            >
              Kembali
            </Button>
          ) : (
            <span className="rounded-xl bg-blue-500 px-4 py-2 text-sm font-semibold text-white shadow-sm">
              {badgeLabel}
            </span>
          )
        }
        innerIcon={<FileText className="h-5 w-5" />}
        innerTitle="Data Self Assessment"
        innerDescription="Lihat dan kelola data hasil self assessment Protocol Question (PQ)."
        innerBadge={
          view === 'questions' && selectedAreaCategory ? (
            <span className="rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700">
              {selectedAreaCategory}
            </span>
          ) : undefined
        }
      >

            {view === 'questions' ? (
              <div className="space-y-5 px-6 pb-6">
                <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-xs font-semibold text-slate-600 dark:border-slate-700 dark:bg-slate-900/60 dark:text-slate-200">
                  <span className="text-slate-500 dark:text-slate-300">Ket:</span>
                  <span className="rounded-full bg-blue-100 px-3 py-1 text-[#1e3a8a]">
                    Satisfactory
                  </span>
                  <span className="rounded-full bg-red-100 px-3 py-1 text-[#991b1b]">
                    Not Satisfactory
                  </span>
                  <span className="rounded-full bg-violet-100 px-3 py-1 text-violet-700">
                    Not Aplicable
                  </span>
                  <div className="flex flex-wrap gap-2 md:ml-auto">
                    <Button variant="outline" size="sm" disabled>
                      {isSubmitted ? 'Dikirim' : 'Draft'}
                    </Button>
                    {reviewByQuestion[activeQuestion.key] && (
                      <Button variant="outline" size="sm" disabled>
                        Reviewed
                      </Button>
                    )}
                    {allowReply && (
                      <Button variant="outline" size="sm" disabled>
                        Allow Reply
                      </Button>
                    )}
                  </div>
                </div>

                <div className="grid gap-6 lg:grid-cols-[1.05fr_1fr]">
                  <div className="space-y-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-[#0f1e45]">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <h2 className="text-sm font-semibold text-slate-700">
                        LIST PROTOCOL QUESTION
                      </h2>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={handleSendAll}
                        disabled={isSubmittingAnswers || !selectedAreaId}
                      >
                        Kirim Semua
                      </Button>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-slate-500">Search:</span>
                      <Input
                        value={questionSearch}
                        onChange={(event) => setQuestionSearch(event.target.value)}
                        className="max-w-xs"
                      />
                    </div>
                    <div className="flex flex-wrap items-center gap-2 text-xs font-semibold text-slate-600">
                      <span className="rounded-full bg-amber-100 px-3 py-1 text-[#92400e]">
                        Terjawab {answeredQuestionCount} / {totalQuestionCount}
                      </span>
                      <span className="rounded-full bg-emerald-100 px-3 py-1 text-[#065f46]">
                        Dikirim {submittedQuestionCount} / {totalQuestionCount}
                      </span>
                    </div>

                    <div className="overflow-hidden rounded-xl border border-slate-200">
                      <div className="border-b border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-600">
                        {activeArea?.header}
                      </div>
                      {groupedQuestions.length === 0 ? (
                        <div className="px-3 py-4 text-sm text-slate-500">
                          Tidak ada pertanyaan yang cocok.
                        </div>
                      ) : (
                        groupedQuestions.map((group, index) => (
                          <div
                            key={group.section}
                            className={
                              index < groupedQuestions.length - 1
                                ? 'border-b border-slate-200'
                                : ''
                            }
                          >
                            <div className="border-b border-slate-200 bg-slate-100 px-3 py-2 text-xs font-semibold text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200">
                              {group.section}
                            </div>
                            <div className="divide-y">
                              {group.questions.map((question) => {
                                const questionVisual = getQuestionVisual(question.key);
                                return (
                                  <label
                                    key={question.key}
                                    className={`flex cursor-pointer items-start gap-3 px-3 py-3 text-sm transition-colors ${questionVisual.row}`}
                                    onClick={() => setActiveQuestionKey(question.key)}
                                  >
                                    <span
                                      className={`mt-1 inline-flex h-4 w-4 items-center justify-center rounded border text-[10px] font-semibold ${questionVisual.marker}`}
                                    >
                                      {submittedByQuestion[question.key] ? (
                                        <Check className="h-3 w-3" />
                                      ) : isQuestionFilled(question.key) ? (
                                        '•'
                                      ) : null}
                                    </span>
                                    <div className="flex-1">
                                      <span className="font-semibold">
                                        {question.id}
                                      </span>{' '}
                                      - {question.text}
                                    </div>
                                    <SendHorizontal className="mt-1 h-4 w-4 text-slate-400" />
                                  </label>
                                );
                              })}
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                    {totalQuestionCount > 0 && (
                      <div className="flex flex-wrap items-center justify-between gap-2 pt-3 text-xs text-slate-500">
                        <span>
                          Menampilkan {Math.max(1, (safeQuestionPage - 1) * QUESTIONS_PER_PAGE + 1)}
                          {' - '}
                          {Math.min(
                            totalQuestionCount,
                            safeQuestionPage * QUESTIONS_PER_PAGE
                          )}{' '}
                          dari total {totalQuestionCount} pertanyaan
                        </span>
                        {totalQuestionPages > 1 && (
                          <div className="flex flex-wrap items-center gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() =>
                                setQuestionPage((prev) => Math.max(1, prev - 1))
                              }
                              disabled={safeQuestionPage === 1}
                            >
                              Sebelumnya
                            </Button>
                            {Array.from(
                              { length: totalQuestionPages },
                              (_, index) => {
                                const page = index + 1;
                                const isActive = page === safeQuestionPage;
                                return (
                                  <Button
                                    key={page}
                                    size="sm"
                                    variant={isActive ? 'default' : 'outline'}
                                    className={
                                      isActive
                                        ? 'bg-blue-500 text-white hover:bg-blue-600'
                                        : undefined
                                    }
                                    onClick={() => setQuestionPage(page)}
                                  >
                                    {page}
                                  </Button>
                                );
                              }
                            )}
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() =>
                                setQuestionPage((prev) =>
                                  Math.min(totalQuestionPages, prev + 1)
                                )
                              }
                              disabled={safeQuestionPage === totalQuestionPages}
                            >
                              Selanjutnya
                            </Button>
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  <div className="space-y-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-[#0f1e45]">
                    <div>
                      <h2 className="text-sm font-semibold text-slate-700">
                        Upload file evidence{' '}
                        <span className="text-red-500">*</span>
                      </h2>
                      <p className="mt-1 text-xs text-slate-500">
                        Your file will be upload to server
                      </p>
                    </div>
                    <div className="relative flex min-h-[140px] items-center justify-center rounded-xl border-2 border-dashed border-slate-200 bg-slate-50 text-center">
                      <div className="flex flex-col items-center gap-2 text-sm text-slate-500">
                        <UploadCloud className="h-6 w-6 text-slate-400" />
                        Drop files here or click to upload.
                      </div>
                      <input
                        type="file"
                        multiple
                        className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
                        onChange={handleEvidenceUpload}
                        disabled={
                          isUploadingEvidence ||
                          !selectedAreaId ||
                          !activeQuestion ||
                          isAnswerLocked
                        }
                      />
                    </div>
                    {isUploadingEvidence && (
                      <div className="text-xs text-slate-500">Mengunggah file...</div>
                    )}
                    {evidenceList.length > 0 && (
                      <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 text-xs text-slate-500">
                        <div className="mb-2 text-xs font-semibold text-slate-600">
                          File evidence existing
                        </div>
                        <div className="space-y-2">
                          {evidenceList.map((item) => (
                            <div
                              key={item.id}
                              className="flex items-center justify-between gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2"
                            >
                              <a
                                href={resolveApiUrl(item.url)}
                                target="_blank"
                                rel="noreferrer"
                                className="truncate text-blue-600 underline"
                              >
                                {item.name}
                              </a>
                              <Button
                                type="button"
                                size="sm"
                                variant="ghost"
                                onClick={() => handleEvidenceDelete(item.id)}
                                disabled={isAnswerLocked}
                              >
                                Hapus
                              </Button>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                    {evidenceError && (
                      <div className="text-xs text-red-500">{evidenceError}</div>
                    )}
                    <div className="text-xs text-slate-500">
                      *File yang diperbolehkan: JPG, JPEG, PDF, DOCX, PNG, MP3, MP4,
                      XLSX
                      <br />
                      *Max size : 20MB
                    </div>

                    <FormSection title="Data Assessment">
                      <div className="grid gap-4">
                        <FormField label="Protocol Question">
                          <Textarea
                            rows={3}
                            value={activeQuestion?.text ?? ''}
                            disabled
                          />
                        </FormField>
                        <FormField label="Referensi Regulasi">
                          <Textarea
                            rows={2}
                            value={activeQuestion?.reference ?? ''}
                            disabled
                          />
                        </FormField>
                        <FormField label="Status of Implementation" required>
                          <select
                            className="h-10 w-full rounded-md border border-slate-200 px-3 text-sm"
                            value={activeQuestionState.status}
                            onChange={(event) =>
                              handleAssessmentChange(activeQuestion.key, {
                                status: event.target.value,
                              })
                            }
                            disabled={isReviewLocked}
                          >
                            <option value="Satisfactory">Satisfactory</option>
                            <option value="Not Satisfactory">Not Satisfactory</option>
                            <option value="Not Aplicable">Not Aplicable</option>
                          </select>
                        </FormField>
                        <FormField label="Comment">
                          <Textarea
                            rows={3}
                            value={activeQuestionState.comment}
                            onChange={(event) =>
                              handleAssessmentChange(activeQuestion.key, {
                                comment: event.target.value,
                              })
                            }
                            disabled={isReviewLocked}
                          />
                        </FormField>
                        <FormField label="Evidence Notes">
                          <Textarea
                            rows={3}
                            value={activeQuestionState.evidence}
                            onChange={(event) =>
                              handleAssessmentChange(activeQuestion.key, {
                                evidence: event.target.value,
                              })
                            }
                            disabled={isReviewLocked}
                          />
                        </FormField>
                        <div className="text-xs text-red-500">
                          Kolom dengan tanda bintang wajib diisi.
                        </div>
                        <div className="flex flex-wrap items-center justify-end gap-2 pt-2">
                          <Button variant="outline" onClick={handleSaveDraft}>
                            Simpan Draft
                          </Button>
                          <Button
                            className="bg-blue-500 text-white hover:bg-blue-600"
                            onClick={handleSendAssessment}
                            disabled={isAnswerLocked || isSubmittingAnswers}
                          >
                            Kirim
                          </Button>
                        </div>
                      </div>
                    </FormSection>
                  </div>
                </div>
              </div>
            ) : (
              <>
                <SelfAssessmentListFilters
                  month={month}
                  monthOptions={MONTH_OPTIONS}
                  onMonthChange={setMonth}
                  year={year}
                  yearOptions={YEAR_OPTIONS}
                  onYearChange={setYear}
                  searchText={searchText}
                  onSearchTextChange={setSearchText}
                  onSearch={() => {}}
                  onReset={resetFilters}
                  monthClassName={selectClassName}
                />

                <div className="px-6 pb-6">
                  <SelfAssessmentSubmissionTable
                    rows={submissionRows}
                    totalCount={submissionRows.length}
                    onResetFilters={resetFilters}
                  />
                </div>
              </>
            )}
      </SelfAssessmentWorkspace>
    </div>
  );
}
