const ACCESS_TOKEN_KEY = 'keamanan.auth.accessToken';
const REFRESH_TOKEN_KEY = 'keamanan.auth.refreshToken';
const LEGACY_TOKEN_KEY = 'auth.portal.token';

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

export function setSessionTokens(params: { accessToken: string; refreshToken?: string }) {
  if (typeof window === 'undefined') {
    return;
  }

  const accessToken = normalizeToken(params.accessToken);
  if (!accessToken) {
    return;
  }

  window.localStorage.setItem(ACCESS_TOKEN_KEY, accessToken);
  window.localStorage.setItem(LEGACY_TOKEN_KEY, accessToken);

  const refreshToken = normalizeToken(params.refreshToken ?? null);
  if (refreshToken) {
    window.localStorage.setItem(REFRESH_TOKEN_KEY, refreshToken);
  }
}

export function clearSessionTokens() {
  if (typeof window === 'undefined') {
    return;
  }

  window.localStorage.removeItem(ACCESS_TOKEN_KEY);
  window.localStorage.removeItem(REFRESH_TOKEN_KEY);
  window.localStorage.removeItem(LEGACY_TOKEN_KEY);
}

export function getSessionToken() {
  if (typeof window === 'undefined') {
    return null;
  }

  const url = new URL(window.location.href);
  const fromQuery = normalizeToken(url.searchParams.get('token'));
  if (fromQuery) {
    setSessionTokens({ accessToken: fromQuery });
    url.searchParams.delete('token');
    window.history.replaceState({}, document.title, `${url.pathname}${url.search}${url.hash}`);
    return fromQuery;
  }

  return normalizeToken(
    window.localStorage.getItem(ACCESS_TOKEN_KEY) ?? window.localStorage.getItem(LEGACY_TOKEN_KEY)
  );
}

export function getRefreshToken() {
  if (typeof window === 'undefined') {
    return null;
  }

  return normalizeToken(window.localStorage.getItem(REFRESH_TOKEN_KEY));
}
