import { Router } from 'express';
import { nanoid } from 'nanoid';
import { safeCertificationNoteLocationInput } from '../certification-note-locations.js';
import { config } from '../config.js';
import { execQuery, queryOne } from '../db.js';
import { hashToken, randomToken, signAccessToken, signIdToken, verifyAccessToken } from '../crypto.js';
import {
  extractClientCredentials,
  getClientById,
  getUserExternalDnpInstansiAccess,
  getUserBySession,
  getUserPermissions,
  normalizeScope,
  nowMs,
  sanitizeRedirectTarget,
  tokenResponse,
} from '../auth-service.js';
import { asyncHandler } from '../middleware.js';
import { createTokenRateLimiter } from '../rate-limit.js';

export function createOauthRouter(deps = {}) {
  const router = Router();
  const services = {
    execQuery,
    queryOne,
    hashToken,
    randomToken,
    signAccessToken,
    signIdToken,
    verifyAccessToken,
    extractClientCredentials,
    getClientById,
    getUserExternalDnpInstansiAccess,
    getUserBySession,
    getUserPermissions,
    normalizeScope,
    nowMs,
    sanitizeRedirectTarget,
    tokenResponse,
    tokenRateLimiter: createTokenRateLimiter(),
    ...deps,
  };

  const getCertificationNoteLocationAccess = (userRow) =>
    safeCertificationNoteLocationInput(userRow?.certification_note_location_access_json);

  router.get(
    '/oauth/authorize',
    asyncHandler(async (req, res) => {
      const clientId = String(req.query.client_id || '');
      const redirectUri = String(req.query.redirect_uri || '');
      const responseType = String(req.query.response_type || '');
      const state = String(req.query.state || '');
      const scope = services.normalizeScope(String(req.query.scope || 'openid profile email'));
      const codeChallenge = String(req.query.code_challenge || '');
      const codeChallengeMethod = String(req.query.code_challenge_method || '');

      const client = await services.getClientById(clientId);
      if (!client) {
        res.status(400).json({ error: 'invalid_client' });
        return;
      }
      if (!client.redirectUris.includes(redirectUri)) {
        res.status(400).json({ error: 'invalid_redirect_uri' });
        return;
      }
      if (responseType !== 'code') {
        res.status(400).json({ error: 'unsupported_response_type' });
        return;
      }
      if (!codeChallenge || codeChallengeMethod !== 'S256') {
        res.status(400).json({ error: 'invalid_request', message: 'PKCE S256 is required' });
        return;
      }

      const user = await services.getUserBySession(req);
      if (!user) {
        const returnTo = services.sanitizeRedirectTarget(
          `${config.baseUrl}/oauth/authorize?${new URLSearchParams(req.query).toString()}`,
          `${config.baseUrl}/`,
          { allowRelative: true }
        );
        const loginUi = new URL(config.loginUiUrl);
        loginUi.searchParams.set('return_to', returnTo);
        res.redirect(loginUi.toString());
        return;
      }

      const code = services.randomToken(24);
      await services.execQuery(
        `
          INSERT INTO authorization_codes (
            code, client_id, user_id, redirect_uri, scope, code_challenge, code_challenge_method, expires_at, consumed_at, created_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, NULL, ?)
        `,
        [
          code,
          client.id,
          user.id,
          redirectUri,
          scope,
          codeChallenge,
          codeChallengeMethod,
          services.nowMs() + config.codeTtlSeconds * 1000,
          services.nowMs(),
        ]
      );

      const target = new URL(redirectUri);
      target.searchParams.set('code', code);
      if (state) {
        target.searchParams.set('state', state);
      }
      res.redirect(target.toString());
    })
  );

  router.post(
    '/oauth/token',
    services.tokenRateLimiter,
    asyncHandler(async (req, res) => {
      const grantType = String(req.body.grant_type || '');
      const { clientId, clientSecret } = services.extractClientCredentials(req);
      const client = await services.getClientById(clientId);

      if (!client) {
        res.status(401).json({ error: 'invalid_client' });
        return;
      }
      if (!client.isPublicClient && client.client_secret !== clientSecret) {
        res.status(401).json({ error: 'invalid_client' });
        return;
      }
      if (client.isPublicClient && clientSecret) {
        res.status(400).json({ error: 'invalid_request', message: 'Public PKCE clients must not send client_secret' });
        return;
      }

      if (grantType === 'authorization_code') {
        const code = String(req.body.code || '');
        const redirectUri = String(req.body.redirect_uri || '');
        const codeVerifier = String(req.body.code_verifier || '');

        const codeRow = await services.queryOne('SELECT * FROM authorization_codes WHERE code = ? LIMIT 1', [code]);
        if (!codeRow || codeRow.consumed_at || codeRow.expires_at <= services.nowMs()) {
          res.status(400).json({ error: 'invalid_grant' });
          return;
        }
        if (codeRow.client_id !== client.id || codeRow.redirect_uri !== redirectUri) {
          res.status(400).json({ error: 'invalid_grant' });
          return;
        }

        const expectedHashHex = services.hashToken(codeVerifier);
        const codeChallengeFromVerifier = Buffer.from(expectedHashHex, 'hex').toString('base64url');
        if (codeChallengeFromVerifier !== codeRow.code_challenge) {
          res.status(400).json({ error: 'invalid_grant', message: 'PKCE verification failed' });
          return;
        }

        await services.execQuery('UPDATE authorization_codes SET consumed_at = ? WHERE code = ?', [
          services.nowMs(),
          codeRow.code,
        ]);

        const userRow = await services.queryOne('SELECT * FROM users WHERE id = ? LIMIT 1', [codeRow.user_id]);
        if (!userRow) {
          res.status(400).json({ error: 'invalid_grant' });
          return;
        }

        const permissions = services.getUserPermissions(userRow);
        const externalDnpInstansiAccess = services.getUserExternalDnpInstansiAccess(userRow);
        const certificationNoteLocationAccess = getCertificationNoteLocationAccess(userRow);
        const accessToken = await services.signAccessToken(
          {
            sub: userRow.id,
            email: userRow.email,
            phone: userRow.phone,
            preferred_username: userRow.username,
            name: userRow.username,
            role: userRow.role,
            permissions,
            certification_note_location_access: certificationNoteLocationAccess,
            external_dnp_instansi_access: externalDnpInstansiAccess,
            scope: codeRow.scope,
          },
          config.accessTokenTtlSeconds
        );
        const idToken = await services.signIdToken(
          {
            sub: userRow.id,
            email: userRow.email,
            phone: userRow.phone,
            preferred_username: userRow.username,
            name: userRow.username,
            role: userRow.role,
            certification_note_location_access: certificationNoteLocationAccess,
            external_dnp_instansi_access: externalDnpInstansiAccess,
          },
          config.accessTokenTtlSeconds
        );

        const refreshTokenRaw = services.randomToken(48);
        await services.execQuery(
          `
            INSERT INTO refresh_tokens (
              id, token_hash, user_id, client_id, scope, expires_at, revoked_at, created_at
            ) VALUES (?, ?, ?, ?, ?, ?, NULL, ?)
          `,
          [
            nanoid(),
            services.hashToken(refreshTokenRaw),
            userRow.id,
            client.id,
            codeRow.scope,
            services.nowMs() + config.refreshTokenTtlSeconds * 1000,
            services.nowMs(),
          ]
        );

        res.json(
          services.tokenResponse({
            accessToken,
            idToken,
            refreshToken: refreshTokenRaw,
            scope: codeRow.scope,
            user: {
              ...userRow,
              permissions,
              certification_note_location_access: certificationNoteLocationAccess,
              external_dnp_instansi_access: externalDnpInstansiAccess,
            },
          })
        );
        return;
      }

      if (grantType === 'refresh_token') {
        const refreshToken = String(req.body.refresh_token || '');
        const tokenHash = services.hashToken(refreshToken);
        const tokenRow = await services.queryOne('SELECT * FROM refresh_tokens WHERE token_hash = ? LIMIT 1', [tokenHash]);

        if (!tokenRow || tokenRow.revoked_at || tokenRow.expires_at <= services.nowMs()) {
          res.status(400).json({ error: 'invalid_grant' });
          return;
        }
        if (tokenRow.client_id !== client.id) {
          res.status(400).json({ error: 'invalid_grant' });
          return;
        }

        await services.execQuery('UPDATE refresh_tokens SET revoked_at = ? WHERE id = ?', [services.nowMs(), tokenRow.id]);

        const userRow = await services.queryOne('SELECT * FROM users WHERE id = ? LIMIT 1', [tokenRow.user_id]);
        if (!userRow) {
          res.status(400).json({ error: 'invalid_grant' });
          return;
        }

        const permissions = services.getUserPermissions(userRow);
        const externalDnpInstansiAccess = services.getUserExternalDnpInstansiAccess(userRow);
        const certificationNoteLocationAccess = getCertificationNoteLocationAccess(userRow);
        const accessToken = await services.signAccessToken(
          {
            sub: userRow.id,
            email: userRow.email,
            phone: userRow.phone,
            preferred_username: userRow.username,
            name: userRow.username,
            role: userRow.role,
            permissions,
            certification_note_location_access: certificationNoteLocationAccess,
            external_dnp_instansi_access: externalDnpInstansiAccess,
            scope: tokenRow.scope,
          },
          config.accessTokenTtlSeconds
        );
        const idToken = await services.signIdToken(
          {
            sub: userRow.id,
            email: userRow.email,
            phone: userRow.phone,
            preferred_username: userRow.username,
            name: userRow.username,
            role: userRow.role,
            certification_note_location_access: certificationNoteLocationAccess,
            external_dnp_instansi_access: externalDnpInstansiAccess,
          },
          config.accessTokenTtlSeconds
        );

        const nextRefreshToken = services.randomToken(48);
        await services.execQuery(
          `
            INSERT INTO refresh_tokens (
              id, token_hash, user_id, client_id, scope, expires_at, revoked_at, created_at
            ) VALUES (?, ?, ?, ?, ?, ?, NULL, ?)
          `,
          [
            nanoid(),
            services.hashToken(nextRefreshToken),
            userRow.id,
            client.id,
            tokenRow.scope,
            services.nowMs() + config.refreshTokenTtlSeconds * 1000,
            services.nowMs(),
          ]
        );

        res.json(
          services.tokenResponse({
            accessToken,
            idToken,
            refreshToken: nextRefreshToken,
            scope: tokenRow.scope,
            user: {
              ...userRow,
              permissions,
              certification_note_location_access: certificationNoteLocationAccess,
              external_dnp_instansi_access: externalDnpInstansiAccess,
            },
          })
        );
        return;
      }

      res.status(400).json({ error: 'unsupported_grant_type' });
    })
  );

  router.post(
    '/oauth/revoke',
    asyncHandler(async (req, res) => {
      const token = String(req.body.token || '');
      if (token) {
        await services.execQuery('UPDATE refresh_tokens SET revoked_at = ? WHERE token_hash = ?', [
          services.nowMs(),
          services.hashToken(token),
        ]);
      }
      res.status(200).json({ success: true });
    })
  );

  router.get(
    '/oauth/userinfo',
    asyncHandler(async (req, res) => {
      const authHeader = String(req.headers.authorization || '');
      const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';
      if (!token) {
        res.status(401).json({ error: 'invalid_token' });
        return;
      }
      try {
        const payload = await services.verifyAccessToken(token);
        res.json({
          sub: payload.sub,
          email: payload.email,
          phone: payload.phone,
          preferred_username: payload.preferred_username,
          name: payload.name,
          role: payload.role,
          permissions: payload.permissions,
          certification_note_location_access: payload.certification_note_location_access ?? [],
          external_dnp_instansi_access: payload.external_dnp_instansi_access ?? [],
        });
      } catch {
        res.status(401).json({ error: 'invalid_token' });
      }
    })
  );

  return router;
}
