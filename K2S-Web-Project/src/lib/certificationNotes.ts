export const CERTIFICATION_NOTE_LOCATIONS = [
  {
    slug: 'surabaya',
    label: 'Surabaya',
    menuLabel: 'Surabaya',
    officeLabel: 'Perum LPPNPI Cabang Surabaya',
  },
  {
    slug: 'sumenep',
    label: 'Sumenep',
    menuLabel: 'Sumenep',
    officeLabel: 'Perum LPPNPI Cabang Pembantu Sumenep',
  },
  {
    slug: 'banyuwangi',
    label: 'Banyuwangi',
    menuLabel: 'Banyuwangi',
    officeLabel: 'Perum LPPNPI Cabang Pembantu Banyuwangi',
  },
  {
    slug: 'malang',
    label: 'Malang',
    menuLabel: 'Malang',
    officeLabel: 'Perum LPPNPI Cabang Pembantu Malang',
  },
  {
    slug: 'kediri',
    label: 'Kediri',
    menuLabel: 'Kediri',
    officeLabel: 'Perum LPPNPI Cabang Pembantu Kediri',
  },
  {
    slug: 'blora',
    label: 'Blora',
    menuLabel: 'Blora',
    officeLabel: 'Perum LPPNPI Cabang Pembantu Blora',
  },
  {
    slug: 'jember',
    label: 'Jember',
    menuLabel: 'Jember',
    officeLabel: 'Perum LPPNPI Cabang Pembantu Jember',
  },
  {
    slug: 'bawean',
    label: 'Bawean',
    menuLabel: 'Bawean',
    officeLabel: 'Perum LPPNPI Cabang Pembantu Bawean',
  },
] as const;

export const DEFAULT_CERTIFICATION_NOTE_LOCATION =
  CERTIFICATION_NOTE_LOCATIONS[0];

export const CERTIFICATION_NOTE_PROGRESS_OPTIONS = [0, 25, 50, 75, 100] as const;
export const CERTIFICATION_NOTE_MAX_FILE_SIZE_BYTES = 20 * 1024 * 1024;
export const CERTIFICATION_NOTE_MAX_FILE_SIZE_LABEL = '20 MB';

export function findCertificationNoteLocationBySlug(slug?: string | null) {
  return (
    CERTIFICATION_NOTE_LOCATIONS.find((item) => item.slug === slug) ??
    DEFAULT_CERTIFICATION_NOTE_LOCATION
  );
}
