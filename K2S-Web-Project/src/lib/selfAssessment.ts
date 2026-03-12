import { apiFetch } from '@/lib/api';
import {
  SelfAssessmentAnswer,
  SelfAssessmentQuestion,
  SelfAssessmentReviewSummary,
  SelfAssessmentScope,
} from '@/types/selfAssessment';

export async function fetchSelfAssessmentQuestions(
  scope: SelfAssessmentScope,
  category?: string,
  sessionAreaId?: string
) {
  const params = new URLSearchParams({ scope });
  if (category) {
    params.set('category', category);
  }
  if (sessionAreaId) {
    params.set('sessionAreaId', sessionAreaId);
  }
  const response = await apiFetch<{ data: SelfAssessmentQuestion[] }>(
    `/api/self-assessment/questions?${params.toString()}`
  );
  return response.data;
}

export type SelfAssessmentSessionArea = {
  id: string;
  category: string;
  team: {
    leader: string;
    dnp: string[];
    kobo: string[];
  } | null;
};

export type SelfAssessmentSession = {
  id: string;
  title: string | null;
  startDate: string;
  endDate: string;
  targetSessionAreaIds?: string[];
  targetAgendaIds?: string[];
  areas: SelfAssessmentSessionArea[];
};

export async function fetchSelfAssessmentSessions(scope: SelfAssessmentScope) {
  const response = await apiFetch<{ data: SelfAssessmentSession[] }>(
    `/api/self-assessment/sessions?scope=${scope}`
  );
  return response.data;
}

export async function fetchSelfAssessmentAnswers(sessionAreaId: string) {
  const response = await apiFetch<{ data: SelfAssessmentAnswer[] }>(
    `/api/self-assessment/answers?sessionAreaId=${sessionAreaId}`
  );
  return response.data;
}

export async function submitSelfAssessmentAnswers(items: Array<{
  sessionAreaId: string;
  questionCode: string;
  status: string;
  comment?: string;
  submit?: boolean;
  evidenceNote?: string;
}>) {
  const response = await apiFetch<{ data: { saved: string[] } }>(
    '/api/self-assessment/answers/bulk',
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ items }),
    }
  );
  return response.data;
}

export type SelfAssessmentEvidence = {
  id: string;
  name: string;
  url: string;
  created_at?: string;
};

export async function fetchSelfAssessmentEvidence(params: {
  sessionAreaId: string;
  questionCode: string;
}) {
  const query = new URLSearchParams({
    sessionAreaId: params.sessionAreaId,
    questionCode: params.questionCode,
  });
  const response = await apiFetch<{ data: SelfAssessmentEvidence[] }>(
    `/api/self-assessment/evidence?${query.toString()}`
  );
  return response.data;
}

export async function uploadSelfAssessmentEvidence(params: {
  sessionAreaId: string;
  questionCode: string;
  file: File;
}) {
  const formData = new FormData();
  formData.append('sessionAreaId', params.sessionAreaId);
  formData.append('questionCode', params.questionCode);
  formData.append('file', params.file);

  const response = await apiFetch<{ data: SelfAssessmentEvidence }>(
    '/api/self-assessment/evidence',
    {
      method: 'POST',
      body: formData,
    }
  );
  return response.data;
}

export async function deleteSelfAssessmentEvidence(id: string) {
  const response = await apiFetch<{ data: { success: boolean } }>(
    `/api/self-assessment/evidence/${id}`,
    { method: 'DELETE' }
  );
  return response.data;
}

export async function fetchSelfAssessmentReviewList(params: {
  scope?: SelfAssessmentScope;
  month?: string;
  year?: string;
}) {
  const query = new URLSearchParams();
  if (params.scope) query.set('scope', params.scope);
  if (params.month) query.set('month', params.month);
  if (params.year) query.set('year', params.year);
  const response = await apiFetch<{ data: SelfAssessmentReviewSummary[] }>(
    `/api/self-assessment/reviews?${query.toString()}`
  );
  return response.data;
}

export async function fetchSelfAssessmentReviewDetail(sessionAreaId: string) {
  const response = await apiFetch<{ data: {
    sessionAreaId: string;
    area: string;
    scope: string;
    schedule: string | null;
    totalQuestions?: number;
    answers: Array<{
      id: string;
      questionCode: string;
      questionText: string;
      reference: string | null;
      status: string;
      comment: string | null;
      evidenceNote?: string | null;
      createdAt?: string | null;
      updatedAt?: string | null;
      createdBy?: { id: string; name: string; email?: string } | null;
      isSubmitted?: boolean;
      submittedAt: string | null;
      evidence: Array<{ id: string; name: string; url: string }>;
      review: {
        id: string;
        status: string;
        comment: string | null;
        severity?: string | null;
        probability?: string | null;
        resume?: string | null;
        description?: string | null;
        finding?: string | null;
        recommendations?: string | null;
        remark?: string | null;
        allowReply: boolean;
        isFinal: boolean;
        sentAt: string | null;
        reviewer?: { id: string; name: string; email?: string } | null;
      } | null;
    }>;
  } }>(`/api/self-assessment/reviews/${sessionAreaId}`);
  return response.data;
}

export async function fetchAdminSelfAssessmentSubmissions(params: {
  scope?: SelfAssessmentScope;
  month?: string;
  year?: string;
}) {
  const query = new URLSearchParams();
  if (params.scope) query.set('scope', params.scope);
  if (params.month) query.set('month', params.month);
  if (params.year) query.set('year', params.year);
  const response = await apiFetch<{ data: Array<{
    sessionAreaId: string;
    user: { id: string; name: string; email?: string } | null;
    area: string;
    scope: string;
    schedule: string | null;
    leader: string;
    dnp: string[];
    kobo: string[];
    questionCount: number;
    submittedAt: string | null;
  }> }>(`/api/admin/self-assessment/submissions?${query.toString()}`);
  return response.data;
}

export async function fetchAdminSelfAssessmentSubmissionDetail(params: {
  sessionAreaId: string;
  userId: string;
}) {
  const response = await apiFetch<{ data: {
    sessionAreaId: string;
    area: string;
    scope: string;
    schedule: string | null;
    team: { leader: string; dnp: string[]; kobo: string[] } | null;
    totalQuestions?: number;
    result: {
      id: string;
      status: string;
      finalizedAt: string | null;
      files: Array<{ id: string; name: string; url: string }>;
    } | null;
    answers: Array<{
      id: string;
      questionCode: string;
      questionText: string;
      reference: string | null;
      status: string;
      comment: string | null;
      submittedAt: string | null;
      isSubmitted?: boolean;
      evidence: Array<{ id: string; name: string; url: string }>;
      review: {
        id: string;
        status: string;
        comment: string | null;
        severity?: string | null;
        probability?: string | null;
        resume?: string | null;
        description?: string | null;
        finding?: string | null;
        recommendations?: string | null;
        remark?: string | null;
        allowReply: boolean;
        isFinal: boolean;
        sentAt: string | null;
        reviewer?: { id: string; name: string; email?: string } | null;
      } | null;
    }>;
  } }>(
    `/api/admin/self-assessment/submissions/${params.sessionAreaId}?userId=${params.userId}`
  );
  return response.data;
}

export async function submitAdminSelfAssessmentReviews(payload: {
  items: Array<{
    answerId: string;
    status: string;
    comment?: string;
    severity?: string;
    probability?: string;
    resume?: string;
    description?: string;
    finding?: string;
    recommendations?: string;
    remark?: string;
  }>;
  action: 'draft' | 'send';
  allowReply?: boolean;
}) {
  const response = await apiFetch<{ data: { saved: string[] } }>(
    '/api/admin/self-assessment/reviews/bulk',
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    }
  );
  return response.data;
}

export async function finalizeSelfAssessmentResult(payload: {
  sessionAreaId: string;
  userId: string;
  status: 'interim' | 'final';
  files?: File[];
  replaceFiles?: boolean;
}) {
  const formData = new FormData();
  formData.append('sessionAreaId', payload.sessionAreaId);
  formData.append('userId', payload.userId);
  formData.append('status', payload.status);
  formData.append('replaceFiles', payload.replaceFiles ? '1' : '0');
  if (payload.files) {
    payload.files.forEach((file) => formData.append('files[]', file));
  }

  const response = await apiFetch<{ data: {
    id: string;
    status: string;
    finalizedAt: string | null;
    files: Array<{ id: string; name: string; url: string }>;
  } }>(
    '/api/admin/self-assessment/results/finalize',
    {
      method: 'POST',
      body: formData,
    }
  );
  return response.data;
}

export async function deleteSelfAssessmentResultFile(fileId: string) {
  const response = await apiFetch<{ data: { deleted: boolean } }>(
    `/api/admin/self-assessment/results/files/${fileId}`,
    { method: 'DELETE' }
  );
  return response.data;
}

export async function fetchSelfAssessmentResults(params: {
  scope?: SelfAssessmentScope;
  status?: 'interim' | 'final';
  year?: string;
}) {
  const query = new URLSearchParams();
  if (params.scope) query.set('scope', params.scope);
  if (params.status) query.set('status', params.status);
  if (params.year) query.set('year', params.year);
  const response = await apiFetch<{ data: Array<{
    id: string;
    sessionAreaId: string;
    area: string;
    scope: string;
    schedule: string | null;
    leader: string;
    dnp: string[];
    kobo: string[];
    status: string;
    finalizedAt: string | null;
    files: Array<{ id: string; name: string; url: string }>;
  }> }>(`/api/self-assessment/results?${query.toString()}`);
  return response.data;
}

export async function finalizeMonitoringResult(payload: {
  sessionAreaId: string;
  userId: string;
  status: 'interim' | 'final';
  files?: File[];
  replaceFiles?: boolean;
}) {
  const formData = new FormData();
  formData.append('sessionAreaId', payload.sessionAreaId);
  formData.append('userId', payload.userId);
  formData.append('status', payload.status);
  formData.append('replaceFiles', payload.replaceFiles ? '1' : '0');
  if (payload.files) {
    payload.files.forEach((file) => formData.append('files[]', file));
  }

  const response = await apiFetch<{ data: {
    id: string;
    status: string;
    finalizedAt: string | null;
    files: Array<{ id: string; name: string; url: string }>;
  } }>(
    '/api/admin/self-assessment/results/monitoring/finalize',
    {
      method: 'POST',
      body: formData,
    }
  );
  return response.data;
}

export async function deleteMonitoringResultFile(fileId: string) {
  const response = await apiFetch<{ data: { deleted: boolean } }>(
    `/api/admin/self-assessment/results/monitoring/files/${fileId}`,
    { method: 'DELETE' }
  );
  return response.data;
}

export async function fetchMonitoringResults(params: {
  scope?: SelfAssessmentScope;
  status?: 'interim' | 'final';
  year?: string;
}) {
  const query = new URLSearchParams();
  if (params.scope) query.set('scope', params.scope);
  if (params.status) query.set('status', params.status);
  if (params.year) query.set('year', params.year);
  const response = await apiFetch<{ data: Array<{
    id: string;
    sessionAreaId: string;
    area: string;
    scope: string;
    schedule: string | null;
    leader: string;
    dnp: string[];
    kobo: string[];
    status: string;
    finalizedAt: string | null;
    files: Array<{ id: string; name: string; url: string }>;
  }> }>(`/api/self-assessment/monitoring-results?${query.toString()}`);
  return response.data;
}

export async function fetchSelfAssessmentCap(params: {
  scope: SelfAssessmentScope;
  sessionAreaId: string;
  includeReviewed?: boolean;
}) {
  const query = new URLSearchParams({
    scope: params.scope,
    sessionAreaId: params.sessionAreaId,
  });
  if (params.includeReviewed) {
    query.set('includeReviewed', '1');
  }
  const response = await apiFetch<{ data: Array<{
    answerId: string;
    questionCode: string;
    questionText: string;
    reference: string | null;
    status: string;
    review: {
      status: string;
      severity?: string | null;
      probability?: string | null;
      resume?: string | null;
      finding?: string | null;
      recommendations?: string | null;
      description?: string | null;
      reviewedBy?: { id: string; name: string; email?: string } | null;
      reviewedAt?: string | null;
    } | null;
    cap: {
      id: string;
      actionPlan: string;
      targetDate: string | null;
      status: string;
      sentAt: string | null;
    review: {
      result: string | null;
      comment: string | null;
      status: string | null;
      reviewedBy?: { id: string; name: string; email?: string } | null;
      reviewedAt?: string | null;
    } | null;
    fulfillmentReview?: {
      result: string | null;
      comment: string | null;
      status: string | null;
      reviewedBy?: { id: string; name: string; email?: string } | null;
      reviewedAt?: string | null;
    } | null;
      fulfillments: Array<{
        id: string;
        step: number;
        proposeAction: string;
        actionOffice: string;
        evidenceReference: string | null;
        completeDate: string | null;
        progress: number;
        status: string;
        submittedAt: string | null;
        createdAt?: string | null;
        files: Array<{ id: string; name: string; url: string }>;
      }>;
      extensions: Array<{
        id: string;
        dueDate: string;
        fileName: string;
        fileUrl: string;
        status: string;
      }>;
    } | null;
  }> }>(`/api/self-assessment/cap?${query.toString()}`);
  return response.data;
}

export async function fetchSelfAssessmentCapList() {
  const response = await apiFetch<{ data: Array<{
    id: string;
    answerId: string;
    sessionAreaId: string | null;
    scope: string;
    area: string;
    questionCode: string | null;
    questionText: string;
    questionCategory: string | null;
    questionCategoryPrefix: string | null;
    leader: string | null;
    targetDate: string | null;
    isClosed: boolean;
  }> }>('/api/self-assessment/cap/list');
  return response.data;
}

export async function fetchSelfAssessmentCapSessions(params: {
  scope: SelfAssessmentScope;
  month?: string;
  year?: string;
}) {
  const query = new URLSearchParams({ scope: params.scope });
  if (params.month) query.set('month', params.month);
  if (params.year) query.set('year', params.year);
  const response = await apiFetch<{ data: Array<{
    sessionAreaId: string;
    area: string;
    scope: string;
    schedule: string | null;
    leader: string;
    dnp: string[];
    kobo: string[];
    notSatisfactoryCount: number;
    finalizedAt: string | null;
  }> }>(`/api/self-assessment/cap/sessions?${query.toString()}`);
  return response.data;
}

export async function fetchSelfAssessmentCapFulfillmentSessions(params?: {
  scope?: SelfAssessmentScope;
  month?: string;
  year?: string;
}) {
  const query = new URLSearchParams();
  if (params?.scope) query.set('scope', params.scope);
  if (params?.month) query.set('month', params.month);
  if (params?.year) query.set('year', params.year);
  const response = await apiFetch<{ data: Array<{
    sessionAreaId: string;
    title: string | null;
    area: string;
    scope: string;
    schedule: string | null;
    leader: string;
    dnp: string[];
    kobo: string[];
    fulfillmentCount: number;
    sentAt: string | null;
  }> }>(`/api/self-assessment/cap/fulfillment-sessions?${query.toString()}`);
  return response.data;
}

export async function fetchSelfAssessmentCapSessionsAll(params?: {
  scopes?: SelfAssessmentScope[];
  month?: string;
  year?: string;
}) {
  const scopes = params?.scopes ?? ['audit', 'inspeksi', 'surveillance', 'monitoring'];
  const results = await Promise.all(
    scopes.map((scope) =>
      fetchSelfAssessmentCapSessions({
        scope,
        month: params?.month,
        year: params?.year,
      }).catch(() => [])
    )
  );
  return results.flat();
}

export async function submitSelfAssessmentCap(payload: {
  answerId: string;
  actionPlan: string;
  targetDate: string;
  action: 'draft' | 'send';
}) {
  const response = await apiFetch<{ data: { id: string; status: string; sentAt: string | null } }>(
    '/api/self-assessment/cap',
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    }
  );
  return response.data;
}

export async function submitSelfAssessmentCapFulfillment(payload: {
  capId: string;
  step: number;
  proposeAction: string;
  actionOffice: string;
  evidenceReference?: string;
  completeDate: string;
  progress: number;
  action: 'draft' | 'send';
  exportToExternal?: boolean;
  file?: File;
  files?: File[];
}) {
  const formData = new FormData();
  const hasMultipleFiles = Boolean(payload.files?.length);
  formData.append('step', String(payload.step));
  formData.append('proposeAction', payload.proposeAction);
  formData.append('actionOffice', payload.actionOffice);
  formData.append('completeDate', payload.completeDate);
  formData.append('progress', String(payload.progress));
  formData.append('action', payload.action);
  if (payload.evidenceReference) {
    formData.append('evidenceReference', payload.evidenceReference);
  }
  if (!hasMultipleFiles && payload.file) {
    formData.append('file', payload.file);
  }
  if (hasMultipleFiles && payload.files) {
    payload.files.forEach((file) => formData.append('files[]', file));
  }
  const response = await apiFetch<{ data: { id: string; status: string; submittedAt: string | null } }>(
    `/api/self-assessment/cap/${payload.capId}/fulfillments`,
    { method: 'POST', body: formData }
  );
  return response.data;
}

export async function submitSelfAssessmentCapExtension(payload: {
  capId: string;
  dueDate: string;
  file: File;
}) {
  const formData = new FormData();
  formData.append('dueDate', payload.dueDate);
  formData.append('file', payload.file);
  const response = await apiFetch<{ data: { id: string; dueDate: string } }>(
    `/api/self-assessment/cap/${payload.capId}/extensions`,
    { method: 'POST', body: formData }
  );
  return response.data;
}

export async function deleteSelfAssessmentCapFulfillmentFile(fileId: string) {
  const response = await apiFetch<{ data: { deleted: boolean } }>(
    `/api/self-assessment/cap/fulfillment-files/${fileId}`,
    { method: 'DELETE' }
  );
  return response.data;
}

export async function fetchAdminSelfAssessmentCap(scope?: SelfAssessmentScope) {
  const query = scope ? `?scope=${scope}` : '';
  const response = await apiFetch<{ data: Array<{
    id: string;
    answerId: string;
    user: { id: string; name: string; email?: string } | null;
    area: string;
    scope: string;
    questionCode: string | null;
    questionText?: string;
    actionPlan?: string | null;
    targetDate?: string | null;
    sentAt: string | null;
    review?: {
      result: string | null;
      comment: string | null;
      status: string | null;
      reviewedBy?: { id: string; name: string; email?: string } | null;
      reviewedAt?: string | null;
    } | null;
    selfAssessmentReview?: {
      status: string;
      severity?: string | null;
      probability?: string | null;
      resume?: string | null;
      finding?: string | null;
      recommendations?: string | null;
      description?: string | null;
      reviewedBy?: { id: string; name: string; email?: string } | null;
      reviewedAt?: string | null;
    } | null;
  }> }>(`/api/admin/self-assessment/cap${query}`);
  return response.data;
}

export async function fetchAdminSelfAssessmentCapSessions(params: {
  scope?: SelfAssessmentScope;
  month?: string;
  year?: string;
}) {
  const query = new URLSearchParams();
  if (params.scope) query.set('scope', params.scope);
  if (params.month) query.set('month', params.month);
  if (params.year) query.set('year', params.year);
  const response = await apiFetch<{ data: Array<{
    sessionAreaId: string;
    user: { id: string; name: string; email?: string } | null;
    title: string | null;
    area: string;
    scope: string;
    schedule: string | null;
    leader: string;
    dnp: string[];
    kobo: string[];
    capCount: number;
    sentAt: string | null;
  }> }>(`/api/admin/self-assessment/cap/sessions?${query.toString()}`);
  return response.data;
}

export async function fetchAdminSelfAssessmentCapDetail(params: {
  sessionAreaId: string;
  userId: string;
}) {
  const response = await apiFetch<{ data: {
    sessionAreaId: string;
    area: string;
    scope: string;
    schedule: string | null;
    team: { leader: string; dnp: string[]; kobo: string[] } | null;
    caps: Array<{
      id: string;
      answerId: string;
      questionCode: string | null;
      questionText: string;
      actionPlan: string | null;
      targetDate: string | null;
      sentAt: string | null;
      review: {
        result: string | null;
        comment: string | null;
        status: string | null;
        reviewedBy?: { id: string; name: string; email?: string } | null;
        reviewedAt?: string | null;
      } | null;
      monitoringReview?: {
        result: string | null;
        comment: string | null;
        status: string | null;
        reviewedBy?: { id: string; name: string; email?: string } | null;
        reviewedAt?: string | null;
      } | null;
      fulfillmentReview?: {
        result: string | null;
        comment: string | null;
        status: string | null;
        reviewedBy?: { id: string; name: string; email?: string } | null;
        reviewedAt?: string | null;
      } | null;
      selfAssessmentReview: {
        status: string;
        severity?: string | null;
        probability?: string | null;
        resume?: string | null;
        finding?: string | null;
        recommendations?: string | null;
        description?: string | null;
        reviewedBy?: { id: string; name: string; email?: string } | null;
        reviewedAt?: string | null;
      } | null;
    }>;
  } }>(
    `/api/admin/self-assessment/cap/sessions/${params.sessionAreaId}?userId=${params.userId}`
  );
  return response.data;
}

export async function fetchAdminSelfAssessmentCapFulfillmentSessions(
  params: {
    scope?: SelfAssessmentScope;
    month?: string;
    year?: string;
    openedOnly?: boolean;
  } = {}
) {
  const query = new URLSearchParams();
  if (params.scope) query.set('scope', params.scope);
  if (params.month) query.set('month', params.month);
  if (params.year) query.set('year', params.year);
  if (params.openedOnly) query.set('openedOnly', '1');
  const response = await apiFetch<{ data: Array<{
    sessionAreaId: string;
    user: { id: string; name: string; email?: string } | null;
    title: string | null;
    area: string;
    scope: string;
    schedule: string | null;
    leader: string;
    dnp: string[];
    kobo: string[];
    fulfillmentCount: number;
    sentAt: string | null;
  }> }>(`/api/admin/self-assessment/cap-fulfillments/sessions?${query.toString()}`);
  return response.data;
}

export async function fetchAdminSelfAssessmentCapFulfillmentDetail(params: {
  sessionAreaId: string;
  userId: string;
}) {
  const response = await apiFetch<{ data: {
    sessionAreaId: string;
    area: string;
    scope: string;
    schedule: string | null;
    team: { leader: string; dnp: string[]; kobo: string[] } | null;
    user?: { id: string; name: string; email?: string } | null;
    sentCaps?: number;
    totalCaps?: number;
    result?: {
      id: string;
      status: string;
      finalizedAt: string | null;
      files: Array<{ id: string; name: string; url: string }>;
    } | null;
    caps: Array<{
      id: string;
      answerId: string;
      questionCode: string | null;
      questionText: string;
      questionReference?: string | null;
      actionPlan: string | null;
      targetDate: string | null;
      selfAssessmentComment?: string | null;
      selfAssessmentEvidenceNote?: string | null;
      selfAssessmentCreatedAt?: string | null;
      selfAssessmentUpdatedAt?: string | null;
      selfAssessmentEvidenceFiles?: Array<{ id: string; name: string; url: string }>;
      review: {
        result: string | null;
        comment: string | null;
        status: string | null;
        reviewedBy?: { id: string; name: string; email?: string } | null;
        reviewedAt?: string | null;
      } | null;
      selfAssessmentReview: {
        status: string;
        severity?: string | null;
        probability?: string | null;
        resume?: string | null;
        finding?: string | null;
        recommendations?: string | null;
        description?: string | null;
        reviewedBy?: { id: string; name: string; email?: string } | null;
        reviewedAt?: string | null;
      } | null;
      fulfillments: Array<{
        id: string;
        step: number;
        proposeAction: string;
        actionOffice: string;
        evidenceReference: string | null;
        completeDate: string | null;
        progress: number;
        status: string;
        submittedAt: string | null;
        createdAt?: string | null;
        updatedAt?: string | null;
        files: Array<{ id: string; name: string; url: string }>;
      }>;
      extensions?: Array<{
        id: string;
        dueDate: string;
        fileName: string;
        fileUrl: string;
        status: string;
      }>;
    }>;
  } }>(
    `/api/admin/self-assessment/cap-fulfillments/sessions/${params.sessionAreaId}?userId=${params.userId}`
  );
  return response.data;
}

export async function submitAdminSelfAssessmentCapReview(payload: {
  capId: string;
  result?: string;
  comment?: string;
  status?: string;
  action?: 'draft' | 'send';
  enforceProgress100?: boolean;
}) {
  const response = await apiFetch<{ data: { id: string; reviewedAt: string | null } }>(
    '/api/admin/self-assessment/cap/reviews',
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    }
  );
  return response.data;
}

export async function submitAdminSelfAssessmentCapFulfillmentReview(payload: {
  capId: string;
  result?: string;
  comment?: string;
  status?: string;
  action?: 'draft' | 'send';
  enforceProgress100?: boolean;
}) {
  const response = await apiFetch<{ data: { id: string; reviewedAt: string | null } }>(
    '/api/admin/self-assessment/cap/fulfillment-reviews',
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    }
  );
  return response.data;
}

export async function submitAdminSelfAssessmentMonitoringReview(payload: {
  capId: string;
  result?: string;
  comment?: string;
  status?: string;
  action?: 'draft' | 'send';
}) {
  const response = await apiFetch<{ data: { id: string; reviewedAt: string | null } }>(
    '/api/admin/self-assessment/monitoring/reviews',
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    }
  );
  return response.data;
}
