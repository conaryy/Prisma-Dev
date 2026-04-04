import {
  formatDateForApi,
  isMonthSeparatorRow,
  normalizeDate,
  normalizeString,
  normalizeTime,
} from './shared';
import type { ParsedTeknikRow } from './types';

export const TEKNIK_SHEET_NAME = 'Rekap Logbook Teknik';
export const TEKNIK_HEADER_ROW_INDEX = 25;

export function parseTeknikRows(rows: Array<Array<string | number | Date | null>>, date1904: boolean) {
  let currentEntryDate: Date | null = null;
  let currentEntryTime = '';

  const parsedRows: Array<Omit<ParsedTeknikRow, 'entryNo'>> = [];

  for (let index = TEKNIK_HEADER_ROW_INDEX; index < rows.length; index += 1) {
    const row = rows[index] ?? [];
    const entryNoRaw = row[0];
    const entryDateRaw = row[1];
    const entryTimeRaw = row[2];
    const equipmentRaw = row[3];
    const frequencyRaw = row[4];
    const incidentRaw = row[5];

    const normalizedTime = normalizeTime(entryTimeRaw);
    const normalizedEquipment = normalizeString(equipmentRaw);
    const normalizedFrequency = normalizeString(frequencyRaw);
    const normalizedIncident = normalizeString(incidentRaw);
    const normalizedDate = normalizeDate(entryDateRaw, date1904);
    const rawRowValues = [entryNoRaw, entryDateRaw, entryTimeRaw, equipmentRaw, frequencyRaw, incidentRaw].map((value) =>
      normalizeString(value)
    );

    if (
      !normalizeString(entryNoRaw) &&
      !normalizedTime &&
      !normalizedEquipment &&
      !normalizedFrequency &&
      !normalizedIncident &&
      !normalizedDate
    ) {
      continue;
    }

    if (isMonthSeparatorRow(rawRowValues)) {
      currentEntryDate = null;
      currentEntryTime = '';
      continue;
    }

    if (normalizedDate) {
      currentEntryDate = normalizedDate;
    }

    if (normalizedTime) {
      currentEntryTime = normalizedTime;
    }

    if (!currentEntryDate || !normalizedIncident) {
      continue;
    }

    parsedRows.push({
      entryDate: currentEntryDate,
      entryTime: currentEntryTime || '00:00',
      equipment: normalizedEquipment,
      frequencySection: normalizedFrequency,
      incident: normalizedIncident,
      sourceRowNumber: index + 1,
    });
  }

  const sortedRows = [...parsedRows].sort((left, right) => {
    const leftKey = `${formatDateForApi(left.entryDate)} ${left.entryTime}`;
    const rightKey = `${formatDateForApi(right.entryDate)} ${right.entryTime}`;

    if (leftKey < rightKey) {
      return -1;
    }
    if (leftKey > rightKey) {
      return 1;
    }

    return left.sourceRowNumber - right.sourceRowNumber;
  });

  return sortedRows.map((row, index) => ({
    entryNo: index + 1,
    ...row,
  }));
}
