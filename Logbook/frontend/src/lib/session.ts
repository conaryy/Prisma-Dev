const AUTH_PORTAL_TOKEN_KEY = 'auth.portal.token';
const K2S_TOKEN_KEY = 'k2s.authToken';
const LOCALHOST_NAMES = new Set(['localhost', '127.0.0.1']);

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

export function setSessionToken(token: string) {
  if (typeof window === 'undefined') {
    return;
  }
  const normalized = normalizeToken(token);
  if (!normalized) {
    return;
  }
  window.localStorage.setItem(AUTH_PORTAL_TOKEN_KEY, normalized);
}

export function clearSessionToken() {
  if (typeof window === 'undefined') {
    return;
  }
  window.localStorage.removeItem(AUTH_PORTAL_TOKEN_KEY);
}

export function getSessionToken() {
  if (typeof window === 'undefined') {
    return null;
  }

  const url = new URL(window.location.href);
  const fromQuery = normalizeToken(url.searchParams.get('token'));
  if (fromQuery) {
    setSessionToken(fromQuery);
    url.searchParams.delete('token');
    window.history.replaceState({}, document.title, `${url.pathname}${url.search}${url.hash}`);
    return fromQuery;
  }

  return normalizeToken(
    window.localStorage.getItem(AUTH_PORTAL_TOKEN_KEY) ??
    window.localStorage.getItem(K2S_TOKEN_KEY)
  );
}

export function requireSessionToken() {
  const token = getSessionToken();
  if (!token) {
    const currentHost = typeof window !== 'undefined' ? window.location.hostname : '';
    if (LOCALHOST_NAMES.has(currentHost)) {
      // Allow local UI development without forcing auth portal redirect.
      return null;
    }

    const authPortalUrl =
      (import.meta as { env?: Record<string, string> }).env?.VITE_AUTH_PORTAL_URL ??
      'https://prisma.ryvidia.my.id/login';
    window.location.href = authPortalUrl;
    return null;
  }
  return token;
}
