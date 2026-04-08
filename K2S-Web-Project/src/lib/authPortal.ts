import { getAuthToken } from '@/lib/api';

function normalizeBaseUrl(value: string) {
  return value.replace(/\/+$/, '');
}

function normalizePortalBaseUrl(value: string) {
  const normalized = normalizeBaseUrl(value.trim());
  if (!normalized) {
    return normalized;
  }

  try {
    const parsed = new URL(normalized);
    return parsed.origin;
  } catch {
    return normalized.replace(/\/login(?:\/.*)?$/i, '');
  }
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

export function getAuthPortalUrl(path = '/portal-admin', options?: { includeToken?: boolean }) {
  const env = (import.meta as { env?: Record<string, string> }).env ?? {};
  const base = normalizePortalBaseUrl(env.VITE_AUTH_PORTAL_URL || defaultAuthPortalBaseUrl());
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  const target = new URL(`${base}${normalizedPath}`);

  if (options?.includeToken) {
    const token = getAuthToken();
    if (token) {
      target.searchParams.set('token', token);
    }
  }

  return target.toString();
}
