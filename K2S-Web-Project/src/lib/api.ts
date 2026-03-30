const API_BASE_URL =
  (import.meta as { env?: Record<string, string> }).env?.VITE_API_BASE_URL ??
  'http://localhost:8000';
const ABSOLUTE_URL_PATTERN = /^[a-z][a-z0-9+.-]*:\/\//i;

const TOKEN_KEY = 'k2s.authToken';
const PORTAL_TOKEN_KEY = 'auth.portal.token';
const USER_KEY = 'k2s.authUser';

function normalizeToken(value: string | null) {
  if (!value) {
    return null;
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }

  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    return trimmed.slice(1, -1);
  }

  return trimmed;
}

function parseJwtPayload(token: string) {
  try {
    const [, payload] = token.split('.');
    if (!payload) {
      return null;
    }
    const normalized = payload.replace(/-/g, '+').replace(/_/g, '/');
    const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, '=');
    const decoded = atob(padded);
    return JSON.parse(decoded) as Record<string, unknown>;
  } catch {
    return null;
  }
}

function deriveUserFromToken(token: string) {
  const payload = parseJwtPayload(token);
  if (!payload) {
    return null;
  }

  const realmRoles = Array.isArray((payload as { realm_access?: { roles?: unknown } }).realm_access?.roles)
    ? ((payload as { realm_access?: { roles?: string[] } }).realm_access?.roles ?? [])
    : [];
  const directRoles = Array.isArray(payload.roles) ? (payload.roles as string[]) : [];
  const allRoles = [...realmRoles, ...directRoles].map((x) => String(x).toLowerCase());
  const isAdmin = allRoles.some((role) => role.includes('admin'));

  const fallbackUser: Record<string, unknown> = {
    id: payload.sub,
    email: payload.email,
    username: payload.preferred_username,
    name: payload.name ?? payload.preferred_username ?? payload.email ?? 'User',
    role: isAdmin ? 'Admin' : 'Viewer',
  };

  return fallbackUser;
}

function consumeTokenFromQuery() {
  if (typeof window === 'undefined') {
    return null;
  }

  try {
    const url = new URL(window.location.href);
    const token = normalizeToken(url.searchParams.get('token'));
    if (!token) {
      return null;
    }

    window.localStorage.setItem(TOKEN_KEY, token);
    window.localStorage.setItem(PORTAL_TOKEN_KEY, token);
    const fallbackUser = deriveUserFromToken(token);
    if (fallbackUser) {
      window.localStorage.setItem(USER_KEY, JSON.stringify(fallbackUser));
    }
    url.searchParams.delete('token');
    window.history.replaceState({}, document.title, `${url.pathname}${url.search}${url.hash}`);
    return token;
  } catch {
    return null;
  }
}

export function getAuthToken() {
  if (typeof window === 'undefined') {
    return null;
  }
  const queryToken = consumeTokenFromQuery();
  if (queryToken) {
    return queryToken;
  }
  return normalizeToken(
    window.localStorage.getItem(TOKEN_KEY) ??
      window.localStorage.getItem(PORTAL_TOKEN_KEY)
  );
}

export function getApiBaseUrl() {
  return API_BASE_URL;
}

export function setAuthToken(token: string) {
  if (typeof window === 'undefined') {
    return;
  }
  const normalized = normalizeToken(token);
  if (!normalized) {
    return;
  }
  window.localStorage.setItem(TOKEN_KEY, normalized);
  window.localStorage.setItem(PORTAL_TOKEN_KEY, normalized);
}

export function getAuthUser<T = Record<string, unknown>>() {
  if (typeof window === 'undefined') {
    return null;
  }
  const raw = window.localStorage.getItem(USER_KEY);
  if (!raw) {
    const token = getAuthToken();
    if (!token) {
      return null;
    }
    const fallbackUser = deriveUserFromToken(token);
    if (!fallbackUser) {
      return null;
    }
    window.localStorage.setItem(USER_KEY, JSON.stringify(fallbackUser));
    return fallbackUser as T;
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
