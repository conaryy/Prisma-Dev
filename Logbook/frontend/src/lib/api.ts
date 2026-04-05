import { clearSessionToken, getRefreshToken, getSessionToken, setSessionTokens } from './session';
import { isSsoEnabled, refreshAccessToken, startSsoLogin } from './sso';

function resolveApiBaseUrl() {
  const fromEnv = (import.meta as { env?: Record<string, string> }).env?.VITE_LOGBOOK_API_BASE_URL;
  if (fromEnv) {
    return fromEnv;
  }

  if (typeof window !== 'undefined') {
    const host = window.location.hostname;
    if (host === 'localhost' || host === '127.0.0.1') {
      return 'http://localhost:3105/api/v1';
    }
  }

  return '/api/v1';
}

const API_BASE_URL = resolveApiBaseUrl();
let activeRefreshRequest: Promise<string | null> | null = null;

async function refreshSessionToken() {
  const refreshToken = getRefreshToken();
  if (!refreshToken) {
    clearSessionToken();
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
        clearSessionToken();
        return null;
      })
      .finally(() => {
        activeRefreshRequest = null;
      });
  }

  return activeRefreshRequest;
}

async function requestJson<T>(path: string, options: RequestInit = {}) {
  const buildHeaders = (token: string | null) => {
    const headers = new Headers(options.headers);
    headers.set('Accept', 'application/json');
    if (token && !headers.has('Authorization')) {
      headers.set('Authorization', `Bearer ${token}`);
    }
    return headers;
  };

  const currentToken = getSessionToken();
  let response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers: buildHeaders(currentToken),
  });

  if (response.status === 401) {
    const refreshedToken = await refreshSessionToken();
    if (refreshedToken) {
      response = await fetch(`${API_BASE_URL}${path}`, {
        ...options,
        headers: buildHeaders(refreshedToken),
      });
    }
  }

  const data = await response.json().catch(() => ({}));
  if (response.status === 401 && typeof window !== 'undefined') {
    clearSessionToken();

    if (isSsoEnabled() && !window.location.pathname.startsWith('/auth/callback')) {
      const returnTo = `${window.location.pathname}${window.location.search}${window.location.hash}`;
      startSsoLogin(returnTo).catch(() => {});
    }
  }

  if (!response.ok) {
    throw new Error(
      (typeof data?.message === 'string' && data.message) ||
        'Request to Logbook API failed.'
    );
  }

  return data as T;
}

export async function apiFetch<T>(path: string, options: RequestInit = {}) {
  return requestJson<T>(path, options);
}

export async function apiUploadForm<T>(path: string, formData: FormData) {
  return requestJson<T>(path, {
    method: 'POST',
    body: formData,
  });
}

export async function apiDelete<T>(path: string) {
  return requestJson<T>(path, {
    method: 'DELETE',
  });
}
