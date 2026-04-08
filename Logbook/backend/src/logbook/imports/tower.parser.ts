import { formatDateForApi, normalizeDate, normalizeString, normalizeTime } from './shared';
import type { ParsedTowerRow, ParsedRowResult, RowParseError } from './types';

export const TOWER_SHEET_NAME = 'Rekap Logbook TWR';
export const TOWER_HEADER_ROW_INDEX = 23;

export function parseTowerRows(rows: Array<Array<string | number | Date | null>>, date1904: boolean): ParsedRowResult<ParsedTowerRow>[] {
  let currentEntryNo = 0;
  let currentEntryDate: Date | null = null;
  let currentEntryDateRaw: string | null = null;
  let currentOperationType = '';
  let currentFacility = '';

  const results: ParsedRowResult<ParsedTowerRow>[] = [];

  for (let index = TOWER_HEADER_ROW_INDEX; index < rows.length; index += 1) {
    const row = rows[index] ?? [];

    // Fallback array length safety
    const entryNoRaw = row[0];
    const entryDateRaw = row[1];
    const entryTimeRaw = row[2];
    const operationTypeRaw = row[3];
    const facilityRaw = row[4];
    const callSignRaw = row[5];
    const descriptionRaw = row[6];

    const rawPayload = JSON.stringify(row);
    const rawDateStr = normalizeString(entryDateRaw) || null;
    const rawTimeStr = normalizeString(entryTimeRaw) || null;

    const normalizedNoStr = normalizeString(entryNoRaw);
    const normalizedTime = normalizeTime(entryTimeRaw);
    const normalizedDate = normalizeDate(entryDateRaw, date1904);
    const normalizedOperationType = normalizeString(operationTypeRaw);
    const normalizedFacility = normalizeString(facilityRaw);
    const normalizedCallSign = normalizeString(callSignRaw);
    const normalizedDescription = normalizeString(descriptionRaw);

    if (
      !normalizedNoStr &&
      !normalizedDate &&
      !normalizedTime &&
      !normalizedOperationType &&
      !normalizedFacility &&
      !normalizedCallSign &&
      !normalizedDescription
    ) {
      continue;
    }

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
    if (normalizedOperationType) {
      currentOperationType = normalizedOperationType;
    }
    if (normalizedFacility) {
      currentFacility = normalizedFacility;
    }

    const isContinuationRow =
      !normalizedNoStr &&
      !normalizedDate &&
      !normalizedTime &&
      !normalizedOperationType &&
      !normalizedFacility &&
      !normalizedCallSign &&
      Boolean(normalizedDescription) &&
      results.length > 0;

    if (isContinuationRow) {
      const lastResult = results[results.length - 1];
      if (lastResult.data) {
        lastResult.data.description = `${lastResult.data.description} ${normalizedDescription}`.trim();
        lastResult.rawPayload = JSON.stringify([lastResult.rawPayload, rawPayload]);
      }
      continue;
    }

    const errors: RowParseError[] = [];
    let isValid = true;
    let data: ParsedTowerRow | null = null;

    if (!currentEntryDate) {
      errors.push({ fieldName: 'Tanggal', errorCode: 'MISSING_DATE', errorMessage: 'Tanggal tidak ditemukan (konteks terputus).' });
      isValid = false;
    }

    if (!normalizedDescription) {
      errors.push({ fieldName: 'Keterangan', errorCode: 'MISSING_DESCRIPTION', errorMessage: 'Laporan Kejadian/Keterangan kosong.' });
      isValid = false;
    }

    if (isValid && currentEntryDate) {
      data = {
        entryNo: currentEntryNo || 1,
        entryDate: currentEntryDate,
        entryTime: normalizedTime || '00:00',
        operationType: normalizedOperationType || currentOperationType || 'Operation Report',
        facility: normalizedFacility || currentFacility || '',
        callSign: normalizedCallSign || '-',
        description: normalizedDescription,
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

  return results;
}
