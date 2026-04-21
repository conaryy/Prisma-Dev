import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../database/prisma.service';
import type { SemanticSearchFilters } from './semantic-search.filters';

type SearchEntryRow = {
  source_type: 'tower' | 'app' | 'teknik';
  source_id: string;
  entry_no: number;
  entry_date: string;
  entry_time: string;
  operation_type: string | null;
  facility: string | null;
  call_sign: string | null;
  description: string | null;
  equipment: string | null;
  frequency_section: string | null;
  incident: string | null;
};

@Injectable()
export class SemanticSearchPostgresService {
  constructor(private readonly prisma: PrismaService) {}

  private buildActiveBatchEntryCondition(
    tableName: 'tower_logbook_entries' | 'app_logbook_entries' | 'teknik_logbook_entries'
  ) {
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

  async fetchEntriesByRefs(refs: Array<{ sourceType: 'tower' | 'app' | 'teknik'; sourceId: string }>) {
    if (refs.length === 0) {
      return [] as SearchEntryRow[];
    }

    const idsByType = refs.reduce(
      (accumulator, ref) => {
        accumulator[ref.sourceType].push(ref.sourceId);
        return accumulator;
      },
      { tower: [] as string[], app: [] as string[], teknik: [] as string[] }
    );

    const queries: Prisma.Sql[] = [];

    if (idsByType.tower.length > 0) {
      queries.push(Prisma.sql`
        SELECT
          'tower' AS source_type,
          id AS source_id,
          entry_no,
          TO_CHAR(entry_date, 'YYYY-MM-DD') AS entry_date,
          entry_time,
          operation_type,
          facility,
          call_sign,
          description,
          NULL::text AS equipment,
          NULL::text AS frequency_section,
          NULL::text AS incident
        FROM tower_logbook_entries
        WHERE ${this.buildActiveBatchEntryCondition('tower_logbook_entries')}
          AND id = ANY(${idsByType.tower}::text[])
      `);
    }

    if (idsByType.app.length > 0) {
      queries.push(Prisma.sql`
        SELECT
          'app' AS source_type,
          id AS source_id,
          entry_no,
          TO_CHAR(entry_date, 'YYYY-MM-DD') AS entry_date,
          entry_time,
          operation_type,
          facility,
          call_sign,
          description,
          NULL::text AS equipment,
          NULL::text AS frequency_section,
          NULL::text AS incident
        FROM app_logbook_entries
        WHERE ${this.buildActiveBatchEntryCondition('app_logbook_entries')}
          AND id = ANY(${idsByType.app}::text[])
      `);
    }

    if (idsByType.teknik.length > 0) {
      queries.push(Prisma.sql`
        SELECT
          'teknik' AS source_type,
          id AS source_id,
          entry_no,
          TO_CHAR(entry_date, 'YYYY-MM-DD') AS entry_date,
          entry_time,
          NULL::text AS operation_type,
          NULL::text AS facility,
          NULL::text AS call_sign,
          NULL::text AS description,
          equipment,
          frequency_section,
          incident
        FROM teknik_logbook_entries
        WHERE ${this.buildActiveBatchEntryCondition('teknik_logbook_entries')}
          AND id = ANY(${idsByType.teknik}::text[])
      `);
    }

    if (queries.length === 0) {
      return [] as SearchEntryRow[];
    }

    return this.prisma.$queryRaw<SearchEntryRow[]>(Prisma.sql`
      ${Prisma.join(queries, ' UNION ALL ')}
    `);
  }

  async fetchAllActiveEntries() {
    return this.prisma.$queryRaw<SearchEntryRow[]>(Prisma.sql`
      SELECT *
      FROM (
        SELECT
          'tower' AS source_type,
          id AS source_id,
          entry_no,
          TO_CHAR(entry_date, 'YYYY-MM-DD') AS entry_date,
          entry_time,
          operation_type,
          facility,
          call_sign,
          description,
          NULL::text AS equipment,
          NULL::text AS frequency_section,
          NULL::text AS incident
        FROM tower_logbook_entries
        WHERE ${this.buildActiveBatchEntryCondition('tower_logbook_entries')}

        UNION ALL

        SELECT
          'app' AS source_type,
          id AS source_id,
          entry_no,
          TO_CHAR(entry_date, 'YYYY-MM-DD') AS entry_date,
          entry_time,
          operation_type,
          facility,
          call_sign,
          description,
          NULL::text AS equipment,
          NULL::text AS frequency_section,
          NULL::text AS incident
        FROM app_logbook_entries
        WHERE ${this.buildActiveBatchEntryCondition('app_logbook_entries')}

        UNION ALL

        SELECT
          'teknik' AS source_type,
          id AS source_id,
          entry_no,
          TO_CHAR(entry_date, 'YYYY-MM-DD') AS entry_date,
          entry_time,
          NULL::text AS operation_type,
          NULL::text AS facility,
          NULL::text AS call_sign,
          NULL::text AS description,
          equipment,
          frequency_section,
          incident
        FROM teknik_logbook_entries
        WHERE ${this.buildActiveBatchEntryCondition('teknik_logbook_entries')}
      ) combined_entries
      ORDER BY entry_date DESC, entry_time DESC
    `);
  }

  private buildStructuredConditions(
    filters: SemanticSearchFilters,
    tableName: 'tower_logbook_entries' | 'app_logbook_entries' | 'teknik_logbook_entries'
  ) {
    const conditions: Prisma.Sql[] = [this.buildActiveBatchEntryCondition(tableName)];

    if (filters.startDate) {
      conditions.push(Prisma.sql`${Prisma.raw(tableName)}.entry_date::date >= ${filters.startDate}::date`);
    }

    if (filters.endDate) {
      conditions.push(Prisma.sql`${Prisma.raw(tableName)}.entry_date::date <= ${filters.endDate}::date`);
    }

    return Prisma.sql`WHERE ${Prisma.join(conditions, ' AND ')}`;
  }

  async fetchStructuredEntries(filters: SemanticSearchFilters, limit = 10) {
    const queries: Prisma.Sql[] = [];
    const requestedSourceTypes = filters.sourceType
      ? [filters.sourceType]
      : (['tower', 'app', 'teknik'] as const);

    if (requestedSourceTypes.includes('tower')) {
      queries.push(Prisma.sql`
        SELECT
          'tower' AS source_type,
          id AS source_id,
          entry_no,
          TO_CHAR(entry_date, 'YYYY-MM-DD') AS entry_date,
          entry_time,
          operation_type,
          facility,
          call_sign,
          description,
          NULL::text AS equipment,
          NULL::text AS frequency_section,
          NULL::text AS incident
        FROM tower_logbook_entries
        ${this.buildStructuredConditions(filters, 'tower_logbook_entries')}
      `);
    }

    if (requestedSourceTypes.includes('app')) {
      queries.push(Prisma.sql`
        SELECT
          'app' AS source_type,
          id AS source_id,
          entry_no,
          TO_CHAR(entry_date, 'YYYY-MM-DD') AS entry_date,
          entry_time,
          operation_type,
          facility,
          call_sign,
          description,
          NULL::text AS equipment,
          NULL::text AS frequency_section,
          NULL::text AS incident
        FROM app_logbook_entries
        ${this.buildStructuredConditions(filters, 'app_logbook_entries')}
      `);
    }

    if (requestedSourceTypes.includes('teknik')) {
      queries.push(Prisma.sql`
        SELECT
          'teknik' AS source_type,
          id AS source_id,
          entry_no,
          TO_CHAR(entry_date, 'YYYY-MM-DD') AS entry_date,
          entry_time,
          NULL::text AS operation_type,
          NULL::text AS facility,
          NULL::text AS call_sign,
          NULL::text AS description,
          equipment,
          frequency_section,
          incident
        FROM teknik_logbook_entries
        ${this.buildStructuredConditions(filters, 'teknik_logbook_entries')}
      `);
    }

    if (queries.length === 0) {
      return [] as SearchEntryRow[];
    }

    return this.prisma.$queryRaw<SearchEntryRow[]>(Prisma.sql`
      SELECT *
      FROM (
        ${Prisma.join(queries, ' UNION ALL ')}
      ) combined_entries
      ORDER BY entry_date DESC, entry_time DESC
      LIMIT ${limit}
    `);
  }
}
