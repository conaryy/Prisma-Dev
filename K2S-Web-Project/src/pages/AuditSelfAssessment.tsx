import { useEffect, useMemo, useState } from 'react';
import {
  ClipboardCheck,
  FileText,
  FolderOpen,
  RefreshCw,
  Search,
  SendHorizontal,
  UploadCloud,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { FormField, FormSection } from '@/components/shared/Form';
import { toast } from '@/hooks/use-toast';
import { resolveApiUrl } from '@/lib/api';
import { formatDateRangeIndonesian } from '@/lib/date';
import {
  fetchSelfAssessmentAnswers,
  fetchSelfAssessmentQuestions,
  submitSelfAssessmentAnswers,
} from '@/lib/selfAssessment';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  deleteSelfAssessmentEvidence,
  fetchSelfAssessmentEvidence,
  uploadSelfAssessmentEvidence,
} from '@/lib/selfAssessment';
import { type SelfAssessmentScope } from '@/types/selfAssessment';

const MONTH_OPTIONS = [
  { value: 'ALL', label: 'Semua', shortLabel: 'All' },
  { value: 'JANUARI', label: 'JANUARI', shortLabel: 'Jan' },
  { value: 'FEBRUARI', label: 'FEBRUARI', shortLabel: 'Feb' },
  { value: 'MARET', label: 'MARET', shortLabel: 'Mar' },
  { value: 'APRIL', label: 'APRIL', shortLabel: 'Apr' },
  { value: 'MEI', label: 'MEI', shortLabel: 'Mei' },
  { value: 'JUNI', label: 'JUNI', shortLabel: 'Jun' },
  { value: 'JULI', label: 'JULI', shortLabel: 'Jul' },
  { value: 'AGUSTUS', label: 'AGUSTUS', shortLabel: 'Agu' },
  { value: 'SEPTEMBER', label: 'SEPTEMBER', shortLabel: 'Sep' },
  { value: 'OKTOBER', label: 'OKTOBER', shortLabel: 'Okt' },
  { value: 'NOVEMBER', label: 'NOVEMBER', shortLabel: 'Nov' },
  { value: 'DESEMBER', label: 'DESEMBER', shortLabel: 'Des' },
];
const YEAR_OPTIONS = ['ALL', '2026', '2025', '2024', '2023', '2022'];

const selectClassName =
  'h-11 w-full rounded-xl border border-input bg-white/80 px-4 text-sm text-slate-700 shadow-sm transition-colors placeholder:text-slate-400 focus:border-blue-300 focus:outline-none focus:ring-2 focus:ring-blue-200 dark:border-slate-700 dark:bg-slate-900/70 dark:text-slate-100 dark:placeholder:text-slate-400 dark:focus:border-blue-400 dark:focus:ring-blue-900/50 sm:w-60';

type ProtocolQuestion = {
  id: string;
  text: string;
  reference?: string;
  category?: string | null;
  questionCategory?: string | null;
  questionCategoryPrefix?: string | null;
};

type AuditArea = {
  id: string;
  category: string;
  team: {
    leader: string;
    dnp: string[];
    kobo: string[];
  } | null;
};

type AuditSession = {
  id: string;
  title: string | null;
  startDate: string;
  endDate: string;
  areas: AuditArea[];
};

const resolveQuestionCategoryLabel = (question: ProtocolQuestion) => {
  const prefix = question.questionCategoryPrefix?.trim();
  const name = question.questionCategory?.trim();
  if (prefix && name) return `${prefix} - ${name}`;
  if (prefix) return prefix;
  if (name) return name;
  const fallbackPrefix = question.id.split('.')[0]?.trim();
  return fallbackPrefix ? `${fallbackPrefix} - KATEGORI` : 'Kategori';
};

const DEFAULT_PROTOCOL_QUESTIONS: ProtocolQuestion[] = [
  {
    id: 'A.1',
    text: 'Apakah sertifikat penyelenggara pelayanan manajemen lalu lintas dan telekomunikasi penerbangan sesuai dengan pelayanan yang diberikan?',
    reference: 'PKPS 170 - Peraturan Lalu Lintas Penerbangan',
    questionCategory: 'ORGANISASI',
    questionCategoryPrefix: 'A',
  },
  {
    id: 'A.2',
    text: 'Apakah penyelenggara pelayanan manajemen lalu lintas dan telekomunikasi penerbangan mengajukan permohonan perubahan layanan sesuai ketentuan?',
    reference: 'PKPS 170 - Peraturan Lalu Lintas Penerbangan',
    questionCategory: 'ORGANISASI',
    questionCategoryPrefix: 'A',
  },
  {
    id: 'A.3',
    text: 'Apakah penyelenggara pelayanan manajemen lalu lintas dan telekomunikasi penerbangan memiliki Manual yang terdokumentasi dengan baik?',
    reference: 'PKPS 170 - Peraturan Lalu Lintas Penerbangan',
    questionCategory: 'ORGANISASI',
    questionCategoryPrefix: 'A',
  },
  {
    id: 'A.4',
    text: 'Apakah penyelenggara pelayanan manajemen lalu lintas dan telekomunikasi penerbangan melaporkan amandemen layanan secara periodik?',
    reference: 'PKPS 170 - Peraturan Lalu Lintas Penerbangan',
    questionCategory: 'ORGANISASI',
    questionCategoryPrefix: 'A',
  },
  {
    id: 'A.5',
    text: 'Apakah terdapat tindak lanjut terhadap catatan pada sertifikat yang masih berlaku?',
    reference: 'PKPS 170 - Peraturan Lalu Lintas Penerbangan',
    questionCategory: 'ORGANISASI',
    questionCategoryPrefix: 'A',
  },
  {
    id: 'A.6',
    text: 'Apakah penyelenggara pelayanan manajemen lalu lintas dan telekomunikasi penerbangan memiliki struktur organisasi yang jelas?',
    reference: 'PKPS 170 - Peraturan Lalu Lintas Penerbangan',
    questionCategory: 'ORGANISASI',
    questionCategoryPrefix: 'A',
  },
  {
    id: 'A.7',
    text: 'Apakah penyelenggara pelayanan manajemen lalu lintas dan telekomunikasi penerbangan melaporkan kepatuhan terhadap audit internal?',
    reference: 'PKPS 170 - Peraturan Lalu Lintas Penerbangan',
    questionCategory: 'ORGANISASI',
    questionCategoryPrefix: 'A',
  },
];
const QUESTIONS_PER_PAGE = 8;

const FALLBACK_QUESTION: ProtocolQuestion = {
  id: '',
  text: '',
  reference: '',
  questionCategory: '',
  questionCategoryPrefix: '',
};


type ViewMode = 'list' | 'questions';

interface AuditSelfAssessmentProps {
  scope?: SelfAssessmentScope;
  scopeLabel?: string;
  questions?: ProtocolQuestion[];
  sessions?: AuditSession[];
}

export function AuditSelfAssessment({
  scope = 'audit',
  scopeLabel = 'Audit',
  questions,
  sessions = [],
}: AuditSelfAssessmentProps) {
  const [protocolQuestions, setProtocolQuestions] = useState<ProtocolQuestion[]>(
    Array.isArray(questions) ? questions : DEFAULT_PROTOCOL_QUESTIONS
  );
  const [month, setMonth] = useState(MONTH_OPTIONS[0].value);
  const [year, setYear] = useState(YEAR_OPTIONS[0]);
  const [searchText, setSearchText] = useState('');
  const [view, setView] = useState<ViewMode>('list');
  const [selectedAssessmentId, setSelectedAssessmentId] = useState<string | null>(
    null
  );
  const [questionSearch, setQuestionSearch] = useState('');
  const [questionPage, setQuestionPage] = useState(1);
  const [activeQuestionId, setActiveQuestionId] = useState<string | null>(null);
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

  const sessionAreas = useMemo(() => {
    return sessions.flatMap((session) =>
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
  }, [sessions, teamOverrides]);
  const sessionRows = useMemo(() => {
    return sessions.map((session) => {
      const areas = session.areas.map((area) => ({
        id: area.id,
        label: area.category,
        team: teamOverrides[area.id] ?? area.team ?? null,
      }));
      const team = areas.find((item) => item.team)?.team ?? null;
      const schedule =
        session.startDate && session.endDate
          ? `${session.startDate} - ${session.endDate}`
          : null;
      return {
        id: session.id,
        areas,
        team,
        schedule,
      };
    });
  }, [sessions, teamOverrides]);
  const selectedAreaLabel = useMemo(
    () =>
      sessionAreas.find((item) => item.id === selectedAssessmentId)?.area ?? '',
    [sessionAreas, selectedAssessmentId]
  );
  const selectedAreaCategory = selectedAreaLabel.trim().toLowerCase();

  const selectedMonth =
    MONTH_OPTIONS.find((option) => option.value === month) ?? MONTH_OPTIONS[0];
  const badgeLabel = `${selectedMonth.shortLabel} ${year}`;

  const resetFilters = () => {
    setMonth(MONTH_OPTIONS[0].value);
    setYear(YEAR_OPTIONS[0]);
    setSearchText('');
  };

  useEffect(() => {
    if (Array.isArray(questions)) {
      setProtocolQuestions(questions);
    }
  }, [questions]);

  useEffect(() => {
    if (!selectedAssessmentId) {
      return;
    }
    const category = selectedAreaLabel.trim();
    fetchSelfAssessmentQuestions(scope, category || undefined, selectedAssessmentId)
      .then((items) => {
        setProtocolQuestions(
          items.map((item) => ({
            id: item.code,
            text: item.text,
            reference: item.reference ?? undefined,
            category: item.category ?? null,
            questionCategory: item.question_category ?? null,
            questionCategoryPrefix: item.question_category_prefix ?? null,
          }))
        );
      })
      .catch((error: Error) => {
        const message =
          error.message || 'Gagal memuat pertanyaan sesuai sesi terpilih.';
        toast({ title: 'Gagal memuat pertanyaan', description: message });
      });
  }, [scope, selectedAssessmentId, selectedAreaLabel]);

  useEffect(() => {
    setQuestionPage(1);
  }, [questionSearch]);

  useEffect(() => {
    if (!selectedAssessmentId) {
      setAssessmentByQuestion({});
      setReviewByQuestion({});
      return;
    }
    fetchSelfAssessmentAnswers(selectedAssessmentId)
      .then((items) => {
        const nextAnswers: Record<
          string,
          { status: string; comment: string; evidence: string }
        > = {};
        const nextReview: Record<string, { allowReply: boolean; isFinal: boolean }> =
          {};
        const nextSubmitted: Record<string, boolean> = {};
        items.forEach((item) => {
          nextAnswers[item.questionCode] = {
            status: item.status,
            comment: item.comment ?? '',
            evidence: item.evidenceNote ?? '',
          };
          if (item.review) {
            nextReview[item.questionCode] = {
              allowReply: item.review.allowReply,
              isFinal: item.review.isFinal,
            };
          }
          nextSubmitted[item.questionCode] = item.isSubmitted;
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
  }, [selectedAssessmentId]);

  const filteredByCategory = selectedAreaCategory
    ? protocolQuestions.filter(
        (question) =>
          (question.category ?? '').trim().toLowerCase() === selectedAreaCategory
      )
    : protocolQuestions;
  const filteredQuestions = filteredByCategory.filter((question) =>
    `${question.id} ${question.text}`
      .toLowerCase()
      .includes(questionSearch.toLowerCase())
  );
  const totalQuestionCount = filteredQuestions.length;
  const totalQuestionPages = Math.max(
    1,
    Math.ceil(totalQuestionCount / QUESTIONS_PER_PAGE)
  );
  const safeQuestionPage = Math.min(questionPage, totalQuestionPages);
  const startIndex = (safeQuestionPage - 1) * QUESTIONS_PER_PAGE;
  const pagedQuestions = filteredQuestions.slice(
    startIndex,
    startIndex + QUESTIONS_PER_PAGE
  );

  useEffect(() => {
    if (questionPage !== safeQuestionPage) {
      setQuestionPage(safeQuestionPage);
    }
  }, [questionPage, safeQuestionPage]);

  useEffect(() => {
    if (!activeQuestionId) {
      setActiveQuestionId(pagedQuestions[0]?.id ?? null);
      return;
    }
    if (pagedQuestions.length === 0) {
      return;
    }
    if (!pagedQuestions.some((question) => question.id === activeQuestionId)) {
      setActiveQuestionId(pagedQuestions[0]?.id ?? null);
    }
  }, [activeQuestionId, pagedQuestions]);

  const activeQuestion =
    protocolQuestions.find((question) => question.id === activeQuestionId) ??
    protocolQuestions[0] ??
    FALLBACK_QUESTION;
  const activeQuestionState = assessmentByQuestion[activeQuestion.id] ?? {
    status: 'Satisfactory',
    comment: '',
    evidence: '',
  };
  const allowReply = reviewByQuestion[activeQuestion.id]?.allowReply ?? false;
  const isSubmitted = submittedByQuestion[activeQuestion.id] ?? false;
  const isReviewLocked = reviewByQuestion[activeQuestion.id]?.isFinal ?? false;
  const isMonitoringScope = scope === 'monitoring';
  const isAnswerLocked = isMonitoringScope
    ? isReviewLocked
    : isSubmitted && !allowReply;
  const hasActiveEvidence = evidenceList.length > 0;

  const isQuestionFilled = (questionId: string) => {
    const state = assessmentByQuestion[questionId];
    if (!state) return false;
    return (
      state.comment.trim().length > 0 ||
      state.evidence.trim().length > 0 ||
      state.status !== 'Satisfactory'
    );
  };

  const resolveQuestionStatusTone = (questionId: string) => {
    const status = (assessmentByQuestion[questionId]?.status ?? '')
      .trim()
      .toLowerCase();
    if (status === 'not satisfactory') return 'not-satisfactory';
    if (status === 'not aplicable' || status === 'not applicable') return 'not-applicable';
    if (status === 'satisfactory') return 'satisfactory';
    return 'default';
  };

  const getQuestionVisual = (questionId: string) => {
    const isSubmittedQuestion = submittedByQuestion[questionId] ?? false;
    const isActiveQuestion = activeQuestionId === questionId;
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

    const tone = resolveQuestionStatusTone(questionId);
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
    isQuestionFilled(question.id)
  ).length;
  const submittedQuestionCount = filteredQuestions.filter(
    (question) => submittedByQuestion[question.id]
  ).length;

  const questionRows: JSX.Element[] = [];
  let lastCategoryLabel: string | null = null;
  pagedQuestions.forEach((question) => {
    const categoryLabel = resolveQuestionCategoryLabel(question);
    const questionVisual = getQuestionVisual(question.id);
    if (categoryLabel && categoryLabel !== lastCategoryLabel) {
      questionRows.push(
        <div
          key={`${question.id}-category`}
          className="bg-slate-100 px-3 py-2 text-xs font-semibold text-slate-600 dark:bg-slate-800 dark:text-slate-200"
        >
          {categoryLabel}
        </div>
      );
      lastCategoryLabel = categoryLabel;
    }
    questionRows.push(
      <label
        key={question.id}
        className={`flex cursor-pointer items-start gap-3 px-3 py-3 text-sm transition-colors ${questionVisual.row}`}
        onClick={() => setActiveQuestionId(question.id)}
      >
        <span
          className={`mt-1 inline-flex h-4 w-4 items-center justify-center rounded border text-[10px] font-semibold ${questionVisual.marker}`}
        >
          {submittedByQuestion[question.id]
            ? '✓'
            : isQuestionFilled(question.id)
            ? '•'
            : ''}
        </span>
        <div className="flex-1 whitespace-pre-line">
          <span className="font-semibold">{question.id}</span> - {question.text}
        </div>
        <SendHorizontal className="mt-1 h-4 w-4 text-slate-400" />
      </label>
    );
  });

  const openQuestions = (assessmentId: string | null) => {
    const assessment = sessionAreas.find((item) => item.id === assessmentId);
    const fallbackId = assessment?.id ?? sessionAreas[0]?.id ?? null;
    setSelectedAssessmentId(fallbackId);
    setView('questions');
    if (!activeQuestionId) {
      setActiveQuestionId(protocolQuestions[0]?.id ?? null);
    }
  };

  useEffect(() => {
    if (!selectedAssessmentId || !activeQuestionId) {
      setEvidenceList([]);
      return;
    }
    fetchSelfAssessmentEvidence({
      sessionAreaId: selectedAssessmentId,
      questionCode: activeQuestionId,
    })
      .then((items) => setEvidenceList(items))
      .catch((error: Error) => {
        setEvidenceError(error.message || 'Gagal memuat evidence.');
      });
  }, [selectedAssessmentId, activeQuestionId]);

  const handleEvidenceUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files ?? []);
    if (files.length === 0) {
      return;
    }
    if (!selectedAssessmentId || !activeQuestionId) {
      setEvidenceError('Pilih area dan pertanyaan terlebih dahulu.');
      event.target.value = '';
      return;
    }
    setEvidenceError(null);
    setIsUploadingEvidence(true);
    try {
      for (const file of files) {
        await uploadSelfAssessmentEvidence({
          sessionAreaId: selectedAssessmentId,
          questionCode: activeQuestionId,
          file,
        });
      }
      const items = await fetchSelfAssessmentEvidence({
        sessionAreaId: selectedAssessmentId,
        questionCode: activeQuestionId,
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
    if (!selectedAssessmentId || !activeQuestionId) {
      return;
    }
    setEvidenceError(null);
    try {
      await deleteSelfAssessmentEvidence(id);
      const items = await fetchSelfAssessmentEvidence({
        sessionAreaId: selectedAssessmentId,
        questionCode: activeQuestionId,
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
    questionId: string,
    nextValue: { status?: string; comment?: string; evidence?: string }
  ) => {
    setAssessmentByQuestion((prev) => ({
      ...prev,
      [questionId]: {
        status: nextValue.status ?? prev[questionId]?.status ?? 'Satisfactory',
        comment: nextValue.comment ?? prev[questionId]?.comment ?? '',
        evidence: nextValue.evidence ?? prev[questionId]?.evidence ?? '',
      },
    }));
  };

  const handleSaveDraft = () => {
    if (!selectedAssessmentId || !activeQuestionId) {
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
    if (!isQuestionFilled(activeQuestionId)) {
      toast({
        title: 'Belum ada jawaban',
        description: 'Isi jawaban sebelum menyimpan draft.',
      });
      return;
    }
    setIsSubmittingAnswers(true);
    submitSelfAssessmentAnswers([
      {
        sessionAreaId: selectedAssessmentId,
        questionCode: activeQuestionId,
        status: assessmentByQuestion[activeQuestionId]?.status ?? 'Satisfactory',
        comment: assessmentByQuestion[activeQuestionId]?.comment ?? '',
        evidenceNote: assessmentByQuestion[activeQuestionId]?.evidence ?? '',
        submit: false,
      },
    ])
      .then(() => {
        setSubmittedByQuestion((prev) => ({
          ...prev,
          [activeQuestionId]: false,
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

  const handleSendAssessment = () => {
    if (!selectedAssessmentId || !activeQuestionId) {
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
    if (!isQuestionFilled(activeQuestionId)) {
      toast({
        title: 'Belum ada jawaban',
        description: 'Isi jawaban sebelum mengirim.',
      });
      return;
    }
    if (!hasActiveEvidence) {
      toast({
        title: 'Evidence wajib diunggah',
        description: 'Upload minimal 1 file evidence sebelum mengirim PQ.',
      });
      return;
    }
    setIsSubmittingAnswers(true);
    submitSelfAssessmentAnswers([
      {
        sessionAreaId: selectedAssessmentId,
        questionCode: activeQuestionId,
        status: assessmentByQuestion[activeQuestionId]?.status ?? 'Satisfactory',
        comment: assessmentByQuestion[activeQuestionId]?.comment ?? '',
        evidenceNote: assessmentByQuestion[activeQuestionId]?.evidence ?? '',
      },
    ])
      .then(() => {
        setSubmittedByQuestion((prev) => ({
          ...prev,
          [activeQuestionId]: true,
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

  const handleSendAll = () => {
    if (!selectedAssessmentId) {
      toast({
        title: 'Pilih area terlebih dahulu',
        description: 'Pilih area sebelum mengirim semua.',
      });
      return;
    }
    const items = filteredByCategory
      .filter(
        (question) =>
          isQuestionFilled(question.id) &&
          !(
            submittedByQuestion[question.id] &&
            !reviewByQuestion[question.id]?.allowReply &&
            scope !== 'monitoring'
          )
      )
      .map((question) => ({
        sessionAreaId: selectedAssessmentId,
        questionCode: question.id,
        status: assessmentByQuestion[question.id]?.status ?? 'Satisfactory',
        comment: assessmentByQuestion[question.id]?.comment ?? '',
        evidenceNote: assessmentByQuestion[question.id]?.evidence ?? '',
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
            next[item.questionCode] = true;
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
      <section className="overflow-hidden rounded-[28px] border border-slate-200/80 bg-white shadow-[0_24px_60px_rgba(15,23,42,0.08)] dark:border-slate-700/80 dark:bg-[#0b1736] dark:shadow-[0_24px_60px_rgba(2,8,28,0.55)]">
        <header className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-100 px-6 py-5 dark:border-slate-700">
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl border border-blue-200 bg-blue-50 text-blue-600 shadow-sm">
                <ClipboardCheck className="h-5 w-5" />
              </span>
              <h1 className="text-lg font-semibold text-slate-800 dark:text-slate-100">
                Protocol Question (PQ)
              </h1>
            </div>
            <span className="hidden h-6 w-px bg-slate-200 sm:block dark:bg-slate-700" />
            <div className="flex items-center gap-2 text-sm text-slate-500 dark:text-slate-300">
              <span>{scopeLabel}</span>
              <span>/</span>
              <span className="font-semibold text-blue-600">
                Protocol Question (PQ)
              </span>
            </div>
          </div>
        </header>

        <div className="bg-blue-50/60 px-6 py-6 dark:bg-[#0d214f]">
          <section className="overflow-hidden rounded-2xl border border-blue-100/60 bg-white shadow-sm dark:border-slate-700 dark:bg-[#132754]">
            <div className="flex flex-wrap items-start justify-between gap-4 border-b border-slate-100 px-6 py-5 dark:border-slate-700">
              <div className="flex items-start gap-4">
                <span className="flex h-12 w-12 items-center justify-center rounded-full bg-blue-100 text-blue-600">
                  <FileText className="h-5 w-5" />
                </span>
                <div className="space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="text-lg font-semibold text-slate-800 dark:text-slate-100">
                      Data Self Assessment
                    </h2>
                    {selectedAreaLabel && (
                      <span className="rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700">
                        {selectedAreaLabel}
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-slate-500 dark:text-slate-300">
                    Lihat dan kelola data hasil self assessment Protocol Question (PQ).
                  </p>
                </div>
              </div>
              {view !== 'list' ? (
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
              )}
            </div>

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
                    {reviewByQuestion[activeQuestion.id] && (
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
                        disabled={isSubmittingAnswers || !selectedAssessmentId}
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
                        172 - PENYELENGGARA PELAYANAN LALU LINTAS DAN TELEKOMUNIKASI
                        PENERBANGAN
                      </div>
                      <div className="divide-y">
                        {questionRows}
                        {totalQuestionCount === 0 && (
                          <div className="px-3 py-4 text-sm text-slate-500">
                            Tidak ada pertanyaan yang cocok.
                          </div>
                        )}
                      </div>
                    </div>
                    {totalQuestionCount > 0 && (
                      <div className="flex flex-wrap items-center justify-between gap-2 pt-3 text-xs text-slate-500">
                        <span>
                          Menampilkan{' '}
                          {Math.max(1, (safeQuestionPage - 1) * QUESTIONS_PER_PAGE + 1)}
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
                          !selectedAssessmentId ||
                          !activeQuestionId ||
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
                              handleAssessmentChange(activeQuestion.id, {
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
                              handleAssessmentChange(activeQuestion.id, {
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
                              handleAssessmentChange(activeQuestion.id, {
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
                            disabled={isAnswerLocked || isSubmittingAnswers || !hasActiveEvidence}
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
                <div className="flex flex-wrap items-center gap-4 px-6 py-5">
                  <select
                    className={selectClassName}
                    value={month}
                    onChange={(event) => setMonth(event.target.value)}
                  >
                    {MONTH_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                  <select
                    className="h-11 w-full rounded-xl border border-input bg-white/80 px-4 text-sm text-slate-700 shadow-sm transition-colors focus:border-blue-300 focus:outline-none focus:ring-2 focus:ring-blue-200 dark:text-slate-100 sm:w-32"
                    value={year}
                    onChange={(event) => setYear(event.target.value)}
                  >
                    {YEAR_OPTIONS.map((option) => (
                      <option key={option} value={option}>
                        {option}
                      </option>
                    ))}
                  </select>
                  <div className="relative min-w-0 flex-1 sm:min-w-[220px]">
                    <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400 dark:text-blue-200/70" />
                    <Input
                      value={searchText}
                      onChange={(event) => setSearchText(event.target.value)}
                      className="h-11 rounded-xl border border-input bg-white/80 pl-9 text-slate-700 placeholder:text-slate-400 focus-visible:border-blue-300 focus-visible:ring-2 focus-visible:ring-blue-200 dark:text-slate-100"
                      placeholder="Cari area / ketua tim..."
                    />
                  </div>
                  <Button
                    type="button"
                    className="h-11 rounded-xl bg-blue-500 px-5 text-white shadow-sm hover:bg-blue-600"
                  >
                    <Search className="mr-2 h-4 w-4" />
                    Search
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    className="h-11 rounded-xl border-slate-200 px-4 text-slate-600 shadow-sm hover:border-blue-200 hover:bg-blue-50"
                    onClick={resetFilters}
                  >
                    <RefreshCw className="mr-2 h-4 w-4" />
                    Reset
                  </Button>
                </div>

                <div className="px-6 pb-6">
                  <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900/60">
                    <Table className="w-full">
                      <TableHeader className="bg-slate-50/80">
                        <TableRow>
                          <TableHead
                            rowSpan={2}
                            className="border-r border-slate-200 text-center text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500"
                          >
                            No
                          </TableHead>
                          <TableHead
                            rowSpan={2}
                            className="border-r border-slate-200 text-center text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500"
                          >
                            Area
                          </TableHead>
                          <TableHead
                            rowSpan={2}
                            className="border-r border-slate-200 text-center text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500"
                          >
                            Ketua Tim
                          </TableHead>
                          <TableHead
                            colSpan={2}
                            className="border-r border-slate-200 text-center text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500"
                          >
                            Anggota
                          </TableHead>
                          <TableHead
                            rowSpan={2}
                            className="text-center text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500"
                          >
                            Tanggal Pelaksanaan
                          </TableHead>
                        </TableRow>
                        <TableRow>
                          <TableHead className="border-r border-slate-200 text-center text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500">
                            Anggota
                          </TableHead>
                          <TableHead className="border-r border-slate-200 text-center text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500">
                            Audity
                          </TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {sessionRows.length === 0 ? (
                          <TableRow>
                            <TableCell colSpan={6} className="py-16">
                              <div className="flex flex-col items-center gap-3 text-center text-slate-500">
                                <div className="relative">
                                  <FolderOpen className="h-16 w-16 text-blue-200" />
                                  <Search className="absolute bottom-1 right-0 h-6 w-6 rounded-full bg-blue-100 p-1 text-blue-400" />
                                </div>
                                <div className="space-y-1">
                                  <div className="text-base font-semibold text-slate-700">
                                    Belum ada data
                                  </div>
                                  <div className="text-sm text-slate-500">
                                    Coba ubah filter bulan/tahun atau reset filter
                                  </div>
                                </div>
                                <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
                                  <Button
                                    type="button"
                                    variant="outline"
                                    className="rounded-xl border-slate-200 px-4 text-slate-600 shadow-sm hover:border-blue-200 hover:bg-blue-50"
                                    onClick={resetFilters}
                                  >
                                    <RefreshCw className="mr-2 h-4 w-4" />
                                    Reset Filter
                                  </Button>
                                </div>
                              </div>
                            </TableCell>
                          </TableRow>
                        ) : (
                          sessionRows.map((row, index) => (
                            <TableRow key={row.id}>
                              <TableCell className="text-center text-sm">
                                {index + 1}
                              </TableCell>
                              <TableCell className="text-center">
                                <div className="flex flex-wrap justify-center gap-2">
                                  {row.areas.map((area) => (
                                    <Button
                                      key={area.id}
                                      type="button"
                                      size="sm"
                                      variant="outline"
                                      className="h-8 rounded-lg border-blue-200 bg-blue-50 text-xs font-semibold text-blue-700"
                                      onClick={() => openQuestions(area.id)}
                                    >
                                      {area.label}
                                    </Button>
                                  ))}
                                </div>
                              </TableCell>
                              <TableCell className="text-center text-sm">
                                {row.team?.leader ?? '-'}
                              </TableCell>
                              <TableCell className="text-sm">
                                <ol className="list-decimal space-y-1 pl-4">
                                  {(row.team?.dnp ?? []).map((name) => (
                                    <li key={name}>{name}</li>
                                  ))}
                                </ol>
                              </TableCell>
                              <TableCell className="text-sm">
                                <ol className="list-decimal space-y-1 pl-4">
                                  {(row.team?.kobo ?? []).map((name) => (
                                    <li key={name}>{name}</li>
                                  ))}
                                </ol>
                              </TableCell>
                              <TableCell className="text-center text-sm text-slate-500">
                                {row.schedule
                                  ? formatDateRangeIndonesian(row.schedule)
                                  : 'Menunggu admin'}
                              </TableCell>
                            </TableRow>
                          ))
                        )}
                      </TableBody>
                    </Table>
                    <div className="border-t border-slate-200 px-4 py-3 text-sm text-slate-500">
                      Menampilkan {sessionRows.length || 0} dari total{' '}
                      {sessionRows.length || 0} data
                    </div>
                  </div>
                </div>
              </>
            )}
          </section>
        </div>
      </section>
    </div>
  );
}
