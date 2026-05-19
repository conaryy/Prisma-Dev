export const DEFAULT_ADMIN_PERMISSIONS = {
  can_access_admin_portal: true,
  can_manage_users: true,
  can_manage_admin_module: true,
  can_access_k2s_dashboard: true,
  can_access_logbook: true,
  can_access_k3: true,
  can_access_keamanan: true,
  can_access_external_dnp: true,
};

export const DEFAULT_VIEWER_PERMISSIONS = {
  can_access_admin_portal: false,
  can_manage_users: false,
  can_manage_admin_module: false,
  can_access_k2s_dashboard: true,
  can_access_logbook: false,
  can_access_k3: false,
  can_access_keamanan: false,
  can_access_external_dnp: false,
};

export function buildEffectivePermissions(role, inputPermissions) {
  const isAdmin = String(role || '').toLowerCase() === 'admin';
  const base = isAdmin ? DEFAULT_ADMIN_PERMISSIONS : DEFAULT_VIEWER_PERMISSIONS;
  const merged = {
    ...base,
    ...(inputPermissions && typeof inputPermissions === 'object' ? inputPermissions : {}),
  };

  if (!isAdmin) {
    merged.can_access_admin_portal = false;
    merged.can_manage_users = false;
    merged.can_manage_admin_module = false;
  }

  return merged;
}
