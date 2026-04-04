import { Injectable } from '@nestjs/common';
import { PersonnelStatus, Prisma } from '@prisma/client';
import { PrismaService } from './database/prisma.service';

type PersonnelWithRelations = Prisma.PersonnelGetPayload<{
  include: {
    educationHistories: true;
    workHistories: true;
    trainingHistories: true;
  };
}>;

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

type TestItem = {
  title: string;
  owner: string;
  date: string;
  score: string;
  status: 'Selesai' | 'Terjadwal' | 'Perlu Tindak Lanjut';
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

@Injectable()
export class DashboardService {
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
        description: 'Jadwal, program, dan tindak lanjut pengawasan keamanan.',
      },
      {
        id: 'dokumen',
        label: 'Dokumen',
        href: '/dokumen',
        icon: 'document',
        description: 'SOP, eviden audit, dan kontrol revisi dokumen.',
      },
    ];

    const personnelRows: PersonnelWithRelations[] = await this.prisma.personnel.findMany({
      include: {
        educationHistories: true,
        workHistories: true,
        trainingHistories: true,
      },
      orderBy: [{ createdAt: 'desc' }, { name: 'asc' }],
    });

    const licenses: LicenseItem[] = personnelRows.map((item) => ({
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

    const validPersonnelCount = licenses.filter((item) => item.status === 'Valid').length;
    const renewalPersonnelCount = licenses.filter((item) => item.status === 'Perpanjangan').length;

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
        label: 'Tes Bulan Ini',
        value: '07',
        delta: '3 agenda berjalan',
        description: 'Simulasi, random screening, dan tabletop exercise yang sudah dijadwalkan.',
      },
      {
        label: 'Dokumen Terkendali',
        value: '38',
        delta: '4 perlu revisi',
        description: 'Dokumen keamanan yang masih aktif dan terhubung ke versi terbaru.',
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

    const tests: TestItem[] = [
      {
        title: 'Simulasi Akses Tidak Sah',
        owner: 'Tim Compliance',
        date: '04 Apr 2026',
        score: '94/100',
        status: 'Terjadwal',
      },
      {
        title: 'Random Screening Personel',
        owner: 'Shift B',
        date: '28 Mar 2026',
        score: '88/100',
        status: 'Selesai',
      },
      {
        title: 'Tabletop Exercise Ancaman Bagasi',
        owner: 'Joint Ops',
        date: '11 Apr 2026',
        score: 'Menunggu',
        status: 'Perlu Tindak Lanjut',
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

    const activities: ActivityItem[] = [
      {
        title: 'Access Gate Cargo masuk jadwal servis',
        detail: 'Ticket pemeliharaan diterbitkan dan vendor standby pukul 09:30.',
        timestamp: 'Hari ini, 07:45',
      },
      {
        title: 'Checklist Harian CCTV ditandatangani',
        detail: 'Seluruh kamera perimeter shift pagi tervalidasi tanpa blind spot.',
        timestamp: 'Hari ini, 06:40',
      },
      {
        title: 'Dua lisensi masuk antrean perpanjangan',
        detail: 'Supervisor shift A dan operator CCTV perlu pembaruan sebelum pertengahan April.',
        timestamp: '29 Mar 2026, 16:20',
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
        title: 'Notifikasi Prioritas',
        message: '2 lisensi akan kedaluwarsa dalam 30 hari dan 1 fasilitas perlu servis segera.',
        hint: 'Fokuskan tindak lanjut pada personel shift pagi dan access gate cargo.',
        tone: 'warning',
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
            label: 'Tes',
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
          label: 'Coverage CCTV',
          value: '98%',
          note: 'Perimeter timur menjadi area dengan cakupan terbaik pekan ini.',
        },
        {
          label: 'Kesiapan Shift',
          value: '3/3',
          note: 'Seluruh shift memiliki komposisi personel minimum terpenuhi.',
        },
        {
          label: 'Dokumen Review',
          value: '04',
          note: 'SOP escalation alarm dan matriks lisensi perlu pembaruan final.',
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
        licenseNumber: body.licenseNumber?.trim() || 
        '-',
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
}
