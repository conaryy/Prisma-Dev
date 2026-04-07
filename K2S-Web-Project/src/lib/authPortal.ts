function normalizeBaseUrl(value: string) {
  return value.replace(/\/+$/, '');
}

function defaultAuthPortalBaseUrl() {
  if (typeof window !== 'undefined') {
    const { hostname } = window.location;
    if (hostname === 'localhost' || hostname === '127.0.0.1') {
      return 'http://localhost:5174';
    }
  }

  return 'https://auth.ryvidia.my.id';
}

export function getAuthPortalUrl(path = '/portal-admin') {
  const env = (import.meta as { env?: Record<string, string> }).env ?? {};
  const base = normalizeBaseUrl(env.VITE_AUTH_PORTAL_URL || defaultAuthPortalBaseUrl());
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  return `${base}${normalizedPath}`;
}
