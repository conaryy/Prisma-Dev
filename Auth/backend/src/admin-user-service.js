import bcrypt from 'bcryptjs';
import { nanoid } from 'nanoid';
import { execQuery, parseJson, queryOne } from './db.js';
import { buildEffectivePermissions } from './permissions.js';
import {
  ensureRole,
  ensureStatus,
  nowMs,
  safePermissionsInput,
  sanitizeEmail,
  sanitizePhone,
  sanitizeText,
} from './auth-utils.js';

export async function createManagedUser(payload) {
  const username = sanitizeText(payload.username);
  const email = sanitizeEmail(payload.email);
  const phone = sanitizePhone(payload.phone);
  const password = String(payload.password || '');
  const role = ensureRole(sanitizeText(payload.role || 'Viewer') || 'Viewer');
  const status = ensureStatus(sanitizeText(payload.status || 'Active') || 'Active');
  const displayName = sanitizeText(payload.name);

  if (!displayName || displayName.length < 2) {
    return { ok: false, status: 422, error: 'Nama minimal 2 karakter.' };
  }
  if (!username || username.length < 3) {
    return { ok: false, status: 422, error: 'Username minimal 3 karakter.' };
  }
  if (!password || password.length < 8) {
    return { ok: false, status: 422, error: 'Password minimal 8 karakter.' };
  }

  const existingByUsername = await queryOne(
    'SELECT id FROM users WHERE lower(username) = lower(?) LIMIT 1',
    [username]
  );
  if (existingByUsername) {
    return { ok: false, status: 409, error: 'Username sudah digunakan.' };
  }

  if (email) {
    const existingByEmail = await queryOne(
      'SELECT id FROM users WHERE lower(email) = lower(?) LIMIT 1',
      [email]
    );
    if (existingByEmail) {
      return { ok: false, status: 409, error: 'Email sudah digunakan.' };
    }
  }

  const userId = nanoid();
  const now = nowMs();
  const permissions = buildEffectivePermissions(role, safePermissionsInput(payload.permissions));
  await execQuery(
    `
      INSERT INTO users (id, username, email, phone, password_hash, role, permissions_json, status, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `,
    [userId, username, email, phone, bcrypt.hashSync(password, 10), role, JSON.stringify(permissions), status, now, now]
  );

  const created = await queryOne('SELECT * FROM users WHERE id = ? LIMIT 1', [userId]);
  return { ok: true, user: created };
}

export async function updateManagedUser(userId, payload) {
  const current = await queryOne('SELECT * FROM users WHERE id = ? LIMIT 1', [userId]);
  if (!current) {
    return { ok: false, status: 404, error: 'User tidak ditemukan.' };
  }

  const nextName = sanitizeText(payload.name || current.username);
  const nextUsername = sanitizeText(payload.username || current.username);
  const nextEmail = payload.email === undefined ? current.email : sanitizeEmail(payload.email);
  const nextPhone = payload.phone === undefined ? current.phone : sanitizePhone(payload.phone);
  const nextRole = payload.role ? ensureRole(sanitizeText(payload.role)) : current.role;
  const nextStatus = payload.status ? ensureStatus(sanitizeText(payload.status)) : current.status;
  const rawPermissions =
    payload.permissions !== undefined
      ? safePermissionsInput(payload.permissions)
      : parseJson(current.permissions_json || '{}', {});
  const nextPermissions = buildEffectivePermissions(nextRole, rawPermissions);

  if (!nextName || nextName.length < 2) {
    return { ok: false, status: 422, error: 'Nama minimal 2 karakter.' };
  }
  if (!nextUsername || nextUsername.length < 3) {
    return { ok: false, status: 422, error: 'Username minimal 3 karakter.' };
  }

  const conflictUsername = await queryOne(
    'SELECT id FROM users WHERE lower(username) = lower(?) AND id <> ? LIMIT 1',
    [nextUsername, userId]
  );
  if (conflictUsername) {
    return { ok: false, status: 409, error: 'Username sudah digunakan.' };
  }

  if (nextEmail) {
    const conflictEmail = await queryOne(
      'SELECT id FROM users WHERE lower(email) = lower(?) AND id <> ? LIMIT 1',
      [nextEmail, userId]
    );
    if (conflictEmail) {
      return { ok: false, status: 409, error: 'Email sudah digunakan.' };
    }
  }

  const password = sanitizeText(payload.password);
  const shouldUpdatePassword = Boolean(password);
  const params = shouldUpdatePassword
    ? [
        nextUsername,
        nextEmail,
        nextPhone,
        nextRole,
        JSON.stringify(nextPermissions),
        nextStatus,
        nowMs(),
        bcrypt.hashSync(password, 10),
        userId,
      ]
    : [
        nextUsername,
        nextEmail,
        nextPhone,
        nextRole,
        JSON.stringify(nextPermissions),
        nextStatus,
        nowMs(),
        userId,
      ];

  await execQuery(
    shouldUpdatePassword
      ? `
          UPDATE users
          SET username = ?, email = ?, phone = ?, role = ?, permissions_json = ?, status = ?, updated_at = ?, password_hash = ?
          WHERE id = ?
        `
      : `
          UPDATE users
          SET username = ?, email = ?, phone = ?, role = ?, permissions_json = ?, status = ?, updated_at = ?
          WHERE id = ?
        `,
    params
  );

  const updated = await queryOne('SELECT * FROM users WHERE id = ? LIMIT 1', [userId]);
  return { ok: true, user: updated };
}

export async function deleteManagedUser(userId, actorUserId) {
  if (!userId) {
    return { ok: false, status: 422, error: 'User id tidak valid.' };
  }
  if (userId === actorUserId) {
    return { ok: false, status: 400, error: 'Tidak bisa menghapus akun sendiri.' };
  }

  const exists = await queryOne('SELECT id FROM users WHERE id = ? LIMIT 1', [userId]);
  if (!exists) {
    return { ok: false, status: 404, error: 'User tidak ditemukan.' };
  }

  await execQuery('DELETE FROM auth_sessions WHERE user_id = ?', [userId]);
  await execQuery('DELETE FROM authorization_codes WHERE user_id = ?', [userId]);
  await execQuery('DELETE FROM refresh_tokens WHERE user_id = ?', [userId]);
  await execQuery('DELETE FROM users WHERE id = ?', [userId]);
  return { ok: true };
}

export async function resetManagedUserPassword(userId, password, logoutSessions = true) {
  if (!password || password.length < 8) {
    return { ok: false, status: 422, error: 'Password minimal 8 karakter.' };
  }

  const exists = await queryOne('SELECT id FROM users WHERE id = ? LIMIT 1', [userId]);
  if (!exists) {
    return { ok: false, status: 404, error: 'User tidak ditemukan.' };
  }

  await execQuery('UPDATE users SET password_hash = ?, updated_at = ? WHERE id = ?', [
    bcrypt.hashSync(password, 10),
    nowMs(),
    userId,
  ]);

  if (logoutSessions) {
    await execQuery('DELETE FROM auth_sessions WHERE user_id = ?', [userId]);
    await execQuery('DELETE FROM authorization_codes WHERE user_id = ?', [userId]);
    await execQuery('DELETE FROM refresh_tokens WHERE user_id = ?', [userId]);
  }

  const updated = await queryOne('SELECT * FROM users WHERE id = ? LIMIT 1', [userId]);
  return {
    ok: true,
    user: updated,
    loggedOutSessions: logoutSessions,
  };
}

export async function updateOwnProfile(userId, payload) {
  const current = await queryOne('SELECT * FROM users WHERE id = ? LIMIT 1', [userId]);
  if (!current) {
    return { ok: false, status: 404, error: 'User tidak ditemukan.' };
  }

  const nextUsername = sanitizeText(payload.username || payload.name || current.username);
  const nextEmail = payload.email === undefined ? current.email : sanitizeEmail(payload.email);
  const nextPhone = payload.phone === undefined ? current.phone : sanitizePhone(payload.phone);

  if (!nextUsername || nextUsername.length < 3) {
    return { ok: false, status: 422, error: 'Nama / username minimal 3 karakter.' };
  }

  const conflictUsername = await queryOne(
    'SELECT id FROM users WHERE lower(username) = lower(?) AND id <> ? LIMIT 1',
    [nextUsername, userId]
  );
  if (conflictUsername) {
    return { ok: false, status: 409, error: 'Username sudah digunakan.' };
  }

  if (nextEmail) {
    const conflictEmail = await queryOne(
      'SELECT id FROM users WHERE lower(email) = lower(?) AND id <> ? LIMIT 1',
      [nextEmail, userId]
    );
    if (conflictEmail) {
      return { ok: false, status: 409, error: 'Email sudah digunakan.' };
    }
  }

  await execQuery(
    `
      UPDATE users
      SET username = ?, email = ?, phone = ?, updated_at = ?
      WHERE id = ?
    `,
    [nextUsername, nextEmail, nextPhone, nowMs(), userId]
  );

  const updated = await queryOne('SELECT * FROM users WHERE id = ? LIMIT 1', [userId]);
  return { ok: true, user: updated };
}

export async function changeOwnPassword(userId, currentPassword, nextPassword) {
  if (!nextPassword || nextPassword.length < 8) {
    return { ok: false, status: 422, error: 'Password minimal 8 karakter.' };
  }

  const current = await queryOne('SELECT * FROM users WHERE id = ? LIMIT 1', [userId]);
  if (!current) {
    return { ok: false, status: 404, error: 'User tidak ditemukan.' };
  }

  const matches = bcrypt.compareSync(String(currentPassword || ''), current.password_hash || '');
  if (!matches) {
    return { ok: false, status: 422, error: 'Password lama tidak cocok.' };
  }

  await execQuery('UPDATE users SET password_hash = ?, updated_at = ? WHERE id = ?', [
    bcrypt.hashSync(nextPassword, 10),
    nowMs(),
    userId,
  ]);

  const updated = await queryOne('SELECT * FROM users WHERE id = ? LIMIT 1', [userId]);
  return { ok: true, user: updated };
}
