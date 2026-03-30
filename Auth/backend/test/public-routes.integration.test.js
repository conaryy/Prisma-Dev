import test from 'node:test';
import assert from 'node:assert/strict';
import { createPublicRouter } from '../src/routes/public-routes.js';

function createNoopRateLimiter() {
  return (_req, _res, next) => next();
}

function createMockResponse() {
  return {
    statusCode: 200,
    headers: {},
    body: undefined,
    redirectedTo: null,
    contentType: null,
    cookies: [],
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
    send(payload) {
      this.body = payload;
      this.finished = true;
      return this;
    },
    type(value) {
      this.contentType = value;
      return this;
    },
    redirect(target) {
      this.statusCode = 302;
      this.redirectedTo = target;
      this.finished = true;
      return this;
    },
    cookie(name, value, options) {
      this.cookies.push({ name, value, options });
      return this;
    },
    clearCookie(name, options) {
      this.cookies.push({ name, cleared: true, options });
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

test('GET /health returns service metadata', async () => {
  const router = createPublicRouter({
    loginRateLimiter: createNoopRateLimiter(),
  });

  const response = await invokeRouter(router, {
    method: 'GET',
    url: '/health',
  });

  assert.equal(response.statusCode, 200);
  assert.equal(response.body.ok, true);
  assert.equal(response.body.service, 'auth-backend');
});

test('POST /auth/ui/login returns 401 for invalid credentials', async () => {
  const router = createPublicRouter({
    loginRateLimiter: createNoopRateLimiter(),
    authenticateLocalUser: async () => ({
      ok: false,
      status: 401,
      error: 'Invalid credentials',
    }),
  });

  const response = await invokeRouter(router, {
    method: 'POST',
    url: '/auth/ui/login',
    body: { email: 'admin', password: 'wrong' },
  });

  assert.equal(response.statusCode, 401);
  assert.equal(response.body.error, 'Invalid credentials');
});

test('POST /auth/ui/login returns success payload and sets session cookie', async () => {
  const router = createPublicRouter({
    loginRateLimiter: createNoopRateLimiter(),
    authenticateLocalUser: async () => ({
      ok: true,
      user: { id: 'user-1' },
    }),
    createUserSession: async () => 'session-123',
  });

  const response = await invokeRouter(router, {
    method: 'POST',
    url: '/auth/ui/login',
    body: {
      email: 'admin',
      password: 'secret123',
      return_to: '/portal-admin',
    },
  });

  assert.equal(response.statusCode, 200);
  assert.equal(response.body.success, true);
  assert.match(response.body.redirect_to, /\/portal-admin$/);
  assert.equal(response.cookies[0].name, 'auth_sid');
  assert.equal(response.cookies[0].value, 'session-123');
});

test('POST /auth/login redirects to sanitized target after success', async () => {
  const router = createPublicRouter({
    loginRateLimiter: createNoopRateLimiter(),
    authenticateLocalUser: async () => ({
      ok: true,
      user: { id: 'user-1' },
    }),
    createUserSession: async () => 'session-redirect',
  });

  const response = await invokeRouter(router, {
    method: 'POST',
    url: '/auth/login',
    body: {
      email: 'admin',
      password: 'secret123',
      return_to: 'https://evil.example.com/phish',
    },
  });

  assert.equal(response.statusCode, 302);
  assert.equal(response.redirectedTo, 'http://localhost:4000/');
});

test('GET /auth/logout redirects to allowed post-logout URI', async () => {
  const router = createPublicRouter({
    loginRateLimiter: createNoopRateLimiter(),
    performLogout: async () => {},
    resolvePostLogoutRedirect: async () => 'http://localhost:5174/login',
  });

  const response = await invokeRouter(router, {
    method: 'GET',
    url: '/auth/logout',
  });

  assert.equal(response.statusCode, 302);
  assert.equal(response.redirectedTo, 'http://localhost:5174/login');
});
