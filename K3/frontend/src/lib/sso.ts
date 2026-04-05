const STATE_KEY = 'k3.sso.state';
const VERIFIER_KEY = 'k3.sso.verifier';
const RETURN_TO_KEY = 'k3.sso.returnTo';

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
  const configured = env().VITE_SSO_AUTH_BASE_URL;
  if (configured) {
    return configured.replace(/\/+$/, '');
  }

  if (typeof window !== 'undefined') {
    const { hostname } = window.location;
    if (hostname === 'localhost' || hostname === '127.0.0.1') {
      return 'http://localhost:3104';
    }
  }

  return 'https://authapi.ryvidia.my.id';
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
  return env().VITE_SSO_CLIENT_ID || 'k3-web';
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

function readStoredSsoFlow() {
  if (typeof window === 'undefined') {
    return {
      state: null,
      verifier: null,
      returnTo: null,
    };
  }

  return {
    state: sessionStorage.getItem(STATE_KEY),
    verifier: sessionStorage.getItem(VERIFIER_KEY),
    returnTo: sessionStorage.getItem(RETURN_TO_KEY),
  };
}

export function isSsoEnabled() {
  return String(env().VITE_SSO_ENABLED || 'true').toLowerCase() !== 'false';
}

export async function startSsoLogin(returnTo = '/') {
  const existingFlow = readStoredSsoFlow();
  const canReuseExistingFlow =
    Boolean(existingFlow.state && existingFlow.verifier) && existingFlow.returnTo === returnTo;
  const state = canReuseExistingFlow && existingFlow.state ? existingFlow.state : randomString(32);
  const verifier =
    canReuseExistingFlow && existingFlow.verifier ? existingFlow.verifier : randomString(64);
  const challenge = await sha256Base64Url(verifier);

  if (typeof window !== 'undefined') {
    sessionStorage.setItem(STATE_KEY, state);
    sessionStorage.setItem(VERIFIER_KEY, verifier);
    sessionStorage.setItem(RETURN_TO_KEY, returnTo);
  }

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

export function readSsoState() {
  const { state, verifier, returnTo } = readStoredSsoFlow();

  return { state, verifier, returnTo: returnTo || '/' };
}

export function clearSsoState() {
  if (typeof window === 'undefined') {
    return;
  }

  sessionStorage.removeItem(STATE_KEY);
  sessionStorage.removeItem(VERIFIER_KEY);
  sessionStorage.removeItem(RETURN_TO_KEY);
}

type TokenResponse = {
  access_token: string;
  refresh_token?: string;
  user?: Record<string, unknown>;
};

async function requestToken(body: URLSearchParams, fallbackMessage: string) {
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
      fallbackMessage;
    throw new Error(message);
  }

  return data as TokenResponse;
}

export async function exchangeAuthorizationCode(code: string, verifier: string) {
  const body = new URLSearchParams({
    grant_type: 'authorization_code',
    client_id: getClientId(),
    code,
    redirect_uri: getRedirectUri(),
    code_verifier: verifier,
  });

  return requestToken(body, 'SSO token exchange failed.');
}

export async function refreshAccessToken(refreshToken: string) {
  const body = new URLSearchParams({
    grant_type: 'refresh_token',
    client_id: getClientId(),
    refresh_token: refreshToken,
  });

  return requestToken(body, 'SSO token refresh failed.');
}

export function buildSsoLogoutUrl(postLogoutRedirectUri: string, clientId = getClientId()) {
  const params = new URLSearchParams({
    post_logout_redirect_uri: postLogoutRedirectUri,
    client_id: clientId,
  });
  return `${getLogoutUrl()}?${params.toString()}`;
}
