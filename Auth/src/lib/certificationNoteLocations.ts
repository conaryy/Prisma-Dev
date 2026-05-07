export const CERTIFICATION_NOTE_LOCATION_OPTIONS = [
  { key: 'surabaya', label: 'Surabaya' },
  { key: 'sumenep', label: 'Sumenep' },
  { key: 'banyuwangi', label: 'Banyuwangi' },
  { key: 'malang', label: 'Malang' },
  { key: 'kediri', label: 'Kediri' },
  { key: 'blora', label: 'Blora' },
  { key: 'jember', label: 'Jember' },
  { key: 'bawean', label: 'Bawean' },
] as const;

const CERTIFICATION_NOTE_LOCATION_LABEL_MAP: ReadonlyMap<string, string> = new Map(
  CERTIFICATION_NOTE_LOCATION_OPTIONS.map((item) => [item.key, item.label])
);

export function formatCertificationNoteLocationAccess(values: string[] | null | undefined) {
  const labels = (values ?? [])
    .map((value) => CERTIFICATION_NOTE_LOCATION_LABEL_MAP.get(value) ?? value)
    .filter((value) => value.trim() !== '');

  return labels.join(', ');
}
