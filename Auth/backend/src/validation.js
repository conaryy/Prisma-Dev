import { safePermissionsInput } from './auth-utils.js';

function normalizeObject(input) {
  return input && typeof input === 'object' ? input : {};
}

function normalizeString(value) {
  return String(value ?? '').trim();
}

export function validateLoginPayload(input) {
  const payload = normalizeObject(input);
  const email = normalizeString(payload.email);
  const password = String(payload.password ?? '');

  if (!email) {
    return { ok: false, status: 422, error: 'Email / Username wajib diisi.' };
  }
  if (!password) {
    return { ok: false, status: 422, error: 'Password wajib diisi.' };
  }

  return {
    ok: true,
    data: {
      email,
      password,
      return_to: payload.return_to,
    },
  };
}

export function validateCreateUserPayload(input) {
  const payload = normalizeObject(input);

  return {
    ok: true,
    data: {
      name: normalizeString(payload.name),
      username: normalizeString(payload.username),
      email: payload.email,
      password: String(payload.password ?? ''),
      role: payload.role,
      status: payload.status,
      permissions: safePermissionsInput(payload.permissions),
    },
  };
}

export function validateUpdateUserPayload(input) {
  const payload = normalizeObject(input);

  return {
    ok: true,
    data: {
      name: payload.name,
      username: payload.username,
      email: payload.email,
      password: payload.password,
      role: payload.role,
      status: payload.status,
      permissions: payload.permissions === undefined ? undefined : safePermissionsInput(payload.permissions),
    },
  };
}

export function validateResetPasswordPayload(input) {
  const payload = normalizeObject(input);
  const password = String(payload.password ?? '');

  if (!password) {
    return { ok: false, status: 422, error: 'Password wajib diisi.' };
  }

  return {
    ok: true,
    data: {
      password,
      logout_sessions: payload.logout_sessions,
    },
  };
}
