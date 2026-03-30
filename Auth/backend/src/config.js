import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');
const dataDir = path.join(rootDir, 'data');

function toInt(value, fallback) {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

function toList(value) {
  return String(value || '')
    .split(',')
    .map((x) => x.trim())
    .filter(Boolean);
}

function toBoolean(value, fallback = false) {
  if (value === undefined || value === null || value === '') {
    return fallback;
  }
  const normalized = String(value).trim().toLowerCase();
  if (['1', 'true', 'yes', 'on'].includes(normalized)) return true;
  if (['0', 'false', 'no', 'off'].includes(normalized)) return false;
  return fallback;
}

function getPgConfig() {
  const connectionString = process.env.AUTH_DATABASE_URL || process.env.DATABASE_URL || '';
  return {
    connectionString: connectionString || null,
    host: process.env.AUTH_PG_HOST || '127.0.0.1',
    port: toInt(process.env.AUTH_PG_PORT, 5432),
    database: process.env.AUTH_PG_DB || 'sso_auth',
    user: process.env.AUTH_PG_USER || 'sso_auth',
    password: process.env.AUTH_PG_PASSWORD || '',
    ssl: String(process.env.AUTH_PG_SSL || 'false').toLowerCase() === 'true',
  };
}

export const config = {
  nodeEnv: process.env.NODE_ENV || 'development',
  port: toInt(process.env.AUTH_PORT, 4000),
  baseUrl: process.env.AUTH_BASE_URL || `http://localhost:${toInt(process.env.AUTH_PORT, 4000)}`,
  issuer: process.env.AUTH_ISSUER || process.env.AUTH_BASE_URL || `http://localhost:${toInt(process.env.AUTH_PORT, 4000)}`,
  audience: process.env.AUTH_AUDIENCE || 'k2s-platform',
  loginUiUrl: process.env.AUTH_LOGIN_UI_URL || 'http://localhost:5174/login',
  isSecureCookies: toBoolean(
    process.env.AUTH_SESSION_COOKIE_SECURE,
    String(process.env.AUTH_BASE_URL || '').startsWith('https://')
  ),
  pg: getPgConfig(),
  jwkPath: path.join(dataDir, 'jwks-private.json'),
  defaultClient: {
    clientId: process.env.AUTH_DEFAULT_CLIENT_ID || 'k2s-web',
    clientSecret: process.env.AUTH_DEFAULT_CLIENT_SECRET || 'dev-secret-k2s',
    redirectUri:
      process.env.AUTH_DEFAULT_REDIRECT_URI ||
      'http://localhost:5173/auth/callback',
    postLogoutRedirectUri:
      process.env.AUTH_DEFAULT_POST_LOGOUT_URI || 'http://localhost:5173/login',
  },
  defaultLogbookClient: {
    clientId: process.env.AUTH_LOGBOOK_CLIENT_ID || 'logbook-web',
    clientSecret: process.env.AUTH_LOGBOOK_CLIENT_SECRET || 'dev-secret-logbook',
    redirectUri:
      process.env.AUTH_LOGBOOK_REDIRECT_URI ||
      'http://localhost:5175/auth/callback',
    postLogoutRedirectUri:
      process.env.AUTH_LOGBOOK_POST_LOGOUT_URI || 'http://localhost:5175/',
  },
  allowedOrigins: toList(process.env.AUTH_ALLOWED_ORIGINS),
  sessionCookieName: process.env.AUTH_SESSION_COOKIE_NAME || 'auth_sid',
  sessionTtlSeconds: toInt(process.env.AUTH_SESSION_TTL_SECONDS, 8 * 60 * 60),
  codeTtlSeconds: toInt(process.env.AUTH_CODE_TTL_SECONDS, 5 * 60),
  accessTokenTtlSeconds: toInt(process.env.AUTH_ACCESS_TOKEN_TTL_SECONDS, 15 * 60),
  refreshTokenTtlSeconds: toInt(process.env.AUTH_REFRESH_TOKEN_TTL_SECONDS, 14 * 24 * 60 * 60),
  devAdmin: {
    username: process.env.AUTH_DEV_ADMIN_USERNAME || 'admin',
    email: process.env.AUTH_DEV_ADMIN_EMAIL || 'admin@local.test',
    password: process.env.AUTH_DEV_ADMIN_PASSWORD || 'Admin123!',
  },
  rateLimit: {
    enabled: toBoolean(process.env.AUTH_RATE_LIMIT_ENABLED, true),
    loginWindowMs: toInt(process.env.AUTH_RATE_LIMIT_LOGIN_WINDOW_MS, 10 * 60 * 1000),
    loginMaxPerIp: toInt(process.env.AUTH_RATE_LIMIT_LOGIN_MAX_PER_IP, 60),
    loginMaxPerIdentity: toInt(process.env.AUTH_RATE_LIMIT_LOGIN_MAX_PER_IDENTITY, 20),
    tokenWindowMs: toInt(process.env.AUTH_RATE_LIMIT_TOKEN_WINDOW_MS, 5 * 60 * 1000),
    tokenMaxPerIp: toInt(process.env.AUTH_RATE_LIMIT_TOKEN_MAX_PER_IP, 120),
    tokenMaxPerClient: toInt(process.env.AUTH_RATE_LIMIT_TOKEN_MAX_PER_CLIENT, 60),
    resetPasswordWindowMs: toInt(process.env.AUTH_RATE_LIMIT_RESET_PASSWORD_WINDOW_MS, 15 * 60 * 1000),
    resetPasswordMaxPerActor: toInt(process.env.AUTH_RATE_LIMIT_RESET_PASSWORD_MAX_PER_ACTOR, 30),
  },
  isDevelopment: (process.env.NODE_ENV || 'development') !== 'production',
  dataDir,
};
