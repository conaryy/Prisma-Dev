import type { DashboardData } from '@/types/dashboard';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? '';

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

export async function fetchDashboard(): Promise<DashboardData> {
  const response = await fetch(`${API_BASE_URL}/api/dashboard`);

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
}) {
  const response = await fetch(`${API_BASE_URL}/api/personnel`, {
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

export async function updateSupervisionStatus(
  activityId: string,
  status: 'Belum Terlaksana' | 'Terlaksana' | 'Perlu Tindak Lanjut'
) {
  const response = await fetch(`${API_BASE_URL}/api/supervision-activities/${activityId}/status`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ status }),
  });

  if (!response.ok) {
    throw new Error(await readApiError(response, 'Gagal memperbarui status kegiatan pengawasan.'));
  }

  return response.json();
}

export async function uploadSupervisionEvidence(activityId: string, file: File) {
  const formData = new FormData();
  formData.append('file', file);

  const response = await fetch(`${API_BASE_URL}/api/supervision-activities/${activityId}/evidence`, {
    method: 'POST',
    body: formData,
  });

  if (!response.ok) {
    throw new Error(await readApiError(response, 'Gagal mengunggah evidence kegiatan pengawasan.'));
  }

  return response.json();
}
