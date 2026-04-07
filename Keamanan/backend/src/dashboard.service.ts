import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PersonnelStatus, Prisma } from '@prisma/client';
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
  name: string;
  zone: string;
  status: 'Optimal' | 'Perlu Servis' | 'Terjadwal';
  coverage: string;
  updatedAt: string;
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
};

type TestEvidenceItem = {
  id: string;
  name: string;
  url: string;
  uploadedAt: string;
};

type TestItem = {
  id: string;
  title: string;
  category: 'Audit' | 'Inspeksi' | 'Test';
  owner: string;
  inspector: string;
  date: string;
  score: string;
  status: 'Belum Terlaksana' | 'Terlaksana' | 'Perlu Tindak Lanjut';
  completedAt: string | null;
  completionNote: string | null;
  sourceDocument: string;
  evidenceFiles: TestEvidenceItem[];
};

type DocumentItem = {
  title: string;
  owner: string;
  version: string;
  updatedAt: string;
  status: 'Aktif' | 'Review' | 'Revisi';
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
      title: 'Pengujian (Test) Keamanan',
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
  private readonly supervisionEvidenceUploadsRoot = join(this.uploadsRoot, 'supervision-evidence');
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

  private mapSupervisionCategory(category: SupervisionCategoryValue): TestItem['category'] {
    if (category === 'AUDIT') {
      return 'Audit';
    }

    if (category === 'INSPEKSI') {
      return 'Inspeksi';
    }

    return 'Test';
  }

  private mapSupervisionStatus(status: SupervisionStatusValue): TestItem['status'] {
    if (status === 'TERLAKSANA') {
      return 'Terlaksana';
    }

    if (status === 'PERLU_TINDAK_LANJUT') {
      return 'Perlu Tindak Lanjut';
    }

    return 'Belum Terlaksana';
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

  private formatDate(value: Date) {
    return new Intl.DateTimeFormat('id-ID', {
      dateStyle: 'medium',
      timeStyle: 'short',
    }).format(value);
  }

  private supervisionEvidenceUrl(storageName: string) {
    return `/uploads/supervision-evidence/${storageName}`;
  }

  private toEvidenceItem(evidence: DbSupervisionEvidenceRow): TestEvidenceItem {
    return {
      id: evidence.id,
      name: evidence.fileName,
      url: this.supervisionEvidenceUrl(evidence.storageName),
      uploadedAt: this.formatDate(evidence.uploadedAt),
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
      title: activity.title,
      category: this.mapSupervisionCategory(activity.category),
      owner: activity.location ?? 'Perum LPPNPI Cabang Surabaya',
      inspector: activity.inspectorNames.join(', '),
      date: activity.scheduleLabel,
      score: evidenceSummary,
      status: this.mapSupervisionStatus(activity.status),
      completedAt: activity.completedAt ? this.formatDate(activity.completedAt) : null,
      completionNote: activity.completionNote ?? null,
      sourceDocument: activity.sourceDocument ?? '-',
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
        "uploadedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);

    await this.prisma.$executeRawUnsafe(`
      CREATE INDEX IF NOT EXISTS "SupervisionActivity_schedule_idx"
      ON "SupervisionActivity" ("category", "scheduleYear", "scheduleMonth", "scheduleWeek");
    `);

    await this.prisma.$executeRawUnsafe(`
      CREATE INDEX IF NOT EXISTS "SupervisionEvidence_activity_uploaded_idx"
      ON "SupervisionEvidence" ("activityId", "uploadedAt");
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
          "sourceDocument",
          "createdAt",
          "updatedAt"
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
          ${item.sourceDocument},
          NOW(),
          NOW()
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

    const [personnelRows, supervisionRows] = await Promise.all([
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

    const licenses: LicenseItem[] = personnelRows.map((item: PersonnelWithRelations) => ({
      slug: item.slug,
      name: item.name,
      location: item.location,
      documentPeriod: item.documentPeriod ?? '-',
      sourceDocument: item.sourceDocument ?? '-',
      licenseNumber: item.licenseNumber ?? '-',
      birthPlaceDate: item.birthPlaceDate ?? '-',
      address: item.address ?? '-',
      maritalStatus: item.maritalStatus ?? '-',
      religion: item.religion ?? '-',
      status: this.mapPersonnelStatus(item.status),
      educationHistory: item.educationHistories.map(
        (row: PersonnelWithRelations['educationHistories'][number]) => row.value
      ),
      workHistory: item.workHistories.map((row: PersonnelWithRelations['workHistories'][number]) => row.value),
      trainingHistory: item.trainingHistories.map(
        (row: PersonnelWithRelations['trainingHistories'][number]) => row.value
      ),
      refreshmentExisting: item.refreshmentExisting ?? '-',
      refreshmentPlan: item.refreshmentPlan ?? '-',
      recurrentExisting: item.recurrentExisting ?? '-',
      recurrentPlan: item.recurrentPlan ?? '-',
    }));

    const tests = this.sortSupervisionActivities(supervisionRows).map((item) => this.toTestItem(item));

    const validPersonnelCount = licenses.filter((item) => item.status === 'Valid').length;
    const renewalPersonnelCount = licenses.filter((item) => item.status === 'Perpanjangan').length;
    const completedSupervisionCount = tests.filter((item) => item.status === 'Terlaksana').length;
    const followUpSupervisionCount = tests.filter(
      (item) => item.status === 'Perlu Tindak Lanjut'
    ).length;
    const pendingSupervisionCount = tests.filter(
      (item) => item.status === 'Belum Terlaksana'
    ).length;
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
        description: `${pendingSupervisionCount} agenda belum terlaksana dan ${followUpSupervisionCount} perlu tindak lanjut.`,
      },
      {
        label: 'Evidence Tersimpan',
        value: String(evidenceUploadCount),
        delta: `${followUpSupervisionCount} perlu review`,
        description: 'Evidence unggahan kegiatan pengawasan yang sudah tersimpan pada dashboard keamanan.',
      },
    ];

    const facilities: FacilityItem[] = [
      {
        name: 'CCTV Perimeter Timur',
        zone: 'Zona Airside',
        status: 'Optimal',
        coverage: '98%',
        updatedAt: '30 Mar 2026, 08:15',
      },
      {
        name: 'Access Gate Cargo',
        zone: 'Zona Cargo',
        status: 'Perlu Servis',
        coverage: '76%',
        updatedAt: '29 Mar 2026, 17:40',
      },
      {
        name: 'X-Ray Checkpoint Utama',
        zone: 'Terminal Kedatangan',
        status: 'Optimal',
        coverage: '100%',
        updatedAt: '30 Mar 2026, 06:25',
      },
      {
        name: 'Pagar Perimeter Selatan',
        zone: 'Zona Restricted',
        status: 'Terjadwal',
        coverage: '88%',
        updatedAt: '31 Mar 2026, 09:00',
      },
    ];

    const documents: DocumentItem[] = [
      {
        title: 'SOP Pemeriksaan Access Gate',
        owner: 'Compliance',
        version: 'v3.2',
        updatedAt: '27 Mar 2026',
        status: 'Aktif',
      },
      {
        title: 'Checklist Harian CCTV',
        owner: 'Control Room',
        version: 'v1.8',
        updatedAt: '30 Mar 2026',
        status: 'Aktif',
      },
      {
        title: 'Prosedur Escalation Alarm',
        owner: 'Security Lead',
        version: 'v2.0',
        updatedAt: '18 Mar 2026',
        status: 'Review',
      },
      {
        title: 'Matriks Lisensi Personel',
        owner: 'HR Security',
        version: 'v4.1',
        updatedAt: '26 Mar 2026',
        status: 'Revisi',
      },
    ];

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
              detail: 'Agenda audit, inspeksi, dan test diambil dari dokumen kerja pengawasan keamanan tahun 2026.',
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
        message: `${pendingSupervisionCount} agenda belum terlaksana, ${followUpSupervisionCount} perlu tindak lanjut.`,
        hint: 'Unggah evidence pada agenda yang selesai agar pelaksanaan pengawasan tercatat dengan benar.',
        tone: pendingSupervisionCount > 0 || followUpSupervisionCount > 0 ? 'warning' : 'calm',
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
          note: 'Agenda audit, inspeksi, dan test berasal dari dokumen program kerja pengawasan 2026.',
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

  async updateSupervisionStatus(activityId: string, status: TestItem['status']) {
    const activity = await this.requireSupervisionActivity(activityId);
    const nextStatus = this.toSupervisionStatus(status);

    const completedAt =
      nextStatus === 'BELUM_TERLAKSANA' ? null : activity.completedAt ?? new Date();
    const completionNote =
      nextStatus === 'BELUM_TERLAKSANA'
        ? null
        : nextStatus === 'PERLU_TINDAK_LANJUT'
          ? 'Pelaksanaan membutuhkan tindak lanjut tambahan.'
          : null;

    await this.ensureSupervisionStorage();
    await this.prisma.$executeRaw(Prisma.sql`
      UPDATE "SupervisionActivity"
      SET
        "status" = ${nextStatus}::"SupervisionStatus",
        "completedAt" = ${completedAt},
        "completionNote" = ${completionNote},
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
      await this.prisma.$executeRaw(Prisma.sql`
        INSERT INTO "SupervisionEvidence" (
          "id",
          "activityId",
          "fileName",
          "storageName",
          "mimeType",
          "sizeBytes"
        )
        VALUES (
          ${randomUUID()},
          ${activity.id},
          ${file.originalname},
          ${storageName},
          ${file.mimetype || null},
          ${Number(file.size ?? file.buffer.byteLength ?? 0)}
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
