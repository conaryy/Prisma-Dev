import type { DashboardData } from '@/types/dashboard';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? '';

export async function fetchDashboard(): Promise<DashboardData> {
  const response = await fetch(`${API_BASE_URL}/api/dashboard`);

  if (!response.ok) {
    throw new Error('Gagal memuat data dashboard keamanan.');
  }

  const payload = (await response.json()) as { data: DashboardData };
  return payload.data;
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
    throw new Error('Gagal menyimpan personil keamanan.');
  }

  return response.json();
}
