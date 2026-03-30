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
        source_type TEXT NOT NULL DEFAULT 'manual',
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);

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
  }
}
