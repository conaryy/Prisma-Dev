import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { FacilityStatus, PersonnelStatus, Prisma } from '@prisma/client';
import { randomUUID } from 'node:crypto';
import { promises as fs } from 'node:fs';
import { basename, extname, join } from 'node:path';
import { PrismaService } from './database/prisma.service';

type PersonnelWithRelations = Prisma.PersonnelGetPayload<{
  include: {
    educationHistories: true;
    workHistories: true;
    trainingHistories: true;
  };
}>;

type SecurityFacilityRow = {
  id: string;
  slug: string;
  name: string;
  zone: string;
  status: FacilityStatus;
  coveragePercent: number;
  photoFileName: string | null;
  photoStorageName: string | null;
  photoMimeType: string | null;
  createdAt: Date;
  updatedAt: Date;
};

type SupervisionCategoryValue = 'AUDIT' | 'INSPEKSI' | 'TEST';
type SupervisionStatusValue = 'BELUM_TERLAKSANA' | 'TERLAKSANA' | 'PERLU_TINDAK_LANJUT';

type DbSupervisionActivityRow = {
  id: string;
  slug: string;
  title: string;
  category: SupervisionCategoryValue;
  location: string | null;
  inspectorNames: string[];
  scheduleLabel: string;
  scheduleYear: number;
  scheduleMonth: number | null;
  scheduleWeek: number | null;
  sourceDocument: string | null;
  status: SupervisionStatusValue;
  completedAt: Date | null;
  completionNote: string | null;
  createdAt: Date;
  updatedAt: Date;
};

type DbSupervisionEvidenceRow = {
  id: string;
  activityId: string;
  fileName: string;
  storageName: string;
  mimeType: string | null;
  sizeBytes: number;
  executionDate: Date | null;
  uploadedAt: Date;
};

type SupervisionActivityWithRelations = DbSupervisionActivityRow & {
  evidences: DbSupervisionEvidenceRow[];
};

type NavigationItem = {
  id: string;
  label: string;
  href?: string;
  icon: 'dashboard' | 'facility' | 'personnel' | 'license' | 'test' | 'document';
  description?: string;
  children?: NavigationItem[];
};

type QuickAction = {
  label: string;
  variant: 'primary' | 'secondary' | 'ghost';
};

type MetricCard = {
  label: string;
  value: string;
  delta: string;
  description: string;
};

type AlertPanel = {
  title: string;
  message: string;
  hint: string;
  tone: 'calm' | 'warning';
};

type ChartSeries = {
  id: string;
  label: string;
  color: string;
  values: number[];
};

type FacilityItem = {
  id: string;
  name: string;
  zone: string;
  status: 'Optimal' | 'Perlu Servis' | 'Terjadwal';
  coverage: string;
  updatedAt: string;
  photoUrl?: string | null;
};

type LicenseItem = {
  slug: string;
  name: string;
  location: string;
  documentPeriod: string;
  sourceDocument: string;
  licenseNumber: string;
  birthPlaceDate: string;
  address: string;
  maritalStatus: string;
  religion: string;
  status: 'Valid' | 'Perpanjangan' | 'Pelatihan';
  educationHistory: string[];
  workHistory: string[];
  trainingHistory: string[];
  refreshmentExisting: string;
  refreshmentPlan: string;
  recurrentExisting: string;
  recurrentPlan: string;
  photoUrl?: string | null;
};

type TestEvidenceItem = {
  id: string;
  name: string;
  url: string;
  executionDateIso: string;
  uploadedAt: string;
};

type TestItem = {
  id: string;
  title: string;
  category: 'Audit' | 'Inspeksi' | 'Pengunjungan';
  owner: string;
  location: string | null;
  inspector: string;
  date: string;
  score: string;
  status: 'Terjadwal' | 'Terlaksana' | 'Perlu Tindak Lanjut';
  completedAt: string | null;
  completedAtIso: string | null;
  completionNote: string | null;
  sourceDocument: string;
  scheduleYear: number;
  scheduleMonth: number | null;
  scheduleWeek: number | null;
  evidenceFiles: TestEvidenceItem[];
};

type DocumentItem = {
  id: string;
  title: string;
  owner: string;
  version: string;
  updatedAt: string;
  status: 'Aktif' | 'Review' | 'Revisi';
  url?: string;
};

type ActivityItem = {
  title: string;
  detail: string;
  timestamp: string;
};

type SupervisionSeedItem = {
  id: string;
  slug: string;
  title: string;
  category: SupervisionCategoryValue;
  location: string | null;
  inspectorNames: string[];
  scheduleLabel: string;
  scheduleYear: number;
  scheduleMonth: number | null;
  scheduleWeek: number | null;
  sourceDocument: string | null;
};

const SUPERVISION_SOURCE_DOCUMENT = 'Jadwal Kegiatan Pengawasan Keamanan - Tahun 2026.pdf';
const SUPERVISION_INSPECTOR_NAMES = ['Arif Hartono', 'Adhe Rafika Yulianti'];
const SUPERVISION_TEST_MONTHS = [
  { month: 2, label: 'Minggu II Februari 2026' },
  { month: 4, label: 'Minggu II April 2026' },
  { month: 6, label: 'Minggu II Juni 2026' },
  { month: 8, label: 'Minggu II Agustus 2026' },
  { month: 10, label: 'Minggu II Oktober 2026' },
  { month: 12, label: 'Minggu II Desember 2026' },
];

const SUPERVISION_ACTIVITY_SEED: SupervisionSeedItem[] = [
  {
    id: 'audit-internal-keamanan-2026',
    slug: 'audit-internal-keamanan-2026',
    title: 'Audit Internal Keamanan',
    category: 'AUDIT',
    location: 'Perum LPPNPI Cabang Surabaya',
    inspectorNames: SUPERVISION_INSPECTOR_NAMES,
    scheduleLabel: '1 kali dalam 2 tahun (internal)',
    scheduleYear: 2026,
    scheduleMonth: null,
    scheduleWeek: null,
    sourceDocument: SUPERVISION_SOURCE_DOCUMENT,
  },
  ...[
    'Cabang Surabaya',
    'KCP Banyuwangi',
    'KCP Malang',
    'KCP Sumenep',
    'Penyedia Personel AVSEC',
  ].map((location) => ({
    id: `inspeksi-${location.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-2026`,
    slug: `inspeksi-${location.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-2026`,
    title: 'Inspeksi Keamanan',
    category: 'INSPEKSI' as const,
    location,
    inspectorNames: SUPERVISION_INSPECTOR_NAMES,
    scheduleLabel: '1 kali dalam tahun 2026 (lokasi pelaksanaan menyesuaikan program pengawasan)',
    scheduleYear: 2026,
    scheduleMonth: null,
    scheduleWeek: null,
    sourceDocument: SUPERVISION_SOURCE_DOCUMENT,
  })),
  ...['Cabang Surabaya', 'KCP Banyuwangi', 'KCP Sumenep'].flatMap((location) =>
    SUPERVISION_TEST_MONTHS.map(({ month, label }) => ({
      id: `test-${location.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${month}-2026`,
      slug: `test-${location.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${month}-2026`,
      title: 'Pengunjungan Keamanan',
      category: 'TEST' as const,
      location,
      inspectorNames: SUPERVISION_INSPECTOR_NAMES,
      scheduleLabel: label,
      scheduleYear: 2026,
      scheduleMonth: month,
      scheduleWeek: 2,
      sourceDocument: SUPERVISION_SOURCE_DOCUMENT,
    }))
  ),
];

@Injectable()
export class DashboardService {
  private readonly uploadsRoot = join(__dirname, '..', 'uploads');
  private readonly personnelPhotoUploadsRoot = join(this.uploadsRoot, 'personnel-photos');
  private readonly facilityPhotoUploadsRoot = join(this.uploadsRoot, 'facility-photos');
  private readonly supervisionEvidenceUploadsRoot = join(this.uploadsRoot, 'supervision-evidence');
  private personnelPhotoStorageReadyPromise: Promise<void> | null = null;
  private facilityPhotoStorageReadyPromise: Promise<void> | null = null;
  private supervisionStorageReadyPromise: Promise<void> | null = null;

  constructor(private readonly prisma: PrismaService) {}

  private mapPersonnelStatus(status: PersonnelStatus): LicenseItem['status'] {
    if (status === PersonnelStatus.PERPANJANGAN) {
      return 'Perpanjangan';
    }

    if (status === PersonnelStatus.PELATIHAN) {
      return 'Pelatihan';
    }

    return 'Valid';
  }

  private toPersonnelStatus(status?: LicenseItem['status']): PersonnelStatus {
    if (status === 'Perpanjangan') {
      return PersonnelStatus.PERPANJANGAN;
    }

    if (status === 'Pelatihan') {
      return PersonnelStatus.PELATIHAN;
    }

    return PersonnelStatus.VALID;
  }

  private mapFacilityStatus(status: FacilityStatus): FacilityItem['status'] {
    if (status === FacilityStatus.OPTIMAL) {
      return 'Optimal';
    }

    if (status === FacilityStatus.PERLU_SERVIS) {
      return 'Perlu Servis';
    }

    return 'Terjadwal';
  }

  private toFacilityStatus(status?: FacilityItem['status']): FacilityStatus {
    if (status === 'Optimal') {
      return FacilityStatus.OPTIMAL;
    }

    if (status === 'Perlu Servis') {
      return FacilityStatus.PERLU_SERVIS;
    }

    return FacilityStatus.TERJADWAL;
  }

  private mapSupervisionCategory(category: SupervisionCategoryValue): TestItem['category'] {
    if (category === 'AUDIT') {
      return 'Audit';
    }

    if (category === 'INSPEKSI') {
      return 'Inspeksi';
    }

    return 'Pengunjungan';
  }

  private mapSupervisionStatus(status: SupervisionStatusValue): TestItem['status'] {
    if (status === 'TERLAKSANA') {
      return 'Terlaksana';
    }

    if (status === 'PERLU_TINDAK_LANJUT') {
      return 'Perlu Tindak Lanjut';
    }

    return 'Terjadwal';
  }

  private toSupervisionStatus(status: TestItem['status']): SupervisionStatusValue {
    if (status === 'Terlaksana') {
      return 'TERLAKSANA';
    }

    if (status === 'Perlu Tindak Lanjut') {
      return 'PERLU_TINDAK_LANJUT';
    }

    return 'BELUM_TERLAKSANA';
  }

  private slugify(value: string) {
    return value
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
  }

  private async createUniqueSlug(baseSlug: string) {
    const initialSlug = baseSlug || 'personil-baru';
    let nextSlug = initialSlug;
    let counter = 2;

    while (await this.prisma.personnel.findUnique({ where: { slug: nextSlug } })) {
      nextSlug = `${initialSlug}-${counter}`;
      counter += 1;
    }

    return nextSlug;
  }

  private async createUniqueFacilitySlug(baseSlug: string) {
    const initialSlug = baseSlug || 'fasilitas-baru';
    let nextSlug = initialSlug;
    let counter = 2;

    while (await this.prisma.securityFacility.findUnique({ where: { slug: nextSlug } })) {
      nextSlug = `${initialSlug}-${counter}`;
      counter += 1;
    }

    return nextSlug;
  }

  private formatDate(value: Date) {
    return new Intl.DateTimeFormat('id-ID', {
      dateStyle: 'medium',
      timeStyle: 'short',
    }).format(value);
  }

  private parseCompletedAtInput(value?: string | null) {
    if (!value) {
      return null;
    }

    const normalizedValue = value.trim();
    if (!normalizedValue) {
      return null;
    }

    const dateOnlyMatch = normalizedValue.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    const parsedDate = dateOnlyMatch
      ? new Date(`${normalizedValue}T12:00:00.000Z`)
      : new Date(normalizedValue);

    if (Number.isNaN(parsedDate.getTime())) {
      throw new BadRequestException('Tanggal pelaksanaan kegiatan pengawasan tidak valid.');
    }

    return parsedDate;
  }

  private parseCoveragePercent(value: number | string) {
    const normalizedValue = typeof value === 'number' ? value : Number.parseInt(String(value).trim(), 10);

    if (!Number.isFinite(normalizedValue) || Number.isNaN(normalizedValue)) {
      throw new BadRequestException('Coverage fasilitas harus berupa angka 0 sampai 100.');
    }

    const roundedValue = Math.round(normalizedValue);
    if (roundedValue < 0 || roundedValue > 100) {
      throw new BadRequestException('Coverage fasilitas harus berada di rentang 0 sampai 100.');
    }

    return roundedValue;
  }

  private facilityPhotoUrl(storageName: string) {
    return `/uploads/facility-photos/${storageName}`;
  }

  private personnelPhotoUrl(storageName: string) {
    return `/uploads/personnel-photos/${storageName}`;
  }

  private supervisionEvidenceUrl(storageName: string) {
    return `/uploads/supervision-evidence/${storageName}`;
  }

  private toEvidenceItem(evidence: DbSupervisionEvidenceRow): TestEvidenceItem {
    const executionDate = evidence.executionDate ?? evidence.uploadedAt;

    return {
      id: evidence.id,
      name: evidence.fileName,
      url: this.supervisionEvidenceUrl(evidence.storageName),
      executionDateIso: executionDate.toISOString(),
      uploadedAt: this.formatDate(evidence.uploadedAt),
    };
  }

  private toDocumentItemFromEvidence(
    activity: SupervisionActivityWithRelations,
    evidence: DbSupervisionEvidenceRow
  ): DocumentItem & { sortValue: number } {
    const categoryLabel = this.mapSupervisionCategory(activity.category);
    const ownerLabel = activity.location ? `${categoryLabel} · ${activity.location}` : categoryLabel;

    return {
      id: `evidence-${evidence.id}`,
      title: evidence.fileName,
      owner: ownerLabel,
      version: 'Evidence Upload',
      updatedAt: this.formatDate(evidence.uploadedAt),
      status: 'Aktif',
      url: this.supervisionEvidenceUrl(evidence.storageName),
      sortValue: evidence.uploadedAt.getTime(),
    };
  }

  private toFacilityItem(facility: SecurityFacilityRow): FacilityItem {
    return {
      id: facility.id,
      name: facility.name,
      zone: facility.zone,
      status: this.mapFacilityStatus(facility.status),
      coverage: `${facility.coveragePercent}%`,
      updatedAt: this.formatDate(facility.updatedAt),
      photoUrl: facility.photoStorageName ? this.facilityPhotoUrl(facility.photoStorageName) : null,
    };
  }

  private toPersonnelItem(person: PersonnelWithRelations): LicenseItem {
    return {
      slug: person.slug,
      name: person.name,
      location: person.location,
      documentPeriod: person.documentPeriod ?? '-',
      sourceDocument: person.sourceDocument ?? '-',
      licenseNumber: person.licenseNumber ?? '-',
      birthPlaceDate: person.birthPlaceDate ?? '-',
      address: person.address ?? '-',
      maritalStatus: person.maritalStatus ?? '-',
      religion: person.religion ?? '-',
      status: this.mapPersonnelStatus(person.status),
      educationHistory: person.educationHistories.map(
        (row: PersonnelWithRelations['educationHistories'][number]) => row.value
      ),
      workHistory: person.workHistories.map((row: PersonnelWithRelations['workHistories'][number]) => row.value),
      trainingHistory: person.trainingHistories.map(
        (row: PersonnelWithRelations['trainingHistories'][number]) => row.value
      ),
      refreshmentExisting: person.refreshmentExisting ?? '-',
      refreshmentPlan: person.refreshmentPlan ?? '-',
      recurrentExisting: person.recurrentExisting ?? '-',
      recurrentPlan: person.recurrentPlan ?? '-',
      photoUrl: person.photoStorageName ? this.personnelPhotoUrl(person.photoStorageName) : null,
    };
  }

  private toTestItem(activity: SupervisionActivityWithRelations): TestItem {
    const evidences = [...activity.evidences]
      .sort((left, right) => right.uploadedAt.getTime() - left.uploadedAt.getTime())
      .map((item) => this.toEvidenceItem(item));

    const evidenceSummary =
      evidences.length > 0 ? `${evidences.length} file evidence` : 'Belum ada evidence';

    return {
      id: activity.id,
      title: activity.category === 'TEST' ? 'Pengunjungan Keamanan' : activity.title,
      category: this.mapSupervisionCategory(activity.category),
      owner: activity.location ?? 'Perum LPPNPI Cabang Surabaya',
      location: activity.location,
      inspector: activity.inspectorNames.length ? activity.inspectorNames.join(', ') : '-',
      date: activity.scheduleLabel,
      score: evidenceSummary,
      status: this.mapSupervisionStatus(activity.status),
      completedAt: activity.completedAt ? this.formatDate(activity.completedAt) : null,
      completedAtIso: activity.completedAt ? activity.completedAt.toISOString() : null,
      completionNote: activity.completionNote ?? null,
      sourceDocument: activity.sourceDocument ?? '-',
      scheduleYear: activity.scheduleYear,
      scheduleMonth: activity.scheduleMonth,
      scheduleWeek: activity.scheduleWeek,
      evidenceFiles: evidences,
    };
  }

  private sortSupervisionActivities(items: SupervisionActivityWithRelations[]) {
    const categoryOrder: Record<SupervisionCategoryValue, number> = {
      AUDIT: 0,
      INSPEKSI: 1,
      TEST: 2,
    };

    return [...items].sort((left, right) => {
      const byCategory = categoryOrder[left.category] - categoryOrder[right.category];
      if (byCategory !== 0) {
        return byCategory;
      }

      const byMonth = (left.scheduleMonth ?? 99) - (right.scheduleMonth ?? 99);
      if (byMonth !== 0) {
        return byMonth;
      }

      const byLocation = (left.location ?? '').localeCompare(right.location ?? '', 'id');
      if (byLocation !== 0) {
        return byLocation;
      }

      return left.title.localeCompare(right.title, 'id');
    });
  }

  private async ensureSupervisionStorage() {
    if (!this.supervisionStorageReadyPromise) {
      this.supervisionStorageReadyPromise = this.setupSupervisionStorage().catch((error) => {
        this.supervisionStorageReadyPromise = null;
        throw error;
      });
    }

    await this.supervisionStorageReadyPromise;
  }

  private async ensureFacilityPhotoStorage() {
    if (!this.facilityPhotoStorageReadyPromise) {
      this.facilityPhotoStorageReadyPromise = fs
        .mkdir(this.facilityPhotoUploadsRoot, { recursive: true })
        .then(() => undefined)
        .catch((error) => {
          this.facilityPhotoStorageReadyPromise = null;
          throw error;
        });
    }

    await this.facilityPhotoStorageReadyPromise;
  }

  private async ensurePersonnelPhotoStorage() {
    if (!this.personnelPhotoStorageReadyPromise) {
      this.personnelPhotoStorageReadyPromise = fs
        .mkdir(this.personnelPhotoUploadsRoot, { recursive: true })
        .then(() => undefined)
        .catch((error) => {
          this.personnelPhotoStorageReadyPromise = null;
          throw error;
        });
    }

    await this.personnelPhotoStorageReadyPromise;
  }

  private async setupSupervisionStorage() {
    await this.prisma.$executeRawUnsafe(`
      DO $$
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'SupervisionCategory') THEN
          CREATE TYPE "SupervisionCategory" AS ENUM ('AUDIT', 'INSPEKSI', 'TEST');
        END IF;
      END
      $$;
    `);

    await this.prisma.$executeRawUnsafe(`
      DO $$
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'SupervisionStatus') THEN
          CREATE TYPE "SupervisionStatus" AS ENUM ('BELUM_TERLAKSANA', 'TERLAKSANA', 'PERLU_TINDAK_LANJUT');
        END IF;
      END
      $$;
    `);

    await this.prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "SupervisionActivity" (
        "id" TEXT PRIMARY KEY,
        "slug" TEXT NOT NULL UNIQUE,
        "title" TEXT NOT NULL,
        "category" "SupervisionCategory" NOT NULL,
        "location" TEXT,
        "inspectorNames" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
        "scheduleLabel" TEXT NOT NULL,
        "scheduleYear" INTEGER NOT NULL,
        "scheduleMonth" INTEGER,
        "scheduleWeek" INTEGER,
        "sourceDocument" TEXT,
        "status" "SupervisionStatus" NOT NULL DEFAULT 'BELUM_TERLAKSANA',
        "completedAt" TIMESTAMPTZ,
        "completionNote" TEXT,
        "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);

    await this.prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "SupervisionEvidence" (
        "id" TEXT PRIMARY KEY,
        "activityId" TEXT NOT NULL REFERENCES "SupervisionActivity"("id") ON DELETE CASCADE,
        "fileName" TEXT NOT NULL,
        "storageName" TEXT NOT NULL UNIQUE,
        "mimeType" TEXT,
        "sizeBytes" INTEGER NOT NULL,
        "executionDate" TIMESTAMPTZ,
        "uploadedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);

    await this.prisma.$executeRawUnsafe(`
      ALTER TABLE "SupervisionEvidence"
      ADD COLUMN IF NOT EXISTS "executionDate" TIMESTAMPTZ;
    `);

    await this.prisma.$executeRawUnsafe(`
      UPDATE "SupervisionEvidence"
      SET "executionDate" = COALESCE("executionDate", "uploadedAt")
      WHERE "executionDate" IS NULL;
    `);

    await this.prisma.$executeRawUnsafe(`
      CREATE INDEX IF NOT EXISTS "SupervisionActivity_schedule_idx"
      ON "SupervisionActivity" ("category", "scheduleYear", "scheduleMonth", "scheduleWeek");
    `);

    await this.prisma.$executeRawUnsafe(`
      CREATE INDEX IF NOT EXISTS "SupervisionEvidence_activity_uploaded_idx"
      ON "SupervisionEvidence" ("activityId", "uploadedAt");
    `);

    await this.prisma.$executeRawUnsafe(`
      CREATE INDEX IF NOT EXISTS "SupervisionEvidence_activity_execution_uploaded_idx"
      ON "SupervisionEvidence" ("activityId", "executionDate", "uploadedAt");
    `);

    await this.prisma.$executeRawUnsafe(`
      UPDATE "SupervisionActivity"
      SET "title" = 'Pengunjungan Keamanan'
      WHERE "category" = 'TEST'
        AND "title" IN ('Pengujian (Test) Keamanan', 'Pengujian Keamanan');
    `);

    const [countRow] = await this.prisma.$queryRaw<Array<{ count: bigint }>>(Prisma.sql`
      SELECT COUNT(*)::bigint AS "count" FROM "SupervisionActivity"
    `);

    if (Number(countRow?.count ?? 0) > 0) {
      return;
    }

    for (const item of SUPERVISION_ACTIVITY_SEED) {
      await this.prisma.$executeRaw(Prisma.sql`
        INSERT INTO "SupervisionActivity" (
          "id",
          "slug",
          "title",
          "category",
          "location",
          "inspectorNames",
          "scheduleLabel",
          "scheduleYear",
          "scheduleMonth",
          "scheduleWeek",
          "sourceDocument"
        )
        VALUES (
          ${item.id},
          ${item.slug},
          ${item.title},
          ${item.category}::"SupervisionCategory",
          ${item.location},
          ${item.inspectorNames},
          ${item.scheduleLabel},
          ${item.scheduleYear},
          ${item.scheduleMonth},
          ${item.scheduleWeek},
          ${item.sourceDocument}
        )
        ON CONFLICT ("slug") DO NOTHING
      `);
    }
  }

  private async loadSupervisionActivities(): Promise<SupervisionActivityWithRelations[]> {
    await this.ensureSupervisionStorage();

    const [activities, evidences] = await Promise.all([
      this.prisma.$queryRaw<DbSupervisionActivityRow[]>(Prisma.sql`
        SELECT
          "id",
          "slug",
          "title",
          "category",
          "location",
          "inspectorNames",
          "scheduleLabel",
          "scheduleYear",
          "scheduleMonth",
          "scheduleWeek",
          "sourceDocument",
          "status",
          "completedAt",
          "completionNote",
          "createdAt",
          "updatedAt"
        FROM "SupervisionActivity"
      `),
      this.prisma.$queryRaw<DbSupervisionEvidenceRow[]>(Prisma.sql`
        SELECT
          "id",
          "activityId",
          "fileName",
          "storageName",
          "mimeType",
          "sizeBytes",
          "executionDate",
          "uploadedAt"
        FROM "SupervisionEvidence"
        ORDER BY "uploadedAt" DESC
      `),
    ]);

    const evidenceMap = new Map<string, DbSupervisionEvidenceRow[]>();
    for (const evidence of evidences) {
      const nextItems = evidenceMap.get(evidence.activityId) ?? [];
      nextItems.push(evidence);
      evidenceMap.set(evidence.activityId, nextItems);
    }

    return activities.map((activity) => ({
      ...activity,
      evidences: evidenceMap.get(activity.id) ?? [],
    }));
  }

  private async requireSupervisionActivity(activityId: string) {
    const activities = await this.loadSupervisionActivities();
    const activity = activities.find((item) => item.id === activityId) ?? null;

    if (!activity) {
      throw new NotFoundException('Agenda pengawasan tidak ditemukan.');
    }

    return activity;
  }

  async getDashboard() {
    const navigation: NavigationItem[] = [
      {
        id: 'dashboard',
        label: 'Dashboard',
        href: '/dashboard',
        icon: 'dashboard',
        description: 'Ringkasan operasional keamanan harian.',
      },
      {
        id: 'fasilitas-keamanan',
        label: 'Fasilitas Keamanan',
        href: '/fasilitas-keamanan',
        icon: 'facility',
        description: 'Status CCTV, access gate, X-Ray, dan perimeter.',
      },
      {
        id: 'personil-keamanan',
        label: 'Personil Keamanan',
        href: '/personil-keamanan',
        icon: 'personnel',
        description: 'Data personel, lisensi, dan kesiapan shift operasional.',
      },
      {
        id: 'tes-keamanan',
        label: 'Program Pengawasan Keamanan',
        href: '/tes-keamanan',
        icon: 'test',
        description: 'Jadwal, evidence, dan status pelaksanaan pengawasan keamanan.',
      },
      {
        id: 'dokumen',
        label: 'Dokumen',
        href: '/dokumen',
        icon: 'document',
        description: 'SOP, eviden audit, dan kontrol revisi dokumen.',
      },
    ];

    const [facilityRows, personnelRows, supervisionRows] = await Promise.all([
      this.prisma.securityFacility.findMany({
        orderBy: [{ updatedAt: 'desc' }, { createdAt: 'desc' }, { name: 'asc' }],
      }),
      this.prisma.personnel.findMany({
        include: {
          educationHistories: true,
          workHistories: true,
          trainingHistories: true,
        },
        orderBy: [{ createdAt: 'desc' }, { name: 'asc' }],
      }),
      this.loadSupervisionActivities(),
    ]);

    const facilities: FacilityItem[] = facilityRows.map((item) => this.toFacilityItem(item as SecurityFacilityRow));

    const licenses: LicenseItem[] = personnelRows.map((item: PersonnelWithRelations) => this.toPersonnelItem(item));

    const tests = this.sortSupervisionActivities(supervisionRows).map((item) => this.toTestItem(item));

    const validPersonnelCount = licenses.filter((item) => item.status === 'Valid').length;
    const renewalPersonnelCount = licenses.filter((item) => item.status === 'Perpanjangan').length;
    const completedSupervisionCount = tests.filter((item) => item.status === 'Terlaksana').length;
    const followUpSupervisionCount = tests.filter(
      (item) => item.status === 'Perlu Tindak Lanjut'
    ).length;
    const scheduledSupervisionCount = tests.filter((item) => item.status === 'Terjadwal').length;
    const evidenceUploadCount = tests.reduce((total, item) => total + item.evidenceFiles.length, 0);

    const metrics: MetricCard[] = [
      {
        label: 'Fasilitas Aktif',
        value: '18',
        delta: '+2 unit bulan ini',
        description: 'CCTV, access control, perimeter, dan perangkat screening yang siap operasi.',
      },
      {
        label: 'Lisensi Valid',
        value: String(validPersonnelCount),
        delta: `${licenses.length ? Math.round((validPersonnelCount / licenses.length) * 100) : 0}% personel`,
        description: `${renewalPersonnelCount} personel masih dalam antrean perpanjangan lisensi aktif.`,
      },
      {
        label: 'Agenda Pengawasan',
        value: String(tests.length),
        delta: `${completedSupervisionCount} terlaksana`,
        description: `${scheduledSupervisionCount} agenda terjadwal dan ${followUpSupervisionCount} perlu tindak lanjut.`,
      },
      {
        label: 'Evidence Tersimpan',
        value: String(evidenceUploadCount),
        delta: `${followUpSupervisionCount} perlu review`,
        description: 'Evidence unggahan kegiatan pengawasan yang sudah tersimpan pada dashboard keamanan.',
      },
    ];

    const manualDocuments: Array<DocumentItem & { sortValue: number }> = [
      {
        id: 'doc-sop-access-gate',
        title: 'SOP Pemeriksaan Access Gate',
        owner: 'Compliance',
        version: 'v3.2',
        updatedAt: '27 Mar 2026',
        status: 'Aktif',
        sortValue: new Date('2026-03-27T08:00:00.000Z').getTime(),
      },
      {
        id: 'doc-checklist-cctv',
        title: 'Checklist Harian CCTV',
        owner: 'Control Room',
        version: 'v1.8',
        updatedAt: '30 Mar 2026',
        status: 'Aktif',
        sortValue: new Date('2026-03-30T08:00:00.000Z').getTime(),
      },
      {
        id: 'doc-escalation-alarm',
        title: 'Prosedur Escalation Alarm',
        owner: 'Security Lead',
        version: 'v2.0',
        updatedAt: '18 Mar 2026',
        status: 'Review',
        sortValue: new Date('2026-03-18T08:00:00.000Z').getTime(),
      },
      {
        id: 'doc-matriks-lisensi',
        title: 'Matriks Lisensi Personel',
        owner: 'HR Security',
        version: 'v4.1',
        updatedAt: '26 Mar 2026',
        status: 'Revisi',
        sortValue: new Date('2026-03-26T08:00:00.000Z').getTime(),
      },
    ];

    const uploadedDocuments = supervisionRows
      .flatMap((activity) =>
        activity.evidences.map((evidence) => this.toDocumentItemFromEvidence(activity, evidence))
      )
      .sort((left, right) => right.sortValue - left.sortValue);

    const documents: DocumentItem[] = [...uploadedDocuments, ...manualDocuments]
      .sort((left, right) => right.sortValue - left.sortValue)
      .map(({ sortValue: _sortValue, ...item }) => item);

    const activitiesFromSupervision = supervisionRows
      .flatMap((item): Array<{ title: string; detail: string; timestamp: string; value: number }> => {
        const updates: Array<{ title: string; detail: string; timestamp: string; value: number }> = [];
        const activityLabel = item.location
          ? `${this.mapSupervisionCategory(item.category)} ${item.location}`
          : item.title;

        if (item.completedAt) {
          updates.push({
            title: activityLabel,
            detail: `Status agenda diperbarui menjadi ${this.mapSupervisionStatus(item.status).toLowerCase()}.`,
            timestamp: this.formatDate(item.completedAt),
            value: item.completedAt.getTime(),
          });
        }

        const lastEvidence = item.evidences[0];
        if (lastEvidence) {
          updates.push({
            title: `Evidence ${item.location ?? item.title}`,
            detail: `${lastEvidence.fileName} diunggah untuk ${item.title.toLowerCase()}.`,
            timestamp: this.formatDate(lastEvidence.uploadedAt),
            value: lastEvidence.uploadedAt.getTime(),
          });
        }

        return updates;
      })
      .sort(
        (
          left: { title: string; detail: string; timestamp: string; value: number },
          right: { title: string; detail: string; timestamp: string; value: number }
        ) => right.value - left.value
      )
      .slice(0, 4)
      .map(
        ({
          value: _value,
          ...item
        }: {
          title: string;
          detail: string;
          timestamp: string;
          value: number;
        }) => item
      );

    const activities: ActivityItem[] =
      activitiesFromSupervision.length > 0
        ? activitiesFromSupervision
        : [
            {
              title: 'Program pengawasan 2026 berhasil dimuat',
              detail: 'Agenda audit, inspeksi, dan pengunjungan diambil dari dokumen kerja pengawasan keamanan tahun 2026.',
              timestamp: 'Hari ini',
            },
            {
              title: 'Evidence belum tersedia',
              detail: 'Unggah file evidence pada agenda yang sudah terlaksana agar status dashboard akurat.',
              timestamp: 'Hari ini',
            },
          ];

    return {
      generatedAt: new Date().toISOString(),
      organization: {
        name: 'Unit Keamanan PRISMA',
        branch: 'Perum LPPNPI Cabang Surabaya',
        stage: 'Tahap 1 Pengawasan',
      },
      navigation,
      hero: {
        eyebrow: 'Dashboard Keamanan',
        title: 'Halo, Tim Keamanan PRISMA Surabaya!',
        subtitle:
          'Ringkasan fasilitas, lisensi personel, program pengawasan keamanan, dan kontrol dokumen terbaru dalam satu panel.',
      },
      quickActions: [
        { label: 'User Manual', variant: 'secondary' },
        { label: 'Admin Manual', variant: 'ghost' },
        { label: 'Profil Unit', variant: 'secondary' },
        { label: 'Unduh Ringkasan', variant: 'primary' },
      ] as QuickAction[],
      metrics,
      alert: {
        title: 'Status Program Pengawasan',
        message: `${scheduledSupervisionCount} agenda terjadwal, ${followUpSupervisionCount} perlu tindak lanjut.`,
        hint: 'Unggah evidence pada agenda yang selesai agar pelaksanaan pengawasan tercatat dengan benar.',
        tone: scheduledSupervisionCount > 0 || followUpSupervisionCount > 0 ? 'warning' : 'calm',
      } as AlertPanel,
      chart: {
        title: 'Kesiapan Keamanan',
        subtitle: 'Tren pemenuhan fasilitas, lisensi, dan program pengawasan enam bulan terakhir.',
        labels: ['Okt', 'Nov', 'Des', 'Jan', 'Feb', 'Mar'],
        series: [
          {
            id: 'facility',
            label: 'Fasilitas',
            color: '#d9772b',
            values: [72, 76, 80, 82, 85, 88],
          },
          {
            id: 'license',
            label: 'Lisensi',
            color: '#14b8a6',
            values: [68, 71, 75, 78, 81, 85],
          },
          {
            id: 'test',
            label: 'Program',
            color: '#7f7065',
            values: [60, 63, 69, 73, 77, 80],
          },
        ] as ChartSeries[],
      },
      facilities,
      licenses,
      tests,
      documents,
      activities,
      spotlight: [
        {
          label: 'Agenda Total',
          value: String(tests.length),
          note: 'Agenda audit, inspeksi, dan pengunjungan berasal dari dokumen program kerja pengawasan 2026.',
        },
        {
          label: 'Terlaksana',
          value: String(completedSupervisionCount),
          note: 'Status terlaksana akan naik setelah evidence atau status pelaksanaan diinput.',
        },
        {
          label: 'Evidence',
          value: String(evidenceUploadCount),
          note: 'Jumlah file evidence yang terhubung ke agenda pengawasan keamanan.',
        },
      ],
    };
  }

  async createPersonnel(body: {
    name: string;
    location: string;
    status?: LicenseItem['status'];
    licenseNumber?: string;
    address?: string;
  }) {
    const name = body.name.trim();
    const location = body.location.trim();
    const slug = await this.createUniqueSlug(this.slugify(`${name}-${location}`));

    return this.prisma.personnel.create({
      data: {
        slug,
        name,
        location,
        documentPeriod: 'Ditambahkan Manual',
        sourceDocument: 'Input Dashboard',
        licenseNumber: body.licenseNumber?.trim() || '-',
        birthPlaceDate: '-',
        address: body.address?.trim() || '-',
        maritalStatus: '-',
        religion: '-',
        status: this.toPersonnelStatus(body.status),
        refreshmentExisting: '-',
        refreshmentPlan: '-',
        recurrentExisting: '-',
        recurrentPlan: '-',
      },
    });
  }

  private async savePersonnelPhoto(file: {
    originalname?: string;
    mimetype?: string;
    buffer?: Buffer;
  }) {
    if (!file?.buffer || !file.originalname) {
      return null;
    }

    if (!file.mimetype?.startsWith('image/')) {
      throw new BadRequestException('Foto personel harus berupa file gambar.');
    }

    await this.ensurePersonnelPhotoStorage();

    const safeOriginalName = basename(file.originalname).replace(/[^a-zA-Z0-9._-]+/g, '-');
    const extension = extname(safeOriginalName);
    const storageName = `${Date.now()}-${randomUUID()}${extension || ''}`;
    const targetPath = join(this.personnelPhotoUploadsRoot, storageName);
    await fs.writeFile(targetPath, file.buffer);

    return {
      fileName: safeOriginalName,
      mimeType: file.mimetype ?? null,
      storageName,
      targetPath,
    };
  }

  async uploadPersonnelPhoto(
    slug: string,
    photo?: {
      originalname?: string;
      mimetype?: string;
      buffer?: Buffer;
    }
  ) {
    const person = await this.prisma.personnel.findUnique({
      where: { slug },
    });

    if (!person) {
      throw new NotFoundException('Personel keamanan tidak ditemukan.');
    }

    const savedPhoto = await this.savePersonnelPhoto(photo ?? {});

    if (!savedPhoto) {
      throw new BadRequestException('Foto personel wajib diunggah.');
    }

    const previousStorageName = person.photoStorageName;

    try {
      const updatedPerson = await this.prisma.personnel.update({
        where: { slug },
        data: {
          photoFileName: savedPhoto.fileName,
          photoStorageName: savedPhoto.storageName,
          photoMimeType: savedPhoto.mimeType,
        },
        include: {
          educationHistories: true,
          workHistories: true,
          trainingHistories: true,
        },
      });

      if (previousStorageName) {
        const previousPath = join(this.personnelPhotoUploadsRoot, previousStorageName);
        await fs.unlink(previousPath).catch(() => undefined);
      }

      return this.toPersonnelItem(updatedPerson);
    } catch (error) {
      await fs.unlink(savedPhoto.targetPath).catch(() => undefined);
      throw error;
    }
  }

  private async saveFacilityPhoto(file: {
    originalname?: string;
    mimetype?: string;
    buffer?: Buffer;
  }) {
    if (!file?.buffer || !file.originalname) {
      return null;
    }

    if (!file.mimetype?.startsWith('image/')) {
      throw new BadRequestException('Foto alat keamanan harus berupa file gambar.');
    }

    await this.ensureFacilityPhotoStorage();

    const safeOriginalName = basename(file.originalname).replace(/[^a-zA-Z0-9._-]+/g, '-');
    const extension = extname(safeOriginalName);
    const storageName = `${Date.now()}-${randomUUID()}${extension || ''}`;
    const targetPath = join(this.facilityPhotoUploadsRoot, storageName);
    await fs.writeFile(targetPath, file.buffer);

    return {
      fileName: safeOriginalName,
      mimeType: file.mimetype ?? null,
      storageName,
      targetPath,
    };
  }

  async createFacility(body: {
    name: string;
    zone: string;
    status?: FacilityItem['status'];
    coveragePercent: number | string;
  }, photo?: {
    originalname?: string;
    mimetype?: string;
    buffer?: Buffer;
  }) {
    const name = body.name.trim();
    const zone = body.zone.trim();

    if (!name) {
      throw new BadRequestException('Nama alat keamanan wajib diisi.');
    }

    if (!zone) {
      throw new BadRequestException('Zona alat keamanan wajib diisi.');
    }

    const coveragePercent = this.parseCoveragePercent(body.coveragePercent);
    const slug = await this.createUniqueFacilitySlug(this.slugify(`${name}-${zone}`));
    const savedPhoto = await this.saveFacilityPhoto(photo ?? {});

    try {
      return await this.prisma.securityFacility.create({
        data: {
          slug,
          name,
          zone,
          status: this.toFacilityStatus(body.status),
          coveragePercent,
          photoFileName: savedPhoto?.fileName ?? null,
          photoStorageName: savedPhoto?.storageName ?? null,
          photoMimeType: savedPhoto?.mimeType ?? null,
        },
      });
    } catch (error) {
      if (savedPhoto?.targetPath) {
        await fs.unlink(savedPhoto.targetPath).catch(() => undefined);
      }

      throw error;
    }
  }

  async updateSupervisionStatus(
    activityId: string,
    input: {
      status: 'Terlaksana' | 'Perlu Tindak Lanjut';
      completedAt?: string | null;
      completionNote?: string | null;
      inspectorNames?: string[] | null;
    }
  ) {
    const activity = await this.requireSupervisionActivity(activityId);
    const nextStatus = this.toSupervisionStatus(input.status);
    const requestedCompletedAt = this.parseCompletedAtInput(input.completedAt);

    const completedAt =
      nextStatus === 'BELUM_TERLAKSANA' ? null : requestedCompletedAt ?? activity.completedAt ?? new Date();
    const trimmedCompletionNote = input.completionNote?.trim();
    const completionNote =
      nextStatus === 'BELUM_TERLAKSANA'
        ? null
        : trimmedCompletionNote
          ? trimmedCompletionNote
          : nextStatus === 'PERLU_TINDAK_LANJUT'
            ? 'Pelaksanaan membutuhkan tindak lanjut tambahan.'
            : null;
    const normalizedInspectorNames =
      input.inspectorNames === undefined
        ? activity.inspectorNames
        : Array.from(
            new Set(
              (input.inspectorNames ?? [])
                .map((name) => name.trim())
                .filter(Boolean)
            )
          );

    await this.ensureSupervisionStorage();
    await this.prisma.$executeRaw(Prisma.sql`
      UPDATE "SupervisionActivity"
      SET
        "status" = ${nextStatus}::"SupervisionStatus",
        "completedAt" = ${completedAt},
        "completionNote" = ${completionNote},
        "inspectorNames" = ${normalizedInspectorNames},
        "updatedAt" = NOW()
      WHERE "id" = ${activity.id}
    `);

    const updatedActivity = await this.requireSupervisionActivity(activity.id);

    return this.toTestItem(updatedActivity);
  }

  async uploadSupervisionEvidence(
    activityId: string,
    file: {
      originalname?: string;
      mimetype?: string;
      size?: number;
      buffer?: Buffer;
    }
  ) {
    const activity = await this.requireSupervisionActivity(activityId);

    if (!file?.buffer || !file.originalname) {
      throw new BadRequestException('File evidence wajib diunggah.');
    }

    await fs.mkdir(this.supervisionEvidenceUploadsRoot, { recursive: true });

    const safeOriginalName = basename(file.originalname).replace(/[^a-zA-Z0-9._-]+/g, '-');
    const extension = extname(safeOriginalName);
    const storageName = `${Date.now()}-${randomUUID()}${extension || ''}`;
    const targetPath = join(this.supervisionEvidenceUploadsRoot, storageName);
    await fs.writeFile(targetPath, file.buffer);

    try {
      await this.ensureSupervisionStorage();
      const executionDate = activity.completedAt ?? new Date();
      await this.prisma.$executeRaw(Prisma.sql`
        INSERT INTO "SupervisionEvidence" (
          "id",
          "activityId",
          "fileName",
          "storageName",
          "mimeType",
          "sizeBytes",
          "executionDate"
        )
        VALUES (
          ${randomUUID()},
          ${activity.id},
          ${file.originalname},
          ${storageName},
          ${file.mimetype || null},
          ${Number(file.size ?? file.buffer.byteLength ?? 0)},
          ${executionDate}
        )
      `);
    } catch (error) {
      await fs.rm(targetPath, { force: true });
      throw error;
    }

    const nextStatus = activity.status === 'BELUM_TERLAKSANA' ? 'TERLAKSANA' : activity.status;
    const nextCompletionNote = nextStatus === 'PERLU_TINDAK_LANJUT' ? activity.completionNote : null;

    await this.prisma.$executeRaw(Prisma.sql`
      UPDATE "SupervisionActivity"
      SET
        "status" = ${nextStatus}::"SupervisionStatus",
        "completedAt" = ${activity.completedAt ?? new Date()},
        "completionNote" = ${nextCompletionNote},
        "updatedAt" = NOW()
      WHERE "id" = ${activity.id}
    `);

    const updatedActivity = await this.requireSupervisionActivity(activity.id);

    return this.toTestItem(updatedActivity);
  }
}
