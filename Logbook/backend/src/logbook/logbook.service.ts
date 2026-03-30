import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../database/prisma.service';

type FindEntriesParams = {
  category: 'tower' | 'app' | 'teknik';
  limit: number;
};

@Injectable()
export class LogbookService {
  constructor(private readonly prisma: PrismaService) {}

  async findEntries(params: FindEntriesParams) {
    if (params.category === 'tower') {
      const rows = await this.prisma.$queryRaw<
        Array<{
          id: string;
          entryNo: number;
          entryDate: Date;
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
          entry_date AS "entryDate",
          entry_time AS "entryTime",
          operation_type AS "operationType",
          facility,
          call_sign AS "callSign",
          description,
          source_type AS "sourceType",
          created_at AS "createdAt",
          updated_at AS "updatedAt"
        FROM tower_logbook_entries
        ORDER BY entry_date DESC, entry_time DESC, entry_no DESC
        LIMIT ${params.limit}
      `);

      return rows.map((row) => ({
        id: row.id,
        no: row.entryNo,
        date: row.entryDate.toISOString().slice(0, 10),
        time: row.entryTime,
        operationType: row.operationType,
        facility: row.facility,
        callSign: row.callSign,
        description: row.description,
        sourceType: row.sourceType,
        createdAt: row.createdAt,
        updatedAt: row.updatedAt,
      }));
    }

    if (params.category === 'app') {
      const rows = await this.prisma.$queryRaw<
        Array<{
          id: string;
          entryNo: number;
          entryDate: Date;
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
          entry_date AS "entryDate",
          entry_time AS "entryTime",
          operation_type AS "operationType",
          facility,
          call_sign AS "callSign",
          description,
          source_type AS "sourceType",
          created_at AS "createdAt",
          updated_at AS "updatedAt"
        FROM app_logbook_entries
        ORDER BY entry_date DESC, entry_time DESC, entry_no DESC
        LIMIT ${params.limit}
      `);

      return rows.map((row) => ({
        id: row.id,
        no: row.entryNo,
        date: row.entryDate.toISOString().slice(0, 10),
        time: row.entryTime,
        operationType: row.operationType,
        facility: row.facility,
        callSign: row.callSign,
        description: row.description,
        sourceType: row.sourceType,
        createdAt: row.createdAt,
        updatedAt: row.updatedAt,
      }));
    }

    const rows = await this.prisma.$queryRaw<
      Array<{
        id: string;
        entryNo: number;
        entryDate: Date;
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
        entry_date AS "entryDate",
        entry_time AS "entryTime",
        equipment,
        frequency_section AS "frequencySection",
        incident,
        source_type AS "sourceType",
        created_at AS "createdAt",
        updated_at AS "updatedAt"
      FROM teknik_logbook_entries
      ORDER BY entry_date DESC, entry_time DESC, entry_no DESC
      LIMIT ${params.limit}
    `);

    return rows.map((row) => ({
      id: row.id,
      no: row.entryNo,
      date: row.entryDate.toISOString().slice(0, 10),
      time: row.entryTime,
      equipment: row.equipment,
      frequencyOrSection: row.frequencySection,
      incident: row.incident,
      sourceType: row.sourceType,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    }));
  }
}
