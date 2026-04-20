import * as XLSX from 'xlsx';

const MONTH_MARKERS = new Set([
  'JANUARI',
  'FEBRUARI',
  'MARET',
  'APRIL',
  'MEI',
  'JUNI',
  'JULI',
  'AGUSTUS',
  'SEPTEMBER',
  'OKTOBER',
  'NOVEMBER',
  'DESEMBER',
]);

const MONTH_ALIASES: Record<string, number> = {
  JAN: 1,
  JANUARI: 1,
  FEB: 2,
  FEBRUARI: 2,
  MAR: 3,
  MARET: 3,
  APR: 4,
  APRIL: 4,
  MAY: 5,
  MEI: 5,
  JUN: 6,
  JUNI: 6,
  JUL: 7,
  JULI: 7,
  AUG: 8,
  AGU: 8,
  AGT: 8,
  AGUSTUS: 8,
  SEP: 9,
  SEPT: 9,
  SEPTEMBER: 9,
  OCT: 10,
  OKT: 10,
  OKTOBER: 10,
  NOV: 11,
  NOVEMBER: 11,
  DEC: 12,
  DES: 12,
  DESEMBER: 12,
};

export function normalizeString(value: unknown) {
  return String(value ?? '')
    .replace(/\r/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function normalizeTime(value: unknown) {
  const normalized = normalizeString(value);
  if (!normalized) {
    return '';
  }

  const compact = normalized.replace('.', ':');
  if (/^\d{1,2}:\d{2}$/.test(compact)) {
    const [hours, minutes] = compact.split(':');
    return `${hours.padStart(2, '0')}:${minutes}`;
  }

  return normalized;
}

function buildUtcDate(year: number, month: number, day: number) {
  if (year < 100) {
    year += year >= 70 ? 1900 : 2000;
  }

  const date = new Date(Date.UTC(year, month - 1, day));
  if (
    Number.isNaN(date.getTime()) ||
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    return null;
  }

  return date;
}

function parseTextDate(value: string) {
  const normalized = value
    .trim()
    .replace(/\s+/g, ' ')
    .replace(/[./]/g, '-')
    .toUpperCase();

  const rangeMatch = normalized.match(/^(\d{1,2})\s*-\s*\d{1,2}\s+([A-Z]+)\s+(\d{2,4})$/);
  if (rangeMatch) {
    const day = Number.parseInt(rangeMatch[1], 10);
    const month = MONTH_ALIASES[rangeMatch[2]];
    const year = Number.parseInt(rangeMatch[3], 10);
    if (month) {
      return buildUtcDate(year, month, day);
    }
  }

  const simpleMatch = normalized.match(/^(\d{1,2})-([A-Z]+)-(\d{2,4})$/);
  if (simpleMatch) {
    const day = Number.parseInt(simpleMatch[1], 10);
    const month = MONTH_ALIASES[simpleMatch[2]];
    const year = Number.parseInt(simpleMatch[3], 10);
    if (month) {
      return buildUtcDate(year, month, day);
    }
  }

  return null;
}

function excelSerialToDate(serial: number, date1904 = false) {
  const parsed = XLSX.SSF.parse_date_code(serial, { date1904 });
  if (!parsed || !parsed.y || !parsed.m || !parsed.d) {
    return null;
  }

  return new Date(Date.UTC(parsed.y, parsed.m - 1, parsed.d));
}

export function normalizeDate(value: unknown, date1904 = false) {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate()));
  }

  if (typeof value === 'number' && Number.isFinite(value)) {
    const parsed = excelSerialToDate(value, date1904);
    if (parsed && !Number.isNaN(parsed.getTime())) {
      return parsed;
    }
  }

  const text = normalizeString(value);
  if (!text) {
    return null;
  }

  const parsedTextDate = parseTextDate(text);
  if (parsedTextDate) {
    return parsedTextDate;
  }

  const parsed = new Date(text);
  if (!Number.isNaN(parsed.getTime())) {
    return new Date(Date.UTC(parsed.getUTCFullYear(), parsed.getUTCMonth(), parsed.getUTCDate()));
  }

  return null;
}

export function isMonthSeparatorRow(values: string[]) {
  const compact = values.filter(Boolean);
  if (compact.length === 0) {
    return false;
  }

  if (compact.length <= 3) {
    return compact.some((value) => MONTH_MARKERS.has(value.toUpperCase())) && compact.some((value) => /^\d{4}$/.test(value));
  }

  return false;
}

export function formatDateForApi(date: Date) {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  const day = String(date.getUTCDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function readWorkbookSheetRows(
  buffer: Buffer,
  targetSheetName: string
): {
  sheetName: string;
  rows: Array<Array<string | number | Date | null>>;
  date1904: boolean;
} {
  const workbook = XLSX.read(buffer, {
    type: 'buffer',
    cellDates: false,
    dense: true,
  });

  const sheetName =
    workbook.SheetNames.find((name) => name.trim().toLowerCase() === targetSheetName.toLowerCase()) ??
    workbook.SheetNames[0];

  if (!sheetName) {
    throw new Error(`Sheet ${targetSheetName} tidak ditemukan.`);
  }

  const sheet = workbook.Sheets[sheetName];
  if (!sheet) {
    throw new Error(`Isi sheet ${targetSheetName} tidak dapat dibaca.`);
  }

  const rows = XLSX.utils.sheet_to_json<(string | number | Date | null)[]>(sheet, {
    header: 1,
    raw: true,
    defval: null,
  });

  return {
    sheetName,
    rows,
    date1904: Boolean(workbook.Workbook?.WBProps?.date1904),
  };
}
