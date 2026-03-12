import {
  AgendaItem,
  AuditItem,
  FacilityItem,
  Finding,
  FollowUp,
  InspectionItem,
  InstansiProfile,
  MonitoringItem,
  OrganizationItem,
  PersonilItem,
  CertificateItem,
} from '@/types/kks';

const toISODate = (date: Date) => date.toISOString().slice(0, 10);
const daysFromNow = (days: number) => {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return toISODate(date);
};
const nowISO = () => new Date().toISOString();

export const seedInstansi: InstansiProfile = {
  facilityGroup: 'Pelayanan Navigasi Penerbangan',
  kobu: 'KANTOR OTORITAS BANDAR UDARA WILAYAH III',
  bandara: 'JUANDA',
  cabangAirnav: 'PERUM LPPNPI CABANG SURABAYA',
  name: 'Perum LPPNPI Cabang Surabaya',
  alias: 'Surabaya',
  address:
    'Perum LPPNPI Kantor Cabang Surabaya, Gedung AOB (Tower) Bandar Udara Juanda Surabaya 61253A',
  contactName: 'Sekretariat Pengawasan',
  contactEmail: 'safetyairnavsurabaya@gmail.com',
  contactPhone: '031 2896515',
  fax: '031 86888456',
  postalCode: '61253',
  longitude: '7.3581446372362285',
  latitude: '112.79651453661337',
  serviceArea: '172 - 172',
  operatingHours: '08:00 - 16:00',
  trafficType: '-',
  runwayCapacity: '-',
  runwayCondition: '-',
  location: '',
};

export const seedFacilities: FacilityItem[] = [
  {
    id: 'facility-1',
    group: 'COMMUNICATION',
    name: 'VHF-A/G ADC PRIMARY',
    merk: 'PARK AIR',
    type: 'T6T DAN T6R',
    frequency: '118.3',
    ident: '-',
    condition: 'Normal',
  },
  {
    id: 'facility-2',
    group: 'COMMUNICATION',
    name: 'VHF-A/G ADC SECONDARY',
    merk: 'OTE',
    type: 'DT100 DAN DRR100',
    frequency: '118.10',
    ident: '-',
    condition: 'Normal',
  },
  {
    id: 'facility-3',
    group: 'COMMUNICATION',
    name: 'VHF - GROUND CONTROL PRIMARY',
    merk: 'PARK AIR',
    type: 'T6T DAN T6R',
    frequency: '118.90',
    ident: '-',
    condition: 'Normal',
  },
  {
    id: 'facility-4',
    group: 'COMMUNICATION',
    name: 'VHF - GROUND CONTROL SECONDARY',
    merk: 'OTE',
    type: 'DT100 DAN DRR100',
    frequency: '119.15',
    ident: '-',
    condition: 'Normal',
  },
  {
    id: 'facility-5',
    group: 'COMMUNICATION',
    name: 'VHF A/G CDU SECONDARY',
    merk: 'PARK AIR',
    type: 'T6',
    frequency: '119.15 MHZ',
    ident: '-',
    condition: 'Normal',
  },
  {
    id: 'facility-6',
    group: 'COMMUNICATION',
    name: 'VHF - APP DIRECTOR PRIMARY',
    merk: 'PARK AIR',
    type: 'T6T DAN T6R',
    frequency: '123.20',
    ident: '-',
    condition: 'Normal',
  },
  {
    id: 'facility-7',
    group: 'COMMUNICATION',
    name: 'VHF - APP DIRECTOR SECONDARY',
    merk: 'OTE',
    type: 'DT100 DAN DRR100',
    frequency: '124.50',
    ident: '-',
    condition: 'Normal',
  },
  {
    id: 'facility-8',
    group: 'COMMUNICATION',
    name: 'VHF - APP WEST PRIMARY',
    merk: 'PARK AIR',
    type: 'T6T DAN T6R',
    frequency: '125.10',
    ident: '-',
    condition: 'Normal',
  },
  {
    id: 'facility-9',
    group: 'COMMUNICATION',
    name: 'VHF - APP WEST SECONDARY',
    merk: 'PARK AIR',
    type: 'T6T DAN T6R',
    frequency: '123.55',
    ident: '-',
    condition: 'Normal',
  },
  {
    id: 'facility-10',
    group: 'COMMUNICATION',
    name: 'VHF - APP EAST PRIMARY',
    merk: 'PARK AIR',
    type: 'T6T DAN T6R',
    frequency: '124',
    ident: '-',
    condition: 'Normal',
  },
  {
    id: 'facility-11',
    group: 'COMMUNICATION',
    name: 'VHF - APP EAST SECONDARY',
    merk: 'OTE',
    type: 'DT100 DAN DRR100',
    frequency: '122.85',
    ident: '-',
    condition: 'Normal',
  },
  {
    id: 'facility-12',
    group: 'COMMUNICATION',
    name: 'VHF PORTABLE',
    merk: 'FUNKE',
    type: 'FSG-90',
    frequency: '118.9 MHZ',
    ident: '-',
    condition: 'Single',
  },
  {
    id: 'facility-13',
    group: 'COMMUNICATION',
    name: 'VHF - ER ACC MKS PRIMARY',
    merk: 'SELEX',
    type: 'DT100 DAN DRR100',
    frequency: '123.90',
    ident: '-',
    condition: 'Normal',
  },
  {
    id: 'facility-14',
    group: 'COMMUNICATION',
    name: 'ATIS',
    merk: 'TERMA',
    type: '-',
    frequency: '128.20',
    ident: '-',
    condition: 'Unserviceable',
  },
];

export const seedOrganizations: OrganizationItem[] = [
  {
    id: 'org-1',
    unitName: '-',
    positionName: 'General Manager Perum LPPNPI Cabang Surabaya',
    level: '1',
    status: 'Aktif',
  },
];

export const seedPersonil: PersonilItem[] = [];

export const seedCertificates: CertificateItem[] = [
  {
    id: 'cert-1',
    name: 'Sertifikat Penyelenggara Pelayanan Lalu Lintas Penerbangan',
    type: 'Sertifikat 172',
    number: '172/LLP/2025',
    validUntil: '2027-12-31',
    status: 'Berlaku',
  },
  {
    id: 'cert-2',
    name: 'Sertifikat Penyelenggara Pelayanan Lalu Lintas Penerbangan',
    type: 'Sertifikat 172',
    number: '172/LLP/2026',
    validUntil: '2028-12-31',
    status: 'Berlaku',
  },
];

export const seedAgenda: AgendaItem[] = [
  {
    id: 'agenda-1',
    date: daysFromNow(7),
    activityType: 'Audit Internal',
    location: 'Gedung Administrasi',
    status: 'Direncanakan',
  },
  {
    id: 'agenda-2',
    date: daysFromNow(-3),
    activityType: 'Monitoring CNS',
    location: 'Unit CNS',
    status: 'Selesai',
  },
];

export const seedAudits: AuditItem[] = [
  {
    id: 'audit-1',
    number: 'AUD-2026-001',
    date: daysFromNow(-14),
    location: 'CNS Surabaya',
    status: 'Selesai',
    focus: 'Kepatuhan SOP Pelaporan',
  },
  {
    id: 'audit-2',
    number: 'AUD-2026-002',
    date: daysFromNow(10),
    location: 'ATC Tower',
    status: 'Direncanakan',
    focus: 'Audit Prosedur Shift',
  },
];

export const seedInspections: InspectionItem[] = [
  {
    id: 'inspeksi-1',
    number: 'INS-2026-014',
    date: daysFromNow(-5),
    location: 'CNS',
    status: 'Berjalan',
    unit: 'CNS',
  },
  {
    id: 'inspeksi-2',
    number: 'INS-2026-015',
    date: daysFromNow(12),
    location: 'AOC',
    status: 'Direncanakan',
    unit: 'AOC',
  },
];

export const seedMonitoring: MonitoringItem[] = [
  {
    id: 'monitor-1',
    date: daysFromNow(-2),
    location: 'Terminal Radar',
    status: 'Aktif',
    note: 'Pemantauan parameter komunikasi.',
  },
  {
    id: 'monitor-2',
    date: daysFromNow(-9),
    location: 'Runway Ops',
    status: 'Selesai',
    note: 'Monitoring prosedur runway crossing.',
  },
];

export const seedFindings: Finding[] = [
  {
    id: 'finding-1',
    sumber: 'Audit',
    sumberId: 'audit-1',
    kategori: 'Prosedur',
    deskripsi: 'SOP pelaporan gangguan belum tersosialisasi penuh ke teknisi shift malam.',
    severity: 'High',
    status: 'Open',
    dueDate: daysFromNow(8),
    createdAt: nowISO(),
    updatedAt: nowISO(),
  },
  {
    id: 'finding-2',
    sumber: 'Monitoring',
    sumberId: 'monitor-1',
    kategori: 'Dokumentasi',
    deskripsi: 'Log komunikasi harian belum ditandatangani supervisor.',
    severity: 'Med',
    status: 'In Progress',
    dueDate: daysFromNow(3),
    createdAt: nowISO(),
    updatedAt: nowISO(),
  },
  {
    id: 'finding-3',
    sumber: 'Inspeksi',
    sumberId: 'inspeksi-1',
    kategori: 'Peralatan',
    deskripsi: 'Kalibrasi perangkat navigasi belum diperbarui di papan kontrol.',
    severity: 'Low',
    status: 'Closed',
    dueDate: daysFromNow(-1),
    createdAt: nowISO(),
    updatedAt: nowISO(),
  },
];

export const seedFollowUps: FollowUp[] = [
  {
    id: 'cap-1',
    findingId: 'finding-1',
    aksiPerbaikan: 'Sosialisasi SOP dan refresh training untuk teknisi shift malam.',
    pic: 'Tim CNS',
    targetDate: daysFromNow(6),
    status: 'In Progress',
    evidenceFiles: [],
    history: ['Dibuat pada ' + nowISO()],
    createdAt: nowISO(),
    updatedAt: nowISO(),
  },
  {
    id: 'cap-2',
    findingId: 'finding-2',
    aksiPerbaikan: 'Update log dan verifikasi tanda tangan supervisor.',
    pic: 'Supervisor Monitoring',
    targetDate: daysFromNow(2),
    status: 'Open',
    evidenceFiles: [],
    history: ['Dibuat pada ' + nowISO()],
    createdAt: nowISO(),
    updatedAt: nowISO(),
  },
  {
    id: 'cap-3',
    findingId: 'finding-3',
    aksiPerbaikan: 'Kalibrasi ulang dan update papan kontrol.',
    pic: 'Teknisi Navigasi',
    targetDate: daysFromNow(-2),
    status: 'Done',
    evidenceFiles: [],
    history: ['Dibuat pada ' + nowISO(), 'Selesai dan diverifikasi'],
    createdAt: nowISO(),
    updatedAt: nowISO(),
  },
];
