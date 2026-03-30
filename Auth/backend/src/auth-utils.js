import { config } from './config.js';
import { parseJson } from './db.js';
import { DEFAULT_ADMIN_PERMISSIONS, buildEffectivePermissions } from './permissions.js';

const ALLOWED_ROLES = new Set(['Admin', 'Viewer']);
const ALLOWED_STATUS = new Set(['Active', 'Disabled']);

export function nowMs() {
  return Date.now();
}

export function sanitizeText(value) {
  return String(value ?? '').trim();
}

export function sanitizeEmail(value) {
  const normalized = sanitizeText(value).toLowerCase();
  return normalized || null;
}

export function ensureRole(value) {
  if (!ALLOWED_ROLES.has(value)) {
    throw new Error('Role harus Admin atau Viewer.');
  }
  return value;
}

export function ensureStatus(value) {
  if (!ALLOWED_STATUS.has(value)) {
    throw new Error('Status harus Active atau Disabled.');
  }
  return value;
}

export function safePermissionsInput(input) {
  const source = input && typeof input === 'object' ? input : {};
  const keys = Object.keys(DEFAULT_ADMIN_PERMISSIONS);
  const out = {};
  for (const key of keys) {
    if (Object.prototype.hasOwnProperty.call(source, key)) {
      out[key] = Boolean(source[key]);
    }
  }
  return out;
}

export function normalizeScope(scope) {
  const fallback = 'openid profile email';
  if (!scope || typeof scope !== 'string') {
    return fallback;
  }
  const unique = [...new Set(scope.split(/\s+/).map((item) => item.trim()).filter(Boolean))];
  return unique.length ? unique.join(' ') : fallback;
}

export function getAllowedRedirectOrigins() {
  const out = new Set(config.allowedOrigins);
  for (const raw of [config.baseUrl, config.loginUiUrl]) {
    try {
      out.add(new URL(raw).origin);
    } catch {
      // Ignore invalid config URL and rely on explicit allowlist.
    }
  }
  return out;
}

export function sanitizeRedirectTarget(rawValue, fallback, options = {}) {
  const value = String(rawValue || '').trim();
  if (!value) {
    return fallback;
  }

  const allowedOrigins = getAllowedRedirectOrigins();
  const allowedPaths = options.allowedPaths ? new Set(options.allowedPaths) : null;
  const allowRelative = options.allowRelative !== false;

  if (allowRelative && value.startsWith('/')) {
    try {
      const url = new URL(value, config.baseUrl);
      if (allowedPaths && !allowedPaths.has(url.pathname)) {
        return fallback;
      }
      return url.toString();
    } catch {
      return fallback;
    }
  }

  try {
    const url = new URL(value);
    if (!allowedOrigins.has(url.origin)) {
      return fallback;
    }
    if (allowedPaths && !allowedPaths.has(url.pathname)) {
      return fallback;
    }
    return url.toString();
  } catch {
    return fallback;
  }
}

export function getUserPermissions(user) {
  return buildEffectivePermissions(
    user.role,
    parseJson(user.permissions_json || '{}', {})
  );
}

export function toUserResponse(row) {
  const permissions = getUserPermissions(row);
  return {
    id: row.id,
    name: row.username,
    username: row.username,
    email: row.email,
    role: row.role,
    status: row.status,
    can_access_external_dnp: Boolean(permissions.can_access_external_dnp),
    permissions,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

export function tokenResponse({ accessToken, idToken, refreshToken, scope, user }) {
  return {
    access_token: accessToken,
    token_type: 'Bearer',
    expires_in: config.accessTokenTtlSeconds,
    refresh_token: refreshToken,
    scope,
    id_token: idToken,
    user: {
      id: user.id,
      name: user.username,
      username: user.username,
      email: user.email,
      role: user.role,
      status: user.status,
      permissions: user.permissions,
      can_access_external_dnp: Boolean(user.permissions?.can_access_external_dnp),
    },
  };
}
