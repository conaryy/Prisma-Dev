import type { AuditAnalysis } from '@/types';

type LatestChecklistResponse = {
  data: AuditAnalysis | null;
};

type UploadChecklistResponse = {
  message: string;
  data: AuditAnalysis;
};

async function readJson<T>(response: Response) {
  const payload = (await response.json()) as T & { message?: string };
  if (!response.ok) {
    throw new Error(payload.message || 'Permintaan gagal diproses.');
  }
  return payload;
}

export async function fetchLatestChecklist() {
  const response = await fetch('/api/checklist-audit/latest');
  return readJson<LatestChecklistResponse>(response);
}

export async function uploadChecklistDocument(file: File) {
  const formData = new FormData();
  formData.append('document', file);

  const response = await fetch('/api/checklist-audit/analyze', {
    method: 'POST',
    body: formData,
  });

  return readJson<UploadChecklistResponse>(response);
}

export async function uploadQuestionEvidence(questionCode: string, file: File) {
  const formData = new FormData();
  formData.append('file', file);

  const response = await fetch(`/api/checklist-audit/${encodeURIComponent(questionCode)}/files`, {
    method: 'POST',
    body: formData,
  });

  return readJson<UploadChecklistResponse>(response);
}

export async function deleteQuestionEvidence(questionCode: string, fileId: string) {
  const response = await fetch(
    `/api/checklist-audit/${encodeURIComponent(questionCode)}/files/${encodeURIComponent(fileId)}`,
    {
      method: 'DELETE',
    }
  );

  return readJson<UploadChecklistResponse>(response);
}

export async function createQuestionGroup(questionCodes: string[]) {
  const response = await fetch('/api/checklist-audit/groups', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ questionCodes }),
  });

  return readJson<UploadChecklistResponse>(response);
}

export async function updateQuestionGroup(groupId: string, questionCodes: string[]) {
  const response = await fetch(`/api/checklist-audit/groups/${encodeURIComponent(groupId)}`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ questionCodes }),
  });

  return readJson<UploadChecklistResponse>(response);
}

export async function removeQuestionGroup(groupId: string) {
  const response = await fetch(`/api/checklist-audit/groups/${encodeURIComponent(groupId)}`, {
    method: 'DELETE',
  });

  return readJson<UploadChecklistResponse>(response);
}
