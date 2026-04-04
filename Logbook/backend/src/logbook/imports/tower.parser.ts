import { formatDateForApi, normalizeDate, normalizeString, normalizeTime } from './shared';
import type { ParsedTowerRow } from './types';

export const TOWER_SHEET_NAME = 'Rekap Logbook TWR';
export const TOWER_HEADER_ROW_INDEX = 23;

export function parseTowerRows(rows: Array<Array<string | number | Date | null>>, date1904: boolean) {
  let currentEntryDate: Date | null = null;
  let currentOperationType = '';
  let currentFacility = '';

  const parsedRows: Array<Omit<ParsedTowerRow, 'entryNo'>> = [];

  for (let index = TOWER_HEADER_ROW_INDEX; index < rows.length; index += 1) {
    const row = rows[index] ?? [];
    const entryDateRaw = row[1];
    const entryTimeRaw = row[2];
    const operationTypeRaw = row[3];
    const facilityRaw = row[4];
    const callSignRaw = row[5];
    const descriptionRaw = row[6];

    const normalizedDate = normalizeDate(entryDateRaw, date1904);
    const normalizedTime = normalizeTime(entryTimeRaw);
    const normalizedOperationType = normalizeString(operationTypeRaw);
    const normalizedFacility = normalizeString(facilityRaw);
    const normalizedCallSign = normalizeString(callSignRaw);
    const normalizedDescription = normalizeString(descriptionRaw);

    if (
      !normalizedDate &&
      !normalizedTime &&
      !normalizedOperationType &&
      !normalizedFacility &&
      !normalizedCallSign &&
      !normalizedDescription
    ) {
      continue;
    }

    if (normalizedDate) {
      currentEntryDate = normalizedDate;
    }
    if (normalizedOperationType) {
      currentOperationType = normalizedOperationType;
    }
    if (normalizedFacility) {
      currentFacility = normalizedFacility;
    }

    const isContinuationRow =
      !normalizedDate &&
      !normalizedTime &&
      !normalizedOperationType &&
      !normalizedFacility &&
      !normalizedCallSign &&
      Boolean(normalizedDescription) &&
      parsedRows.length > 0;

    if (isContinuationRow) {
      const lastRow = parsedRows[parsedRows.length - 1];
      lastRow.description = `${lastRow.description} ${normalizedDescription}`.trim();
      continue;
    }

    if (!currentEntryDate || !normalizedDescription) {
      continue;
    }

    parsedRows.push({
      entryDate: currentEntryDate,
      entryTime: normalizedTime || '00:00',
      operationType: normalizedOperationType || currentOperationType || 'Operation Report',
      facility: normalizedFacility || currentFacility || '',
      callSign: normalizedCallSign,
      description: normalizedDescription,
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
