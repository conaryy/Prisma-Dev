import { getUserBySession } from './auth-service.js';

export async function requireSessionUser(req, res, next) {
  try {
    const user = await getUserBySession(req);
    if (!user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    req.authUser = user;
    next();
  } catch (error) {
    next(error);
  }
}

export function requireManageUsers(req, res, next) {
  const canManage = Boolean(
    req.authUser?.permissions?.can_manage_users ||
      String(req.authUser?.role || '').toLowerCase() === 'admin'
  );
  if (!canManage) {
    res.status(403).json({ error: 'Forbidden' });
    return;
  }
  next();
}

export function asyncHandler(fn) {
  return function wrappedHandler(req, res, next) {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}
