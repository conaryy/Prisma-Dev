export type PermissionMap = {
  can_access_admin_portal: boolean;
  can_manage_users: boolean;
  can_manage_admin_module: boolean;
  can_access_k2s_dashboard: boolean;
  can_access_logbook: boolean;
  can_access_k3: boolean;
  can_access_keamanan: boolean;
  can_access_external_dnp: boolean;
};

type AuthUserLike = {
  role?: string;
  can_access_external_dnp?: boolean;
  external_dnp_instansi_access?: string[] | null;
  permissions?: Partial<PermissionMap> | Record<string, unknown> | null;
};

function isBoolean(value: unknown): value is boolean {
  return typeof value === 'boolean';
}

function getRole(user: AuthUserLike | null | undefined) {
  return String(user?.role ?? '').toLowerCase();
}

function getPermissions(user: AuthUserLike | null | undefined) {
  if (!user?.permissions || typeof user.permissions !== 'object') {
    return {};
  }
  return user.permissions as Record<string, unknown>;
}

function getPermissionFlag(
  user: AuthUserLike | null | undefined,
  key: keyof PermissionMap,
  fallback: boolean
) {
  const permissions = getPermissions(user);
  if (isBoolean(permissions[key])) {
    return permissions[key];
  }
  return fallback;
}

export function isAdminRole(user: AuthUserLike | null | undefined) {
  return getRole(user) === 'admin';
}

export function canAccessAdminPortal(user: AuthUserLike | null | undefined) {
  const permissions = getPermissions(user);
  if (isBoolean(permissions.can_access_admin_portal)) {
    return permissions.can_access_admin_portal;
  }
  return isAdminRole(user);
}

export function canManageAdminModule(user: AuthUserLike | null | undefined) {
  const permissions = getPermissions(user);
  if (isBoolean(permissions.can_manage_admin_module)) {
    return permissions.can_manage_admin_module;
  }
  return isAdminRole(user);
}

export function canAccessK2sDashboard(user: AuthUserLike | null | undefined) {
  return getPermissionFlag(user, 'can_access_k2s_dashboard', true);
}

export function canAccessLogbook(user: AuthUserLike | null | undefined) {
  return getPermissionFlag(user, 'can_access_logbook', true);
}

export function canAccessK3(user: AuthUserLike | null | undefined) {
  return getPermissionFlag(user, 'can_access_k3', isAdminRole(user));
}

export function canAccessKeamanan(user: AuthUserLike | null | undefined) {
  return getPermissionFlag(user, 'can_access_keamanan', isAdminRole(user));
}

export function canAccessExternalDnp(user: AuthUserLike | null | undefined) {
  const permissions = getPermissions(user);
  if (isBoolean(permissions.can_access_external_dnp)) {
    return permissions.can_access_external_dnp;
  }
  if (isBoolean(user?.can_access_external_dnp)) {
    return user.can_access_external_dnp;
  }
  return true;
}

export function canManageExternalDnp(user: AuthUserLike | null | undefined) {
  return isAdminRole(user);
}
