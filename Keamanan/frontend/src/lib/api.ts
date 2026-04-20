import { clearSessionTokens, getRefreshToken, getSessionToken, setSessionTokens } from '@/lib/session';
import { refreshAccessToken } from '@/lib/sso';
import type { DashboardData } from '@/types/dashboard';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? '';
let activeRefreshRequest: Promise<string | null> | null = null;

function resolveApiAssetUrl(url: string) {
  if (!url || /^https?:\/\//i.test(url) || !url.startsWith('/')) {
    return url;
  }

  const normalizedApiBase = API_BASE_URL.replace(/\/+$/, '');
  if (!normalizedApiBase) {
    return url;
  }

  return `${normalizedApiBase}${url}`;
}

function normalizeDashboard(data: DashboardData): DashboardData {
  return {
    ...data,
    facilities: data.facilities.map((item) => ({
      ...item,
      photoUrl: item.photoUrl ? resolveApiAssetUrl(item.photoUrl) : item.photoUrl,
    })),
    licenses: data.licenses.map((item) => ({
      ...item,
      photoUrl: item.photoUrl ? resolveApiAssetUrl(item.photoUrl) : item.photoUrl,
    })),
    tests: data.tests.map((item) => ({
      ...item,
      evidenceFiles: item.evidenceFiles.map((evidence) => ({
        ...evidence,
        url: resolveApiAssetUrl(evidence.url),
      })),
    })),
  };
}

async function readApiError(response: Response, fallbackMessage: string) {
  try {
    const payload = (await response.json()) as { message?: string };
    if (typeof payload.message === 'string' && payload.message.trim()) {
      return payload.message;
    }
  } catch {
    // Ignore response parsing error and fall back to default message.
  }

  return fallbackMessage;
}

async function refreshSessionToken() {
  const refreshToken = getRefreshToken();
  if (!refreshToken) {
    clearSessionTokens();
    return null;
  }

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

async function apiFetch(path: string, init: RequestInit = {}, allowRefresh = true) {
  const headers = new Headers(init.headers);
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
  retryHeaders.set('Authorization', `Bearer ${refreshedToken}`);

  return fetch(path, {
    ...init,
    headers: retryHeaders,
  });
}

export async function fetchDashboard(): Promise<DashboardData> {
  const response = await apiFetch(`${API_BASE_URL}/api/dashboard`);

  if (!response.ok) {
    throw new Error(await readApiError(response, 'Gagal memuat data dashboard keamanan.'));
  }

  const payload = (await response.json()) as { data: DashboardData };
  return normalizeDashboard(payload.data);
}

export async function createPersonnel(input: {
  name: string;
  location: string;
  status?: 'Valid' | 'Perpanjangan' | 'Pelatihan';
  licenseNumber?: string;
  address?: string;
  documentPeriod?: string;
  sourceDocument?: string;
  birthPlaceDate?: string;
  maritalStatus?: string;
  religion?: string;
  educationHistory?: string[];
  workHistory?: string[];
  trainingHistory?: string[];
  refreshmentExisting?: string;
  refreshmentPlan?: string;
  recurrentExisting?: string;
  recurrentPlan?: string;
}) {
  const response = await apiFetch(`${API_BASE_URL}/api/personnel`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(input),
  });

  if (!response.ok) {
    throw new Error(await readApiError(response, 'Gagal menyimpan personil keamanan.'));
  }

  return response.json();
}

export async function deletePersonnelTable() {
  const response = await apiFetch(`${API_BASE_URL}/api/personnel`, {
    method: 'DELETE',
  });

  if (!response.ok) {
    throw new Error(await readApiError(response, 'Gagal menghapus data personil keamanan.'));
  }

  return response.json();
}

export async function deletePersonnel(slug: string) {
  const response = await apiFetch(`${API_BASE_URL}/api/personnel/${slug}`, {
    method: 'DELETE',
  });

  if (!response.ok) {
    throw new Error(await readApiError(response, 'Gagal menghapus personil keamanan.'));
  }

  return response.json();
}

export async function deleteDocumentsTable() {
  const response = await apiFetch(`${API_BASE_URL}/api/documents`, {
    method: 'DELETE',
  });

  if (!response.ok) {
    throw new Error(await readApiError(response, 'Gagal menghapus data dokumen keamanan.'));
  }

  return response.json();
}

export async function deleteDocument(sourceType: 'manual' | 'evidence', id: string) {
  const response = await apiFetch(`${API_BASE_URL}/api/documents/${sourceType}/${id}`, {
    method: 'DELETE',
  });

  if (!response.ok) {
    throw new Error(await readApiError(response, 'Gagal menghapus dokumen keamanan.'));
  }

  return response.json();
}

export async function uploadPersonnelPhoto(slug: string, photo: File) {
  const formData = new FormData();
  formData.append('photo', photo);

  const response = await apiFetch(`${API_BASE_URL}/api/personnel/${slug}/photo`, {
    method: 'POST',
    body: formData,
  });

  if (!response.ok) {
    throw new Error(await readApiError(response, 'Gagal menyimpan foto personel.'));
  }

  return response.json();
}

export async function createFacility(input: {
  name: string;
  zone: string;
  status?: 'Optimal' | 'Perlu Servis' | 'Terjadwal';
  coveragePercent: number;
  photo?: File | null;
}) {
  const formData = new FormData();
  formData.append('name', input.name);
  formData.append('zone', input.zone);
  formData.append('status', input.status ?? 'Optimal');
  formData.append('coveragePercent', String(input.coveragePercent));
  if (input.photo) {
    formData.append('photo', input.photo);
  }

  const response = await apiFetch(`${API_BASE_URL}/api/facilities`, {
    method: 'POST',
    body: formData,
  });

  if (!response.ok) {
    throw new Error(await readApiError(response, 'Gagal menyimpan alat keamanan.'));
  }

  return response.json();
}

export async function deleteFacility(id: string) {
  const response = await apiFetch(`${API_BASE_URL}/api/facilities/${id}`, {
    method: 'DELETE',
  });

  if (!response.ok) {
    throw new Error(await readApiError(response, 'Gagal menghapus alat keamanan.'));
  }

  return response.json();
}

export async function updateSupervisionStatus(
  activityId: string,
  input: {
    status: 'Terlaksana' | 'Perlu Tindak Lanjut';
    location?: string | null;
    completedAt?: string | null;
    completionNote?: string | null;
    inspectorNames?: string[] | null;
  }
) {
  const response = await apiFetch(`${API_BASE_URL}/api/supervision-activities/${activityId}/status`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(input),
  });

  if (!response.ok) {
    throw new Error(await readApiError(response, 'Gagal memperbarui status kegiatan pengawasan.'));
  }

  return response.json();
}

export async function uploadSupervisionEvidence(activityId: string, file: File) {
  const formData = new FormData();
  formData.append('file', file);

  const response = await apiFetch(`${API_BASE_URL}/api/supervision-activities/${activityId}/evidence`, {
    method: 'POST',
    body: formData,
  });

  if (!response.ok) {
    throw new Error(await readApiError(response, 'Gagal mengunggah evidence kegiatan pengawasan.'));
  }

  return response.json();
}
