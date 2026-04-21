export type SelfAssessmentScope =
  | 'audit'
  | 'monitoring'
  | 'inspeksi'
  | 'surveillance';

export type SelfAssessmentQuestion = {
  id: string;
  scope: SelfAssessmentScope;
  category: string | null;
  question_category?: string | null;
  question_category_prefix?: string | null;
  code: string;
  text: string;
  reference: string | null;
  is_active: boolean;
  sort_order: number;
};

export type SelfAssessmentReview = {
  id: string;
  status: string;
  comment?: string | null;
  severity?: string | null;
  probability?: string | null;
  resume?: string | null;
  description?: string | null;
  finding?: string | null;
  recommendations?: string | null;
  remark?: string | null;
  allowReply: boolean;
  isFinal: boolean;
  sentAt?: string | null;
  reviewer?: { id: string; name: string; email?: string } | null;
};

export type SelfAssessmentAnswer = {
  id: string;
  questionCode: string;
  status: string;
  comment?: string | null;
  evidenceNote?: string | null;
  isSubmitted: boolean;
  submittedAt?: string | null;
  resultFinalizedAt?: string | null;
  review?: SelfAssessmentReview | null;
};

export type SelfAssessmentReviewSummary = {
  sessionAreaId: string;
  area: string;
  scope: string;
  schedule: string | null;
  leader: string;
  dnp: string[];
  kobo: string[];
  questionCount: number;
  submittedAt: string | null;
};
