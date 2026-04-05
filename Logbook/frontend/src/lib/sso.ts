const STATE_KEY = 'logbook.sso.state';
const VERIFIER_KEY = 'logbook.sso.verifier';
const RETURN_TO_KEY = 'logbook.sso.returnTo';

function env() {
  return (import.meta as { env?: Record<string, string> }).env ?? {};
}

function randomString(length = 48) {
  const alphabet =
    'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~';
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  return Array.from(bytes)
    .map((value) => alphabet[value % alphabet.length])
    .join('');
}

function base64UrlEncode(bytes: Uint8Array) {
  const raw = btoa(String.fromCharCode(...bytes));
  return raw.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

async function sha256Base64Url(input: string) {
  const data = new TextEncoder().encode(input);
  const digest = await crypto.subtle.digest('SHA-256', data);
  return base64UrlEncode(new Uint8Array(digest));
}

function getAuthBaseUrl() {
  return (env().VITE_SSO_AUTH_BASE_URL || 'http://localhost:3104').replace(/\/+$/, '');
}

function getAuthorizeUrl() {
  return env().VITE_SSO_AUTHORIZE_URL || `${getAuthBaseUrl()}/oauth/authorize`;
}

function getTokenUrl() {
  return env().VITE_SSO_TOKEN_URL || `${getAuthBaseUrl()}/oauth/token`;
}

function getLogoutUrl() {
  return env().VITE_SSO_LOGOUT_URL || `${getAuthBaseUrl()}/auth/logout`;
}

function getClientId() {
  return env().VITE_SSO_CLIENT_ID || 'logbook-web';
}

function getScope() {
  return env().VITE_SSO_SCOPE || 'openid profile email';
}

function getRedirectUri() {
  const configured = env().VITE_SSO_REDIRECT_URI;
  if (configured) {
    return configured;
  }
  return `${window.location.origin}/auth/callback`;
}

export function isSsoEnabled() {
  return String(env().VITE_SSO_ENABLED || '').toLowerCase() === 'true';
}

export async function startSsoLogin(returnTo = '/') {
  const state = randomString(32);
  const verifier = randomString(64);
  const challenge = await sha256Base64Url(verifier);

  sessionStorage.setItem(STATE_KEY, state);
  sessionStorage.setItem(VERIFIER_KEY, verifier);
  sessionStorage.setItem(RETURN_TO_KEY, returnTo);

  const params = new URLSearchParams({
    response_type: 'code',
    client_id: getClientId(),
    redirect_uri: getRedirectUri(),
    scope: getScope(),
    state,
    code_challenge: challenge,
    code_challenge_method: 'S256',
  });

  window.location.assign(`${getAuthorizeUrl()}?${params.toString()}`);
}

export function consumeSsoState() {
  const state = sessionStorage.getItem(STATE_KEY);
  const verifier = sessionStorage.getItem(VERIFIER_KEY);
  const returnTo = sessionStorage.getItem(RETURN_TO_KEY);
  sessionStorage.removeItem(STATE_KEY);
  sessionStorage.removeItem(VERIFIER_KEY);
  sessionStorage.removeItem(RETURN_TO_KEY);
  return { state, verifier, returnTo: returnTo || '/' };
}

export async function exchangeAuthorizationCode(code: string, verifier: string) {
  const body = new URLSearchParams({
    grant_type: 'authorization_code',
    client_id: getClientId(),
    code,
    redirect_uri: getRedirectUri(),
    code_verifier: verifier,
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
      'SSO token exchange failed.';
    throw new Error(message);
  }

  return data as {
    access_token: string;
    refresh_token?: string;
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
      'SSO token refresh failed.';
    throw new Error(message);
  }

  return data as {
    access_token: string;
    refresh_token?: string;
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
