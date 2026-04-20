import bcrypt from 'bcryptjs';
import { config } from './config.js';
import { execQuery, parseJson, queryAll, queryOne } from './db.js';
import { randomToken } from './crypto.js';
import {
  getUserPermissions,
  nowMs,
  sanitizeRedirectTarget,
} from './auth-utils.js';

export function setSessionCookie(res, sessionId) {
  res.cookie(config.sessionCookieName, sessionId, {
    httpOnly: true,
    sameSite: 'lax',
    secure: config.isSecureCookies,
    maxAge: config.sessionTtlSeconds * 1000,
    path: '/',
  });
}

export function clearSessionCookie(res) {
  res.clearCookie(config.sessionCookieName, {
    httpOnly: true,
    sameSite: 'lax',
    secure: config.isSecureCookies,
    path: '/',
  });
}

export async function getClientById(clientId) {
  const client = await queryOne('SELECT * FROM oauth_clients WHERE id = ? LIMIT 1', [clientId]);
  if (!client) {
    return null;
  }
  const isPublicClient = config.publicClientIds.includes(String(client.id || '').trim());
  return {
    ...client,
    isPublicClient,
    tokenEndpointAuthMethod: isPublicClient ? 'none' : 'client_secret_post',
    redirectUris: parseJson(client.redirect_uris_json, []),
    postLogoutRedirectUris: parseJson(client.post_logout_redirect_uris_json, []),
    grantTypes: parseJson(client.grant_types_json, []),
  };
}

export async function getUserBySession(req) {
  const sid = req.cookies?.[config.sessionCookieName];
  if (!sid) {
    return null;
  }

  const row = await queryOne(
    `
      SELECT u.*
      FROM auth_sessions s
      JOIN users u ON u.id = s.user_id
      WHERE s.id = ? AND s.expires_at > ?
      LIMIT 1
    `,
    [sid, nowMs()]
  );

  if (!row || String(row.status || 'Active') !== 'Active') {
    return null;
  }

  return {
    ...row,
    permissions: getUserPermissions(row),
  };
}

export async function createUserSession(userId) {
  const sessionId = randomToken(32);
  await execQuery(
    'INSERT INTO auth_sessions (id, user_id, expires_at, created_at) VALUES (?, ?, ?, ?)',
    [sessionId, userId, nowMs() + config.sessionTtlSeconds * 1000, nowMs()]
  );
  return sessionId;
}

export async function authenticateLocalUser(identity, password) {
  const normalizedIdentity = String(identity || '').trim();
  const normalizedPassword = String(password || '');
  const user = await queryOne(
    'SELECT * FROM users WHERE email = ? OR username = ? LIMIT 1',
    [normalizedIdentity, normalizedIdentity]
  );

  if (!user || !bcrypt.compareSync(normalizedPassword, user.password_hash)) {
    return { ok: false, status: 401, error: 'Invalid credentials' };
  }

  if (String(user.status || 'Active') !== 'Active') {
    return { ok: false, status: 403, error: 'Account disabled' };
  }

  return { ok: true, user };
}

export function extractClientCredentials(req) {
  const bodyClientId = String(req.body.client_id || '').trim();
  const bodyClientSecret = String(req.body.client_secret || '');
  if (bodyClientId) {
    return {
      clientId: bodyClientId,
      clientSecret: bodyClientSecret,
      method: 'client_secret_post',
    };
  }

  const authHeader = String(req.headers.authorization || '');
  if (!authHeader.startsWith('Basic ')) {
    return { clientId: '', clientSecret: '', method: null };
  }

  try {
    const decoded = Buffer.from(authHeader.slice(6), 'base64').toString('utf8');
    const separatorIndex = decoded.indexOf(':');
    if (separatorIndex < 0) {
      return { clientId: '', clientSecret: '', method: null };
    }
    return {
      clientId: decoded.slice(0, separatorIndex),
      clientSecret: decoded.slice(separatorIndex + 1),
      method: 'client_secret_basic',
    };
  } catch {
    return { clientId: '', clientSecret: '', method: null };
  }
}

function normalizeRedirectUriForMatch(value) {
  const raw = String(value || '').trim();
  if (!raw) {
    return '';
  }

  try {
    const url = new URL(raw);
    if (url.pathname !== '/' && url.pathname.endsWith('/')) {
      url.pathname = url.pathname.replace(/\/+$/, '');
    }
    if (url.pathname === '/') {
      url.pathname = '';
    }
    return url.toString();
  } catch {
    return raw.replace(/\/+$/, '');
  }
}

function findMatchingPostLogoutRedirect(requested, allowedUris) {
  const normalizedRequested = normalizeRedirectUriForMatch(requested);
  if (!normalizedRequested) {
    return null;
  }

  return (
    allowedUris.find(
      (candidate) => normalizeRedirectUriForMatch(candidate) === normalizedRequested
    ) ?? null
  );
}

export async function resolvePostLogoutRedirect(req) {
  const requested = String(
    req.query.post_logout_redirect_uri || req.body?.post_logout_redirect_uri || ''
  ).trim();

  if (!requested) {
    return null;
  }

  const clientId = String(req.query.client_id || req.body?.client_id || '').trim();
  if (clientId) {
    const client = await getClientById(clientId);
    const matchedRedirect = client
      ? findMatchingPostLogoutRedirect(requested, client.postLogoutRedirectUris)
      : null;
    if (matchedRedirect) {
      return matchedRedirect;
    }
    return null;
  }

  const allClients = await queryAll('SELECT * FROM oauth_clients');
  for (const raw of allClients) {
    const postLogoutUris = parseJson(raw.post_logout_redirect_uris_json, []);
    const matchedRedirect = Array.isArray(postLogoutUris)
      ? findMatchingPostLogoutRedirect(requested, postLogoutUris)
      : null;
    if (matchedRedirect) {
      return matchedRedirect;
    }
  }

  return sanitizeRedirectTarget(requested, null, {
    allowRelative: false,
    allowedPaths: ['/login', '/portal-admin', '/portal-user', '/profile', '/dashboard'],
  });
}

export async function performLogout(req, res) {
  const sid = req.cookies?.[config.sessionCookieName];
  if (sid) {
    await execQuery('DELETE FROM auth_sessions WHERE id = ?', [sid]);
  }
  clearSessionCookie(res);
}
