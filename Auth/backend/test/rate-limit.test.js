import test from 'node:test';
import assert from 'node:assert/strict';
import {
  __clearRateLimitState,
  createLoginRateLimiter,
  createResetPasswordRateLimiter,
  createTokenRateLimiter,
} from '../src/rate-limit.js';

function createMockResponse() {
  return {
    headers: {},
    statusCode: 200,
    body: null,
    setHeader(name, value) {
      this.headers[name] = value;
    },
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(payload) {
      this.body = payload;
      return this;
    },
  };
}

test.beforeEach(() => {
  __clearRateLimitState();
});

test('login limiter allows first request and blocks after threshold', () => {
  const limiter = createLoginRateLimiter({ maxPerIp: 2, maxPerIdentity: 2, windowMs: 60_000 });
  let nextCalls = 0;

  const req = {
    body: { email: 'admin' },
    ip: '127.0.0.1',
    headers: {},
    socket: { remoteAddress: '127.0.0.1' },
  };

  limiter(req, createMockResponse(), () => {
    nextCalls += 1;
  });
  limiter(req, createMockResponse(), () => {
    nextCalls += 1;
  });

  const blockedRes = createMockResponse();
  limiter(req, blockedRes, () => {
    nextCalls += 1;
  });

  assert.equal(nextCalls, 2);
  assert.equal(blockedRes.statusCode, 429);
  assert.equal(blockedRes.body.error, 'rate_limited');
});

test('token limiter blocks by client threshold', () => {
  const limiter = createTokenRateLimiter({ maxPerIp: 10, maxPerClient: 1, windowMs: 60_000 });
  const req = {
    body: { client_id: 'k2s-web' },
    ip: '127.0.0.1',
    headers: {},
    socket: { remoteAddress: '127.0.0.1' },
  };

  let nextCalls = 0;
  limiter(req, createMockResponse(), () => {
    nextCalls += 1;
  });

  const blockedRes = createMockResponse();
  limiter(req, blockedRes, () => {
    nextCalls += 1;
  });

  assert.equal(nextCalls, 1);
  assert.equal(blockedRes.statusCode, 429);
});

test('reset password limiter uses actor and target combination', () => {
  const limiter = createResetPasswordRateLimiter({ maxPerActor: 1, windowMs: 60_000 });
  const req = {
    params: { id: 'target-1' },
    authUser: { id: 'admin-1' },
    ip: '127.0.0.1',
    headers: {},
    socket: { remoteAddress: '127.0.0.1' },
  };

  let nextCalls = 0;
  limiter(req, createMockResponse(), () => {
    nextCalls += 1;
  });

  const blockedRes = createMockResponse();
  limiter(req, blockedRes, () => {
    nextCalls += 1;
  });

  assert.equal(nextCalls, 1);
  assert.equal(blockedRes.statusCode, 429);
});
