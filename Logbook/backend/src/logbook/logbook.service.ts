import { BadRequestException, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { randomUUID } from 'crypto';
import { PrismaService } from '../database/prisma.service';
import { parseAppRows, APP_HEADER_ROW_INDEX, APP_SHEET_NAME } from './imports/app.parser';
import {
  formatDateForApi,
  readWorkbookSheetRows,
} from './imports/shared';
import { parseTeknikRows, TEKNIK_HEADER_ROW_INDEX, TEKNIK_SHEET_NAME } from './imports/teknik.parser';
import { parseTowerRows, TOWER_HEADER_ROW_INDEX, TOWER_SHEET_NAME } from './imports/tower.parser';
import type { ImportLogbookParams } from './imports/types';

type FindEntriesParams = {
  category: 'tower' | 'app' | 'teknik';
  page: number;
  pageSize: number;
  search: string;
  sort: 'desc' | 'asc';
  year?: number;
  month?: number;
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

    const monthWhereClause = selectedYear
      ? Prisma.sql`WHERE EXTRACT(YEAR FROM entry_date) = ${selectedYear}`
      : Prisma.empty;

    const [yearRows, monthRows] = await Promise.all([
      this.prisma.$queryRaw<Array<{ year: number }>>(Prisma.sql`
        SELECT DISTINCT EXTRACT(YEAR FROM entry_date)::int AS year
        FROM ${tableName}
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

  async purgeAllLogbookData() {
    await this.prisma.$transaction(async (tx) => {
      await tx.$executeRaw(Prisma.sql`DELETE FROM tower_logbook_entries`);
      await tx.$executeRaw(Prisma.sql`DELETE FROM app_logbook_entries`);
      await tx.$executeRaw(Prisma.sql`DELETE FROM teknik_logbook_entries`);
      await tx.$executeRaw(Prisma.sql`DELETE FROM logbook_import_batches`);
    });

    return {
      deleted: true,
      message: 'Seluruh data logbook berhasil dihapus.',
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
            -- Return DATE columns as text to avoid JS Date timezone shifts on read.
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

      const total = Number(countRows[0]?.total ?? 0);

      return {
        data: rows.map((row) => ({
          id: row.id,
          no: row.entryNo,
          date: row.entryDate,
          time: row.entryTime,
          operationType: row.operationType,
          facility: row.facility,
          callSign: row.callSign,
          description: row.description,
          sourceType: row.sourceType,
          createdAt: row.createdAt,
          updatedAt: row.updatedAt,
        })),
        total,
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
            -- Return DATE columns as text to avoid JS Date timezone shifts on read.
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

      const total = Number(countRows[0]?.total ?? 0);

      return {
        data: rows.map((row) => ({
          id: row.id,
          no: row.entryNo,
          date: row.entryDate,
          time: row.entryTime,
          operationType: row.operationType,
          facility: row.facility,
          callSign: row.callSign,
          description: row.description,
          sourceType: row.sourceType,
          createdAt: row.createdAt,
          updatedAt: row.updatedAt,
        })),
        total,
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
          -- Return DATE columns as text to avoid JS Date timezone shifts on read.
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

    const total = Number(countRows[0]?.total ?? 0);

    return {
      data: rows.map((row) => ({
        id: row.id,
        no: row.entryNo,
        date: row.entryDate,
        time: row.entryTime,
        equipment: row.equipment,
        frequencyOrSection: row.frequencySection,
        incident: row.incident,
        sourceType: row.sourceType,
        createdAt: row.createdAt,
        updatedAt: row.updatedAt,
      })),
      total,
      ...filters,
    };
  }

  async importTeknikEntries(params: ImportLogbookParams) {
    const { sheetName, rows, date1904 } = this.readImportWorkbook(
      params.buffer,
      TEKNIK_SHEET_NAME,
      'Teknik'
    );

    if (rows.length < TEKNIK_HEADER_ROW_INDEX) {
      throw new BadRequestException('Format file Teknik tidak sesuai. Header tabel tidak ditemukan.');
    }

    const parsedRows = parseTeknikRows(rows, date1904);
    if (parsedRows.length === 0) {
      throw new BadRequestException('Tidak ada baris Logbook Teknik yang valid untuk diimpor.');
    }

    const batchId = randomUUID();
    const totalRows = Math.max(rows.length - TEKNIK_HEADER_ROW_INDEX, 0);
    const invalidRows = totalRows - parsedRows.length;

    await this.prisma.$transaction(async (tx) => {
      await tx.$executeRaw(Prisma.sql`
        INSERT INTO logbook_import_batches (
          id, category, source_period, source_file_name, status,
          total_rows, valid_rows, invalid_rows, sheet_name, imported_by, completed_at
        ) VALUES (
          ${batchId},
          'teknik',
          ${params.sourcePeriod ?? null},
          ${params.fileName},
          'completed',
          ${totalRows},
          ${parsedRows.length},
          ${Math.max(invalidRows, 0)},
          ${sheetName},
          ${params.importedBy ?? null},
          NOW()
        )
      `);

      for (const row of parsedRows) {
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
            ${randomUUID()},
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
      }
    });

    return {
      batchId,
      category: 'teknik',
      sheetName,
      sourceFileName: params.fileName,
      sourcePeriod: params.sourcePeriod ?? null,
      totalRows,
      validRows: parsedRows.length,
      invalidRows: Math.max(invalidRows, 0),
      insertedRows: parsedRows.length,
      preview: parsedRows.slice(0, 5).map((row) => ({
        no: row.entryNo,
        date: formatDateForApi(row.entryDate),
        time: row.entryTime,
        equipment: row.equipment,
        frequencySection: row.frequencySection,
        incident: row.incident,
        sourceRowNumber: row.sourceRowNumber,
      })),
    };
  }

  async importAppEntries(params: ImportLogbookParams) {
    const { sheetName, rows, date1904 } = this.readImportWorkbook(
      params.buffer,
      APP_SHEET_NAME,
      'APP'
    );

    if (rows.length < APP_HEADER_ROW_INDEX) {
      throw new BadRequestException('Format file APP tidak sesuai. Header tabel tidak ditemukan.');
    }

    const parsedRows = parseAppRows(rows, date1904);
    if (parsedRows.length === 0) {
      throw new BadRequestException('Tidak ada baris Logbook APP yang valid untuk diimpor.');
    }

    const batchId = randomUUID();
    const totalRows = Math.max(rows.length - APP_HEADER_ROW_INDEX, 0);
    const invalidRows = totalRows - parsedRows.length;

    await this.prisma.$transaction(async (tx) => {
      await tx.$executeRaw(Prisma.sql`
        INSERT INTO logbook_import_batches (
          id, category, source_period, source_file_name, status,
          total_rows, valid_rows, invalid_rows, sheet_name, imported_by, completed_at
        ) VALUES (
          ${batchId},
          'app',
          ${params.sourcePeriod ?? null},
          ${params.fileName},
          'completed',
          ${totalRows},
          ${parsedRows.length},
          ${Math.max(invalidRows, 0)},
          ${sheetName},
          ${params.importedBy ?? null},
          NOW()
        )
      `);

      for (const row of parsedRows) {
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
            source_type
          ) VALUES (
            ${randomUUID()},
            ${row.entryNo},
            CAST(${formatDateForApi(row.entryDate)} AS DATE),
            ${row.entryTime},
            ${row.operationType},
            ${row.facility},
            ${row.callSign},
            ${row.description},
            'import_app'
          )
        `);
      }
    });

    return {
      batchId,
      category: 'app',
      sheetName,
      sourceFileName: params.fileName,
      sourcePeriod: params.sourcePeriod ?? null,
      totalRows,
      validRows: parsedRows.length,
      invalidRows: Math.max(invalidRows, 0),
      insertedRows: parsedRows.length,
      preview: parsedRows.slice(0, 5).map((row) => ({
        no: row.entryNo,
        date: formatDateForApi(row.entryDate),
        time: row.entryTime,
        operationType: row.operationType,
        facility: row.facility,
        callSign: row.callSign,
        description: row.description,
        sourceRowNumber: row.sourceRowNumber,
      })),
    };
  }

  async importTowerEntries(params: ImportLogbookParams) {
    const { sheetName, rows, date1904 } = this.readImportWorkbook(
      params.buffer,
      TOWER_SHEET_NAME,
      'TWR'
    );

    if (rows.length < TOWER_HEADER_ROW_INDEX) {
      throw new BadRequestException('Format file TWR tidak sesuai. Header tabel tidak ditemukan.');
    }

    const parsedRows = parseTowerRows(rows, date1904);
    if (parsedRows.length === 0) {
      throw new BadRequestException('Tidak ada baris Logbook TWR yang valid untuk diimpor.');
    }

    const batchId = randomUUID();
    const totalRows = Math.max(rows.length - TOWER_HEADER_ROW_INDEX, 0);
    const invalidRows = totalRows - parsedRows.length;

    await this.prisma.$transaction(async (tx) => {
      await tx.$executeRaw(Prisma.sql`
        INSERT INTO logbook_import_batches (
          id, category, source_period, source_file_name, status,
          total_rows, valid_rows, invalid_rows, sheet_name, imported_by, completed_at
        ) VALUES (
          ${batchId},
          'tower',
          ${params.sourcePeriod ?? null},
          ${params.fileName},
          'completed',
          ${totalRows},
          ${parsedRows.length},
          ${Math.max(invalidRows, 0)},
          ${sheetName},
          ${params.importedBy ?? null},
          NOW()
        )
      `);

      for (const row of parsedRows) {
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
            source_type
          ) VALUES (
            ${randomUUID()},
            ${row.entryNo},
            CAST(${formatDateForApi(row.entryDate)} AS DATE),
            ${row.entryTime},
            ${row.operationType},
            ${row.facility},
            ${row.callSign},
            ${row.description},
            'import_tower'
          )
        `);
      }
    });

    return {
      batchId,
      category: 'tower',
      sheetName,
      sourceFileName: params.fileName,
      sourcePeriod: params.sourcePeriod ?? null,
      totalRows,
      validRows: parsedRows.length,
      invalidRows: Math.max(invalidRows, 0),
      insertedRows: parsedRows.length,
      preview: parsedRows.slice(0, 5).map((row) => ({
        no: row.entryNo,
        date: formatDateForApi(row.entryDate),
        time: row.entryTime,
        operationType: row.operationType,
        facility: row.facility,
        callSign: row.callSign,
        description: row.description,
        sourceRowNumber: row.sourceRowNumber,
      })),
    };
  }

}
