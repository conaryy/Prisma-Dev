import test from 'node:test';
import assert from 'node:assert/strict';
import { createOauthRouter } from '../src/routes/oauth-routes.js';

function createNoopRateLimiter() {
  return (_req, _res, next) => next();
}

function createMockResponse() {
  return {
    statusCode: 200,
    headers: {},
    body: undefined,
    redirectedTo: null,
    finished: false,
    status(code) {
      this.statusCode = code;
      return this;
    },
    setHeader(name, value) {
      this.headers[name.toLowerCase()] = value;
    },
    getHeader(name) {
      return this.headers[name.toLowerCase()];
    },
    json(payload) {
      this.body = payload;
      this.finished = true;
      return this;
    },
    redirect(target) {
      this.statusCode = 302;
      this.redirectedTo = target;
      this.finished = true;
      return this;
    },
  };
}

async function invokeRouter(router, { method, url, body = {}, query = {}, headers = {}, cookies = {} }) {
  const req = {
    method,
    url,
    originalUrl: url,
    path: url,
    body,
    query,
    headers,
    cookies,
    params: {},
    ip: '127.0.0.1',
    socket: { remoteAddress: '127.0.0.1' },
    get(name) {
      return this.headers[String(name).toLowerCase()];
    },
  };

  const res = createMockResponse();
  await new Promise((resolve, reject) => {
    router.handle(req, res, (error) => {
      if (error) {
        reject(error);
        return;
      }
      resolve();
    });
    setImmediate(resolve);
  });
  return res;
}

test('GET /oauth/authorize redirects unauthenticated user to login UI', async () => {
  const router = createOauthRouter({
    tokenRateLimiter: createNoopRateLimiter(),
    getClientById: async () => ({
      id: 'k2s-web',
      redirectUris: ['http://localhost:5173/auth/callback'],
      postLogoutRedirectUris: [],
    }),
    getUserBySession: async () => null,
  });

  const response = await invokeRouter(router, {
    method: 'GET',
    url: '/oauth/authorize',
    query: {
      client_id: 'k2s-web',
      redirect_uri: 'http://localhost:5173/auth/callback',
      response_type: 'code',
      scope: 'openid profile email',
      code_challenge: 'challenge',
      code_challenge_method: 'S256',
      state: 'abc',
    },
  });

  assert.equal(response.statusCode, 302);
  assert.match(response.redirectedTo, /^http:\/\/localhost:5174\/login\?/);
  assert.match(response.redirectedTo, /return_to=/);
});

test('POST /oauth/token rejects invalid client', async () => {
  const router = createOauthRouter({
    tokenRateLimiter: createNoopRateLimiter(),
    extractClientCredentials: () => ({
      clientId: 'k2s-web',
      clientSecret: 'wrong',
    }),
    getClientById: async () => ({
      id: 'k2s-web',
      client_secret: 'correct',
    }),
  });

  const response = await invokeRouter(router, {
    method: 'POST',
    url: '/oauth/token',
    body: { grant_type: 'refresh_token', refresh_token: 'abc' },
  });

  assert.equal(response.statusCode, 401);
  assert.equal(response.body.error, 'invalid_client');
});

test('POST /oauth/token returns unsupported grant type when client is valid', async () => {
  const router = createOauthRouter({
    tokenRateLimiter: createNoopRateLimiter(),
    extractClientCredentials: () => ({
      clientId: 'k2s-web',
      clientSecret: 'correct',
    }),
    getClientById: async () => ({
      id: 'k2s-web',
      client_secret: 'correct',
    }),
  });

  const response = await invokeRouter(router, {
    method: 'POST',
    url: '/oauth/token',
    body: { grant_type: 'client_credentials' },
  });

  assert.equal(response.statusCode, 400);
  assert.equal(response.body.error, 'unsupported_grant_type');
});

test('GET /oauth/userinfo returns 401 without bearer token', async () => {
  const router = createOauthRouter({
    tokenRateLimiter: createNoopRateLimiter(),
  });

  const response = await invokeRouter(router, {
    method: 'GET',
    url: '/oauth/userinfo',
  });

  assert.equal(response.statusCode, 401);
  assert.equal(response.body.error, 'invalid_token');
});

test('POST /oauth/revoke revokes token hash and returns success', async () => {
  let executed = null;
  const router = createOauthRouter({
    tokenRateLimiter: createNoopRateLimiter(),
    hashToken: () => 'hashed-token',
    execQuery: async (sql, params) => {
      executed = { sql, params };
      return { changes: 1 };
    },
  });

  const response = await invokeRouter(router, {
    method: 'POST',
    url: '/oauth/revoke',
    body: { token: 'plain-token' },
  });

  assert.equal(response.statusCode, 200);
  assert.equal(response.body.success, true);
  assert.ok(executed);
  assert.equal(executed.params[1], 'hashed-token');
});

test('POST /oauth/token authorization_code returns distinct id_token and access_token', async () => {
  const verifierHashHex = 'ab'.repeat(32);
  const router = createOauthRouter({
    tokenRateLimiter: createNoopRateLimiter(),
    extractClientCredentials: () => ({
      clientId: 'k2s-web',
      clientSecret: 'correct',
    }),
    getClientById: async () => ({
      id: 'k2s-web',
      client_secret: 'correct',
    }),
    queryOne: async (sql, params) => {
      if (sql.includes('FROM authorization_codes')) {
        return {
          code: params[0],
          client_id: 'k2s-web',
          user_id: 'user-1',
          redirect_uri: 'http://localhost:5173/auth/callback',
          scope: 'openid profile email',
          code_challenge: Buffer.from(verifierHashHex, 'hex').toString('base64url'),
          expires_at: Date.now() + 60_000,
          consumed_at: null,
        };
      }
      if (sql.includes('FROM users')) {
        return {
          id: 'user-1',
          email: 'admin@example.com',
          username: 'admin',
          role: 'Admin',
          permissions_json: {},
        };
      }
      return null;
    },
    hashToken: (value) => {
      if (value === 'verifier') {
        return verifierHashHex;
      }
      return `hash:${value}`;
    },
    signAccessToken: async () => 'access-jwt',
    signIdToken: async () => 'id-jwt',
    execQuery: async () => ({ changes: 1 }),
    randomToken: () => 'refresh-raw',
  });

  const response = await invokeRouter(router, {
    method: 'POST',
    url: '/oauth/token',
    body: {
      grant_type: 'authorization_code',
      code: 'auth-code',
      redirect_uri: 'http://localhost:5173/auth/callback',
      code_verifier: 'verifier',
    },
  });

  assert.equal(response.statusCode, 200);
  assert.equal(response.body.access_token, 'access-jwt');
  assert.equal(response.body.id_token, 'id-jwt');
  assert.notEqual(response.body.access_token, response.body.id_token);
});
