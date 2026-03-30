import { getSessionToken } from './session';

function resolveApiBaseUrl() {
  const fromEnv = (import.meta as { env?: Record<string, string> }).env?.VITE_LOGBOOK_API_BASE_URL;
  if (fromEnv) {
    return fromEnv;
  }

  if (typeof window !== 'undefined') {
    const host = window.location.hostname;
    if (host === 'localhost' || host === '127.0.0.1') {
      return 'http://localhost:3100/api/v1';
    }
  }

  return '/api/v1';
}

const API_BASE_URL = resolveApiBaseUrl();

export async function apiFetch<T>(path: string, options: RequestInit = {}) {
  const token = getSessionToken();

  const headers = new Headers(options.headers);
  headers.set('Accept', 'application/json');
  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers,
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(
      (typeof data?.message === 'string' && data.message) ||
        'Request to Logbook API failed.'
    );
  }

  return data as T;
}
