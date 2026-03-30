import { config } from './config.js';

const buckets = new Map();

function now() {
  return Date.now();
}

function cleanupExpiredEntries(currentTime) {
  for (const [key, entry] of buckets.entries()) {
    if (entry.resetAt <= currentTime) {
      buckets.delete(key);
    }
  }
}

function normalizeSegment(value, fallback = 'anonymous') {
  const normalized = String(value ?? '').trim().toLowerCase();
  return normalized || fallback;
}

function clientIp(req) {
  const forwarded = String(req.headers['x-forwarded-for'] || '').split(',')[0]?.trim();
  const remoteAddress = req.ip || req.socket?.remoteAddress || '';
  return normalizeSegment(forwarded || remoteAddress, 'unknown-ip');
}

function applyLimit(key, max, windowMs) {
  const currentTime = now();
  cleanupExpiredEntries(currentTime);

  const bucket = buckets.get(key);
  if (!bucket || bucket.resetAt <= currentTime) {
    const next = {
      count: 1,
      resetAt: currentTime + windowMs,
    };
    buckets.set(key, next);
    return {
      allowed: true,
      remaining: Math.max(max - next.count, 0),
      retryAfterSeconds: Math.max(Math.ceil((next.resetAt - currentTime) / 1000), 1),
    };
  }

  bucket.count += 1;
  buckets.set(key, bucket);

  return {
    allowed: bucket.count <= max,
    remaining: Math.max(max - bucket.count, 0),
    retryAfterSeconds: Math.max(Math.ceil((bucket.resetAt - currentTime) / 1000), 1),
  };
}

function rejectRateLimited(res, retryAfterSeconds) {
  res.setHeader('Retry-After', String(retryAfterSeconds));
  res.status(429).json({
    error: 'rate_limited',
    message: 'Too many requests',
  });
}

export function createLoginRateLimiter(options = {}) {
  return function loginRateLimiter(req, res, next) {
    if (!config.rateLimit.enabled) {
      next();
      return;
    }

    const ip = clientIp(req);
    const identity = normalizeSegment(req.body?.email || req.body?.username, 'unknown-identity');
    const windowMs = options.windowMs ?? config.rateLimit.loginWindowMs;
    const maxPerIp = options.maxPerIp ?? config.rateLimit.loginMaxPerIp;
    const maxPerIdentity = options.maxPerIdentity ?? config.rateLimit.loginMaxPerIdentity;

    const byIp = applyLimit(
      `login:ip:${ip}`,
      maxPerIp,
      windowMs
    );
    if (!byIp.allowed) {
      rejectRateLimited(res, byIp.retryAfterSeconds);
      return;
    }

    const byIdentity = applyLimit(
      `login:identity:${ip}:${identity}`,
      maxPerIdentity,
      windowMs
    );
    if (!byIdentity.allowed) {
      rejectRateLimited(res, byIdentity.retryAfterSeconds);
      return;
    }

    next();
  };
}

export function createTokenRateLimiter(options = {}) {
  return function tokenRateLimiter(req, res, next) {
    if (!config.rateLimit.enabled) {
      next();
      return;
    }

    const ip = clientIp(req);
    const clientId = normalizeSegment(req.body?.client_id, 'unknown-client');
    const windowMs = options.windowMs ?? config.rateLimit.tokenWindowMs;
    const maxPerIp = options.maxPerIp ?? config.rateLimit.tokenMaxPerIp;
    const maxPerClient = options.maxPerClient ?? config.rateLimit.tokenMaxPerClient;

    const byIp = applyLimit(
      `token:ip:${ip}`,
      maxPerIp,
      windowMs
    );
    if (!byIp.allowed) {
      rejectRateLimited(res, byIp.retryAfterSeconds);
      return;
    }

    const byClient = applyLimit(
      `token:client:${ip}:${clientId}`,
      maxPerClient,
      windowMs
    );
    if (!byClient.allowed) {
      rejectRateLimited(res, byClient.retryAfterSeconds);
      return;
    }

    next();
  };
}

export function createResetPasswordRateLimiter(options = {}) {
  return function resetPasswordRateLimiter(req, res, next) {
    if (!config.rateLimit.enabled) {
      next();
      return;
    }

    const ip = clientIp(req);
    const actorId = normalizeSegment(req.authUser?.id, 'unknown-actor');
    const targetUserId = normalizeSegment(req.params?.id, 'unknown-target');
    const windowMs = options.windowMs ?? config.rateLimit.resetPasswordWindowMs;
    const maxPerActor = options.maxPerActor ?? config.rateLimit.resetPasswordMaxPerActor;

    const byActor = applyLimit(
      `reset-password:${ip}:${actorId}:${targetUserId}`,
      maxPerActor,
      windowMs
    );
    if (!byActor.allowed) {
      rejectRateLimited(res, byActor.retryAfterSeconds);
      return;
    }

    next();
  };
}

export function __clearRateLimitState() {
  buckets.clear();
}
