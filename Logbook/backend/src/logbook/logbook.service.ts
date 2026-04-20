import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { createHash, randomUUID } from 'crypto';
import { PrismaService } from '../database/prisma.service';
import { parseAppRows, APP_HEADER_ROW_INDEX, APP_SHEET_NAME } from './imports/app.parser';
import { formatDateForApi, normalizeDate, readWorkbookSheetRows } from './imports/shared';
import { parseTeknikRows, TEKNIK_HEADER_ROW_INDEX, TEKNIK_SHEET_NAME } from './imports/teknik.parser';
import { parseTowerRows, TOWER_HEADER_ROW_INDEX, TOWER_SHEET_NAME } from './imports/tower.parser';
import type {
  ImportLogbookParams,
  ParsedAppRow,
  ParsedRowResult,
  ParsedTeknikRow,
  ParsedTowerRow,
} from './imports/types';

type ImportCategory = 'tower' | 'app' | 'teknik';
type BatchStatus = 'pending' | 'processing' | 'completed' | 'failed';

type FindEntriesParams = {
  category: ImportCategory;
  page: number;
  pageSize: number;
  search: string;
  sort: 'desc' | 'asc';
  year?: number;
  month?: number;
};

type ListImportBatchesParams = {
  category?: ImportCategory;
  status?: BatchStatus;
  page: number;
  pageSize: number;
  search: string;
};

type BatchRow = {
  id: string;
  sourceCategory: ImportCategory;
  sourcePeriod: string | null;
  reimportOfBatchId: string | null;
  isActive: boolean;
  sourceFileName: string;
  status: string;
  totalRows: number;
  validRows: number;
  invalidRows: number;
  sheetName: string | null;
  notes: string | null;
  importedBy: string | null;
  startedAt: Date;
  completedAt: Date | null;
};

type ParsedImportRow = ParsedRowResult<ParsedTeknikRow | ParsedAppRow | ParsedTowerRow>;
type ParsedImportData = ParsedTeknikRow | ParsedAppRow | ParsedTowerRow;
type PersistBatchResult = {
  batchId: string;
  category: ImportCategory;
  sheetName: string;
  sourceFileName: string;
  sourcePeriod: string | null;
  reimportOfBatchId: string | null;
  isActive: boolean;
  totalRows: number;
  validRows: number;
  invalidRows: number;
  insertedRows: number;
  preview: Record<string, unknown>[];
};

function escapeLikePattern(value: string) {
  return value.replace(/[\\%_]/g, (char) => `\\${char}`);
}

function buildWhereClause(conditions: Prisma.Sql[]) {
  if (conditions.length === 0) {
    return Prisma.empty;
  }

  return Prisma.sql`WHERE ${Prisma.join(conditions, ' AND ')}`;
}

@Injectable()
export class LogbookService {
  constructor(private readonly prisma: PrismaService) {}

  private buildActiveBatchEntryCondition(tableName: 'tower_logbook_entries' | 'app_logbook_entries' | 'teknik_logbook_entries') {
    return Prisma.sql`
      (
        ${Prisma.raw(tableName)}.import_batch_id IS NULL
        OR EXISTS (
          SELECT 1
          FROM logbook_import_batches batch
          WHERE batch.id = ${Prisma.raw(tableName)}.import_batch_id
            AND batch.status = 'completed'
            AND COALESCE(batch.is_active, TRUE) = TRUE
        )
      )
    `;
  }

  private readImportWorkbook(
    buffer: Buffer,
    targetSheetName: string,
    categoryLabel: string
  ) {
    try {
      return readWorkbookSheetRows(buffer, targetSheetName);
    } catch (error) {
      const message =
        error instanceof Error && error.message
          ? error.message
          : `File ${categoryLabel} tidak dapat dibaca.`;
      throw new BadRequestException(message);
    }
  }

  private async getDateFilterOptions(
    category: FindEntriesParams['category'],
    selectedYear?: number
  ) {
    const tableName =
      category === 'tower'
        ? Prisma.raw('tower_logbook_entries')
        : category === 'app'
          ? Prisma.raw('app_logbook_entries')
          : Prisma.raw('teknik_logbook_entries');
    const activeEntryCondition =
      category === 'tower'
        ? this.buildActiveBatchEntryCondition('tower_logbook_entries')
        : category === 'app'
          ? this.buildActiveBatchEntryCondition('app_logbook_entries')
          : this.buildActiveBatchEntryCondition('teknik_logbook_entries');

    const monthWhereClause = selectedYear
      ? Prisma.sql`WHERE ${activeEntryCondition} AND EXTRACT(YEAR FROM entry_date) = ${selectedYear}`
      : Prisma.sql`WHERE ${activeEntryCondition}`;

    const [yearRows, monthRows] = await Promise.all([
      this.prisma.$queryRaw<Array<{ year: number }>>(Prisma.sql`
        SELECT DISTINCT EXTRACT(YEAR FROM entry_date)::int AS year
        FROM ${tableName}
        WHERE ${activeEntryCondition}
        ORDER BY year DESC
      `),
      this.prisma.$queryRaw<Array<{ month: number }>>(Prisma.sql`
        SELECT DISTINCT EXTRACT(MONTH FROM entry_date)::int AS month
        FROM ${tableName}
        ${monthWhereClause}
        ORDER BY month ASC
      `),
    ]);

    return {
      availableYears: yearRows.map((row) => row.year),
      availableMonths: monthRows.map((row) => row.month),
    };
  }

  private async recordAuditTrail(params: {
    action: string;
    actorId?: string;
    targetType: string;
    targetId?: string | null;
    batchId?: string | null;
    metadata?: Record<string, unknown> | null;
  }) {
    await this.prisma.$executeRaw(Prisma.sql`
      INSERT INTO logbook_audit_trails (
        id, actor_id, action, target_type, target_id, batch_id, metadata
      ) VALUES (
        ${randomUUID()},
        ${params.actorId ?? 'system'},
        ${params.action},
        ${params.targetType},
        ${params.targetId ?? null},
        ${params.batchId ?? null},
        ${params.metadata ? JSON.stringify(params.metadata) : null}
      )
    `);
  }

  private async getActiveCompletedBatchForPeriod(
    category: ImportCategory,
    sourcePeriod?: string
  ) {
    const normalizedPeriod = sourcePeriod?.trim();
    if (!normalizedPeriod) {
      return null;
    }

    const existingRows = await this.prisma.$queryRaw<Array<{ id: string }>>(Prisma.sql`
      SELECT id
      FROM logbook_import_batches
      WHERE source_category = ${category}
        AND source_period = ${normalizedPeriod}
        AND COALESCE(is_active, TRUE) = TRUE
        AND status = 'completed'
      LIMIT 1
    `);

    return existingRows[0]?.id ?? null;
  }

  private async resolveReimportTarget(
    category: ImportCategory,
    sourcePeriod: string | undefined,
    allowReimport: boolean | undefined
  ) {
    const existingBatchId = await this.getActiveCompletedBatchForPeriod(category, sourcePeriod);
    if (!existingBatchId) {
      if (allowReimport) {
        const normalizedPeriod = sourcePeriod?.trim();
        throw new BadRequestException(
          `Revisi ${category.toUpperCase()} untuk periode ${normalizedPeriod} tidak bisa diproses karena batch aktif untuk periode itu belum ada.`
        );
      }

      return null;
    }

    const normalizedPeriod = sourcePeriod?.trim();
    if (!allowReimport) {
      throw new BadRequestException(
        `Import ${category.toUpperCase()} untuk periode ${normalizedPeriod} sudah pernah diselesaikan. Jalur reimport aman belum tersedia.`
      );
    }

    return existingBatchId;
  }

  private async createImportBatch(
    category: ImportCategory,
    params: ImportLogbookParams,
    sheetName: string,
    reimportOfBatchId?: string | null
  ) {
    const batchId = randomUUID();
    const sourcePeriod = params.sourcePeriod?.trim() || null;

    await this.prisma.$executeRaw(Prisma.sql`
      INSERT INTO logbook_import_batches (
        id, source_category, source_period, reimport_of_batch_id, is_active, source_file_name, status, sheet_name, imported_by
      ) VALUES (
        ${batchId},
        ${category},
        ${sourcePeriod},
        ${reimportOfBatchId ?? null},
        ${reimportOfBatchId ? false : true},
        ${params.fileName},
        'pending',
        ${sheetName},
        ${params.importedBy ?? null}
      )
    `);

    await this.recordAuditTrail({
      action: 'IMPORT_BATCH_CREATED',
      actorId: params.importedBy,
      targetType: 'logbook_import_batch',
      targetId: batchId,
      batchId,
      metadata: {
        category,
        sourcePeriod,
        sourceFileName: params.fileName,
        sheetName,
        reimportOfBatchId: reimportOfBatchId ?? null,
      },
    });

    return batchId;
  }

  private async updateImportBatch(
    batchId: string,
    status: BatchStatus,
    data?: {
      totalRows?: number;
      validRows?: number;
      invalidRows?: number;
      notes?: string | null;
      completed?: boolean;
    }
  ) {
    await this.prisma.$executeRaw(Prisma.sql`
      UPDATE logbook_import_batches
      SET
        status = ${status},
        is_active = COALESCE(${data?.completed === true && status === 'failed' ? false : null}, is_active),
        total_rows = COALESCE(${data?.totalRows ?? null}, total_rows),
        valid_rows = COALESCE(${data?.validRows ?? null}, valid_rows),
        invalid_rows = COALESCE(${data?.invalidRows ?? null}, invalid_rows),
        notes = COALESCE(${data?.notes ?? null}, notes),
        completed_at = CASE
          WHEN ${data?.completed === true} THEN NOW()
          ELSE completed_at
        END
      WHERE id = ${batchId}
    `);
  }

  private buildIntegrityHash(
    recordId: string,
    category: ImportCategory,
    row: ParsedImportData
  ) {
    if ('incident' in row) {
      return createHash('sha256')
        .update(
          [
            category,
            recordId,
            formatDateForApi(row.entryDate),
            row.entryTime,
            row.equipment,
            row.frequencySection,
            row.incident,
          ].join('|')
        )
        .digest('hex');
    }

    return createHash('sha256')
      .update(
        [
          category,
          recordId,
          formatDateForApi(row.entryDate),
          row.entryTime,
          row.operationType,
          row.facility,
          row.callSign,
          row.description,
        ].join('|')
      )
      .digest('hex');
  }

  private async getImportBatchOrThrow(batchId: string) {
    const rows = await this.prisma.$queryRaw<Array<BatchRow>>(Prisma.sql`
      SELECT
        id,
        source_category AS "sourceCategory",
        source_period AS "sourcePeriod",
        reimport_of_batch_id AS "reimportOfBatchId",
        is_active AS "isActive",
        source_file_name AS "sourceFileName",
        status,
        total_rows AS "totalRows",
        valid_rows AS "validRows",
        invalid_rows AS "invalidRows",
        sheet_name AS "sheetName",
        notes,
        imported_by AS "importedBy",
        started_at AS "startedAt",
        completed_at AS "completedAt"
      FROM logbook_import_batches
      WHERE id = ${batchId}
      LIMIT 1
    `);

    const batch = rows[0];
    if (!batch) {
      throw new NotFoundException('Batch import tidak ditemukan.');
    }

    return batch;
  }

  private formatSourcePeriod(date: Date) {
    return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`;
  }

  private inferRowPeriod(row: ParsedImportRow, date1904: boolean) {
    const candidateDate =
      row.data?.entryDate ?? normalizeDate(row.rawDateValue ?? undefined, date1904);

    if (!candidateDate) {
      return null;
    }

    return this.formatSourcePeriod(candidateDate);
  }

  private filterParsedRowsByPeriod(
    parsedRows: ParsedImportRow[],
    sourcePeriod: string,
    date1904: boolean
  ) {
    return parsedRows.filter((row) => this.inferRowPeriod(row, date1904) === sourcePeriod);
  }

  private async persistBatchImport(params: {
    category: ImportCategory;
    sourceLabel: string;
    sheetName: string;
    parsedRows: ParsedImportRow[];
    payload: ImportLogbookParams;
    sourcePeriod?: string;
    reimportOfBatchId?: string | null;
    insertRecord: (
      tx: Prisma.TransactionClient,
      batchId: string,
      recordId: string,
      row: ParsedImportData
    ) => Promise<void>;
    previewMapper: (row: ParsedImportData) => Record<string, unknown>;
  }): Promise<PersistBatchResult> {
    const validRows = params.parsedRows.filter((row) => row.isValid && row.data);
    const invalidRows = params.parsedRows.filter((row) => !row.isValid);
    const totalRowsCount = params.parsedRows.length;
    const batchId = await this.createImportBatch(
      params.category,
      {
        ...params.payload,
        sourcePeriod: params.sourcePeriod ?? params.payload.sourcePeriod,
      },
      params.sheetName,
      params.reimportOfBatchId
    );

    await this.updateImportBatch(batchId, 'processing', {
      totalRows: totalRowsCount,
      validRows: validRows.length,
      invalidRows: invalidRows.length,
      notes: invalidRows.length > 0 ? `${invalidRows.length} baris membutuhkan perhatian.` : null,
    });

    try {
      await this.prisma.$transaction(async (tx) => {
        for (const row of params.parsedRows) {
          await tx.$executeRaw(Prisma.sql`
            INSERT INTO logbook_import_sources (
              id, batch_id, sheet_name, row_number, raw_date_value, raw_time_value, raw_payload
            ) VALUES (
              ${randomUUID()},
              ${batchId},
              ${params.sheetName},
              ${row.sourceRowNumber},
              ${row.rawDateValue ?? null},
              ${row.rawTimeValue ?? null},
              ${row.rawPayload}
            )
          `);

          if (!row.isValid) {
            for (const error of row.errors) {
              await tx.$executeRaw(Prisma.sql`
                INSERT INTO logbook_import_errors (
                  id, batch_id, sheet_name, row_number, field_name, error_code, error_message, raw_payload
                ) VALUES (
                  ${randomUUID()},
                  ${batchId},
                  ${params.sheetName},
                  ${row.sourceRowNumber},
                  ${error.fieldName},
                  ${error.errorCode},
                  ${error.errorMessage},
                  ${row.rawPayload}
                )
              `);
            }
          }
        }

        for (const row of validRows) {
          if (!row.data) {
            continue;
          }

          const recordId = randomUUID();
          await params.insertRecord(tx, batchId, recordId, row.data);

          await tx.$executeRaw(Prisma.sql`
            INSERT INTO logbook_integrity_records (
              id, batch_id, record_type, record_ref, hash_type, hash_value
            ) VALUES (
              ${randomUUID()},
              ${batchId},
              'record',
              ${recordId},
              'sha256',
              ${this.buildIntegrityHash(recordId, params.category, row.data)}
            )
          `);
        }

        if (params.reimportOfBatchId) {
          await tx.$executeRaw(Prisma.sql`
            UPDATE logbook_import_batches
            SET is_active = FALSE
            WHERE id = ${params.reimportOfBatchId}
          `);

          await tx.$executeRaw(Prisma.sql`
            UPDATE logbook_import_batches
            SET is_active = TRUE
            WHERE id = ${batchId}
          `);
        }
      });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : `Import ${params.sourceLabel} gagal diproses.`;

      await this.updateImportBatch(batchId, 'failed', {
        totalRows: totalRowsCount,
        validRows: validRows.length,
        invalidRows: invalidRows.length,
        notes: message,
        completed: true,
      });

      await this.recordAuditTrail({
        action: 'IMPORT_BATCH_FAILED',
        actorId: params.payload.importedBy,
        targetType: 'logbook_import_batch',
        targetId: batchId,
        batchId,
        metadata: {
          category: params.category,
          sourcePeriod: params.sourcePeriod ?? (params.payload.sourcePeriod?.trim() || null),
          sourceFileName: params.payload.fileName,
          error: message,
          reimportOfBatchId: params.reimportOfBatchId ?? null,
        },
      });

      throw error;
    }

    await this.updateImportBatch(batchId, 'completed', {
      totalRows: totalRowsCount,
      validRows: validRows.length,
      invalidRows: invalidRows.length,
      notes: invalidRows.length > 0 ? `${invalidRows.length} baris tercatat sebagai invalid.` : null,
      completed: true,
    });

    await this.recordAuditTrail({
      action: 'IMPORT_BATCH_COMPLETED',
      actorId: params.payload.importedBy,
      targetType: 'logbook_import_batch',
      targetId: batchId,
      batchId,
      metadata: {
        category: params.category,
        sourcePeriod: params.sourcePeriod ?? (params.payload.sourcePeriod?.trim() || null),
        sourceFileName: params.payload.fileName,
        totalRows: totalRowsCount,
        validRows: validRows.length,
        invalidRows: invalidRows.length,
        reimportOfBatchId: params.reimportOfBatchId ?? null,
      },
    });

    if (params.reimportOfBatchId) {
      await this.recordAuditTrail({
        action: 'IMPORT_BATCH_SUPERSEDED',
        actorId: params.payload.importedBy,
        targetType: 'logbook_import_batch',
        targetId: params.reimportOfBatchId,
        batchId: params.reimportOfBatchId,
        metadata: {
          supersededByBatchId: batchId,
          category: params.category,
          sourcePeriod: params.sourcePeriod ?? (params.payload.sourcePeriod?.trim() || null),
        },
      });
    }

    return {
      batchId,
      category: params.category,
      sheetName: params.sheetName,
      sourceFileName: params.payload.fileName,
      sourcePeriod: params.sourcePeriod ?? params.payload.sourcePeriod ?? null,
      reimportOfBatchId: params.reimportOfBatchId ?? null,
      isActive: true,
      totalRows: totalRowsCount,
      validRows: validRows.length,
      invalidRows: invalidRows.length,
      insertedRows: validRows.length,
      preview: validRows.slice(0, 5).map((row) => params.previewMapper(row.data!)),
    };
  }

  private async runImport(params: {
    category: ImportCategory;
    sourceLabel: string;
    targetSheetName: string;
    minRowCount: number;
    invalidHeaderMessage: string;
    emptyRowsMessage: string;
    parser: (
      rows: Array<Array<string | number | Date | null>>,
      date1904: boolean
    ) => ParsedImportRow[];
    insertRecord: (
      tx: Prisma.TransactionClient,
      batchId: string,
      recordId: string,
      row: ParsedImportData
    ) => Promise<void>;
    previewMapper: (row: ParsedImportData) => Record<string, unknown>;
    payload: ImportLogbookParams;
  }) {
    const { sheetName, rows, date1904 } = this.readImportWorkbook(
      params.payload.buffer,
      params.targetSheetName,
      params.sourceLabel
    );

    if (rows.length < params.minRowCount) {
      throw new BadRequestException(params.invalidHeaderMessage);
    }

    const parsedRows = params.parser(rows, date1904);
    if (parsedRows.length === 0) {
      throw new BadRequestException(params.emptyRowsMessage);
    }

    const normalizedSourcePeriod = params.payload.sourcePeriod?.trim();
    if (params.payload.allowReimport) {
      if (!normalizedSourcePeriod) {
        throw new BadRequestException('Tahun dan bulan revisi wajib dipilih.');
      }

      const filteredRows = this.filterParsedRowsByPeriod(
        parsedRows,
        normalizedSourcePeriod,
        date1904
      );
      if (filteredRows.length === 0) {
        throw new BadRequestException(
          `Tidak ditemukan data ${params.sourceLabel} untuk periode ${normalizedSourcePeriod} di file yang diunggah.`
        );
      }

      const reimportOfBatchId = await this.resolveReimportTarget(
        params.category,
        normalizedSourcePeriod,
        true
      );

      return this.persistBatchImport({
        category: params.category,
        sourceLabel: params.sourceLabel,
        sheetName,
        parsedRows: filteredRows,
        payload: params.payload,
        sourcePeriod: normalizedSourcePeriod,
        reimportOfBatchId,
        insertRecord: params.insertRecord,
        previewMapper: params.previewMapper,
      });
    }

    if (normalizedSourcePeriod) {
      const filteredRows = this.filterParsedRowsByPeriod(
        parsedRows,
        normalizedSourcePeriod,
        date1904
      );
      if (filteredRows.length === 0) {
        throw new BadRequestException(
          `Tidak ditemukan data ${params.sourceLabel} untuk periode ${normalizedSourcePeriod} di file yang diunggah.`
        );
      }

      const reimportOfBatchId = await this.resolveReimportTarget(
        params.category,
        normalizedSourcePeriod,
        false
      );

      return this.persistBatchImport({
        category: params.category,
        sourceLabel: params.sourceLabel,
        sheetName,
        parsedRows: filteredRows,
        payload: params.payload,
        sourcePeriod: normalizedSourcePeriod,
        reimportOfBatchId,
        insertRecord: params.insertRecord,
        previewMapper: params.previewMapper,
      });
    }

    const rowsByPeriod = new Map<string, ParsedImportRow[]>();
    let unassignedRows = 0;

    for (const row of parsedRows) {
      const period = this.inferRowPeriod(row, date1904);
      if (!period) {
        unassignedRows += 1;
        continue;
      }

      if (!rowsByPeriod.has(period)) {
        rowsByPeriod.set(period, []);
      }

      rowsByPeriod.get(period)!.push(row);
    }

    const discoveredPeriods = Array.from(rowsByPeriod.keys()).sort();
    if (discoveredPeriods.length === 0) {
      throw new BadRequestException(
        'Periode pada file tidak dapat dideteksi otomatis. Gunakan Upload Revisi untuk periode yang spesifik.'
      );
    }

    const createdBatches: PersistBatchResult[] = [];
    const skippedPeriods: string[] = [];

    for (const period of discoveredPeriods) {
      const existingBatchId = await this.getActiveCompletedBatchForPeriod(params.category, period);
      if (existingBatchId) {
        skippedPeriods.push(period);
        continue;
      }

      const periodRows = rowsByPeriod.get(period) ?? [];
      createdBatches.push(
        await this.persistBatchImport({
          category: params.category,
          sourceLabel: params.sourceLabel,
          sheetName,
          parsedRows: periodRows,
          payload: params.payload,
          sourcePeriod: period,
          insertRecord: params.insertRecord,
          previewMapper: params.previewMapper,
        })
      );
    }

    return {
      mode: 'auto',
      category: params.category,
      sheetName,
      sourceFileName: params.payload.fileName,
      createdBatches,
      skippedPeriods,
      discoveredPeriods,
      unassignedRows,
      totalRows: parsedRows.length,
    };
  }

  async purgeAllLogbookData(actorId?: string) {
    const countRows = await this.prisma.$queryRaw<
      Array<{
        towerEntries: bigint | number;
        appEntries: bigint | number;
        teknikEntries: bigint | number;
        batches: bigint | number;
        sources: bigint | number;
        errors: bigint | number;
        integrityRecords: bigint | number;
        auditTrails: bigint | number;
      }>
    >(Prisma.sql`
      SELECT
        (SELECT COUNT(*)::bigint FROM tower_logbook_entries) AS "towerEntries",
        (SELECT COUNT(*)::bigint FROM app_logbook_entries) AS "appEntries",
        (SELECT COUNT(*)::bigint FROM teknik_logbook_entries) AS "teknikEntries",
        (SELECT COUNT(*)::bigint FROM logbook_import_batches) AS batches,
        (SELECT COUNT(*)::bigint FROM logbook_import_sources) AS sources,
        (SELECT COUNT(*)::bigint FROM logbook_import_errors) AS errors,
        (SELECT COUNT(*)::bigint FROM logbook_integrity_records) AS "integrityRecords",
        (SELECT COUNT(*)::bigint FROM logbook_audit_trails) AS "auditTrails"
    `);

    const summary = {
      towerEntries: Number(countRows[0]?.towerEntries ?? 0),
      appEntries: Number(countRows[0]?.appEntries ?? 0),
      teknikEntries: Number(countRows[0]?.teknikEntries ?? 0),
      batches: Number(countRows[0]?.batches ?? 0),
      sources: Number(countRows[0]?.sources ?? 0),
      errors: Number(countRows[0]?.errors ?? 0),
      integrityRecords: Number(countRows[0]?.integrityRecords ?? 0),
      auditTrails: Number(countRows[0]?.auditTrails ?? 0),
    };

    await this.prisma.$transaction(async (tx) => {
      await tx.$executeRaw(Prisma.sql`DELETE FROM logbook_import_errors`);
      await tx.$executeRaw(Prisma.sql`DELETE FROM logbook_import_sources`);
      await tx.$executeRaw(Prisma.sql`DELETE FROM logbook_integrity_records`);
      await tx.$executeRaw(Prisma.sql`DELETE FROM logbook_audit_trails`);
      await tx.$executeRaw(Prisma.sql`DELETE FROM tower_logbook_entries`);
      await tx.$executeRaw(Prisma.sql`DELETE FROM app_logbook_entries`);
      await tx.$executeRaw(Prisma.sql`DELETE FROM teknik_logbook_entries`);
      await tx.$executeRaw(Prisma.sql`DELETE FROM logbook_import_batches`);
    });

    await this.recordAuditTrail({
      action: 'PURGE_ALL_LOGBOOK_DATA',
      actorId,
      targetType: 'logbook_system',
      metadata: {
        deleted: summary,
      },
    });

    return {
      deleted: true,
      message: 'Seluruh data logbook berhasil dihapus.',
      summary,
    };
  }

  async rollbackImportBatch(batchId: string, actorId?: string) {
    const targetBatch = await this.getImportBatchOrThrow(batchId);

    if (targetBatch.status !== 'completed') {
      throw new BadRequestException('Hanya batch completed yang bisa diaktifkan kembali.');
    }

    if (targetBatch.isActive) {
      throw new BadRequestException('Batch ini sudah aktif.');
    }

    if (!targetBatch.sourcePeriod?.trim()) {
      throw new BadRequestException(
        'Rollback hanya diizinkan untuk batch yang memiliki periode sumber yang jelas.'
      );
    }

    const replacedBatchId = await this.prisma.$transaction(async (tx) => {
      const activeRows = await tx.$queryRaw<Array<{ id: string }>>(Prisma.sql`
        SELECT id
        FROM logbook_import_batches
        WHERE source_category = ${targetBatch.sourceCategory}
          AND source_period = ${targetBatch.sourcePeriod}
          AND status = 'completed'
          AND COALESCE(is_active, TRUE) = TRUE
          AND id <> ${targetBatch.id}
        LIMIT 1
      `);

      const currentActiveBatchId = activeRows[0]?.id ?? null;

      if (currentActiveBatchId) {
        await tx.$executeRaw(Prisma.sql`
          UPDATE logbook_import_batches
          SET is_active = FALSE
          WHERE id = ${currentActiveBatchId}
        `);
      }

      await tx.$executeRaw(Prisma.sql`
        UPDATE logbook_import_batches
        SET is_active = TRUE
        WHERE id = ${targetBatch.id}
      `);

      return currentActiveBatchId;
    });

    await this.recordAuditTrail({
      action: 'IMPORT_BATCH_ROLLBACK_ACTIVATED',
      actorId,
      targetType: 'logbook_import_batch',
      targetId: targetBatch.id,
      batchId: targetBatch.id,
      metadata: {
        category: targetBatch.sourceCategory,
        sourcePeriod: targetBatch.sourcePeriod,
        replacedBatchId,
      },
    });

    if (replacedBatchId) {
      await this.recordAuditTrail({
        action: 'IMPORT_BATCH_ROLLBACK_ARCHIVED',
        actorId,
        targetType: 'logbook_import_batch',
        targetId: replacedBatchId,
        batchId: replacedBatchId,
        metadata: {
          category: targetBatch.sourceCategory,
          sourcePeriod: targetBatch.sourcePeriod,
          activatedBatchId: targetBatch.id,
        },
      });
    }

    return {
      batchId: targetBatch.id,
      isActive: true,
      replacedBatchId,
      sourceCategory: targetBatch.sourceCategory,
      sourcePeriod: targetBatch.sourcePeriod,
    };
  }

  async listImportBatches(params: ListImportBatchesParams) {
    const offset = (params.page - 1) * params.pageSize;
    const normalizedSearch = params.search.trim();
    const hasSearch = normalizedSearch.length > 0;
    const searchTerm = `%${escapeLikePattern(normalizedSearch)}%`;
    const conditions: Prisma.Sql[] = [];

    if (params.category) {
      conditions.push(Prisma.sql`source_category = ${params.category}`);
    }

    if (params.status) {
      conditions.push(Prisma.sql`status = ${params.status}`);
    }

    if (hasSearch) {
      conditions.push(Prisma.sql`
        (
          source_file_name ILIKE ${searchTerm} ESCAPE '\\'
          OR COALESCE(source_period, '') ILIKE ${searchTerm} ESCAPE '\\'
          OR COALESCE(sheet_name, '') ILIKE ${searchTerm} ESCAPE '\\'
          OR COALESCE(imported_by, '') ILIKE ${searchTerm} ESCAPE '\\'
        )
      `);
    }

    const whereClause = buildWhereClause(conditions);
    const [rows, countRows] = await Promise.all([
      this.prisma.$queryRaw<Array<BatchRow>>(Prisma.sql`
        SELECT
          id,
          source_category AS "sourceCategory",
          source_period AS "sourcePeriod",
          reimport_of_batch_id AS "reimportOfBatchId",
          is_active AS "isActive",
          source_file_name AS "sourceFileName",
          status,
          total_rows AS "totalRows",
          valid_rows AS "validRows",
          invalid_rows AS "invalidRows",
          sheet_name AS "sheetName",
          notes,
          imported_by AS "importedBy",
          started_at AS "startedAt",
          completed_at AS "completedAt"
        FROM logbook_import_batches
        ${whereClause}
        ORDER BY started_at DESC
        LIMIT ${params.pageSize}
        OFFSET ${offset}
      `),
      this.prisma.$queryRaw<Array<{ total: bigint | number }>>(Prisma.sql`
        SELECT COUNT(*)::bigint AS total
        FROM logbook_import_batches
        ${whereClause}
      `),
    ]);

    return {
      data: rows,
      total: Number(countRows[0]?.total ?? 0),
    };
  }

  async getImportBatchDetail(
    batchId: string,
    options?: {
      sourcePage?: number;
      sourcePageSize?: number;
      auditPage?: number;
      auditPageSize?: number;
    }
  ) {
    const batch = await this.getImportBatchOrThrow(batchId);
    const sourcePage = options?.sourcePage ?? 1;
    const sourcePageSize = options?.sourcePageSize ?? 10;
    const auditPage = options?.auditPage ?? 1;
    const auditPageSize = options?.auditPageSize ?? 5;
    const sourceOffset = (sourcePage - 1) * sourcePageSize;
    const auditOffset = (auditPage - 1) * auditPageSize;

    const [summaryRows, sourceRows, auditRows] = await Promise.all([
      this.prisma.$queryRaw<
        Array<{
          sourceRows: bigint | number;
          errorCount: bigint | number;
          recordCount: bigint | number;
          auditCount: bigint | number;
        }>
      >(Prisma.sql`
        SELECT
          (SELECT COUNT(*)::bigint FROM logbook_import_sources WHERE batch_id = ${batchId}) AS "sourceRows",
          (SELECT COUNT(*)::bigint FROM logbook_import_errors WHERE batch_id = ${batchId}) AS "errorCount",
          (SELECT COUNT(*)::bigint FROM logbook_integrity_records WHERE batch_id = ${batchId}) AS "recordCount",
          (SELECT COUNT(*)::bigint FROM logbook_audit_trails WHERE batch_id = ${batchId}) AS "auditCount"
      `),
      this.prisma.$queryRaw<
        Array<{
          rowNumber: number;
          rawDateValue: string | null;
          rawTimeValue: string | null;
          rawPayload: string;
          errorCount: bigint | number;
        }>
      >(Prisma.sql`
        SELECT
          s.row_number AS "rowNumber",
          s.raw_date_value AS "rawDateValue",
          s.raw_time_value AS "rawTimeValue",
          s.raw_payload AS "rawPayload",
          COUNT(e.id)::bigint AS "errorCount"
        FROM logbook_import_sources s
        LEFT JOIN logbook_import_errors e
          ON e.batch_id = s.batch_id
         AND e.row_number = s.row_number
        WHERE s.batch_id = ${batchId}
        GROUP BY s.row_number, s.raw_date_value, s.raw_time_value, s.raw_payload
        ORDER BY s.row_number ASC
        LIMIT ${sourcePageSize}
        OFFSET ${sourceOffset}
      `),
      this.prisma.$queryRaw<
        Array<{
          id: string;
          action: string;
          actorId: string;
          metadata: string | null;
          createdAt: Date;
        }>
      >(Prisma.sql`
        SELECT
          id,
          action,
          actor_id AS "actorId",
          metadata,
          created_at AS "createdAt"
        FROM logbook_audit_trails
        WHERE batch_id = ${batchId}
        ORDER BY created_at ASC
        LIMIT ${auditPageSize}
        OFFSET ${auditOffset}
      `),
    ]);

    return {
      ...batch,
      summary: {
        sourceRows: Number(summaryRows[0]?.sourceRows ?? 0),
        errorCount: Number(summaryRows[0]?.errorCount ?? 0),
        recordCount: Number(summaryRows[0]?.recordCount ?? 0),
        auditCount: Number(summaryRows[0]?.auditCount ?? 0),
      },
      sampleSourceRows: sourceRows.map((row) => ({
        ...row,
        errorCount: Number(row.errorCount ?? 0),
      })),
      auditTrail: auditRows.map((row) => ({
        ...row,
        metadata: row.metadata ? JSON.parse(row.metadata) : null,
      })),
    };
  }

  async listImportBatchErrors(
    batchId: string,
    options?: {
      page?: number;
      pageSize?: number;
    }
  ) {
    await this.getImportBatchOrThrow(batchId);
    const page = options?.page ?? 1;
    const pageSize = options?.pageSize ?? 10;
    const offset = (page - 1) * pageSize;

    const [rows, countRows] = await Promise.all([
      this.prisma.$queryRaw<
        Array<{
          id: string;
          rowNumber: number;
          fieldName: string;
          errorCode: string;
          errorMessage: string;
          rawPayload: string;
        }>
      >(Prisma.sql`
        SELECT
          id,
          row_number AS "rowNumber",
          field_name AS "fieldName",
          error_code AS "errorCode",
          error_message AS "errorMessage",
          raw_payload AS "rawPayload"
        FROM logbook_import_errors
        WHERE batch_id = ${batchId}
        ORDER BY row_number ASC, field_name ASC
        LIMIT ${pageSize}
        OFFSET ${offset}
      `),
      this.prisma.$queryRaw<Array<{ total: bigint | number }>>(Prisma.sql`
        SELECT COUNT(*)::bigint AS total
        FROM logbook_import_errors
        WHERE batch_id = ${batchId}
      `),
    ]);

    return {
      data: rows,
      total: Number(countRows[0]?.total ?? 0),
    };
  }

  async findEntries(params: FindEntriesParams) {
    const offset = (params.page - 1) * params.pageSize;
    const normalizedSearch = params.search.trim();
    const hasSearch = normalizedSearch.length > 0;
    const searchTerm = `%${escapeLikePattern(normalizedSearch)}%`;
    const orderClause =
      params.sort === 'asc'
        ? Prisma.sql`ORDER BY entry_date ASC, entry_time ASC, entry_no ASC`
        : Prisma.sql`ORDER BY entry_date DESC, entry_time DESC, entry_no DESC`;

    if (params.category === 'tower') {
      const conditions: Prisma.Sql[] = [];
      if (hasSearch) {
        conditions.push(Prisma.sql`
          (
            operation_type ILIKE ${searchTerm} ESCAPE '\\'
            OR facility ILIKE ${searchTerm} ESCAPE '\\'
            OR call_sign ILIKE ${searchTerm} ESCAPE '\\'
            OR description ILIKE ${searchTerm} ESCAPE '\\'
            OR entry_time ILIKE ${searchTerm} ESCAPE '\\'
            OR entry_no::text ILIKE ${searchTerm} ESCAPE '\\'
          )
        `);
      }
      if (params.year) {
        conditions.push(Prisma.sql`EXTRACT(YEAR FROM entry_date) = ${params.year}`);
      }
      if (params.month) {
        conditions.push(Prisma.sql`EXTRACT(MONTH FROM entry_date) = ${params.month}`);
      }
      conditions.push(this.buildActiveBatchEntryCondition('tower_logbook_entries'));

      const whereClause = buildWhereClause(conditions);
      const [rows, countRows, filters] = await Promise.all([
        this.prisma.$queryRaw<
          Array<{
            id: string;
            entryNo: number;
            entryDate: string;
            entryTime: string;
            operationType: string;
            facility: string;
            callSign: string;
            description: string;
            sourceType: string;
            createdAt: Date;
            updatedAt: Date;
          }>
        >(Prisma.sql`
          SELECT
            id,
            entry_no AS "entryNo",
            entry_date::text AS "entryDate",
            entry_time AS "entryTime",
            operation_type AS "operationType",
            facility,
            call_sign AS "callSign",
            description,
            source_type AS "sourceType",
            created_at AS "createdAt",
            updated_at AS "updatedAt"
          FROM tower_logbook_entries
          ${whereClause}
          ${orderClause}
          LIMIT ${params.pageSize}
          OFFSET ${offset}
        `),
        this.prisma.$queryRaw<Array<{ total: bigint | number }>>(Prisma.sql`
          SELECT COUNT(*)::bigint AS total
          FROM tower_logbook_entries
          ${whereClause}
        `),
        this.getDateFilterOptions(params.category, params.year),
      ]);

      return {
        data: rows.map((row) => ({
          id: row.id,
          no: row.entryNo,
          date: String(row.entryDate).substring(0, 10),
          time: row.entryTime,
          operationType: row.operationType,
          facility: row.facility,
          callSign: row.callSign,
          description: row.description,
          sourceType: row.sourceType,
          createdAt: row.createdAt,
          updatedAt: row.updatedAt,
        })),
        total: Number(countRows[0]?.total ?? 0),
        ...filters,
      };
    }

    if (params.category === 'app') {
      const conditions: Prisma.Sql[] = [];
      if (hasSearch) {
        conditions.push(Prisma.sql`
          (
            operation_type ILIKE ${searchTerm} ESCAPE '\\'
            OR facility ILIKE ${searchTerm} ESCAPE '\\'
            OR call_sign ILIKE ${searchTerm} ESCAPE '\\'
            OR description ILIKE ${searchTerm} ESCAPE '\\'
            OR entry_time ILIKE ${searchTerm} ESCAPE '\\'
            OR entry_no::text ILIKE ${searchTerm} ESCAPE '\\'
          )
        `);
      }
      if (params.year) {
        conditions.push(Prisma.sql`EXTRACT(YEAR FROM entry_date) = ${params.year}`);
      }
      if (params.month) {
        conditions.push(Prisma.sql`EXTRACT(MONTH FROM entry_date) = ${params.month}`);
      }
      conditions.push(this.buildActiveBatchEntryCondition('app_logbook_entries'));

      const whereClause = buildWhereClause(conditions);
      const [rows, countRows, filters] = await Promise.all([
        this.prisma.$queryRaw<
          Array<{
            id: string;
            entryNo: number;
            entryDate: string;
            entryTime: string;
            operationType: string;
            facility: string;
            callSign: string;
            description: string;
            sourceType: string;
            createdAt: Date;
            updatedAt: Date;
          }>
        >(Prisma.sql`
          SELECT
            id,
            entry_no AS "entryNo",
            entry_date::text AS "entryDate",
            entry_time AS "entryTime",
            operation_type AS "operationType",
            facility,
            call_sign AS "callSign",
            description,
            source_type AS "sourceType",
            created_at AS "createdAt",
            updated_at AS "updatedAt"
          FROM app_logbook_entries
          ${whereClause}
          ${orderClause}
          LIMIT ${params.pageSize}
          OFFSET ${offset}
        `),
        this.prisma.$queryRaw<Array<{ total: bigint | number }>>(Prisma.sql`
          SELECT COUNT(*)::bigint AS total
          FROM app_logbook_entries
          ${whereClause}
        `),
        this.getDateFilterOptions(params.category, params.year),
      ]);

      return {
        data: rows.map((row) => ({
          id: row.id,
          no: row.entryNo,
          date: String(row.entryDate).substring(0, 10),
          time: row.entryTime,
          operationType: row.operationType,
          facility: row.facility,
          callSign: row.callSign,
          description: row.description,
          sourceType: row.sourceType,
          createdAt: row.createdAt,
          updatedAt: row.updatedAt,
        })),
        total: Number(countRows[0]?.total ?? 0),
        ...filters,
      };
    }

    const conditions: Prisma.Sql[] = [];
    if (hasSearch) {
      conditions.push(Prisma.sql`
        (
          equipment ILIKE ${searchTerm} ESCAPE '\\'
          OR frequency_section ILIKE ${searchTerm} ESCAPE '\\'
          OR incident ILIKE ${searchTerm} ESCAPE '\\'
          OR entry_time ILIKE ${searchTerm} ESCAPE '\\'
          OR entry_no::text ILIKE ${searchTerm} ESCAPE '\\'
        )
      `);
    }
    if (params.year) {
      conditions.push(Prisma.sql`EXTRACT(YEAR FROM entry_date) = ${params.year}`);
    }
    if (params.month) {
      conditions.push(Prisma.sql`EXTRACT(MONTH FROM entry_date) = ${params.month}`);
    }
    conditions.push(this.buildActiveBatchEntryCondition('teknik_logbook_entries'));

    const whereClause = buildWhereClause(conditions);
    const [rows, countRows, filters] = await Promise.all([
      this.prisma.$queryRaw<
        Array<{
          id: string;
          entryNo: number;
          entryDate: string;
          entryTime: string;
          equipment: string;
          frequencySection: string;
          incident: string;
          sourceType: string;
          createdAt: Date;
          updatedAt: Date;
        }>
      >(Prisma.sql`
        SELECT
          id,
          entry_no AS "entryNo",
          entry_date::text AS "entryDate",
          entry_time AS "entryTime",
          equipment,
          frequency_section AS "frequencySection",
          incident,
          source_type AS "sourceType",
          created_at AS "createdAt",
          updated_at AS "updatedAt"
        FROM teknik_logbook_entries
        ${whereClause}
        ${orderClause}
        LIMIT ${params.pageSize}
        OFFSET ${offset}
      `),
      this.prisma.$queryRaw<Array<{ total: bigint | number }>>(Prisma.sql`
        SELECT COUNT(*)::bigint AS total
        FROM teknik_logbook_entries
        ${whereClause}
      `),
      this.getDateFilterOptions(params.category, params.year),
    ]);

    return {
      data: rows.map((row) => ({
        id: row.id,
        no: row.entryNo,
        date: String(row.entryDate).substring(0, 10),
        time: row.entryTime,
        equipment: row.equipment,
        frequencyOrSection: row.frequencySection,
        incident: row.incident,
        sourceType: row.sourceType,
        createdAt: row.createdAt,
        updatedAt: row.updatedAt,
      })),
      total: Number(countRows[0]?.total ?? 0),
      ...filters,
    };
  }

  async importTeknikEntries(payload: ImportLogbookParams) {
    return this.runImport({
      category: 'teknik',
      sourceLabel: 'Teknik',
      targetSheetName: TEKNIK_SHEET_NAME,
      minRowCount: TEKNIK_HEADER_ROW_INDEX,
      invalidHeaderMessage: 'Format file Teknik tidak sesuai. Header tabel tidak ditemukan.',
      emptyRowsMessage: 'Tidak ada baris Logbook Teknik yang valid untuk dibaca.',
      parser: parseTeknikRows,
      insertRecord: async (tx, batchId, recordId, row) => {
        if (!('incident' in row)) {
          throw new BadRequestException('Payload import Teknik tidak valid.');
        }

        await tx.$executeRaw(Prisma.sql`
          INSERT INTO teknik_logbook_entries (
            id,
            entry_no,
            entry_date,
            entry_time,
            equipment,
            frequency_section,
            incident,
            import_batch_id,
            source_type
          ) VALUES (
            ${recordId},
            ${row.entryNo},
            CAST(${formatDateForApi(row.entryDate)} AS DATE),
            ${row.entryTime},
            ${row.equipment},
            ${row.frequencySection},
            ${row.incident},
            ${batchId},
            'import_teknik'
          )
        `);
      },
      previewMapper: (row) => {
        if (!('incident' in row)) {
          return {};
        }

        return {
          no: row.entryNo,
          date: formatDateForApi(row.entryDate),
          time: row.entryTime,
          equipment: row.equipment,
          frequencySection: row.frequencySection,
          incident: row.incident,
          sourceRowNumber: row.sourceRowNumber,
        };
      },
      payload,
    });
  }

  async importAppEntries(payload: ImportLogbookParams) {
    return this.runImport({
      category: 'app',
      sourceLabel: 'APP',
      targetSheetName: APP_SHEET_NAME,
      minRowCount: APP_HEADER_ROW_INDEX,
      invalidHeaderMessage: 'Format file APP tidak sesuai. Header tabel tidak ditemukan.',
      emptyRowsMessage: 'Tidak ada baris Logbook APP yang valid untuk dibaca.',
      parser: parseAppRows,
      insertRecord: async (tx, batchId, recordId, row) => {
        if ('incident' in row) {
          throw new BadRequestException('Payload import APP tidak valid.');
        }

        await tx.$executeRaw(Prisma.sql`
          INSERT INTO app_logbook_entries (
            id,
            entry_no,
            entry_date,
            entry_time,
            operation_type,
            facility,
            call_sign,
            description,
            import_batch_id,
            source_type
          ) VALUES (
            ${recordId},
            ${row.entryNo},
            CAST(${formatDateForApi(row.entryDate)} AS DATE),
            ${row.entryTime},
            ${row.operationType},
            ${row.facility},
            ${row.callSign},
            ${row.description},
            ${batchId},
            'import_app'
          )
        `);
      },
      previewMapper: (row) => {
        if ('incident' in row) {
          return {};
        }

        return {
          no: row.entryNo,
          date: formatDateForApi(row.entryDate),
          time: row.entryTime,
          operationType: row.operationType,
          facility: row.facility,
          callSign: row.callSign,
          description: row.description,
          sourceRowNumber: row.sourceRowNumber,
        };
      },
      payload,
    });
  }

  async importTowerEntries(payload: ImportLogbookParams) {
    return this.runImport({
      category: 'tower',
      sourceLabel: 'TWR',
      targetSheetName: TOWER_SHEET_NAME,
      minRowCount: TOWER_HEADER_ROW_INDEX,
      invalidHeaderMessage: 'Format file TWR tidak sesuai. Header tabel tidak ditemukan.',
      emptyRowsMessage: 'Tidak ada baris Logbook TWR yang valid untuk dibaca.',
      parser: parseTowerRows,
      insertRecord: async (tx, batchId, recordId, row) => {
        if ('incident' in row) {
          throw new BadRequestException('Payload import TWR tidak valid.');
        }

        await tx.$executeRaw(Prisma.sql`
          INSERT INTO tower_logbook_entries (
            id,
            entry_no,
            entry_date,
            entry_time,
            operation_type,
            facility,
            call_sign,
            description,
            import_batch_id,
            source_type
          ) VALUES (
            ${recordId},
            ${row.entryNo},
            CAST(${formatDateForApi(row.entryDate)} AS DATE),
            ${row.entryTime},
            ${row.operationType},
            ${row.facility},
            ${row.callSign},
            ${row.description},
            ${batchId},
            'import_tower'
          )
        `);
      },
      previewMapper: (row) => {
        if ('incident' in row) {
          return {};
        }

        return {
          no: row.entryNo,
          date: formatDateForApi(row.entryDate),
          time: row.entryTime,
          operationType: row.operationType,
          facility: row.facility,
          callSign: row.callSign,
          description: row.description,
          sourceRowNumber: row.sourceRowNumber,
        };
      },
      payload,
    });
  }
}
