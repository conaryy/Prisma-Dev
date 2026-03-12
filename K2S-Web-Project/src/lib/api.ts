const API_BASE_URL =
  (import.meta as { env?: Record<string, string> }).env?.VITE_API_BASE_URL ??
  'http://localhost:8000';
const ABSOLUTE_URL_PATTERN = /^[a-z][a-z0-9+.-]*:\/\//i;

const TOKEN_KEY = 'k2s.authToken';
const USER_KEY = 'k2s.authUser';

export function getAuthToken() {
  if (typeof window === 'undefined') {
    return null;
  }
  return window.localStorage.getItem(TOKEN_KEY);
}

export function getApiBaseUrl() {
  return API_BASE_URL;
}

export function setAuthToken(token: string) {
  if (typeof window === 'undefined') {
    return;
  }
  window.localStorage.setItem(TOKEN_KEY, token);
}

export function getAuthUser<T = Record<string, unknown>>() {
  if (typeof window === 'undefined') {
    return null;
  }
  const raw = window.localStorage.getItem(USER_KEY);
  if (!raw) {
    return null;
  }
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

export function setAuthUser(user: Record<string, unknown>) {
  if (typeof window === 'undefined') {
    return;
  }
  window.localStorage.setItem(USER_KEY, JSON.stringify(user));
}

export function clearAuthUser() {
  if (typeof window === 'undefined') {
    return;
  }
  window.localStorage.removeItem(USER_KEY);
}

export function clearAuthToken() {
  if (typeof window === 'undefined') {
    return;
  }
  window.localStorage.removeItem(TOKEN_KEY);
}

type ApiFetchOptions = RequestInit & { skipAuth?: boolean };

export class ApiError extends Error {
  status: number;
  data: unknown;

  constructor(message: string, status: number, data: unknown) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.data = data;
  }
}

export async function apiFetch<T>(path: string, options: ApiFetchOptions = {}) {
  const token = getAuthToken();
  const { skipAuth, ...fetchOptions } = options;
  const headers = new Headers(fetchOptions.headers);

  if (!headers.has('Accept')) {
    headers.set('Accept', 'application/json');
  }

  if (!skipAuth && token) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  return fetch(`${API_BASE_URL}${path}`, {
    ...fetchOptions,
    headers,
  }).then(async (response) => {
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      const firstValidationError =
        data?.errors && typeof data.errors === 'object'
          ? Object.values(data.errors).flat()[0]
          : null;
      const message =
        (typeof data?.error === 'string' && data.error) ||
        (typeof data?.message === 'string' && data.message) ||
        (typeof firstValidationError === 'string' && firstValidationError) ||
        'Request failed.';
      throw new ApiError(message, response.status, data);
    }
    return data as T;
  });
}

export function resolveApiUrl(input: string) {
  if (!input) {
    return input;
  }

  if (
    input.startsWith('data:') ||
    input.startsWith('blob:') ||
    input.startsWith('//')
  ) {
    return input;
  }

  const base = API_BASE_URL.replace(/\/+$/, '');

  if (ABSOLUTE_URL_PATTERN.test(input)) {
    try {
      const url = new URL(input);
      const baseUrl = new URL(base);
      if (url.hostname === baseUrl.hostname && url.port !== baseUrl.port) {
        return `${base}${url.pathname}${url.search}${url.hash}`;
      }
    } catch {
      return input;
    }
    return input;
  }

  if (input.startsWith('/')) {
    return `${base}${input}`;
  }

  return `${base}/${input}`;
}
