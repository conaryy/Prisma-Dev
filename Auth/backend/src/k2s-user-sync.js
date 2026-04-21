import { config } from './config.js';

function isConfigured() {
  return Boolean(config.k2sUserSync.url && config.k2sUserSync.token);
}

function buildUrl(path) {
  return new URL(path, config.k2sUserSync.url).toString();
}

function buildPayload(user) {
  return {
    auth_id: user.id,
    name: user.name || user.username,
    username: user.username || user.name,
    email: user.email,
    phone: user.phone,
    role: user.role,
    status: user.status,
    can_access_external_dnp: Boolean(user.can_access_external_dnp),
    permissions: user.permissions || {},
    external_dnp_instansi_access: user.external_dnp_instansi_access || [],
  };
}

async function postK2s(path, payload) {
  if (!isConfigured()) {
    return { skipped: true };
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), config.k2sUserSync.timeoutMs);

  try {
    const response = await fetch(buildUrl(path), {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        'X-Internal-Token': config.k2sUserSync.token,
      },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });

    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      const message =
        typeof data?.error === 'string'
          ? data.error
          : typeof data?.message === 'string'
            ? data.message
            : `K2S user sync failed with HTTP ${response.status}`;
      throw new Error(message);
    }

    return { skipped: false, data };
  } finally {
    clearTimeout(timeout);
  }
}

export async function syncK2sUser(user) {
  if (!user?.id) {
    return { skipped: true };
  }

  return postK2s('', buildPayload(user));
}

export async function disableK2sUser(user) {
  if (!user?.id) {
    return { skipped: true };
  }

  return postK2s('disable', {
    auth_id: user.id,
    username: user.username || user.name || null,
    email: user.email || null,
  });
}

export async function syncK2sUserBestEffort(user) {
  try {
    return await syncK2sUser(user);
  } catch (error) {
    console.warn('[auth-backend] K2S user sync failed:', error?.message || error);
    return { skipped: false, error };
  }
}

export async function disableK2sUserBestEffort(user) {
  try {
    return await disableK2sUser(user);
  } catch (error) {
    console.warn('[auth-backend] K2S user disable failed:', error?.message || error);
    return { skipped: false, error };
  }
}
