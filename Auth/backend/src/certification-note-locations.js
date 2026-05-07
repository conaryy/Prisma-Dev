export const CERTIFICATION_NOTE_LOCATION_OPTIONS = [
  { key: 'surabaya', label: 'Surabaya' },
  { key: 'sumenep', label: 'Sumenep' },
  { key: 'banyuwangi', label: 'Banyuwangi' },
  { key: 'malang', label: 'Malang' },
  { key: 'kediri', label: 'Kediri' },
  { key: 'blora', label: 'Blora' },
  { key: 'jember', label: 'Jember' },
  { key: 'bawean', label: 'Bawean' },
] ;

const CERTIFICATION_NOTE_LOCATION_LOOKUP = new Set(
  CERTIFICATION_NOTE_LOCATION_OPTIONS.map((item) => item.key)
);

export function safeCertificationNoteLocationInput(input) {
  const source = Array.isArray(input) ? input : [];

  return [
    ...new Set(
      source
        .map((value) => String(value ?? '').trim().toLowerCase())
        .filter((value) => CERTIFICATION_NOTE_LOCATION_LOOKUP.has(value))
    ),
  ];
}
