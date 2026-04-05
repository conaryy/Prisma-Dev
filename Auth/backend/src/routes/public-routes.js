import { Router } from 'express';
import { config } from '../config.js';
import { getJwksPayload } from '../crypto.js';
import {
  authenticateLocalUser,
  createUserSession,
  getUserPermissions,
  performLogout,
  resolvePostLogoutRedirect,
  sanitizeRedirectTarget,
  setSessionCookie,
} from '../auth-service.js';
import { asyncHandler } from '../middleware.js';
import { createLoginRateLimiter } from '../rate-limit.js';
import { validateLoginPayload } from '../validation.js';

export function createPublicRouter(deps = {}) {
  const router = Router();
  const services = {
    authenticateLocalUser,
    createUserSession,
    getUserPermissions,
    performLogout,
    resolvePostLogoutRedirect,
    sanitizeRedirectTarget,
    setSessionCookie,
    getJwksPayload,
    validateLoginPayload,
    loginRateLimiter: createLoginRateLimiter(),
    ...deps,
  };

  const resolvePortalLanding = (user) => {
    const permissions = services.getUserPermissions(user);
    const loginUiOrigin = (() => {
      try {
        return new URL(config.loginUiUrl).origin;
      } catch {
        return config.baseUrl;
      }
    })();
    return permissions.can_access_admin_portal
      ? `${loginUiOrigin}/portal-admin`
      : `${loginUiOrigin}/portal-user`;
  };

  const resolveLoginReturnTo = (rawReturnTo, user) => {
    const portalLanding = resolvePortalLanding(user);
    const sanitized = services.sanitizeRedirectTarget(rawReturnTo, portalLanding, {
      allowRelative: true,
    });
    const permissions = services.getUserPermissions(user);

    if (permissions.can_access_admin_portal) {
      return sanitized;
    }

    try {
      const requestedUrl = new URL(sanitized);
      if (requestedUrl.pathname === '/portal-admin' || requestedUrl.pathname.startsWith('/portal-admin/')) {
        return portalLanding;
      }
    } catch {
      return portalLanding;
    }

    return sanitized;
  };

  router.get('/health', (_req, res) => {
    res.json({ ok: true, service: 'auth-backend', issuer: config.issuer });
  });

  router.get('/.well-known/openid-configuration', (_req, res) => {
    res.json({
      issuer: config.issuer,
      authorization_endpoint: `${config.baseUrl}/oauth/authorize`,
      token_endpoint: `${config.baseUrl}/oauth/token`,
      userinfo_endpoint: `${config.baseUrl}/oauth/userinfo`,
      jwks_uri: `${config.baseUrl}/.well-known/jwks.json`,
      revocation_endpoint: `${config.baseUrl}/oauth/revoke`,
      response_types_supported: ['code'],
      grant_types_supported: ['authorization_code', 'refresh_token'],
      subject_types_supported: ['public'],
      id_token_signing_alg_values_supported: ['RS256'],
      token_endpoint_auth_methods_supported: ['none', 'client_secret_post', 'client_secret_basic'],
      scopes_supported: ['openid', 'profile', 'email'],
      claims_supported: ['sub', 'email', 'preferred_username', 'name', 'role', 'permissions'],
      code_challenge_methods_supported: ['S256'],
    });
  });

  router.get('/.well-known/jwks.json', (_req, res) => {
    res.json(services.getJwksPayload());
  });

  router.get('/auth/login', (req, res) => {
    const returnTo = services.sanitizeRedirectTarget(req.query.return_to, `${config.baseUrl}/`, {
      allowRelative: true,
    });
    res.type('html').send(`
<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width,initial-scale=1" />
    <title>Auth Login</title>
    <style>
      body { font-family: sans-serif; max-width: 420px; margin: 48px auto; padding: 0 12px; }
      .card { border: 1px solid #ddd; border-radius: 12px; padding: 16px; }
      label { display:block; margin: 8px 0 4px; font-size: 12px; color:#444; }
      input { width: 100%; padding: 10px; border-radius: 8px; border:1px solid #bbb; }
      button { margin-top: 12px; width: 100%; padding: 10px; border:0; border-radius:8px; background:#2563eb; color:#fff; }
      .muted { color:#666; font-size:12px; margin-top:8px; }
    </style>
  </head>
  <body>
    <div class="card">
      <h3>Sign In</h3>
      <form method="post" action="/auth/login">
        <input type="hidden" name="return_to" value="${returnTo.replace(/"/g, '&quot;')}" />
        <label>Email / Username</label>
        <input name="email" required />
        <label>Password</label>
        <input name="password" type="password" required />
        <button type="submit">Login</button>
      </form>
      <p class="muted">Dev admin: ${config.devAdmin.username} / ${config.devAdmin.password}</p>
    </div>
  </body>
</html>`);
  });

  router.post(
    '/auth/login',
    services.loginRateLimiter,
    asyncHandler(async (req, res) => {
      const validation = services.validateLoginPayload(req.body);
      if (!validation.ok) {
        res.status(validation.status).json({ error: validation.error });
        return;
      }

      const authResult = await services.authenticateLocalUser(
        validation.data.email,
        validation.data.password
      );
      if (!authResult.ok) {
        res.status(authResult.status).json({ error: authResult.error });
        return;
      }
      const returnTo = resolveLoginReturnTo(validation.data.return_to, authResult.user);

      const sessionId = await services.createUserSession(authResult.user.id);
      services.setSessionCookie(res, sessionId);
      res.redirect(returnTo);
    })
  );

  router.post(
    '/auth/ui/login',
    services.loginRateLimiter,
    asyncHandler(async (req, res) => {
      const validation = services.validateLoginPayload(req.body);
      if (!validation.ok) {
        res.status(validation.status).json({ error: validation.error });
        return;
      }

      const authResult = await services.authenticateLocalUser(
        validation.data.email,
        validation.data.password
      );
      if (!authResult.ok) {
        res.status(authResult.status).json({ error: authResult.error });
        return;
      }
      const returnTo = resolveLoginReturnTo(validation.data.return_to, authResult.user);

      const sessionId = await services.createUserSession(authResult.user.id);
      services.setSessionCookie(res, sessionId);
      res.json({
        success: true,
        redirect_to: returnTo,
      });
    })
  );

  router.post(
    '/auth/logout',
    asyncHandler(async (req, res) => {
      await services.performLogout(req, res);
      res.json({ success: true });
    })
  );

  router.get(
    '/auth/logout',
    asyncHandler(async (req, res) => {
      await services.performLogout(req, res);
      const redirectUri = await services.resolvePostLogoutRedirect(req);
      if (redirectUri) {
        res.redirect(redirectUri);
        return;
      }
      res.type('html').send('<html><body><p>Logged out.</p></body></html>');
    })
  );

  return router;
}
