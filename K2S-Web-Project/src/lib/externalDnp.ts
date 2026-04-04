import { apiFetch } from '@/lib/api';
import type { SelfAssessmentScope } from '@/types/selfAssessment';

export type ExternalDnpExportDocumentItem = {
  id: string;
  sessionAreaId: string;
  scope: string;
  scopeLabel: string;
  instansiName: string;
  area: string;
  schedule: string;
  leader: string;
  members: string[];
  audity: string[];
  pqNumber: string;
  questionText: string;
  reference: string;
  temuan: string;
  actionPlan: string;
  progress: number;
};

export async function fetchExternalDnpCapSessions(params: {
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
    instansiName?: string | null;
    schedule: string | null;
    leader: string;
    dnp: string[];
    kobo: string[];
    notSatisfactoryCount: number;
    finalizedAt: string | null;
  }> }>(`/api/external-dnp/cap/sessions?${query.toString()}`);
  return response.data;
}

export async function fetchExternalDnpCap(params: {
  scope: SelfAssessmentScope;
  sessionAreaId: string;
}) {
  const query = new URLSearchParams({
    scope: params.scope,
    sessionAreaId: params.sessionAreaId,
  });
  const response = await apiFetch<{ data: Array<{
    answerId: string;
    questionCode: string;
    questionText: string;
    reference: string | null;
    status: string;
    instansiName?: string | null;
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
        files: Array<{
          id: string;
          name: string;
          url: string;
          source?: 'dnp' | 'local';
          externalFileId?: string | null;
        }>;
      }>;
      extensions: Array<{
        id: string;
        dueDate: string;
        fileName: string;
        fileUrl: string;
        status: string;
      }>;
    } | null;
  }> }>(`/api/external-dnp/cap?${query.toString()}`);
  return response.data;
}

export async function submitExternalDnpCap(payload: {
  answerId: string;
  actionPlan: string;
  targetDate: string;
  action: 'draft' | 'send';
}) {
  const response = await apiFetch<{ data: { id: string; status: string; sentAt: string | null } }>(
    '/api/external-dnp/cap',
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    }
  );
  return response.data;
}

export async function submitExternalDnpCapFulfillment(payload: {
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
}) {
  const formData = new FormData();
  formData.append('step', String(payload.step));
  formData.append('proposeAction', payload.proposeAction);
  formData.append('actionOffice', payload.actionOffice);
  formData.append('completeDate', payload.completeDate);
  formData.append('progress', String(payload.progress));
  formData.append('action', payload.action);
  formData.append('exportToExternal', payload.exportToExternal ? '1' : '0');
  if (payload.evidenceReference) {
    formData.append('evidenceReference', payload.evidenceReference);
  }
  if (payload.file) {
    formData.append('file', payload.file);
  }
  const response = await apiFetch<{ data: { id: string; status: string; submittedAt: string | null } }>(
    `/api/external-dnp/cap/${payload.capId}/fulfillments`,
    { method: 'POST', body: formData }
  );
  return response.data;
}

export async function submitExternalDnpCapExtension(payload: {
  capId: string;
  dueDate: string;
  file: File;
}) {
  const formData = new FormData();
  formData.append('dueDate', payload.dueDate);
  formData.append('file', payload.file);
  const response = await apiFetch<{ data: { id: string; dueDate: string } }>(
    `/api/external-dnp/cap/${payload.capId}/extensions`,
    { method: 'POST', body: formData }
  );
  return response.data;
}

export async function deleteExternalDnpCapFulfillmentFile(fileId: string) {
  const response = await apiFetch<{ data: { deleted: boolean } }>(
    `/api/external-dnp/cap/fulfillment-files/${fileId}`,
    { method: 'DELETE' }
  );
  return response.data;
}

export async function syncExternalDnp(scope?: SelfAssessmentScope) {
  const response = await apiFetch<{ data: Record<string, unknown> }>('/api/external-dnp/sync', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(scope ? { scope } : {}),
  });
  return response.data;
}

export async function initExternalDnpSync() {
  const response = await apiFetch<{ data: { sessionId: string; captchaUrl: string } }>(
    '/api/external-dnp/sync/init',
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    }
  );
  return response.data;
}

export async function runExternalDnpSync(payload: {
  sessionId: string;
  captcha: string;
  username: string;
  password: string;
  scope?: SelfAssessmentScope;
  instansiName?: string;
  loginOnly?: boolean;
}) {
  const response = await apiFetch<{ data: Record<string, unknown> }>(
    '/api/external-dnp/sync/run',
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    }
  );
  return response.data;
}

export async function fetchExternalDnpSyncStatus(instansiName: string) {
  const query = new URLSearchParams({ instansiName });
  const response = await apiFetch<{ data: { active: boolean; instansiName: string } }>(
    `/api/external-dnp/sync/status?${query.toString()}`
  );
  return response.data;
}

export async function startExternalDnpSyncJob(payload: {
  sessionId: string;
  captcha: string;
  username: string;
  password: string;
  scope?: SelfAssessmentScope;
}) {
  const response = await apiFetch<{ data: {
    jobId: string;
    status: 'queued' | 'running' | 'succeeded' | 'failed';
    message?: string | null;
  } }>('/api/external-dnp/sync/start', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  return response.data;
}

export async function fetchExternalDnpSyncJobStatus(jobId: string) {
  const response = await apiFetch<{ data: {
    jobId: string;
    status: 'queued' | 'running' | 'succeeded' | 'failed';
    message?: string | null;
    error?: string | null;
    summary?: Record<string, unknown> | null;
    startedAt?: string | null;
    finishedAt?: string | null;
    createdAt?: string | null;
  } }>(`/api/external-dnp/sync/jobs/${jobId}`);
  return response.data;
}

export async function fetchExternalDnpExportDocumentItems(scope: SelfAssessmentScope) {
  const response = await apiFetch<{ data: ExternalDnpExportDocumentItem[] }>(
    `/api/external-dnp/export-document/items?scope=${scope}`
  );
  return response.data;
}

export async function generateExternalDnpExportDocument(payload: {
  scope: SelfAssessmentScope;
  itemIds: string[];
}) {
  const response = await apiFetch<{ data: {
    generated: boolean;
    scope: string;
    filename: string;
    totalItems: number;
    generatedAt: string;
    downloadUrl: string;
  } }>('/api/external-dnp/export-document/generate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  return response.data;
}
