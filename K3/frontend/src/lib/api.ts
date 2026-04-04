import { clearSessionTokens, getRefreshToken, getSessionToken, setSessionTokens } from '@/lib/session';
import { refreshAccessToken } from '@/lib/sso';
import type {
  AuditAnalysis,
  ChecklistDocumentSummary,
  GoogleDriveFolderListing,
  GoogleDriveStatus,
  SessionUser,
} from '@/types';

type SessionUserResponse = {
  data: SessionUser | null;
};

type LatestChecklistResponse = {
  data: AuditAnalysis | null;
};

type ChecklistDocumentsResponse = {
  data: ChecklistDocumentSummary[];
};

type ChecklistDocumentResponse = {
  data: AuditAnalysis | null;
};

type UploadChecklistResponse = {
  message: string;
  data: AuditAnalysis;
  document?: ChecklistDocumentSummary | null;
};

type DeleteChecklistDocumentResponse = {
  message: string;
  data: {
    documentId: string;
  };
};

type GoogleDriveStatusResponse = {
  data: GoogleDriveStatus;
};

type GoogleDriveConnectUrlResponse = {
  data: {
    authorizationUrl: string;
  };
};

type GoogleDriveDisconnectResponse = {
  message: string;
  data: {
    disconnected: boolean;
  };
};

type GoogleDriveFolderListingResponse = {
  data: GoogleDriveFolderListing;
};

let activeRefreshRequest: Promise<string | null> | null = null;

async function readJson<T>(response: Response) {
  const payload = (await response.json().catch(() => ({}))) as T & { message?: string };
  if (!response.ok) {
    throw new Error(payload.message || 'Permintaan gagal diproses.');
  }
  return payload;
}

async function refreshSessionToken() {
  const refreshToken = getRefreshToken();
  if (!refreshToken) {
    clearSessionTokens();
    return null;
  }

  // Deduplicate concurrent 401 retries so one refresh result is reused.
  if (!activeRefreshRequest) {
    activeRefreshRequest = refreshAccessToken(refreshToken)
      .then((result) => {
        if (!result.access_token) {
          throw new Error('Access token tidak ditemukan.');
        }

        setSessionTokens({
          accessToken: result.access_token,
          refreshToken: result.refresh_token,
        });

        return result.access_token;
      })
      .catch(() => {
        clearSessionTokens();
        return null;
      })
      .finally(() => {
        activeRefreshRequest = null;
      });
  }

  return activeRefreshRequest;
}

async function performApiFetch(path: string, init: RequestInit = {}, allowRefresh = true) {
  const headers = new Headers(init.headers);
  headers.set('Accept', 'application/json');

  const token = getSessionToken();
  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  const response = await fetch(path, {
    ...init,
    headers,
  });

  if (response.status !== 401 || !allowRefresh) {
    return response;
  }

  const refreshedToken = await refreshSessionToken();
  if (!refreshedToken) {
    return response;
  }

  const retryHeaders = new Headers(init.headers);
  retryHeaders.set('Accept', 'application/json');
  retryHeaders.set('Authorization', `Bearer ${refreshedToken}`);

  return fetch(path, {
    ...init,
    headers: retryHeaders,
  });
}

async function apiFetch(path: string, init: RequestInit = {}, allowRefresh = true) {
  const response = await performApiFetch(path, init, allowRefresh);
  return response;
}

export async function fetchSessionUser() {
  const response = await apiFetch('/api/me');
  return readJson<SessionUserResponse>(response);
}

export async function fetchLatestChecklist() {
  const response = await apiFetch('/api/checklist-audit/latest');
  return readJson<LatestChecklistResponse>(response);
}

export async function fetchChecklistDocuments() {
  const response = await apiFetch('/api/checklist-audit/documents');
  return readJson<ChecklistDocumentsResponse>(response);
}

export async function fetchChecklistDocument(documentId: string) {
  const response = await apiFetch(`/api/checklist-audit/documents/${encodeURIComponent(documentId)}`);
  return readJson<ChecklistDocumentResponse>(response);
}

export async function deleteChecklistDocument(documentId: string) {
  const response = await apiFetch(`/api/checklist-audit/documents/${encodeURIComponent(documentId)}`, {
    method: 'DELETE',
  });

  return readJson<DeleteChecklistDocumentResponse>(response);
}

export async function uploadChecklistDocument(file: File) {
  const formData = new FormData();
  formData.append('document', file);

  const response = await apiFetch('/api/checklist-audit/analyze', {
    method: 'POST',
    body: formData,
  });

  return readJson<UploadChecklistResponse>(response);
}

export async function uploadQuestionEvidence(documentId: string, questionCode: string, file: File) {
  const formData = new FormData();
  formData.append('file', file);

  const response = await apiFetch(
    `/api/checklist-audit/${encodeURIComponent(questionCode)}/files?documentId=${encodeURIComponent(documentId)}`,
    {
      method: 'POST',
      body: formData,
    }
  );

  return readJson<UploadChecklistResponse>(response);
}

export async function fetchGoogleDriveStatus() {
  const response = await apiFetch('/api/google-drive/status');
  return readJson<GoogleDriveStatusResponse>(response);
}

export async function createGoogleDriveConnectUrl(returnTo?: string) {
  const response = await apiFetch('/api/google-drive/connect-url', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(returnTo ? { returnTo } : {}),
  });

  return readJson<GoogleDriveConnectUrlResponse>(response);
}

export async function disconnectGoogleDrive() {
  const response = await apiFetch('/api/google-drive/disconnect', {
    method: 'POST',
  });

  return readJson<GoogleDriveDisconnectResponse>(response);
}

export async function fetchGoogleDriveFolders(parentId?: string) {
  const search = parentId ? `?parentId=${encodeURIComponent(parentId)}` : '';
  const response = await apiFetch(`/api/google-drive/folders${search}`);
  return readJson<GoogleDriveFolderListingResponse>(response);
}

export async function syncQuestionEvidenceToDrive(
  documentId: string,
  questionCode: string,
  targetFolderId?: string,
  targetSubfolderName?: string
) {
  const response = await apiFetch(
    `/api/checklist-audit/${encodeURIComponent(questionCode)}/files/sync-drive?documentId=${encodeURIComponent(documentId)}`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        ...(targetFolderId ? { targetFolderId } : {}),
        ...(targetSubfolderName ? { targetSubfolderName } : {}),
      }),
    }
  );

  return readJson<UploadChecklistResponse>(response);
}

export async function deleteQuestionEvidence(documentId: string, questionCode: string, fileId: string) {
  const response = await apiFetch(
    `/api/checklist-audit/${encodeURIComponent(questionCode)}/files/${encodeURIComponent(fileId)}?documentId=${encodeURIComponent(documentId)}`,
    {
      method: 'DELETE',
    }
  );

  return readJson<UploadChecklistResponse>(response);
}

export async function createQuestionGroup(documentId: string, questionCodes: string[]) {
  const response = await apiFetch('/api/checklist-audit/groups', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ documentId, questionCodes }),
  });

  return readJson<UploadChecklistResponse>(response);
}

export async function updateQuestionGroup(documentId: string, groupId: string, questionCodes: string[]) {
  const response = await apiFetch(`/api/checklist-audit/groups/${encodeURIComponent(groupId)}`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ documentId, questionCodes }),
  });

  return readJson<UploadChecklistResponse>(response);
}

export async function removeQuestionGroup(documentId: string, groupId: string) {
  const response = await apiFetch(
    `/api/checklist-audit/groups/${encodeURIComponent(groupId)}?documentId=${encodeURIComponent(documentId)}`,
    {
      method: 'DELETE',
    }
  );

  return readJson<UploadChecklistResponse>(response);
}
