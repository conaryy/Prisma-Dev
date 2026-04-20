import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  async onModuleInit() {
    await this.$connect();
    await this.ensureLogbookTables();
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }

  private async ensureLogbookTables() {
    await this.$executeRaw(Prisma.sql`
      CREATE TABLE IF NOT EXISTS tower_logbook_entries (
        id TEXT PRIMARY KEY,
        entry_no INTEGER NOT NULL,
        entry_date DATE NOT NULL,
        entry_time TEXT NOT NULL,
        operation_type TEXT NOT NULL,
        facility TEXT NOT NULL,
        call_sign TEXT NOT NULL,
        description TEXT NOT NULL,
        import_batch_id TEXT NULL,
        source_type TEXT NOT NULL DEFAULT 'manual',
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);

    await this.$executeRaw(Prisma.sql`
      CREATE TABLE IF NOT EXISTS app_logbook_entries (
        id TEXT PRIMARY KEY,
        entry_no INTEGER NOT NULL,
        entry_date DATE NOT NULL,
        entry_time TEXT NOT NULL,
        operation_type TEXT NOT NULL,
        facility TEXT NOT NULL,
        call_sign TEXT NOT NULL,
        description TEXT NOT NULL,
        import_batch_id TEXT NULL,
        source_type TEXT NOT NULL DEFAULT 'manual',
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);

    await this.$executeRaw(Prisma.sql`
      CREATE TABLE IF NOT EXISTS teknik_logbook_entries (
        id TEXT PRIMARY KEY,
        entry_no INTEGER NOT NULL,
        entry_date DATE NOT NULL,
        entry_time TEXT NOT NULL,
        equipment TEXT NOT NULL,
        frequency_section TEXT NOT NULL,
        incident TEXT NOT NULL,
        import_batch_id TEXT NULL,
        source_type TEXT NOT NULL DEFAULT 'manual',
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);

    await this.$executeRaw(Prisma.sql`
      CREATE TABLE IF NOT EXISTS logbook_import_batches (
        id TEXT PRIMARY KEY,
        source_category TEXT NOT NULL,
        source_period TEXT NULL,
        reimport_of_batch_id TEXT NULL,
        is_active BOOLEAN NOT NULL DEFAULT TRUE,
        source_file_name TEXT NOT NULL,
        status TEXT NOT NULL,
        total_rows INTEGER NOT NULL DEFAULT 0,
        valid_rows INTEGER NOT NULL DEFAULT 0,
        invalid_rows INTEGER NOT NULL DEFAULT 0,
        sheet_name TEXT NULL,
        notes TEXT NULL,
        imported_by TEXT NULL,
        started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        completed_at TIMESTAMPTZ NULL
      );
    `);

    await this.$executeRaw(Prisma.sql`
      ALTER TABLE logbook_import_batches
      ADD COLUMN IF NOT EXISTS reimport_of_batch_id TEXT NULL;
    `);

    await this.$executeRaw(Prisma.sql`
      ALTER TABLE logbook_import_batches
      ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT TRUE;
    `);

    await this.$executeRaw(Prisma.sql`
      CREATE TABLE IF NOT EXISTS logbook_import_sources (
        id TEXT PRIMARY KEY,
        batch_id TEXT NOT NULL,
        sheet_name TEXT NOT NULL,
        row_number INTEGER NOT NULL,
        raw_date_value TEXT NULL,
        raw_time_value TEXT NULL,
        raw_payload TEXT NOT NULL
      );
    `);

    await this.$executeRaw(Prisma.sql`
      CREATE TABLE IF NOT EXISTS logbook_import_errors (
        id TEXT PRIMARY KEY,
        batch_id TEXT NOT NULL,
        sheet_name TEXT NOT NULL,
        row_number INTEGER NOT NULL,
        field_name TEXT NOT NULL,
        error_code TEXT NOT NULL,
        error_message TEXT NOT NULL,
        raw_payload TEXT NOT NULL
      );
    `);

    await this.$executeRaw(Prisma.sql`
      CREATE TABLE IF NOT EXISTS logbook_audit_trails (
        id TEXT PRIMARY KEY,
        actor_id TEXT NOT NULL,
        action TEXT NOT NULL,
        target_type TEXT NOT NULL,
        target_id TEXT NULL,
        batch_id TEXT NULL,
        metadata TEXT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);

    await this.$executeRaw(Prisma.sql`
      CREATE TABLE IF NOT EXISTS logbook_integrity_records (
        id TEXT PRIMARY KEY,
        batch_id TEXT NULL,
        record_type TEXT NOT NULL,
        record_ref TEXT NULL,
        hash_type TEXT NOT NULL,
        hash_value TEXT NOT NULL,
        anchored BOOLEAN NOT NULL DEFAULT FALSE,
        anchored_at TIMESTAMPTZ NULL,
        anchor_ref TEXT NULL
      );
    `);

    await this.$executeRaw(Prisma.sql`
      ALTER TABLE tower_logbook_entries
      ADD COLUMN IF NOT EXISTS import_batch_id TEXT NULL;
    `);

    await this.$executeRaw(Prisma.sql`
      ALTER TABLE app_logbook_entries
      ADD COLUMN IF NOT EXISTS import_batch_id TEXT NULL;
    `);

    await this.$executeRaw(Prisma.sql`
      ALTER TABLE teknik_logbook_entries
      ADD COLUMN IF NOT EXISTS import_batch_id TEXT NULL;
    `);

    await this.normalizeLegacyLogbookColumns();
    await this.ensureTimestampDefaults();

    await this.$executeRaw(Prisma.sql`
      CREATE INDEX IF NOT EXISTS idx_tower_logbook_date_time
      ON tower_logbook_entries (entry_date DESC, entry_time DESC);
    `);
    await this.$executeRaw(Prisma.sql`
      CREATE INDEX IF NOT EXISTS idx_app_logbook_date_time
      ON app_logbook_entries (entry_date DESC, entry_time DESC);
    `);
    await this.$executeRaw(Prisma.sql`
      CREATE INDEX IF NOT EXISTS idx_teknik_logbook_date_time
      ON teknik_logbook_entries (entry_date DESC, entry_time DESC);
    `);
    await this.$executeRaw(Prisma.sql`
      CREATE INDEX IF NOT EXISTS idx_tower_logbook_import_batch
      ON tower_logbook_entries (import_batch_id);
    `);
    await this.$executeRaw(Prisma.sql`
      CREATE INDEX IF NOT EXISTS idx_app_logbook_import_batch
      ON app_logbook_entries (import_batch_id);
    `);
    await this.$executeRaw(Prisma.sql`
      CREATE INDEX IF NOT EXISTS idx_teknik_logbook_import_batch
      ON teknik_logbook_entries (import_batch_id);
    `);
    await this.$executeRaw(Prisma.sql`
      CREATE INDEX IF NOT EXISTS idx_logbook_import_batches_category_created
      ON logbook_import_batches (source_category, started_at DESC);
    `);
    await this.$executeRaw(Prisma.sql`
      CREATE INDEX IF NOT EXISTS idx_logbook_import_batches_category_period_active
      ON logbook_import_batches (source_category, source_period, is_active);
    `);
    await this.$executeRaw(Prisma.sql`
      CREATE INDEX IF NOT EXISTS idx_logbook_import_batches_status_created
      ON logbook_import_batches (status, started_at DESC);
    `);
    await this.$executeRaw(Prisma.sql`
      CREATE INDEX IF NOT EXISTS idx_logbook_import_sources_batch_row
      ON logbook_import_sources (batch_id, row_number);
    `);
    await this.$executeRaw(Prisma.sql`
      CREATE INDEX IF NOT EXISTS idx_logbook_import_errors_batch_row
      ON logbook_import_errors (batch_id, row_number);
    `);
    await this.$executeRaw(Prisma.sql`
      CREATE INDEX IF NOT EXISTS idx_logbook_audit_trails_batch_created
      ON logbook_audit_trails (batch_id, created_at);
    `);
    await this.$executeRaw(Prisma.sql`
      CREATE INDEX IF NOT EXISTS idx_logbook_integrity_records_batch
      ON logbook_integrity_records (batch_id);
    `);
  }

  private async normalizeLegacyLogbookColumns() {
    const tableRenames = [
      ['tower_logbook_entries', 'entryNo', 'entry_no'],
      ['tower_logbook_entries', 'entryno', 'entry_no'],
      ['tower_logbook_entries', 'entryDate', 'entry_date'],
      ['tower_logbook_entries', 'entrydate', 'entry_date'],
      ['tower_logbook_entries', 'entryTime', 'entry_time'],
      ['tower_logbook_entries', 'entrytime', 'entry_time'],
      ['tower_logbook_entries', 'operationType', 'operation_type'],
      ['tower_logbook_entries', 'operationtype', 'operation_type'],
      ['tower_logbook_entries', 'callSign', 'call_sign'],
      ['tower_logbook_entries', 'callsign', 'call_sign'],
      ['tower_logbook_entries', 'sourceType', 'source_type'],
      ['tower_logbook_entries', 'sourcetype', 'source_type'],
      ['tower_logbook_entries', 'createdAt', 'created_at'],
      ['tower_logbook_entries', 'createdat', 'created_at'],
      ['tower_logbook_entries', 'updatedAt', 'updated_at'],
      ['tower_logbook_entries', 'updatedat', 'updated_at'],
      ['app_logbook_entries', 'entryNo', 'entry_no'],
      ['app_logbook_entries', 'entryno', 'entry_no'],
      ['app_logbook_entries', 'entryDate', 'entry_date'],
      ['app_logbook_entries', 'entrydate', 'entry_date'],
      ['app_logbook_entries', 'entryTime', 'entry_time'],
      ['app_logbook_entries', 'entrytime', 'entry_time'],
      ['app_logbook_entries', 'operationType', 'operation_type'],
      ['app_logbook_entries', 'operationtype', 'operation_type'],
      ['app_logbook_entries', 'callSign', 'call_sign'],
      ['app_logbook_entries', 'callsign', 'call_sign'],
      ['app_logbook_entries', 'sourceType', 'source_type'],
      ['app_logbook_entries', 'sourcetype', 'source_type'],
      ['app_logbook_entries', 'createdAt', 'created_at'],
      ['app_logbook_entries', 'createdat', 'created_at'],
      ['app_logbook_entries', 'updatedAt', 'updated_at'],
      ['app_logbook_entries', 'updatedat', 'updated_at'],
      ['teknik_logbook_entries', 'entryNo', 'entry_no'],
      ['teknik_logbook_entries', 'entryno', 'entry_no'],
      ['teknik_logbook_entries', 'entryDate', 'entry_date'],
      ['teknik_logbook_entries', 'entrydate', 'entry_date'],
      ['teknik_logbook_entries', 'entryTime', 'entry_time'],
      ['teknik_logbook_entries', 'entrytime', 'entry_time'],
      ['teknik_logbook_entries', 'frequencySection', 'frequency_section'],
      ['teknik_logbook_entries', 'frequencysection', 'frequency_section'],
      ['teknik_logbook_entries', 'importBatchId', 'import_batch_id'],
      ['teknik_logbook_entries', 'importbatchid', 'import_batch_id'],
      ['teknik_logbook_entries', 'sourceType', 'source_type'],
      ['teknik_logbook_entries', 'sourcetype', 'source_type'],
      ['teknik_logbook_entries', 'createdAt', 'created_at'],
      ['teknik_logbook_entries', 'createdat', 'created_at'],
      ['teknik_logbook_entries', 'updatedAt', 'updated_at'],
      ['teknik_logbook_entries', 'updatedat', 'updated_at'],
    ] as const;

    for (const [tableName, fromColumn, toColumn] of tableRenames) {
      await this.$executeRawUnsafe(`
        DO $$
        BEGIN
          IF EXISTS (
            SELECT 1
            FROM information_schema.columns
            WHERE table_name = '${tableName}'
              AND column_name = '${fromColumn}'
          ) AND NOT EXISTS (
            SELECT 1
            FROM information_schema.columns
            WHERE table_name = '${tableName}'
              AND column_name = '${toColumn}'
          ) THEN
            EXECUTE 'ALTER TABLE ${tableName} RENAME COLUMN "${fromColumn}" TO ${toColumn}';
          ELSIF EXISTS (
            SELECT 1
            FROM information_schema.columns
            WHERE table_name = '${tableName}'
              AND column_name = '${fromColumn}'
          ) AND EXISTS (
            SELECT 1
            FROM information_schema.columns
            WHERE table_name = '${tableName}'
              AND column_name = '${toColumn}'
          ) THEN
            EXECUTE 'UPDATE ${tableName} SET ${toColumn} = COALESCE(${toColumn}, "${fromColumn}") WHERE "${fromColumn}" IS NOT NULL';
            EXECUTE 'ALTER TABLE ${tableName} DROP COLUMN "${fromColumn}"';
          END IF;
        END
        $$;
      `);
    }
  }

  private async ensureTimestampDefaults() {
    const tableNames = [
      'tower_logbook_entries',
      'app_logbook_entries',
      'teknik_logbook_entries',
    ] as const;

    for (const tableName of tableNames) {
      await this.$executeRawUnsafe(`
        ALTER TABLE ${tableName}
        ALTER COLUMN created_at SET DEFAULT CURRENT_TIMESTAMP;
      `);
    }

    await this.$executeRawUnsafe(`
      ALTER TABLE logbook_import_batches
      ALTER COLUMN started_at SET DEFAULT CURRENT_TIMESTAMP;
    `);

    await this.$executeRawUnsafe(`
      ALTER TABLE tower_logbook_entries
      ALTER COLUMN updated_at SET DEFAULT CURRENT_TIMESTAMP;
    `);
    await this.$executeRawUnsafe(`
      ALTER TABLE app_logbook_entries
      ALTER COLUMN updated_at SET DEFAULT CURRENT_TIMESTAMP;
    `);
    await this.$executeRawUnsafe(`
      ALTER TABLE teknik_logbook_entries
      ALTER COLUMN updated_at SET DEFAULT CURRENT_TIMESTAMP;
    `);
  }
}
