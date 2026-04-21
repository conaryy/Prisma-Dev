import { Router } from 'express';
import { queryAll } from '../db.js';
import {
  changeOwnPassword,
  createManagedUser,
  deleteManagedUser,
  resetManagedUserPassword,
  toUserResponse,
  updateOwnProfile,
  updateManagedUser,
} from '../auth-service.js';
import { asyncHandler, requireManageUsers, requireSessionUser } from '../middleware.js';
import { disableK2sUserBestEffort, syncK2sUserBestEffort } from '../k2s-user-sync.js';
import { createResetPasswordRateLimiter } from '../rate-limit.js';
import {
  validateCreateUserPayload,
  validateResetPasswordPayload,
  validateSelfPasswordPayload,
  validateSelfProfilePayload,
  validateUpdateUserPayload,
} from '../validation.js';

export function createAdminRouter() {
  const router = Router();
  const resetPasswordRateLimiter = createResetPasswordRateLimiter();

  router.get('/api/auth/me', requireSessionUser, (req, res) => {
    res.json({ data: toUserResponse(req.authUser) });
  });

  router.patch(
    '/api/profile',
    requireSessionUser,
    asyncHandler(async (req, res) => {
      const validation = validateSelfProfilePayload(req.body);
      if (!validation.ok) {
        res.status(validation.status).json({ error: validation.error });
        return;
      }

      const result = await updateOwnProfile(req.authUser.id, validation.data);
      if (!result.ok) {
        res.status(result.status).json({ error: result.error });
        return;
      }

      res.json({ data: toUserResponse(result.user) });
    })
  );

  router.post(
    '/api/profile/password',
    requireSessionUser,
    asyncHandler(async (req, res) => {
      const validation = validateSelfPasswordPayload(req.body);
      if (!validation.ok) {
        res.status(validation.status).json({ error: validation.error });
        return;
      }

      const result = await changeOwnPassword(
        req.authUser.id,
        validation.data.current_password,
        validation.data.password
      );
      if (!result.ok) {
        res.status(result.status).json({ error: result.error });
        return;
      }

      res.json({
        data: {
          success: true,
          user: toUserResponse(result.user),
        },
      });
    })
  );

  router.get(
    '/api/admin/users',
    requireSessionUser,
    requireManageUsers,
    asyncHandler(async (_req, res) => {
      const rows = await queryAll(
        'SELECT * FROM users ORDER BY CASE WHEN role = ? THEN 0 ELSE 1 END, username ASC',
        ['Admin']
      );
      res.json({
        data: rows.map((row) => toUserResponse(row)),
      });
    })
  );

  router.post(
    '/api/admin/users',
    requireSessionUser,
    requireManageUsers,
    asyncHandler(async (req, res) => {
      const validation = validateCreateUserPayload(req.body);
      if (!validation.ok) {
        res.status(validation.status).json({ error: validation.error });
        return;
      }

      const result = await createManagedUser(validation.data);
      if (!result.ok) {
        res.status(result.status).json({ error: result.error });
        return;
      }
      const user = toUserResponse(result.user);
      await syncK2sUserBestEffort(user);
      res.status(201).json({ data: user });
    })
  );

  router.patch(
    '/api/admin/users/:id',
    requireSessionUser,
    requireManageUsers,
    asyncHandler(async (req, res) => {
      const validation = validateUpdateUserPayload(req.body);
      if (!validation.ok) {
        res.status(validation.status).json({ error: validation.error });
        return;
      }

      const result = await updateManagedUser(
        String(req.params?.id || '').trim(),
        validation.data
      );
      if (!result.ok) {
        res.status(result.status).json({ error: result.error });
        return;
      }
      const user = toUserResponse(result.user);
      await syncK2sUserBestEffort(user);
      res.json({ data: user });
    })
  );

  router.delete(
    '/api/admin/users/:id',
    requireSessionUser,
    requireManageUsers,
    asyncHandler(async (req, res) => {
      const result = await deleteManagedUser(
        String(req.params?.id || '').trim(),
        req.authUser?.id
      );
      if (!result.ok) {
        res.status(result.status).json({ error: result.error });
        return;
      }
      if (result.user) {
        await disableK2sUserBestEffort(toUserResponse(result.user));
      }
      res.json({ data: { success: true } });
    })
  );

  router.post(
    '/api/admin/users/:id/reset-password',
    requireSessionUser,
    requireManageUsers,
    resetPasswordRateLimiter,
    asyncHandler(async (req, res) => {
      const validation = validateResetPasswordPayload(req.body);
      if (!validation.ok) {
        res.status(validation.status).json({ error: validation.error });
        return;
      }

      const result = await resetManagedUserPassword(
        String(req.params?.id || '').trim(),
        validation.data.password,
        Boolean(validation.data.logout_sessions ?? true)
      );
      if (!result.ok) {
        res.status(result.status).json({ error: result.error });
        return;
      }
      res.json({
        data: {
          user: toUserResponse(result.user),
          password_reset: true,
          logged_out_sessions: result.loggedOutSessions,
        },
      });
    })
  );

  return router;
}
