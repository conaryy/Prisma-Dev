export const STORAGE_KEYS = {
  instansi: 'kks.instansi',
  facilities: 'kks.facilities',
  organizations: 'kks.organizations',
  personil: 'kks.personil',
  certificates: 'kks.certificates',
  agenda: 'kks.agenda',
  audits: 'kks.audits',
  inspections: 'kks.inspections',
  monitoring: 'kks.monitoring',
  findings: 'kks.findings',
  followUps: 'kks.followUps',
} as const;

export function scopedStorageKey(baseKey: string, scope?: string | null) {
  if (!scope) {
    return baseKey;
  }
  return `${baseKey}.${scope}`;
}

export function loadStorage<T>(key: string, fallback: T): T {
  if (typeof window === 'undefined') {
    return fallback;
  }

  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) {
      return fallback;
    }
    return JSON.parse(raw) as T;
  } catch (error) {
    console.warn(`Failed to load storage for ${key}`, error);
    return fallback;
  }
}

export function saveStorage<T>(key: string, value: T) {
  if (typeof window === 'undefined') {
    return;
  }

  window.localStorage.setItem(key, JSON.stringify(value));
}
