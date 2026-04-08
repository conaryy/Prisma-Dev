import {
  formatDateForApi,
  isMonthSeparatorRow,
  normalizeDate,
  normalizeString,
  normalizeTime,
} from './shared';
import type { ParsedRowResult, ParsedTeknikRow, RowParseError } from './types';

export const TEKNIK_SHEET_NAME = 'Rekap Logbook Teknik';
export const TEKNIK_HEADER_ROW_INDEX = 25;

export function parseTeknikRows(rows: Array<Array<string | number | Date | null>>, date1904: boolean): ParsedRowResult<ParsedTeknikRow>[] {
  let currentEntryNo = 0;
  let currentEntryDate: Date | null = null;
  let currentEntryDateRaw: string | null = null;
  let currentEquipment = '';

  const results: ParsedRowResult<ParsedTeknikRow>[] = [];

  for (let index = TEKNIK_HEADER_ROW_INDEX; index < rows.length; index += 1) {
    const row = rows[index] ?? [];

    // Fallback array length safety
    const entryNoRaw = row[0];
    const entryDateRaw = row[1];
    const entryTimeRaw = row[2];
    const equipmentRaw = row[3];
    const frequencyRaw = row[4];
    const incidentRaw = row[5];

    const rawPayload = JSON.stringify(row);
    const rawDateStr = normalizeString(entryDateRaw) || null;
    const rawTimeStr = normalizeString(entryTimeRaw) || null;

    const normalizedNoStr = normalizeString(entryNoRaw);
    const normalizedTime = normalizeTime(entryTimeRaw);
    const normalizedEquipment = normalizeString(equipmentRaw);
    const normalizedFrequency = normalizeString(frequencyRaw);
    const normalizedIncident = normalizeString(incidentRaw);
    const normalizedDate = normalizeDate(entryDateRaw, date1904);

    // Check if fully empty
    if (!normalizedNoStr && !normalizedTime && !normalizedEquipment && !normalizedFrequency && !normalizedIncident && !normalizedDate) {
      continue;
    }

    if (isMonthSeparatorRow([entryNoRaw, entryDateRaw, entryTimeRaw, equipmentRaw, frequencyRaw, incidentRaw].map(v => normalizeString(v)))) {
      currentEntryDate = null;
      currentEntryDateRaw = null;
      continue;
    }

    // Carry forward context
    if (normalizedNoStr) {
      const parsedNo = parseInt(normalizedNoStr, 10);
      if (!isNaN(parsedNo)) {
        currentEntryNo = parsedNo;
      }
    }

    if (normalizedDate) {
      currentEntryDate = normalizedDate;
      currentEntryDateRaw = rawDateStr;
    }

    if (normalizedEquipment) {
      currentEquipment = normalizedEquipment;
    }

    const errors: RowParseError[] = [];
    let isValid = true;
    let data: ParsedTeknikRow | null = null;

    if (!currentEntryDate) {
      errors.push({ fieldName: 'TANGGAL', errorCode: 'MISSING_DATE', errorMessage: 'Tanggal tidak ditemukan (konteks terputus).' });
      isValid = false;
    }

    if (!normalizedIncident) {
      errors.push({ fieldName: 'KEJADIAN', errorCode: 'MISSING_INCIDENT', errorMessage: 'Laporan Kejadian kosong.' });
      isValid = false;
    }

    if (isValid && currentEntryDate) {
      data = {
        entryNo: currentEntryNo || 1, // Fallback if 0
        entryDate: currentEntryDate,
        entryTime: normalizedTime || '00:00',
        equipment: normalizedEquipment || currentEquipment || '-', // carry-forward equipment
        frequencySection: normalizedFrequency || '-',
        incident: normalizedIncident,
        sourceRowNumber: index + 1,
      };
    }

    results.push({
      sourceRowNumber: index + 1,
      rawPayload,
      rawDateValue: rawDateStr || currentEntryDateRaw,
      rawTimeValue: rawTimeStr,
      isValid,
      errors,
      data,
    });
  }

  // We DO NOT sort here anymore, to preserve the exact row numbers and batch integrity
  return results;
}
