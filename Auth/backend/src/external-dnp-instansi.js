export const EXTERNAL_DNP_INSTANSI_OPTIONS = [
  { key: 'surabaya', label: 'Cabang Surabaya' },
  { key: 'malang', label: 'KCP Malang' },
  { key: 'banyuwangi', label: 'KCP Banyuwangi' },
  { key: 'sumenep', label: 'KCP Sumenep' },
  { key: 'kediri', label: 'Unit Kediri' },
  { key: 'ngloram', label: 'Unit Ngloram (Blora)' },
  { key: 'bawean', label: 'Unit Bawean' },
  { key: 'jember', label: 'Unit Jember' },
];

const EXTERNAL_DNP_INSTANSI_LOOKUP = new Set(
  EXTERNAL_DNP_INSTANSI_OPTIONS.map((item) => item.key)
);

export function safeExternalDnpInstansiInput(input) {
  const source = Array.isArray(input) ? input : [];

  return [...new Set(
    source
      .map((value) => String(value ?? '').trim().toLowerCase())
      .filter((value) => EXTERNAL_DNP_INSTANSI_LOOKUP.has(value))
  )];
}

export function resolveExternalDnpInstansiAccess({
  role,
  permissions,
  externalDnpInstansiAccess,
}) {
  const isAdmin = String(role || '').toLowerCase() === 'admin';
  const hasExternalDnpAccess = Boolean(permissions?.can_access_external_dnp);

  if (isAdmin || !hasExternalDnpAccess) {
    return [];
  }

  return safeExternalDnpInstansiInput(externalDnpInstansiAccess);
}

export function requiresExternalDnpInstansiAccess({ role, permissions }) {
  const isAdmin = String(role || '').toLowerCase() === 'admin';
  return !isAdmin && Boolean(permissions?.can_access_external_dnp);
}
