import { safePermissionsInput } from './auth-utils.js';
import { safeExternalDnpInstansiInput } from './external-dnp-instansi.js';

function normalizeObject(input) {
  return input && typeof input === 'object' ? input : {};
}

function normalizeString(value) {
  return String(value ?? '').trim();
}

function normalizePhoneInput(value) {
  const cleaned = normalizeString(value).replace(/[\s().-]/g, '').replace(/^\+/, '');
  if (!cleaned) {
    return '';
  }
  if (cleaned.startsWith('08')) {
    return `62${cleaned.slice(1)}`;
  }
  return cleaned;
}

function isValidInternationalPhone(value) {
  return /^[1-9]\d{7,14}$/.test(value);
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
  const email = normalizeString(payload.email).toLowerCase();
  const phone = normalizePhoneInput(payload.phone);

  if (!email) {
    return { ok: false, status: 422, error: 'Email wajib diisi.' };
  }
  if (phone && !isValidInternationalPhone(phone)) {
    return { ok: false, status: 422, error: 'Nomor WhatsApp harus memakai format internasional.' };
  }

  return {
    ok: true,
    data: {
      name: normalizeString(payload.name),
      username: normalizeString(payload.username),
      email,
      phone,
      password: String(payload.password ?? ''),
      role: payload.role,
      status: payload.status,
      permissions: safePermissionsInput(payload.permissions),
      external_dnp_instansi_access: safeExternalDnpInstansiInput(payload.external_dnp_instansi_access),
    },
  };
}

export function validateUpdateUserPayload(input) {
  const payload = normalizeObject(input);
  const phone = payload.phone === undefined
    ? undefined
    : normalizePhoneInput(payload.phone);

  if (phone && !isValidInternationalPhone(phone)) {
    return { ok: false, status: 422, error: 'Nomor WhatsApp harus memakai format internasional.' };
  }

  return {
    ok: true,
    data: {
      name: payload.name,
      username: payload.username,
      email: payload.email,
      phone,
      password: payload.password,
      role: payload.role,
      status: payload.status,
      permissions: payload.permissions === undefined ? undefined : safePermissionsInput(payload.permissions),
      external_dnp_instansi_access: payload.external_dnp_instansi_access === undefined
        ? undefined
        : safeExternalDnpInstansiInput(payload.external_dnp_instansi_access),
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

export function validateSelfProfilePayload(input) {
  const payload = normalizeObject(input);
  const phone = payload.phone === undefined
    ? undefined
    : normalizePhoneInput(payload.phone);

  if (phone && !isValidInternationalPhone(phone)) {
    return { ok: false, status: 422, error: 'Nomor WhatsApp harus memakai format internasional.' };
  }

  return {
    ok: true,
    data: {
      name: normalizeString(payload.name),
      username: normalizeString(payload.username),
      email: payload.email,
      phone,
    },
  };
}

export function validateSelfPasswordPayload(input) {
  const payload = normalizeObject(input);
  const currentPassword = String(payload.current_password ?? '');
  const nextPassword = String(payload.password ?? '');
  const confirmPassword = String(payload.password_confirmation ?? '');

  if (!currentPassword) {
    return { ok: false, status: 422, error: 'Password lama wajib diisi.' };
  }

  if (!nextPassword) {
    return { ok: false, status: 422, error: 'Password baru wajib diisi.' };
  }

  if (nextPassword !== confirmPassword) {
    return { ok: false, status: 422, error: 'Konfirmasi password tidak cocok.' };
  }

  return {
    ok: true,
    data: {
      current_password: currentPassword,
      password: nextPassword,
      password_confirmation: confirmPassword,
    },
  };
}
