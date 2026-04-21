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

function rightRotate(value: number, amount: number) {
  return (value >>> amount) | (value << (32 - amount));
}

function sha256Fallback(data: Uint8Array) {
  const constants = [
    0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1,
    0x923f82a4, 0xab1c5ed5, 0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3,
    0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174, 0xe49b69c1, 0xefbe4786,
    0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
    0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147,
    0x06ca6351, 0x14292967, 0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13,
    0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85, 0xa2bfe8a1, 0xa81a664b,
    0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
    0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a,
    0x5b9cca4f, 0x682e6ff3, 0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208,
    0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
  ];
  const hash = [
    0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a,
    0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19,
  ];
  const bitLength = data.length * 8;
  const paddedLength = Math.ceil((data.length + 9) / 64) * 64;
  const padded = new Uint8Array(paddedLength);
  padded.set(data);
  padded[data.length] = 0x80;
  const view = new DataView(padded.buffer);
  view.setUint32(paddedLength - 4, bitLength, false);

  for (let offset = 0; offset < paddedLength; offset += 64) {
    const words = new Array<number>(64);
    for (let i = 0; i < 16; i += 1) {
      words[i] = view.getUint32(offset + i * 4, false);
    }
    for (let i = 16; i < 64; i += 1) {
      const s0 = rightRotate(words[i - 15], 7) ^ rightRotate(words[i - 15], 18) ^ (words[i - 15] >>> 3);
      const s1 = rightRotate(words[i - 2], 17) ^ rightRotate(words[i - 2], 19) ^ (words[i - 2] >>> 10);
      words[i] = (words[i - 16] + s0 + words[i - 7] + s1) >>> 0;
    }

    let [a, b, c, d, e, f, g, h] = hash;
    for (let i = 0; i < 64; i += 1) {
      const s1 = rightRotate(e, 6) ^ rightRotate(e, 11) ^ rightRotate(e, 25);
      const ch = (e & f) ^ (~e & g);
      const temp1 = (h + s1 + ch + constants[i] + words[i]) >>> 0;
      const s0 = rightRotate(a, 2) ^ rightRotate(a, 13) ^ rightRotate(a, 22);
      const maj = (a & b) ^ (a & c) ^ (b & c);
      const temp2 = (s0 + maj) >>> 0;
      h = g;
      g = f;
      f = e;
      e = (d + temp1) >>> 0;
      d = c;
      c = b;
      b = a;
      a = (temp1 + temp2) >>> 0;
    }

    hash[0] = (hash[0] + a) >>> 0;
    hash[1] = (hash[1] + b) >>> 0;
    hash[2] = (hash[2] + c) >>> 0;
    hash[3] = (hash[3] + d) >>> 0;
    hash[4] = (hash[4] + e) >>> 0;
    hash[5] = (hash[5] + f) >>> 0;
    hash[6] = (hash[6] + g) >>> 0;
    hash[7] = (hash[7] + h) >>> 0;
  }

  const output = new Uint8Array(32);
  const outputView = new DataView(output.buffer);
  hash.forEach((value, index) => outputView.setUint32(index * 4, value, false));
  return output;
}

async function sha256Base64Url(input: string) {
  const data = new TextEncoder().encode(input);
  if (crypto.subtle?.digest) {
    const digest = await crypto.subtle.digest('SHA-256', data);
    return base64UrlEncode(new Uint8Array(digest));
  }
  return base64UrlEncode(sha256Fallback(data));
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
