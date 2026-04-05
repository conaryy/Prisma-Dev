const SSO_STATE_KEY = 'k2s.sso.state';
const SSO_VERIFIER_KEY = 'k2s.sso.verifier';
const SSO_RETURN_TO_KEY = 'k2s.sso.returnTo';
const SSO_LOCK_KEY = 'k2s.sso.lock';
const SSO_TAB_ID_KEY = 'k2s.sso.tabId';
const SSO_LOCK_TTL_MS = 15_000;

type SsoLockPayload = {
  startedAt: number;
  tabId: string;
};

function env() {
  return (import.meta as { env?: Record<string, string> }).env ?? {};
}

function nowMs() {
  return Date.now();
}

function getTabId() {
  const existing = sessionStorage.getItem(SSO_TAB_ID_KEY);
  if (existing) {
    return existing;
  }
  const generated = randomString(16);
  sessionStorage.setItem(SSO_TAB_ID_KEY, generated);
  return generated;
}

function readSsoLock(): SsoLockPayload | null {
  const raw = localStorage.getItem(SSO_LOCK_KEY);
  if (!raw) {
    return null;
  }
  try {
    const parsed = JSON.parse(raw) as SsoLockPayload;
    if (!parsed || typeof parsed.startedAt !== 'number' || typeof parsed.tabId !== 'string') {
      localStorage.removeItem(SSO_LOCK_KEY);
      return null;
    }
    if (nowMs() - parsed.startedAt > SSO_LOCK_TTL_MS) {
      localStorage.removeItem(SSO_LOCK_KEY);
      return null;
    }
    return parsed;
  } catch {
    localStorage.removeItem(SSO_LOCK_KEY);
    return null;
  }
}

function acquireSsoLock({ force = false }: { force?: boolean } = {}) {
  if (force) {
    localStorage.removeItem(SSO_LOCK_KEY);
  }

  const current = readSsoLock();
  const tabId = getTabId();
  if (current && current.tabId !== tabId) {
    return false;
  }

  const payload: SsoLockPayload = {
    startedAt: nowMs(),
    tabId,
  };
  localStorage.setItem(SSO_LOCK_KEY, JSON.stringify(payload));
  return true;
}

export function clearSsoFlowLock() {
  localStorage.removeItem(SSO_LOCK_KEY);
}

export function clearSsoFlowState() {
  sessionStorage.removeItem(SSO_STATE_KEY);
  sessionStorage.removeItem(SSO_VERIFIER_KEY);
  sessionStorage.removeItem(SSO_RETURN_TO_KEY);
}

export function resetSsoClientState() {
  clearSsoFlowState();
  clearSsoFlowLock();
}

function randomString(length = 48) {
  const alphabet =
    'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~';
  const array = new Uint8Array(length);
  crypto.getRandomValues(array);
  return Array.from(array)
    .map((value) => alphabet[value % alphabet.length])
    .join('');
}

function base64UrlEncode(bytes: Uint8Array) {
  const str = btoa(String.fromCharCode(...bytes));
  return str.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

async function sha256Base64Url(input: string) {
  const encoded = new TextEncoder().encode(input);
  const digest = await crypto.subtle.digest('SHA-256', encoded);
  return base64UrlEncode(new Uint8Array(digest));
}

function getAuthorizeUrl() {
  const cfg = env();
  const base = (cfg.VITE_SSO_AUTH_BASE_URL || getDefaultAuthBaseUrl()).replace(/\/+$/, '');
  return cfg.VITE_SSO_AUTHORIZE_URL || `${base}/oauth/authorize`;
}

function getTokenUrl() {
  const cfg = env();
  const base = (cfg.VITE_SSO_AUTH_BASE_URL || getDefaultAuthBaseUrl()).replace(/\/+$/, '');
  return cfg.VITE_SSO_TOKEN_URL || `${base}/oauth/token`;
}

function getLogoutUrl() {
  const cfg = env();
  const base = (cfg.VITE_SSO_AUTH_BASE_URL || getDefaultAuthBaseUrl()).replace(/\/+$/, '');
  return cfg.VITE_SSO_LOGOUT_URL || `${base}/auth/logout`;
}

function getDefaultAuthBaseUrl() {
  if (typeof window !== 'undefined') {
    const { hostname } = window.location;
    if (hostname === 'localhost' || hostname === '127.0.0.1') {
      return 'http://localhost:3104';
    }
  }

  return 'https://authapi.ryvidia.my.id';
}

function getClientId() {
  return env().VITE_SSO_CLIENT_ID || 'k2s-web';
}

function getScope() {
  return env().VITE_SSO_SCOPE || 'openid profile email';
}

function getRedirectUri() {
  const cfg = env();
  if (cfg.VITE_SSO_REDIRECT_URI) {
    return cfg.VITE_SSO_REDIRECT_URI;
  }
  if (typeof window === 'undefined') {
    return '';
  }
  return `${window.location.origin}/auth/callback`;
}

export function isSsoEnabled() {
  return String(env().VITE_SSO_ENABLED || '').toLowerCase() === 'true';
}

export async function startSsoLogin(
  returnTo = '/dashboard',
  options: { force?: boolean } = {}
) {
  const lockAcquired = acquireSsoLock({ force: options.force === true });
  if (!lockAcquired) {
    throw new Error('SSO sedang diproses di tab lain. Tunggu sebentar lalu coba lagi.');
  }

  const state = randomString(32);
  const verifier = randomString(64);
  const challenge = await sha256Base64Url(verifier);

  sessionStorage.setItem(SSO_STATE_KEY, state);
  sessionStorage.setItem(SSO_VERIFIER_KEY, verifier);
  sessionStorage.setItem(SSO_RETURN_TO_KEY, returnTo);

  const params = new URLSearchParams({
    response_type: 'code',
    client_id: getClientId(),
    redirect_uri: getRedirectUri(),
    scope: getScope(),
    state,
    code_challenge: challenge,
    code_challenge_method: 'S256',
  });

  window.location.replace(`${getAuthorizeUrl()}?${params.toString()}`);
}

export function consumeSsoFlowState() {
  const state = sessionStorage.getItem(SSO_STATE_KEY);
  const verifier = sessionStorage.getItem(SSO_VERIFIER_KEY);
  const returnTo = sessionStorage.getItem(SSO_RETURN_TO_KEY);
  clearSsoFlowState();
  clearSsoFlowLock();
  return { state, verifier, returnTo: returnTo || '/dashboard' };
}

export async function exchangeAuthorizationCode({
  code,
  codeVerifier,
}: {
  code: string;
  codeVerifier: string;
}) {
  const body = new URLSearchParams({
    grant_type: 'authorization_code',
    client_id: getClientId(),
    code,
    redirect_uri: getRedirectUri(),
    code_verifier: codeVerifier,
  });

  const response = await fetch(getTokenUrl(), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Accept: 'application/json',
    },
    body: body.toString(),
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message =
      (typeof data?.error_description === 'string' && data.error_description) ||
      (typeof data?.message === 'string' && data.message) ||
      (typeof data?.error === 'string' && data.error) ||
      'SSO token exchange failed';
    throw new Error(message);
  }

  return data as {
    access_token: string;
    refresh_token?: string;
    expires_in?: number;
    user?: Record<string, unknown>;
  };
}

export async function refreshAccessToken(refreshToken: string) {
  const body = new URLSearchParams({
    grant_type: 'refresh_token',
    client_id: getClientId(),
    refresh_token: refreshToken,
  });

  const response = await fetch(getTokenUrl(), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Accept: 'application/json',
    },
    body: body.toString(),
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message =
      (typeof data?.error_description === 'string' && data.error_description) ||
      (typeof data?.message === 'string' && data.message) ||
      (typeof data?.error === 'string' && data.error) ||
      'SSO token refresh failed';
    throw new Error(message);
  }

  return data as {
    access_token: string;
    refresh_token?: string;
    expires_in?: number;
    user?: Record<string, unknown>;
  };
}

export function buildSsoLogoutUrl(postLogoutRedirectUri: string, clientId = getClientId()) {
  const params = new URLSearchParams({
    post_logout_redirect_uri: postLogoutRedirectUri,
    client_id: clientId,
  });
  return `${getLogoutUrl()}?${params.toString()}`;
}
