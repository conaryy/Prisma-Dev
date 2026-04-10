export const EXTERNAL_DNP_INSTANSI_OPTIONS = [
  { key: 'surabaya', label: 'Cabang Surabaya' },
  { key: 'malang', label: 'KCP Malang' },
  { key: 'banyuwangi', label: 'KCP Banyuwangi' },
  { key: 'sumenep', label: 'KCP Sumenep' },
  { key: 'kediri', label: 'Unit Kediri' },
  { key: 'ngloram', label: 'Unit Ngloram (Blora)' },
  { key: 'bawean', label: 'Unit Bawean' },
  { key: 'jember', label: 'Unit Jember' },
] as const;

const EXTERNAL_DNP_INSTANSI_LABEL_MAP: ReadonlyMap<string, string> = new Map(
  EXTERNAL_DNP_INSTANSI_OPTIONS.map((item) => [item.key, item.label])
);

export function formatExternalDnpInstansiAccess(values: string[] | null | undefined) {
  const labels = (values ?? [])
    .map((value) => EXTERNAL_DNP_INSTANSI_LABEL_MAP.get(value) ?? value)
    .filter((value) => value.trim() !== '');

  return labels.join(', ');
}
