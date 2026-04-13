import { Fragment, useDeferredValue, useEffect, useRef, useState, type ChangeEvent, type FormEvent } from 'react';
import Lottie from 'lottie-react';
import successAnimation from '@/assets/Success.json';
import {
  ChevronDownIcon,
  CloseIcon,
  LogoutIcon,
  MenuIcon,
  PortalChecklistIcon,
  PortalDashboardIcon,
  PortalNotebookIcon,
  SearchIcon,
  ShieldIcon,
  TrashIcon,
  UserIcon,
} from '@/components/icons';
import { Sidebar } from '@/components/Sidebar';
import { SupervisionProgramSection } from '@/components/SupervisionProgramSection';
import {
  createFacility,
  deleteFacility,
  deleteDocument,
  deleteDocumentsTable,
  deletePersonnel,
  createPersonnel,
  deletePersonnelTable,
  fetchDashboard,
  uploadPersonnelPhoto,
  updateSupervisionStatus,
  uploadSupervisionEvidence,
} from '@/lib/api';
import type {
  ActivityItem,
  DashboardData,
  DocumentItem,
  FacilityItem,
  LicenseItem,
  MetricCard,
  SpotlightItem,
  TestItem,
} from '@/types/dashboard';

type ThemeMode = 'light' | 'dark';
type RouteId = keyof typeof ROUTE_PATHS;
type CertificateUpload = {
  id: string;
  name: string;
  url: string;
  mimeType: string;
};
type NewPersonnelInput = {
  name: string;
  location: string;
  status: LicenseItem['status'];
  licenseNumber: string;
  address: string;
  documentPeriod?: string;
  sourceDocument?: string;
  birthPlaceDate?: string;
  maritalStatus?: string;
  religion?: string;
  educationHistory?: string[];
  workHistory?: string[];
  trainingHistory?: string[];
  refreshmentExisting?: string;
  refreshmentPlan?: string;
  recurrentExisting?: string;
  recurrentPlan?: string;
};
type NewFacilityInput = {
  name: string;
  zone: string;
  status: FacilityItem['status'];
  coveragePercent: string;
  photo: File | null;
};
type PersonnelImportResult = {
  imported: number;
  failed: string[];
};
type RouteState = {
  routeId: RouteId;
  personSlug: string | null;
};
type PortalTarget = 'auth' | 'k2s' | 'k3' | 'keamanan';
type PortalIconKind = 'dashboard' | 'keamanan' | 'k3' | 'k2s';
type PortalLink = {
  label: string;
  href: string;
  target: PortalTarget;
  iconKind: PortalIconKind;
  badgeClassName: string;
};
type RouteHeroContent = {
  eyebrow: string;
  title: string;
  subtitle?: string;
  chips?: string[];
  showMeta?: boolean;
  showResultCount?: boolean;
};
type SupervisionStatusTag = 'Sudah' | 'Belum';
type AuditSummaryCard = {
  kind: 'audit';
  id: string;
  title: string;
  frequency: string;
  status: SupervisionStatusTag;
  nextSchedule: string;
  description: string;
};
type InspectionSummaryCard = {
  kind: 'inspection';
  id: string;
  title: string;
  frequency: string;
  status: SupervisionStatusTag;
  description: string;
  locations: Array<{
    name: string;
    status: SupervisionStatusTag;
  }>;
};
type TestingSummaryCard = {
  kind: 'testing';
  id: string;
  title: string;
  frequency: string;
  done: number;
  total: number;
  nextSchedule: string;
  subtitle: string;
};
type SupervisionSummaryCard = AuditSummaryCard | InspectionSummaryCard | TestingSummaryCard;
type SupervisionHeatmapLevel = 0 | 1 | 2 | 3 | 4;
type SupervisionHeatmapMarker = {
  monthIndex: number;
  slotIndex: number;
  level: SupervisionHeatmapLevel;
};
type SupervisionHeatmapCategory = 'Audit' | 'Inspeksi' | 'Tes Keamanan';
type SupervisionHeatmapRow = {
  id: string;
  category?: SupervisionHeatmapCategory;
  label: string;
  cells: SupervisionHeatmapLevel[];
  isSpacer?: boolean;
  isGroup?: boolean;
  isBranch?: boolean;
};
type SupervisionScheduleEntry = {
  id: string;
  category: SupervisionHeatmapCategory;
  branch: SupervisionBranchFilter;
  year: number;
  monthIndex: number;
  slotIndex: number;
};
type SupervisionScheduleDraft = {
  category: SupervisionHeatmapCategory;
  branch: SupervisionBranchFilter;
  year: number;
  monthIndex: number;
  slotIndex: number;
};
const SUPERVISION_BRANCH_FILTERS = [
  'Cabang Surabaya',
  'KCP Banyuwangi',
  'KCP Malang',
  'KCP Sumenep',
  'Penyedia Personel AVSEC',
] as const;
type SupervisionBranchFilter = (typeof SUPERVISION_BRANCH_FILTERS)[number];
type SupervisionHeatmapFilter = 'Semua' | SupervisionHeatmapCategory | SupervisionBranchFilter;

const DASHBOARD_THEME_KEY = 'keamanan-dashboard-theme';
const SUPERVISION_YEAR_OPTIONS = Array.from({ length: 2030 - 2000 + 1 }, (_, index) => 2000 + index);
const YEAR_TIMELINE_MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const TIMELINE_SLOT_LABELS = ['I', 'II', 'III', 'IV'] as const;
const TIMELINE_SLOTS_PER_MONTH = 4;
const TIMELINE_TOTAL_COLUMNS = YEAR_TIMELINE_MONTHS.length * TIMELINE_SLOTS_PER_MONTH;
const HEATMAP_LEGEND_LEVELS: SupervisionHeatmapLevel[] = [1];
const SUPERVISION_CATEGORY_FILTERS: SupervisionHeatmapCategory[] = ['Audit', 'Inspeksi', 'Tes Keamanan'];
const SUPERVISION_BRANCHES_BY_CATEGORY: Record<SupervisionHeatmapCategory, SupervisionBranchFilter[]> = {
  Audit: ['Cabang Surabaya', 'KCP Banyuwangi', 'KCP Malang', 'KCP Sumenep'],
  Inspeksi: ['Cabang Surabaya', 'KCP Banyuwangi', 'KCP Malang', 'KCP Sumenep', 'Penyedia Personel AVSEC'],
  'Tes Keamanan': ['Cabang Surabaya', 'KCP Banyuwangi', 'KCP Sumenep'],
};
const BIMONTHLY_TEST_MONTHS = [1, 3, 5, 7, 9, 11] as const;
const SUPERVISION_SUMMARY_CARDS: SupervisionSummaryCard[] = [
  {
    kind: 'audit',
    id: 'audit',
    title: 'Audit',
    frequency: '1 kali / 2 tahun',
    status: 'Sudah',
    nextSchedule: 'Jan 2026',
    description: 'Audit internal berkala untuk memastikan evaluasi pengawasan berjalan menyeluruh.',
  },
  {
    kind: 'inspection',
    id: 'inspection',
    title: 'Inspeksi',
    frequency: '1 kali / tahun',
    status: 'Belum',
    description: 'Ringkasan lokasi prioritas yang menjadi fokus inspeksi tahunan saat ini.',
    locations: [
      { name: 'Surabaya', status: 'Sudah' },
      { name: 'Banyuwangi', status: 'Belum' },
      { name: 'Malang', status: 'Belum' },
    ],
  },
  {
    kind: 'testing',
    id: 'testing',
    title: 'Tes Keamanan',
    frequency: 'Tiap 2 bulan',
    done: 3,
    total: 6,
    nextSchedule: 'Ags 2026',
    subtitle: 'Pelaksanaan rutin per 2 bulan untuk memastikan kesiapan operasional tetap stabil.',
  },
];

function createInspectionEntries(
  year: number,
  plan: Array<[SupervisionBranchFilter, number, number]>
): SupervisionScheduleEntry[] {
  return plan.map(([branch, monthIndex, slotIndex]) => ({
    id: `inspection-${year}-${branch}-${monthIndex}-${slotIndex}`,
    category: 'Inspeksi',
    branch,
    year,
    monthIndex,
    slotIndex,
  }));
}

function createTestingEntries(year: number): SupervisionScheduleEntry[] {
  return SUPERVISION_BRANCHES_BY_CATEGORY['Tes Keamanan'].flatMap((branch) =>
    BIMONTHLY_TEST_MONTHS.map((monthIndex) => ({
      id: `testing-${year}-${branch}-${monthIndex}`,
      category: 'Tes Keamanan' as const,
      branch,
      year,
      monthIndex,
      slotIndex: 0,
    }))
  );
}

const BASE_SUPERVISION_SCHEDULE_ENTRIES: SupervisionScheduleEntry[] = [
  {
    id: 'audit-2026-surabaya',
    category: 'Audit',
    branch: 'Cabang Surabaya',
    year: 2026,
    monthIndex: 6,
    slotIndex: 1,
  },
  ...createInspectionEntries(2025, [
    ['Cabang Surabaya', 0, 1],
    ['KCP Banyuwangi', 2, 1],
    ['KCP Malang', 4, 1],
    ['KCP Sumenep', 7, 1],
    ['Penyedia Personel AVSEC', 10, 1],
  ]),
  ...createInspectionEntries(2026, [
    ['Cabang Surabaya', 2, 1],
    ['KCP Banyuwangi', 4, 1],
    ['KCP Malang', 6, 1],
    ['KCP Sumenep', 8, 1],
    ['Penyedia Personel AVSEC', 10, 1],
  ]),
  ...createInspectionEntries(2027, [
    ['Cabang Surabaya', 1, 1],
    ['KCP Banyuwangi', 3, 1],
    ['KCP Malang', 5, 1],
    ['KCP Sumenep', 7, 1],
    ['Penyedia Personel AVSEC', 9, 1],
  ]),
  ...createTestingEntries(2025),
  ...createTestingEntries(2026),
  ...createTestingEntries(2027),
];

function buildSupervisionHeatmapCells(markers: SupervisionHeatmapMarker[]) {
  const cells = Array.from({ length: TIMELINE_TOTAL_COLUMNS }, () => 0 as SupervisionHeatmapLevel);

  markers.forEach(({ monthIndex, slotIndex, level }) => {
    const normalizedMonthIndex = Math.max(0, Math.min(YEAR_TIMELINE_MONTHS.length - 1, monthIndex));
    const normalizedSlotIndex = Math.max(0, Math.min(TIMELINE_SLOTS_PER_MONTH - 1, slotIndex));
    const targetIndex = normalizedMonthIndex * TIMELINE_SLOTS_PER_MONTH + normalizedSlotIndex;
    cells[targetIndex] = Math.max(cells[targetIndex], level) as SupervisionHeatmapLevel;
  });

  return cells;
}

const SUPERVISION_HEATMAP_ROWS: SupervisionHeatmapRow[] = [
  {
    id: 'heatmap-audit-group',
    category: 'Audit',
    label: 'Audit',
    cells: buildSupervisionHeatmapCells([]),
    isGroup: true,
  },
  {
    id: 'heatmap-audit-surabaya',
    category: 'Audit',
    label: 'Cabang Surabaya',
    cells: buildSupervisionHeatmapCells([{ monthIndex: 6, slotIndex: 1, level: 4 }]),
    isBranch: true,
  },
  {
    id: 'heatmap-audit-banyuwangi',
    category: 'Audit',
    label: 'KCP Banyuwangi',
    cells: buildSupervisionHeatmapCells([]),
    isBranch: true,
  },
  {
    id: 'heatmap-audit-malang',
    category: 'Audit',
    label: 'KCP Malang',
    cells: buildSupervisionHeatmapCells([]),
    isBranch: true,
  },
  {
    id: 'heatmap-audit-sumenep',
    category: 'Audit',
    label: 'KCP Sumenep',
    cells: buildSupervisionHeatmapCells([]),
    isBranch: true,
  },
  {
    id: 'heatmap-inspection-group',
    category: 'Inspeksi',
    label: 'Inspeksi',
    cells: buildSupervisionHeatmapCells([]),
    isGroup: true,
  },
  {
    id: 'heatmap-inspection-surabaya',
    category: 'Inspeksi',
    label: 'Cabang Surabaya',
    cells: buildSupervisionHeatmapCells([{ monthIndex: 2, slotIndex: 1, level: 4 }]),
    isBranch: true,
  },
  {
    id: 'heatmap-inspection-banyuwangi',
    category: 'Inspeksi',
    label: 'KCP Banyuwangi',
    cells: buildSupervisionHeatmapCells([{ monthIndex: 4, slotIndex: 1, level: 4 }]),
    isBranch: true,
  },
  {
    id: 'heatmap-inspection-malang',
    category: 'Inspeksi',
    label: 'KCP Malang',
    cells: buildSupervisionHeatmapCells([{ monthIndex: 6, slotIndex: 1, level: 4 }]),
    isBranch: true,
  },
  {
    id: 'heatmap-inspection-sumenep',
    category: 'Inspeksi',
    label: 'KCP Sumenep',
    cells: buildSupervisionHeatmapCells([{ monthIndex: 8, slotIndex: 1, level: 4 }]),
    isBranch: true,
  },
  {
    id: 'heatmap-inspection-avsec',
    category: 'Inspeksi',
    label: 'Penyedia Personel AVSEC',
    cells: buildSupervisionHeatmapCells([{ monthIndex: 10, slotIndex: 1, level: 4 }]),
    isBranch: true,
  },
  {
    id: 'heatmap-testing-group',
    category: 'Tes Keamanan',
    label: 'Tes Keamanan',
    cells: buildSupervisionHeatmapCells([]),
    isGroup: true,
  },
  {
    id: 'heatmap-testing-surabaya',
    category: 'Tes Keamanan',
    label: 'Cabang Surabaya',
    cells: buildSupervisionHeatmapCells([
      { monthIndex: 1, slotIndex: 0, level: 4 },
      { monthIndex: 3, slotIndex: 0, level: 4 },
      { monthIndex: 5, slotIndex: 0, level: 4 },
      { monthIndex: 7, slotIndex: 0, level: 4 },
      { monthIndex: 9, slotIndex: 0, level: 4 },
      { monthIndex: 11, slotIndex: 0, level: 4 },
    ]),
    isBranch: true,
  },
  {
    id: 'heatmap-testing-banyuwangi',
    category: 'Tes Keamanan',
    label: 'KCP Banyuwangi',
    cells: buildSupervisionHeatmapCells([
      { monthIndex: 1, slotIndex: 0, level: 4 },
      { monthIndex: 3, slotIndex: 0, level: 4 },
      { monthIndex: 5, slotIndex: 0, level: 4 },
      { monthIndex: 7, slotIndex: 0, level: 4 },
      { monthIndex: 9, slotIndex: 0, level: 4 },
      { monthIndex: 11, slotIndex: 0, level: 4 },
    ]),
    isBranch: true,
  },
  {
    id: 'heatmap-testing-sumenep',
    category: 'Tes Keamanan',
    label: 'KCP Sumenep',
    cells: buildSupervisionHeatmapCells([
      { monthIndex: 1, slotIndex: 0, level: 4 },
      { monthIndex: 3, slotIndex: 0, level: 4 },
      { monthIndex: 5, slotIndex: 0, level: 4 },
      { monthIndex: 7, slotIndex: 0, level: 4 },
      { monthIndex: 9, slotIndex: 0, level: 4 },
      { monthIndex: 11, slotIndex: 0, level: 4 },
    ]),
    isBranch: true,
  },
];
const ROUTE_PATHS = {
  dashboard: '/dashboard',
  'fasilitas-keamanan': '/fasilitas-keamanan',
  'personil-keamanan': '/personil-keamanan',
  'tes-keamanan': '/tes-keamanan',
  dokumen: '/dokumen',
} as const;

const LEGACY_ROUTE_ALIASES: Record<string, RouteId> = {
  '/lisensi-keamanan': 'personil-keamanan',
};

function env() {
  return (import.meta as { env?: Record<string, string> }).env ?? {};
}

function normalizeBaseUrl(value: string) {
  return value.replace(/\/+$/, '');
}

function resolvePortalBaseUrl(target: PortalTarget) {
  if (typeof window !== 'undefined') {
    const { protocol, hostname } = window.location;

    if (hostname === 'localhost' || hostname === '127.0.0.1') {
      if (target === 'auth') return `${protocol}//${hostname}:5174`;
      if (target === 'k2s') return `${protocol}//${hostname}:5173`;
      if (target === 'k3') return `${protocol}//${hostname}:5176`;
      return `${protocol}//${hostname}:5177`;
    }

    if (hostname.startsWith('keamanan.')) {
      if (target === 'auth') return `${protocol}//${hostname.replace(/^keamanan\./, 'auth.')}`;
      if (target === 'k2s') return `${protocol}//${hostname.replace(/^keamanan\./, 'k2s.')}`;
      if (target === 'k3') return `${protocol}//${hostname.replace(/^keamanan\./, 'k3.')}`;
      return `${protocol}//${hostname.replace(/^keamanan\./, 'keamanan.')}`;
    }
  }

  if (target === 'auth') return 'https://auth.ryvidia.my.id';
  if (target === 'k2s') return 'https://k2s.ryvidia.my.id';
  if (target === 'k3') return 'https://k3.ryvidia.my.id';
  return 'https://keamanan.ryvidia.my.id';
}

function resolveDashboardPortalUrl() {
  const currentEnv = env();
  const explicitPortalUrl = currentEnv.VITE_PORTAL_DASHBOARD_URL?.trim();
  if (explicitPortalUrl) {
    return normalizeBaseUrl(explicitPortalUrl);
  }

  const authPortalUrl = currentEnv.VITE_AUTH_PORTAL_URL?.trim();
  if (authPortalUrl) {
    try {
      return `${new URL(authPortalUrl).origin}/portal-admin`;
    } catch {
      return `${resolvePortalBaseUrl('auth')}/portal-admin`;
    }
  }

  return `${resolvePortalBaseUrl('auth')}/portal-admin`;
}

function resolvePortalDestination(envKey: string, target: PortalTarget) {
  const value = env()[envKey]?.trim();
  if (value) {
    return normalizeBaseUrl(value);
  }

  return resolvePortalBaseUrl(target);
}

function getPortalLinks(): PortalLink[] {
  return [
    {
      label: 'Dashboard',
      href: resolveDashboardPortalUrl(),
      target: 'auth',
      iconKind: 'dashboard',
      badgeClassName: 'is-dashboard',
    },
    {
      label: 'Keamanan',
      href: resolvePortalDestination('VITE_PORTAL_KEAMANAN_URL', 'keamanan'),
      target: 'keamanan',
      iconKind: 'keamanan',
      badgeClassName: 'is-keamanan',
    },
    {
      label: 'K3',
      href: resolvePortalDestination('VITE_PORTAL_K3_URL', 'k3'),
      target: 'k3',
      iconKind: 'k3',
      badgeClassName: 'is-k3',
    },
    {
      label: 'K2S',
      href: resolvePortalDestination('VITE_PORTAL_K2S_URL', 'k2s'),
      target: 'k2s',
      iconKind: 'k2s',
      badgeClassName: 'is-k2s',
    },
  ];
}

function isSsoEnabled() {
  return String(env().VITE_SSO_ENABLED || '').toLowerCase() === 'true';
}

function getSsoClientId() {
  return env().VITE_SSO_CLIENT_ID || 'keamanan-web';
}

function getSsoLogoutUrl() {
  const configured = env().VITE_SSO_LOGOUT_URL?.trim();
  if (configured) {
    return normalizeBaseUrl(configured);
  }

  const configuredBase = env().VITE_SSO_AUTH_BASE_URL?.trim();
  if (configuredBase) {
    return `${normalizeBaseUrl(configuredBase)}/auth/logout`;
  }

  if (typeof window !== 'undefined') {
    const { protocol, hostname } = window.location;

    if (hostname === 'localhost' || hostname === '127.0.0.1') {
      return `${protocol}//${hostname}:3104/auth/logout`;
    }

    if (hostname.startsWith('keamanan.')) {
      return `${protocol}//${hostname.replace(/^keamanan\./, 'authapi.')}/auth/logout`;
    }
  }

  return 'https://authapi.ryvidia.my.id/auth/logout';
}

function buildSsoLogoutUrl(postLogoutRedirectUri: string) {
  const params = new URLSearchParams({
    post_logout_redirect_uri: postLogoutRedirectUri,
    client_id: getSsoClientId(),
  });

  return `${getSsoLogoutUrl()}?${params.toString()}`;
}

function clearKnownSessionTokens() {
  if (typeof window === 'undefined') {
    return;
  }

  const keys = [
    'auth.portal.token',
    'k2s.authToken',
    'logbook.auth.refreshToken',
    'k3.auth.accessToken',
    'k3.auth.refreshToken',
    'keamanan.auth.accessToken',
    'keamanan.auth.refreshToken',
  ];

  keys.forEach((key) => window.localStorage.removeItem(key));
}

function getInitialTheme(): ThemeMode {
  if (typeof window === 'undefined') {
    return 'light';
  }

  const storedTheme = window.localStorage.getItem(DASHBOARD_THEME_KEY);
  if (storedTheme === 'light' || storedTheme === 'dark') {
    return storedTheme;
  }

  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

function normalizePath(pathname: string) {
  const trimmed = pathname.replace(/\/+$/, '');
  return trimmed || '/';
}

function resolveRouteId(id: string): RouteId {
  if (id === 'personil-keamanan-lisensi') {
    return 'personil-keamanan';
  }

  if (id in ROUTE_PATHS) {
    return id as RouteId;
  }

  return 'dashboard';
}

function getRoutePath(id: string) {
  return ROUTE_PATHS[resolveRouteId(id)];
}

function getPersonDetailPath(slug: string) {
  return `${ROUTE_PATHS['personil-keamanan']}/${slug}`;
}

function parseRouteState(pathname: string): RouteState {
  const normalizedPath = normalizePath(pathname);

  if (normalizedPath === '/') {
    return { routeId: 'dashboard', personSlug: null };
  }

  if (normalizedPath in LEGACY_ROUTE_ALIASES) {
    return { routeId: LEGACY_ROUTE_ALIASES[normalizedPath], personSlug: null };
  }

  const segments = normalizedPath.split('/').filter(Boolean);

  if (segments[0] === 'personil-keamanan') {
    if (segments.length === 1) {
      return { routeId: 'personil-keamanan', personSlug: null };
    }

    if (segments.length >= 2) {
      return { routeId: 'personil-keamanan', personSlug: segments[1] || null };
    }
  }

  const routeEntry = Object.entries(ROUTE_PATHS).find(([, path]) => path === normalizedPath);
  return routeEntry
    ? { routeId: routeEntry[0] as RouteId, personSlug: null }
    : { routeId: 'dashboard', personSlug: null };
}

function getCanonicalPath(routeState: RouteState) {
  if (routeState.routeId === 'personil-keamanan' && routeState.personSlug) {
    return getPersonDetailPath(routeState.personSlug);
  }

  return getRoutePath(routeState.routeId);
}

function getInitialRouteState(): RouteState {
  if (typeof window === 'undefined') {
    return { routeId: 'dashboard', personSlug: null };
  }

  return parseRouteState(window.location.pathname);
}

function matchesQuery(query: string, fields: Array<string | undefined>) {
  if (!query) {
    return true;
  }

  return fields.some((field) => (field ?? '').toLowerCase().includes(query));
}

function countByStatus<T extends { status: string }>(items: T[]) {
  return items.reduce<Record<string, number>>((counts, item) => {
    counts[item.status] = (counts[item.status] ?? 0) + 1;
    return counts;
  }, {});
}

function buildFacilityMetrics(items: FacilityItem[]): MetricCard[] {
  const counts = countByStatus(items);

  return [
    {
      label: 'Fasilitas Tercatat',
      value: String(items.length),
      delta: `${counts.Optimal ?? 0} optimal`,
      description: 'Seluruh perangkat keamanan lapangan yang dipantau pada halaman fasilitas.',
    },
    {
      label: 'Perlu Servis',
      value: String(counts['Perlu Servis'] ?? 0),
      delta: 'Prioritas vendor',
      description: 'Perangkat yang perlu tindak lanjut maintenance atau penggantian komponen.',
    },
  ];
}

function buildPersonnelMetrics(items: LicenseItem[]): MetricCard[] {
  const counts = countByStatus(items);

  return [
    {
      label: 'Personel Tercatat',
      value: String(items.length),
      delta: `${counts.Valid ?? 0} lisensi valid`,
      description: 'Personel keamanan yang tampil pada roster lisensi dan kesiapan shift.',
    },
    {
      label: 'Perlu Perpanjangan',
      value: String(counts.Perpanjangan ?? 0),
      delta: 'Butuh tindak lanjut',
      description: 'Lisensi yang mendekati jatuh tempo dan perlu dijadwalkan untuk renewal.',
    },
    {
      label: 'Dalam Pelatihan',
      value: String(counts.Pelatihan ?? 0),
      delta: 'Refresh module',
      description: 'Personel yang sedang menjalani pelatihan atau pembaruan sertifikasi aktif.',
    },
  ];
}

function getStatusTone(status: string) {
  if (['Optimal', 'Valid', 'Aktif', 'Terlaksana'].includes(status)) {
    return 'good';
  }

  if (['Pelatihan', 'Review', 'Terjadwal'].includes(status)) {
    return 'neutral';
  }

  return 'warn';
}

function getRouteHero(
  routeId: RouteId,
  dashboard: DashboardData,
  visibleFacilities: FacilityItem[],
  visibleLicenses: LicenseItem[],
  visibleTests: TestItem[],
  visibleDocuments: DocumentItem[]
): RouteHeroContent {
  switch (routeId) {
    case 'fasilitas-keamanan':
      return {
        eyebrow: 'Fasilitas Keamanan',
        title: 'Status perangkat lapangan keamanan.',
        subtitle: `Pantau ${visibleFacilities.length} fasilitas berupa CCTV, access gate, X-Ray, dan perimeter secara terpisah.`,
        chips: [],
        showResultCount: false,
      };
    case 'personil-keamanan':
      return {
        eyebrow: 'Personil Keamanan',
        title: 'Roster personel dan kesiapan shift.',
        subtitle: '',
        chips: [],
        showMeta: false,
      };
    case 'tes-keamanan':
      return {
        eyebrow: 'Program Pengawasan Keamanan',
        title: 'Agenda pengawasan dan tindak lanjut operasional.',
        subtitle: `Kelola ${visibleTests.length} agenda audit, inspeksi, dan tes keamanan lengkap dengan evidence dan status pelaksanaan.`,
        chips: ['Audit', 'Inspeksi', 'Tes Keamanan'],
      };
    case 'dokumen':
      return {
        eyebrow: 'Dokumen',
        title: 'Kontrol revisi dokumen keamanan.',
        subtitle: `Monitor ${visibleDocuments.length} dokumen aktif, review, dan revisi pada satu halaman yang lebih fokus.`,
        chips: ['SOP', 'Eviden', 'Review'],
      };
    case 'dashboard':
    default:
      return {
        eyebrow: dashboard.hero.eyebrow,
        title: dashboard.hero.title,
        subtitle: dashboard.hero.subtitle,
        chips: dashboard.quickActions.map((action) => action.label),
      };
  }
}

function StatusBadge({ status }: { status: string }) {
  return <span className={`status-badge is-${getStatusTone(status)}`}>{status}</span>;
}

function getPersonInitials(name: string) {
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('');
}

function normalizePersonnelImportHeader(value: string) {
  return value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '');
}

function normalizePersonnelImportStatus(value?: string): NewPersonnelInput['status'] {
  const normalized = (value ?? '').trim().toLowerCase();

  if (['perpanjangan', 'renewal', 'renew'].includes(normalized)) {
    return 'Perpanjangan';
  }

  if (['pelatihan', 'training', 'refreshment'].includes(normalized)) {
    return 'Pelatihan';
  }

  return 'Valid';
}

function toTitleCaseWords(value: string) {
  return value
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

function normalizePersonnelImportLocation(value?: string) {
  const normalized = (value ?? '').trim().replace(/\s+/g, ' ');
  if (!normalized) {
    return '';
  }

  if (/^(cabang|kcp)\b/i.test(normalized)) {
    return toTitleCaseWords(normalized);
  }

  return `Cabang ${toTitleCaseWords(normalized)}`;
}

function splitMultilineField(value?: string) {
  return (value ?? '')
    .split(/\r?\n/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function flattenMultilineField(value?: string) {
  return splitMultilineField(value).join(' · ');
}

function combineParallelFields(...columns: Array<string[]>) {
  const maxLength = Math.max(0, ...columns.map((items) => items.length));

  return Array.from({ length: maxLength }, (_, index) =>
    columns
      .map((items) => items[index]?.trim() ?? '')
      .filter(Boolean)
      .join(' · ')
  ).filter(Boolean);
}

function deriveDocumentPeriodFromSource(sourceDocument?: string) {
  const source = (sourceDocument ?? '').trim();
  if (!source) {
    return 'Import CSV';
  }

  const upperSource = source.toUpperCase();
  const yearMatch = upperSource.match(/TAHUN\s+(\d{4})/);
  const monthMatch = upperSource.match(
    /\b(JANUARI|FEBRUARI|MARET|APRIL|MEI|JUNI|JULI|AGUSTUS|SEPTEMBER|OKTOBER|NOVEMBER|DESEMBER)\b/
  );

  if (monthMatch && yearMatch) {
    return `${toTitleCaseWords(monthMatch[1])} ${yearMatch[1]}`;
  }

  if (yearMatch) {
    return `Tahun ${yearMatch[1]}`;
  }

  return 'Import CSV';
}

function parseDelimitedRows(input: string, delimiter: ',' | ';') {
  const source = input.replace(/^\uFEFF/, '');
  const rows: string[][] = [];
  let currentRow: string[] = [];
  let currentValue = '';
  let inQuotes = false;

  for (let index = 0; index < source.length; index += 1) {
    const char = source[index];

    if (char === '"') {
      if (inQuotes && source[index + 1] === '"') {
        currentValue += '"';
        index += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (!inQuotes && char === delimiter) {
      currentRow.push(currentValue.trim());
      currentValue = '';
      continue;
    }

    if (!inQuotes && (char === '\n' || char === '\r')) {
      if (char === '\r' && source[index + 1] === '\n') {
        index += 1;
      }
      currentRow.push(currentValue.trim());
      if (currentRow.some((cell) => cell.trim())) {
        rows.push(currentRow);
      }
      currentRow = [];
      currentValue = '';
      continue;
    }

    currentValue += char;
  }

  currentRow.push(currentValue.trim());
  if (currentRow.some((cell) => cell.trim())) {
    rows.push(currentRow);
  }

  return rows;
}

function parsePersonnelImportFile(input: string): NewPersonnelInput[] {
  const commaRows = parseDelimitedRows(input, ',');
  const semicolonRows = parseDelimitedRows(input, ';');
  const rows = semicolonRows[0]?.length > commaRows[0]?.length ? semicolonRows : commaRows;

  if (rows.length < 2) {
    throw new Error('File import harus berisi header dan minimal satu baris data.');
  }

  const headers = rows[0].map(normalizePersonnelImportHeader);
  const nameIndex = headers.findIndex((item) =>
    ['name', 'nama', 'namapersonel', 'namapersonnel', 'namanolicense'].includes(item)
  );
  const locationIndex = headers.findIndex((item) =>
    ['location', 'lokasi', 'cabang', 'cabanglokasi', 'unit'].includes(item)
  );
  const statusIndex = headers.findIndex((item) => ['statuspersonel', 'statuslisensi', 'statusrekamjejak'].includes(item));
  const sourceDocumentIndex = headers.findIndex((item) => ['sourcefile', 'sourcedocument', 'dokumensumber'].includes(item));
  const birthPlaceDateIndex = headers.findIndex((item) =>
    ['tempattanggallahir', 'ttl', 'birthplacedate'].includes(item)
  );
  const addressIndex = headers.findIndex((item) => ['address', 'alamat', 'domisili'].includes(item));
  const maritalStatusIndex = headers.findIndex((item) => ['status', 'statuspernikahan', 'maritalstatus'].includes(item));
  const religionIndex = headers.findIndex((item) => ['agama', 'religion'].includes(item));
  const educationLevelIndex = headers.findIndex((item) =>
    ['riwayatpendidikantingkat', 'pendidikantingkat'].includes(item)
  );
  const educationSchoolIndex = headers.findIndex((item) =>
    ['riwayatpendidikansekolah', 'pendidikansekolah'].includes(item)
  );
  const educationYearIndex = headers.findIndex((item) =>
    ['riwayatpendidikantahun', 'pendidikantahun'].includes(item)
  );
  const workRoleIndex = headers.findIndex((item) => ['riwayatpekerjaanjabatan', 'pekerjaanjabatan'].includes(item));
  const workCompanyIndex = headers.findIndex((item) => ['riwayatpekerjaaninstansi', 'pekerjaaninstansi'].includes(item));
  const workYearIndex = headers.findIndex((item) => ['riwayatpekerjaantahun', 'pekerjaantahun'].includes(item));
  const trainingNameIndex = headers.findIndex((item) =>
    ['riwayatpelatihanpelatihan', 'pelatihanpelatihan', 'riwayatpelatihan'].includes(item)
  );
  const trainingYearIndex = headers.findIndex((item) => ['riwayatpelatihantahun', 'pelatihantahun'].includes(item));
  const refreshmentExistingIndex = headers.findIndex((item) => ['refreshmentexisting'].includes(item));
  const refreshmentPlanIndex = headers.findIndex((item) => ['refreshmentrencana', 'refreshmentplan'].includes(item));
  const recurrentExistingIndex = headers.findIndex((item) => ['recurrentexisting'].includes(item));
  const recurrentPlanIndex = headers.findIndex((item) => ['recurrentrencana', 'recurrentplan'].includes(item));

  if (nameIndex === -1 || locationIndex === -1 || sourceDocumentIndex === -1) {
    throw new Error('Header import wajib memiliki kolom cabang, source file, dan nama/no license.');
  }

  const nextItems = rows.slice(1).flatMap((row, rowIndex) => {
    const nameLicenseParts = splitMultilineField(row[nameIndex]);
    const name = nameLicenseParts[0] ?? '';
    const location = normalizePersonnelImportLocation(row[locationIndex]);
    const sourceDocument = row[sourceDocumentIndex]?.trim() ?? '';

    if (!name && row.every((cell) => !cell.trim())) {
      return [];
    }

    if (!name) {
      return [];
    }

    if (!location) {
      throw new Error(`Baris ${rowIndex + 2} wajib mengisi cabang/lokasi.`);
    }

    const educationHistory = combineParallelFields(
      splitMultilineField(row[educationLevelIndex] ?? ''),
      splitMultilineField(row[educationSchoolIndex] ?? ''),
      splitMultilineField(row[educationYearIndex] ?? '')
    );

    const workHistory = combineParallelFields(
      splitMultilineField(row[workRoleIndex] ?? ''),
      splitMultilineField(row[workCompanyIndex] ?? ''),
      splitMultilineField(row[workYearIndex] ?? '')
    );

    const trainingHistory = combineParallelFields(
      splitMultilineField(row[trainingNameIndex] ?? ''),
      splitMultilineField(row[trainingYearIndex] ?? '')
    );

    return [
      {
        name,
        location,
        status: normalizePersonnelImportStatus(statusIndex >= 0 ? row[statusIndex] : undefined),
        licenseNumber: nameLicenseParts.slice(1).join(' ').trim(),
        address: addressIndex >= 0 ? (row[addressIndex]?.trim() ?? '') : '',
        documentPeriod: deriveDocumentPeriodFromSource(sourceDocument),
        sourceDocument,
        birthPlaceDate: birthPlaceDateIndex >= 0 ? (row[birthPlaceDateIndex]?.trim() ?? '') : '',
        maritalStatus: maritalStatusIndex >= 0 ? (row[maritalStatusIndex]?.trim() ?? '') : '',
        religion: religionIndex >= 0 ? (row[religionIndex]?.trim() ?? '') : '',
        educationHistory,
        workHistory,
        trainingHistory,
        refreshmentExisting:
          refreshmentExistingIndex >= 0 ? flattenMultilineField(row[refreshmentExistingIndex]) : '',
        refreshmentPlan: refreshmentPlanIndex >= 0 ? flattenMultilineField(row[refreshmentPlanIndex]) : '',
        recurrentExisting: recurrentExistingIndex >= 0 ? flattenMultilineField(row[recurrentExistingIndex]) : '',
        recurrentPlan: recurrentPlanIndex >= 0 ? flattenMultilineField(row[recurrentPlanIndex]) : '',
      },
    ];
  });

  if (!nextItems.length) {
    throw new Error('Tidak ada data personel yang dapat diimpor dari file tersebut.');
  }

  return nextItems;
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function buildPersonnelExportDocument(licenses: LicenseItem[], generatedAtLabel: string) {
  const columns = [
    { label: 'No', className: 'col-no' },
    { label: 'Nama Personil', className: 'col-name' },
    { label: 'Cabang / Lokasi', className: 'col-location' },
    { label: 'Periode Dokumen', className: 'col-period' },
    { label: 'Nomor License', className: 'col-license' },
    { label: 'Tempat, Tanggal Lahir', className: 'col-birth' },
    { label: 'Status', className: 'col-status' },
    { label: 'Agama', className: 'col-religion' },
    { label: 'Status Rekam Jejak', className: 'col-record' },
  ];

  const rows = licenses
    .map((item, index) => {
      const cells = [
        { value: String(index + 1), className: 'cell-center' },
        { value: item.name, className: 'cell-strong' },
        { value: item.location, className: '' },
        { value: item.documentPeriod, className: '' },
        { value: item.licenseNumber || '-', className: '' },
        { value: item.birthPlaceDate || '-', className: '' },
        { value: item.maritalStatus || '-', className: '' },
        { value: item.religion || '-', className: '' },
        { value: item.status || '-', className: 'cell-center' },
      ];

      return `<tr>${cells
        .map((cell) => `<td class="${cell.className}">${escapeHtml(cell.value)}</td>`)
        .join('')}</tr>`;
    })
    .join('');

  return `<!DOCTYPE html>
<html
  lang="id"
  xmlns:o="urn:schemas-microsoft-com:office:office"
  xmlns:w="urn:schemas-microsoft-com:office:word"
  xmlns="http://www.w3.org/TR/REC-html40"
>
  <head>
    <meta charset="utf-8" />
    <title>Dokumen Rekap Personil Keamanan</title>
    <!--[if gte mso 9]>
    <xml>
      <w:WordDocument>
        <w:View>Print</w:View>
        <w:Zoom>90</w:Zoom>
      </w:WordDocument>
    </xml>
    <![endif]-->
    <style>
      @page Section1 {
        size: 595.35pt 841.95pt;
        mso-page-orientation: portrait;
        margin: 1.2cm;
      }

      body {
        font-family: "Times New Roman", serif;
        margin: 0;
        color: #111111;
        font-size: 10.5pt;
      }
      .document-shell {
        width: 100%;
      }
      div.Section1 {
        page: Section1;
      }
      .document-header {
        margin-bottom: 18px;
        text-align: center;
      }
      .document-title {
        margin: 0;
        font-size: 22pt;
        font-weight: 700;
      }
      .document-organization {
        margin: 10px 0 0;
        font-size: 16pt;
        font-weight: 700;
        text-decoration: underline;
        text-decoration-color: #c1121f;
        text-underline-offset: 4px;
      }
      .document-subtitle {
        margin: 10px 0 0;
        font-size: 13pt;
        font-weight: 700;
      }
      .document-meta {
        margin: 0 0 14px;
        font-size: 10.5pt;
        line-height: 1.6;
      }
      .document-meta strong {
        display: inline-block;
        min-width: 140px;
      }
      .section-caption {
        margin: 0;
        padding: 8px 10px;
        border: 1px solid #b6bfce;
        border-bottom: 0;
        background: #f7f8fb;
        font-size: 11pt;
        font-weight: 700;
      }
      table {
        width: 100%;
        border-collapse: collapse;
        table-layout: fixed;
        border: 1px solid #b6bfce;
      }
      th,
      td {
        border: 1px solid #b6bfce;
        padding: 8px 9px;
        font-size: 9.5pt;
        vertical-align: top;
        word-break: break-word;
      }
      th {
        background: #dde2ea;
        text-align: left;
        font-weight: 700;
      }
      .col-no {
        width: 4%;
      }
      .col-name {
        width: 17%;
      }
      .col-location {
        width: 12%;
      }
      .col-period {
        width: 11%;
      }
      .col-license {
        width: 15%;
      }
      .col-birth {
        width: 15%;
      }
      .col-status {
        width: 9%;
      }
      .col-religion {
        width: 7%;
      }
      .col-record {
        width: 10%;
      }
      .cell-center {
        text-align: center;
        vertical-align: middle;
      }
      .cell-strong {
        font-weight: 700;
      }
      tbody tr:nth-child(even) td {
        background: #fbfcfe;
      }
    </style>
  </head>
  <body>
    <div class="Section1 document-shell">
      <div class="document-header">
        <h1 class="document-title">Dokumen Rekap Personil Keamanan</h1>
        <div class="document-organization">Perum LPPNPI Cabang Surabaya</div>
        <div class="document-subtitle">Identitas Dokumen Personel</div>
      </div>

      <div class="document-meta">
        <div><strong>Tanggal Export</strong>: ${escapeHtml(generatedAtLabel)}</div>
        <div><strong>Total Personil</strong>: ${licenses.length}</div>
      </div>

      <p class="section-caption">Tabel Rekap Identitas Personel Keamanan</p>
      <table>
        <thead>
          <tr>${columns
            .map((column) => `<th class="${column.className}">${escapeHtml(column.label)}</th>`)
            .join('')}</tr>
        </thead>
        <tbody>
          ${rows}
        </tbody>
      </table>
    </div>
  </body>
</html>`;
}

function buildFacilityExportDocument(facilities: FacilityItem[], generatedAtLabel: string) {
  const columns = [
    { label: 'No', className: 'col-no' },
    { label: 'Fasilitas', className: 'col-name' },
    { label: 'Zona', className: 'col-location' },
    { label: 'Status', className: 'col-status' },
    { label: 'Coverage', className: 'col-coverage' },
    { label: 'Pembaruan', className: 'col-updated' },
  ];

  const rows = facilities
    .map((item, index) => {
      const cells = [
        { value: String(index + 1), className: 'cell-center' },
        { value: item.name, className: 'cell-strong' },
        { value: item.zone, className: '' },
        { value: item.status, className: 'cell-center' },
        { value: item.coverage, className: 'cell-center' },
        { value: item.updatedAt, className: '' },
      ];

      return `<tr>${cells
        .map((cell) => `<td class="${cell.className}">${escapeHtml(cell.value)}</td>`)
        .join('')}</tr>`;
    })
    .join('');

  return `<!DOCTYPE html>
<html
  lang="id"
  xmlns:o="urn:schemas-microsoft-com:office:office"
  xmlns:w="urn:schemas-microsoft-com:office:word"
  xmlns="http://www.w3.org/TR/REC-html40"
>
  <head>
    <meta charset="utf-8" />
    <title>Dokumen Rekap Fasilitas Keamanan</title>
    <!--[if gte mso 9]>
    <xml>
      <w:WordDocument>
        <w:View>Print</w:View>
        <w:Zoom>90</w:Zoom>
      </w:WordDocument>
    </xml>
    <![endif]-->
    <style>
      @page Section1 {
        size: 841.95pt 595.35pt;
        mso-page-orientation: landscape;
        margin: 1.2cm;
      }

      body {
        font-family: "Times New Roman", serif;
        margin: 0;
        color: #111111;
        font-size: 10.5pt;
      }
      div.Section1 {
        page: Section1;
      }
      .document-shell {
        width: 100%;
      }
      .document-header {
        margin-bottom: 18px;
        text-align: center;
      }
      .document-title {
        margin: 0;
        font-size: 22pt;
        font-weight: 700;
      }
      .document-organization {
        margin: 10px 0 0;
        font-size: 16pt;
        font-weight: 700;
        text-decoration: underline;
        text-decoration-color: #c1121f;
        text-underline-offset: 4px;
      }
      .document-subtitle {
        margin: 10px 0 0;
        font-size: 13pt;
        font-weight: 700;
      }
      .document-meta {
        margin: 0 0 14px;
        font-size: 10.5pt;
        line-height: 1.6;
      }
      .document-meta strong {
        display: inline-block;
        min-width: 140px;
      }
      .section-caption {
        margin: 0;
        padding: 8px 10px;
        border: 1px solid #b6bfce;
        border-bottom: 0;
        background: #f7f8fb;
        font-size: 11pt;
        font-weight: 700;
      }
      table {
        width: 100%;
        border-collapse: collapse;
        table-layout: fixed;
        border: 1px solid #b6bfce;
      }
      th,
      td {
        border: 1px solid #b6bfce;
        padding: 8px 9px;
        font-size: 9.5pt;
        vertical-align: top;
        word-break: break-word;
      }
      th {
        background: #dde2ea;
        text-align: left;
        font-weight: 700;
      }
      .col-no {
        width: 5%;
      }
      .col-name {
        width: 28%;
      }
      .col-location {
        width: 22%;
      }
      .col-status {
        width: 14%;
      }
      .col-coverage {
        width: 12%;
      }
      .col-updated {
        width: 19%;
      }
      .cell-center {
        text-align: center;
        vertical-align: middle;
      }
      .cell-strong {
        font-weight: 700;
      }
      tbody tr:nth-child(even) td {
        background: #fbfcfe;
      }
    </style>
  </head>
  <body>
    <div class="Section1 document-shell">
      <div class="document-header">
        <h1 class="document-title">Dokumen Rekap Fasilitas Keamanan</h1>
        <div class="document-organization">Perum LPPNPI Cabang Surabaya</div>
        <div class="document-subtitle">Status Perangkat Lapangan</div>
      </div>

      <div class="document-meta">
        <div><strong>Tanggal Export</strong>: ${escapeHtml(generatedAtLabel)}</div>
        <div><strong>Total Fasilitas</strong>: ${facilities.length}</div>
      </div>

      <p class="section-caption">Tabel Rekap Fasilitas Keamanan</p>
      <table>
        <thead>
          <tr>${columns
            .map((column) => `<th class="${column.className}">${escapeHtml(column.label)}</th>`)
            .join('')}</tr>
        </thead>
        <tbody>
          ${rows}
        </tbody>
      </table>
    </div>
  </body>
</html>`;
}

function EmptyRows({ copy }: { copy: string }) {
  return <div className="empty-inline">{copy}</div>;
}

function getSupervisionCategoryBadgeClass(category: TestItem['category']) {
  if (category === 'Audit') {
    return 'summary-category is-audit';
  }

  if (category === 'Inspeksi') {
    return 'summary-category is-inspeksi';
  }

  return 'summary-category is-tes';
}

function PortalLinkIcon({ kind, className }: { kind: PortalIconKind; className?: string }) {
  if (kind === 'keamanan') {
    return <ShieldIcon className={className} />;
  }

  if (kind === 'k3') {
    return <PortalChecklistIcon className={className} />;
  }

  if (kind === 'k2s') {
    return <PortalNotebookIcon className={className} />;
  }

  return <PortalDashboardIcon className={className} />;
}

export default function App() {
  const [dashboard, setDashboard] = useState<DashboardData | null>(null);
  const [routeState, setRouteState] = useState<RouteState>(getInitialRouteState);
  const [personCertificates, setPersonCertificates] = useState<Record<string, CertificateUpload[]>>({});
  const [search, setSearch] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [theme, setTheme] = useState<ThemeMode>(getInitialTheme);
  const [isPortalMenuOpen, setIsPortalMenuOpen] = useState(false);
  const [isProfileMenuOpen, setIsProfileMenuOpen] = useState(false);
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  const certificateRef = useRef(personCertificates);
  const portalMenuRef = useRef<HTMLDivElement | null>(null);
  const profileMenuRef = useRef<HTMLDivElement | null>(null);
  const deferredSearch = useDeferredValue(search.trim().toLowerCase());
  const activeId = routeState.routeId;
  const portalLinks = getPortalLinks();

  useEffect(() => {
    certificateRef.current = personCertificates;
  }, [personCertificates]);

  useEffect(() => {
    return () => {
      Object.values(certificateRef.current).forEach((items) => {
        items.forEach((item) => {
          URL.revokeObjectURL(item.url);
        });
      });
    };
  }, []);

  useEffect(() => {
    document.body.dataset.theme = theme;
    document.body.style.colorScheme = theme;
    window.localStorage.setItem(DASHBOARD_THEME_KEY, theme);
  }, [theme]);

  useEffect(() => {
    function handlePointerDown(event: MouseEvent) {
      if (portalMenuRef.current && !portalMenuRef.current.contains(event.target as Node)) {
        setIsPortalMenuOpen(false);
      }

      if (profileMenuRef.current && !profileMenuRef.current.contains(event.target as Node)) {
        setIsProfileMenuOpen(false);
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setIsPortalMenuOpen(false);
        setIsProfileMenuOpen(false);
        setIsMobileSidebarOpen(false);
      }
    }

    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  useEffect(() => {
    setIsMobileSidebarOpen(false);
  }, [activeId, routeState.personSlug]);

  function handleLogout() {
    clearKnownSessionTokens();

    if (typeof window === 'undefined') {
      return;
    }

    if (isSsoEnabled()) {
      window.location.replace(buildSsoLogoutUrl(window.location.origin));
      return;
    }

    const authPortalUrl = env().VITE_AUTH_PORTAL_URL?.trim();
    if (authPortalUrl) {
      try {
        const parsed = new URL(authPortalUrl);
        const logoutUrl = new URL('/auth/logout', parsed.origin);
        logoutUrl.searchParams.set('post_logout_redirect_uri', window.location.origin);
        window.location.replace(logoutUrl.toString());
        return;
      } catch {
        // Fall through to default login redirect.
      }
    }

    window.location.replace(`${resolvePortalBaseUrl('auth')}/login`);
  }

  useEffect(() => {
    let cancelled = false;

    async function loadDashboard() {
      try {
        setIsLoading(true);
        const nextDashboard = await fetchDashboard();

        if (!cancelled) {
          setDashboard(nextDashboard);
          setError('');
        }
      } catch (loadError) {
        if (!cancelled) {
          setError(loadError instanceof Error ? loadError.message : 'Terjadi kesalahan tidak dikenal.');
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    }

    void loadDashboard();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    const nextRouteState = parseRouteState(window.location.pathname);
    const canonicalPath = getCanonicalPath(nextRouteState);
    if (normalizePath(window.location.pathname) !== canonicalPath) {
      window.history.replaceState({}, '', canonicalPath);
    }

    setRouteState(nextRouteState);

    function handlePopState() {
      setRouteState(parseRouteState(window.location.pathname));
    }

    window.addEventListener('popstate', handlePopState);

    return () => {
      window.removeEventListener('popstate', handlePopState);
    };
  }, []);

  const selectedPerson = routeState.personSlug
    ? dashboard?.licenses.find((item) => item.slug === routeState.personSlug) ?? null
    : null;
  const selectedCertificates = selectedPerson ? personCertificates[selectedPerson.slug] ?? [] : [];

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    if (routeState.routeId !== 'personil-keamanan' || !routeState.personSlug) {
      return;
    }

    if (!dashboard) {
      return;
    }

    if (selectedPerson) {
      return;
    }

    const nextRouteState = {
      routeId: 'personil-keamanan',
      personSlug: null,
    } satisfies RouteState;

    setRouteState(nextRouteState);
    window.history.replaceState({}, '', getCanonicalPath(nextRouteState));
  }, [dashboard, routeState.personSlug, routeState.routeId, selectedPerson]);

  function handleSelect(id: string) {
    const nextRouteState = {
      routeId: resolveRouteId(id),
      personSlug: null,
    } satisfies RouteState;
    const nextPath = getCanonicalPath(nextRouteState);
    const currentPath =
      typeof window === 'undefined' ? getCanonicalPath(routeState) : normalizePath(window.location.pathname);

    setRouteState(nextRouteState);

    if (typeof window !== 'undefined' && currentPath !== nextPath) {
      window.history.pushState({}, '', nextPath);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }

  function handleSelectPerson(slug: string) {
    const nextRouteState = {
      routeId: 'personil-keamanan',
      personSlug: slug,
    } satisfies RouteState;
    const nextPath = getCanonicalPath(nextRouteState);
    const currentPath =
      typeof window === 'undefined' ? getCanonicalPath(routeState) : normalizePath(window.location.pathname);

    setRouteState(nextRouteState);

    if (typeof window !== 'undefined' && currentPath !== nextPath) {
      window.history.pushState({}, '', nextPath);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }

  function handleCertificateUpload(slug: string, file: File) {
    const nextCertificate = {
      id:
        typeof crypto !== 'undefined' && 'randomUUID' in crypto
          ? crypto.randomUUID()
          : `${Date.now()}-${Math.random().toString(36).slice(2)}`,
      name: file.name,
      url: URL.createObjectURL(file),
      mimeType: file.type || '',
    } satisfies CertificateUpload;

    setPersonCertificates((current) => {
      return {
        ...current,
        [slug]: [...(current[slug] ?? []), nextCertificate],
      };
    });
  }

  function handleCertificateDelete(slug: string, certificateId: string) {
    setPersonCertificates((current) => {
      const items = current[slug] ?? [];
      const target = items.find((item) => item.id === certificateId);
      if (!target) {
        return current;
      }

      URL.revokeObjectURL(target.url);

      const nextItems = items.filter((item) => item.id !== certificateId);
      if (!nextItems.length) {
        const { [slug]: _removed, ...rest } = current;
        return rest;
      }

      return {
        ...current,
        [slug]: nextItems,
      };
    });
  }

  async function refreshDashboardData() {
    const nextDashboard = await fetchDashboard();
    setDashboard(nextDashboard);
    return nextDashboard;
  }

  async function handleAddPerson(input: NewPersonnelInput) {
    await createPersonnel(input);
    await refreshDashboardData();
  }

  async function handleDeletePersonnelTable() {
    await deletePersonnelTable();
    await refreshDashboardData();
  }

  async function handleDeletePerson(slug: string) {
    await deletePersonnel(slug);
    await refreshDashboardData();
  }

  async function handleDeleteDocumentsTable() {
    await deleteDocumentsTable();
    await refreshDashboardData();
  }

  async function handleDeleteDocument(sourceType: DocumentItem['sourceType'], id: string) {
    await deleteDocument(sourceType, id);
    await refreshDashboardData();
  }

  async function handleImportPersonnel(items: NewPersonnelInput[]): Promise<PersonnelImportResult> {
    let imported = 0;
    const failed: string[] = [];

    for (const item of items) {
      try {
        await createPersonnel(item);
        imported += 1;
      } catch {
        failed.push(item.name);
      }
    }

    if (imported > 0) {
      await refreshDashboardData();
    }

    if (!imported) {
      throw new Error('Tidak ada personel yang berhasil diimpor.');
    }

    return {
      imported,
      failed,
    };
  }

  async function handleUploadPersonnelPhoto(slug: string, photo: File) {
    await uploadPersonnelPhoto(slug, photo);
    await refreshDashboardData();
  }

  async function handleAddFacility(input: NewFacilityInput) {
    await createFacility({
      name: input.name,
      zone: input.zone,
      status: input.status,
      coveragePercent: Number.parseInt(input.coveragePercent, 10),
      photo: input.photo,
    });
    await refreshDashboardData();
  }

  async function handleDeleteFacility(id: string) {
    await deleteFacility(id);
    await refreshDashboardData();
  }

  async function handleUpdateSupervisionActivity(input: {
    activityId: string;
    status: 'Terlaksana' | 'Perlu Tindak Lanjut';
    location?: string | null;
    completedAt?: string | null;
    completionNote?: string | null;
    inspectorNames?: string[] | null;
  }): Promise<TestItem> {
    const payload = (await updateSupervisionStatus(input.activityId, {
      status: input.status,
      location: input.location,
      completedAt: input.completedAt,
      completionNote: input.completionNote,
      inspectorNames: input.inspectorNames,
    })) as { data: TestItem };
    const refreshedDashboard = await refreshDashboardData();

    return refreshedDashboard.tests.find((item) => item.id === payload.data.id) ?? payload.data;
  }

  async function handleUploadSupervisionActivityEvidence(activityId: string, files: File[]) {
    for (const file of files) {
      await uploadSupervisionEvidence(activityId, file);
    }

    await refreshDashboardData();
  }

  if (isLoading) {
    return (
      <div className="loading-screen">
        <div className="loading-card">
          <p className="eyebrow">Memuat Dashboard</p>
          <h1 className="loading-title">Menyiapkan panel keamanan PRISMA.</h1>
          <p className="loading-copy">Mengambil ringkasan fasilitas, lisensi personel, tes, dan dokumen.</p>
        </div>
      </div>
    );
  }

  if (error || !dashboard) {
    return (
      <div className="loading-screen">
        <div className="loading-card">
          <p className="eyebrow">Dashboard Tidak Tersedia</p>
          <h1 className="loading-title">Data keamanan belum dapat dimuat.</h1>
          <p className="loading-copy">{error || 'Backend belum merespons endpoint /api/dashboard.'}</p>
        </div>
      </div>
    );
  }

  const visibleMetrics = dashboard.metrics.filter((item) =>
    matchesQuery(deferredSearch, [item.label, item.delta, item.description])
  );
  const visibleFacilities = dashboard.facilities.filter((item) =>
    matchesQuery(deferredSearch, [item.name, item.zone, item.status, item.coverage, item.updatedAt])
  );
  const visibleLicenses = dashboard.licenses.filter((item) =>
    matchesQuery(deferredSearch, [
      item.slug,
      item.name,
      item.location,
      item.documentPeriod,
      item.sourceDocument,
      item.licenseNumber,
      item.birthPlaceDate,
      item.address,
      item.maritalStatus,
      item.religion,
      item.status,
      item.refreshmentExisting,
      item.refreshmentPlan,
      item.recurrentExisting,
      item.recurrentPlan,
      ...item.educationHistory,
      ...item.workHistory,
      ...item.trainingHistory,
    ])
  );
  const visibleTests = dashboard.tests.filter((item) =>
    matchesQuery(deferredSearch, [
      item.title,
      item.category,
      item.owner,
      item.inspector,
      item.date,
      item.score,
      item.status,
      item.completionNote ?? undefined,
      item.sourceDocument,
      ...item.evidenceFiles.map((evidence) => evidence.name),
    ])
  );
  const visibleDocuments = dashboard.documents.filter((item) =>
    matchesQuery(deferredSearch, [item.title, item.owner, item.version, item.updatedAt, item.status])
  );
  const visibleActivities = dashboard.activities.filter((item) =>
    matchesQuery(deferredSearch, [item.title, item.detail, item.timestamp])
  );
  const visibleSpotlight = dashboard.spotlight.filter((item) =>
    matchesQuery(deferredSearch, [item.label, item.value, item.note])
  );
  const resultCount =
    visibleMetrics.length +
    visibleFacilities.length +
    visibleLicenses.length +
    visibleTests.length +
    visibleDocuments.length +
    visibleActivities.length +
    visibleSpotlight.length;

  const generatedAt = new Intl.DateTimeFormat('id-ID', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(dashboard.generatedAt));

  const routeHero = getRouteHero(
    activeId,
    dashboard,
    visibleFacilities,
    visibleLicenses,
    visibleTests,
    visibleDocuments
  );

  const facilityMetrics = buildFacilityMetrics(dashboard.facilities);
  const topbarTitle =
    activeId === 'dashboard'
      ? 'Dashboard'
      : activeId === 'fasilitas-keamanan'
        ? 'Fasilitas Keamanan'
        : activeId === 'personil-keamanan'
          ? 'Personil Keamanan'
          : activeId === 'tes-keamanan'
            ? 'Program Pengawasan Keamanan'
            : 'Dokumen';
  const topbarCaption = dashboard.organization.branch;

  return (
    <div className="app-shell">
      <div
        className={`sidebar-overlay ${isMobileSidebarOpen ? 'is-visible' : ''}`}
        aria-hidden={isMobileSidebarOpen ? 'false' : 'true'}
        onClick={() => setIsMobileSidebarOpen(false)}
      />
      <Sidebar
        activeId={activeId}
        navigation={dashboard.navigation}
        organization={dashboard.organization}
        isMobileOpen={isMobileSidebarOpen}
        onSelect={handleSelect}
        onRequestClose={() => setIsMobileSidebarOpen(false)}
      />

      <main className="workspace">
        <header className="topbar">
          <div className="topbar-profile">
            <div className="topbar-mobile-shell">
              <button
                type="button"
                className="mobile-nav-toggle"
                aria-label={isMobileSidebarOpen ? 'Tutup menu navigasi' : 'Buka menu navigasi'}
                aria-expanded={isMobileSidebarOpen}
                onClick={() => setIsMobileSidebarOpen((currentValue) => !currentValue)}
              >
                <MenuIcon className="mini-icon mobile-nav-toggle-icon" />
              </button>

              <div className="topbar-backdrop">
              <span className="topbar-chip">Workspace</span>
              <strong>{topbarTitle}</strong>
              <small className="topbar-caption">{topbarCaption}</small>
              </div>
            </div>
          </div>

          <label className="searchbox">
            <SearchIcon className="mini-icon searchbox-icon" />
            <input
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Cari menu, temuan, lisensi, atau dokumen..."
            />
          </label>

          <div className="topbar-actions">
            <button
              type="button"
              className={`topbar-pill topbar-pill--plain ${theme === 'dark' ? 'is-active' : ''}`}
              onClick={() => setTheme((currentTheme) => (currentTheme === 'dark' ? 'light' : 'dark'))}
              aria-label={`Ubah tema ke ${theme === 'dark' ? 'light' : 'dark'}`}
            >
              {theme === 'dark' ? 'Dark' : 'Light'}
            </button>
            <div ref={portalMenuRef} className="topbar-action-group">
              <button
                type="button"
                className={`topbar-pill topbar-pill--menu ${isPortalMenuOpen ? 'is-open' : ''}`}
                onClick={() => {
                  setIsPortalMenuOpen((currentValue) => !currentValue);
                  setIsProfileMenuOpen(false);
                }}
                aria-haspopup="menu"
                aria-expanded={isPortalMenuOpen}
                aria-controls="portal-prisma-menu"
              >
                Portal
                <ChevronDownIcon className={`mini-icon portal-chevron ${isPortalMenuOpen ? 'is-open' : ''}`} />
              </button>

              {isPortalMenuOpen ? (
                <div id="portal-prisma-menu" className="portal-menu" role="menu" aria-label="Portal Prisma">
                  <p className="portal-menu-header">Portal Prisma</p>

                  <div className="portal-grid">
                    {portalLinks.map((item) => (
                      <a
                        key={item.label}
                        href={item.href}
                        role="menuitem"
                        aria-current={item.target === 'keamanan' ? 'page' : undefined}
                        className={`portal-link ${item.target === 'keamanan' ? 'is-current' : ''}`}
                        onClick={() => setIsPortalMenuOpen(false)}
                      >
                        <span className={`portal-link-badge ${item.badgeClassName}`} aria-hidden="true">
                          <PortalLinkIcon kind={item.iconKind} className="portal-link-icon" />
                        </span>
                        <span className="portal-link-label">{item.label}</span>
                      </a>
                    ))}
                  </div>
                </div>
              ) : null}
            </div>
            <div ref={profileMenuRef} className="topbar-action-group">
              <button
                type="button"
                className={`icon-button ${isProfileMenuOpen ? 'is-open' : ''}`}
                aria-label="Profil pengguna"
                aria-haspopup="menu"
                aria-expanded={isProfileMenuOpen}
                aria-controls="profile-menu"
                onClick={() => {
                  setIsProfileMenuOpen((currentValue) => !currentValue);
                  setIsPortalMenuOpen(false);
                }}
              >
                <UserIcon className="mini-icon" />
              </button>

              {isProfileMenuOpen ? (
                <div id="profile-menu" className="profile-menu" role="menu" aria-label="Profil pengguna">
                  <button type="button" className="profile-menu-action" role="menuitem" onClick={handleLogout}>
                    <span className="profile-menu-badge" aria-hidden="true">
                      <LogoutIcon className="profile-menu-icon" />
                    </span>
                    <span>Logout</span>
                  </button>
                </div>
              ) : null}
            </div>
          </div>
        </header>

        {activeId === 'dashboard' ? (
          <DashboardPage
            dashboard={dashboard}
            generatedAt={generatedAt}
            searchQuery={deferredSearch}
            visibleFacilities={visibleFacilities}
            visibleLicenses={visibleLicenses}
            visibleTests={visibleTests}
            visibleDocuments={visibleDocuments}
          />
        ) : activeId === 'personil-keamanan' && selectedPerson ? (
          <PersonnelDetailHero person={selectedPerson} onBack={() => handleSelect('personil-keamanan')} />
        ) : activeId === 'tes-keamanan' || activeId === 'personil-keamanan' || activeId === 'dokumen' ? null : (
          <RouteHero
            eyebrow={routeHero.eyebrow}
            title={routeHero.title}
            subtitle={routeHero.subtitle}
            generatedAt={generatedAt}
            chips={routeHero.chips}
            resultCount={resultCount}
            showMeta={routeHero.showMeta}
            showResultCount={routeHero.showResultCount}
          />
        )}

        {activeId === 'fasilitas-keamanan' ? (
          <>
            <section className="metrics-grid metrics-grid--facilities">
              {facilityMetrics.map((metric) => (
                <MetricCard key={metric.label} metric={metric} />
              ))}
            </section>
            <FacilitiesSection
              facilities={visibleFacilities}
              onAddFacility={handleAddFacility}
              onDeleteFacility={handleDeleteFacility}
            />
          </>
        ) : null}

        {activeId === 'personil-keamanan' && !selectedPerson ? (
          <PersonnelSection
            eyebrow="Personil Keamanan"
            title="Roster personel dan lisensi"
            subtitle="Pastikan ketersediaan lisensi kritis dan coverage setiap shift operasional."
            licenses={visibleLicenses}
            onAddPerson={handleAddPerson}
            onDeletePerson={handleDeletePerson}
            onDeletePersonnelTable={handleDeletePersonnelTable}
            onImportPersonnel={handleImportPersonnel}
            onSelectPerson={handleSelectPerson}
          />
        ) : null}

        {activeId === 'personil-keamanan' && selectedPerson ? (
          <PersonnelDetailPage
            person={selectedPerson}
            certificates={selectedCertificates}
            onUploadPhoto={(file) => handleUploadPersonnelPhoto(selectedPerson.slug, file)}
            onUploadCertificate={(file) => handleCertificateUpload(selectedPerson.slug, file)}
            onDeleteCertificate={(certificateId) => handleCertificateDelete(selectedPerson.slug, certificateId)}
          />
        ) : null}

        {activeId === 'tes-keamanan' ? (
          <SupervisionProgramSection
            tests={dashboard.tests}
            searchQuery={deferredSearch}
            onUpdateActivity={handleUpdateSupervisionActivity}
            onUploadEvidence={handleUploadSupervisionActivityEvidence}
          />
        ) : null}

        {activeId === 'dokumen' ? (
          <DocumentsSection
            documents={visibleDocuments}
            generatedAt={generatedAt}
            onDeleteDocument={handleDeleteDocument}
            onDeleteDocumentsTable={handleDeleteDocumentsTable}
          />
        ) : null}
      </main>
    </div>
  );
}

function DashboardPage({
  dashboard,
  generatedAt,
  searchQuery,
  visibleFacilities,
  visibleLicenses,
  visibleTests,
  visibleDocuments,
}: {
  dashboard: DashboardData;
  generatedAt: string;
  searchQuery: string;
  visibleFacilities: FacilityItem[];
  visibleLicenses: LicenseItem[];
  visibleTests: TestItem[];
  visibleDocuments: DocumentItem[];
}) {
  const facilityOptimalCount = visibleFacilities.filter((item) => item.status === 'Optimal').length;
  const facilityNeedsServiceCount = visibleFacilities.filter((item) => item.status === 'Perlu Servis').length;
  const facilityScheduledCount = visibleFacilities.filter((item) => item.status === 'Terjadwal').length;

  const validPersonnelCount = visibleLicenses.filter((item) => item.status === 'Valid').length;
  const renewalPersonnelCount = visibleLicenses.filter((item) => item.status === 'Perpanjangan').length;
  const trainingPersonnelCount = visibleLicenses.filter((item) => item.status === 'Pelatihan').length;

  const completedSupervisionCount = visibleTests.filter((item) => item.status === 'Terlaksana').length;
  const scheduledSupervisionCount = visibleTests.filter((item) => item.status === 'Terjadwal').length;
  const followUpSupervisionCount = visibleTests.filter((item) => item.status === 'Perlu Tindak Lanjut').length;
  const evidenceUploadCount = visibleTests.reduce((total, item) => total + item.evidenceFiles.length, 0);

  const activeDocumentCount = visibleDocuments.filter((item) => item.status === 'Aktif').length;
  const reviewDocumentCount = visibleDocuments.filter((item) => item.status === 'Review').length;
  const revisionDocumentCount = visibleDocuments.filter((item) => item.status === 'Revisi').length;
  const evidenceDocumentCount = visibleDocuments.filter((item) => item.version === 'Evidence Upload').length;

  const facilityPreview = visibleFacilities.slice(0, 3);
  const personnelPreview = visibleLicenses.slice(0, 3);
  const supervisionPreview = visibleTests.slice(0, 3);
  const documentPreview = visibleDocuments.slice(0, 3);
  const isSearching = searchQuery.trim().length > 0;
  const totalOverviewItems =
    visibleFacilities.length + visibleLicenses.length + visibleTests.length + visibleDocuments.length;

  return (
    <>
      <section className="panel dashboard-overview-hero">
        <div className="dashboard-header-copy">
          <div>
            <p className="eyebrow">Dashboard</p>
            <h2 className="dashboard-page-title">Perum LPPNPI Cabang Surabaya</h2>
            <p className="panel-copy">
              Pantau kondisi terbaru fasilitas keamanan, personil keamanan, program pengawasan keamanan, dan dokumen
              dari satu halaman ringkas sebelum masuk ke fitur detailnya.
            </p>
          </div>
          <div className="dashboard-header-meta">
            <span className="data-chip">Sinkron {generatedAt}</span>
            <span className="data-chip">4 fitur utama</span>
          </div>
        </div>
        {isSearching ? (
          <div className="dashboard-search-note">
            Menampilkan overview yang cocok dengan pencarian <strong>{searchQuery}</strong>.
          </div>
        ) : null}
      </section>

      <section className="dashboard-feature-grid">
        <article className="panel dashboard-module-card">
          <div className="dashboard-module-head">
            <div>
              <p className="eyebrow">Fasilitas Keamanan</p>
              <h3 className="dashboard-module-title">Kondisi alat lapangan</h3>
            </div>
            <span className="data-chip">{visibleFacilities.length} alat</span>
          </div>

          <div className="dashboard-module-highlight">
            <strong>{facilityOptimalCount}</strong>
            <span>alat dalam status optimal</span>
            <p>
              {facilityNeedsServiceCount > 0
                ? `${facilityNeedsServiceCount} alat perlu servis dan ${facilityScheduledCount} masih terjadwal untuk penanganan.`
                : 'Belum ada alat yang masuk status perlu servis pada data yang sedang ditampilkan.'}
            </p>
          </div>

          <div className="dashboard-module-stat-grid">
            <div className="dashboard-module-stat">
              <span>Optimal</span>
              <strong>{facilityOptimalCount}</strong>
            </div>
            <div className="dashboard-module-stat">
              <span>Perlu Servis</span>
              <strong>{facilityNeedsServiceCount}</strong>
            </div>
            <div className="dashboard-module-stat">
              <span>Terjadwal</span>
              <strong>{facilityScheduledCount}</strong>
            </div>
          </div>

          <div className="dashboard-module-list">
            {facilityPreview.length ? (
              facilityPreview.map((item) => (
                <div key={item.id} className="dashboard-module-item">
                  <div className="dashboard-module-item-copy">
                    <strong>
                      {item.photoUrl ? (
                        <a href={item.photoUrl} target="_blank" rel="noreferrer" className="facility-name-link">
                          {item.name}
                        </a>
                      ) : (
                        item.name
                      )}
                    </strong>
                    <p>
                      {item.zone} · Coverage {item.coverage}
                    </p>
                  </div>
                  <div className="dashboard-module-item-meta">
                    <StatusBadge status={item.status} />
                  </div>
                </div>
              ))
            ) : (
              <EmptyRows copy="Belum ada fasilitas yang cocok dengan pencarian." />
            )}
          </div>
        </article>

        <article className="panel dashboard-module-card">
          <div className="dashboard-module-head">
            <div>
              <p className="eyebrow">Personil Keamanan</p>
              <h3 className="dashboard-module-title">Status lisensi personel</h3>
            </div>
            <span className="data-chip">{visibleLicenses.length} personel</span>
          </div>

          <div className="dashboard-module-highlight">
            <strong>{validPersonnelCount}</strong>
            <span>personel dengan lisensi valid</span>
            <p>
              {renewalPersonnelCount + trainingPersonnelCount > 0
                ? `${renewalPersonnelCount} perlu perpanjangan dan ${trainingPersonnelCount} masuk status pelatihan.`
                : 'Tidak ada personel yang sedang menunggu perpanjangan atau pelatihan pada data ini.'}
            </p>
          </div>

          <div className="dashboard-module-stat-grid">
            <div className="dashboard-module-stat">
              <span>Valid</span>
              <strong>{validPersonnelCount}</strong>
            </div>
            <div className="dashboard-module-stat">
              <span>Perpanjangan</span>
              <strong>{renewalPersonnelCount}</strong>
            </div>
            <div className="dashboard-module-stat">
              <span>Pelatihan</span>
              <strong>{trainingPersonnelCount}</strong>
            </div>
          </div>

          <div className="dashboard-module-list">
            {personnelPreview.length ? (
              personnelPreview.map((item) => (
                <div key={item.slug} className="dashboard-module-item">
                  <div className="dashboard-module-item-copy">
                    <strong>{item.name}</strong>
                    <p>{item.location}</p>
                  </div>
                  <div className="dashboard-module-item-meta">
                    <StatusBadge status={item.status} />
                  </div>
                </div>
              ))
            ) : (
              <EmptyRows copy="Belum ada personel yang cocok dengan pencarian." />
            )}
          </div>
        </article>

        <article className="panel dashboard-module-card">
          <div className="dashboard-module-head">
            <div>
              <p className="eyebrow">Program Pengawasan</p>
              <h3 className="dashboard-module-title">Pelaksanaan agenda keamanan</h3>
            </div>
            <span className="data-chip">{visibleTests.length} agenda</span>
          </div>

          <div className="dashboard-module-highlight">
            <strong>{completedSupervisionCount}</strong>
            <span>agenda sudah terlaksana</span>
            <p>
              {scheduledSupervisionCount} masih terjadwal, {followUpSupervisionCount} perlu tindak lanjut, dan{' '}
              {evidenceUploadCount} file evidence sudah terhubung.
            </p>
          </div>

          <div className="dashboard-module-stat-grid">
            <div className="dashboard-module-stat">
              <span>Terlaksana</span>
              <strong>{completedSupervisionCount}</strong>
            </div>
            <div className="dashboard-module-stat">
              <span>Terjadwal</span>
              <strong>{scheduledSupervisionCount}</strong>
            </div>
            <div className="dashboard-module-stat">
              <span>Tindak Lanjut</span>
              <strong>{followUpSupervisionCount}</strong>
            </div>
          </div>

          <div className="dashboard-module-list">
            {supervisionPreview.length ? (
              supervisionPreview.map((item) => (
                <div key={item.id} className="dashboard-module-item">
                  <div className="dashboard-module-item-copy">
                    <strong>{item.title}</strong>
                    <p>
                      {item.location ?? item.owner} · {item.completedAt ?? item.date}
                    </p>
                  </div>
                  <div className="dashboard-module-item-meta">
                    <span className={getSupervisionCategoryBadgeClass(item.category)}>{item.category}</span>
                    <StatusBadge status={item.status} />
                  </div>
                </div>
              ))
            ) : (
              <EmptyRows copy="Belum ada agenda pengawasan yang cocok dengan pencarian." />
            )}
          </div>
        </article>

        <article className="panel dashboard-module-card">
          <div className="dashboard-module-head">
            <div>
              <p className="eyebrow">Dokumen</p>
              <h3 className="dashboard-module-title">Kontrol arsip dan evidence</h3>
            </div>
            <span className="data-chip">{visibleDocuments.length} dokumen</span>
          </div>

          <div className="dashboard-module-highlight">
            <strong>{activeDocumentCount}</strong>
            <span>dokumen berstatus aktif</span>
            <p>
              {evidenceDocumentCount} dokumen berasal dari upload evidence, {reviewDocumentCount} review, dan{' '}
              {revisionDocumentCount} revisi.
            </p>
          </div>

          <div className="dashboard-module-stat-grid">
            <div className="dashboard-module-stat">
              <span>Aktif</span>
              <strong>{activeDocumentCount}</strong>
            </div>
            <div className="dashboard-module-stat">
              <span>Review</span>
              <strong>{reviewDocumentCount}</strong>
            </div>
            <div className="dashboard-module-stat">
              <span>Revisi</span>
              <strong>{revisionDocumentCount}</strong>
            </div>
          </div>

          <div className="dashboard-module-list">
            {documentPreview.length ? (
              documentPreview.map((item) => (
                <div key={item.id} className="dashboard-module-item">
                  <div className="dashboard-module-item-copy">
                    <strong>{item.title}</strong>
                    <p>
                      {item.owner} · {item.version}
                    </p>
                  </div>
                  <div className="dashboard-module-item-meta">
                    <StatusBadge status={item.status} />
                  </div>
                </div>
              ))
            ) : (
              <EmptyRows copy="Belum ada dokumen yang cocok dengan pencarian." />
            )}
          </div>
        </article>
      </section>
    </>
  );
}

function RouteHero({
  eyebrow,
  title,
  subtitle,
  generatedAt,
  chips,
  resultCount,
  showMeta = true,
  showResultCount = true,
}: {
  eyebrow: string;
  title: string;
  subtitle?: string;
  generatedAt: string;
  chips?: string[];
  resultCount: number;
  showMeta?: boolean;
  showResultCount?: boolean;
}) {
  return (
    <section className="hero">
      <div className="hero-gradient" />
      <div className="hero-card">
        <div>
          <p className="eyebrow">{eyebrow}</p>
          <h2 className="hero-title">{title}</h2>
          {subtitle ? <p className="hero-copy">{subtitle}</p> : null}
        </div>
        {showMeta ? (
          <div className="hero-actions">
            <span className="data-chip">Sinkron {generatedAt}</span>
            {showResultCount !== false ? <span className="data-chip">{resultCount} hasil cocok</span> : null}
            {(chips ?? []).slice(0, 2).map((chip) => (
              <span key={chip} className="data-chip">
                {chip}
              </span>
            ))}
          </div>
        ) : null}
      </div>
    </section>
  );
}

function ActivityPanel({
  generatedAt,
  activities,
  spotlight,
}: {
  generatedAt: string;
  activities: ActivityItem[];
  spotlight: SpotlightItem[];
}) {
  return (
    <article className="panel panel-activity">
      <div className="panel-head">
        <div>
          <p className="eyebrow">Live Feed</p>
          <h2 className="panel-title">Aktivitas Terkini</h2>
          <p className="panel-copy">Update paling baru dari fasilitas, lisensi, dan dokumen.</p>
        </div>
        <span className="data-chip">Sinkron {generatedAt}</span>
      </div>

      <div className="activity-list">
        {activities.length ? (
          activities.map((item) => (
            <div key={item.title} className="activity-item">
              <span className="activity-pulse" />
              <div>
                <strong>{item.title}</strong>
                <p>{item.detail}</p>
                <small>{item.timestamp}</small>
              </div>
            </div>
          ))
        ) : (
          <EmptyRows copy="Tidak ada aktivitas yang cocok dengan pencarian." />
        )}
      </div>

      <div className="spotlight-grid">
        {spotlight.map((item) => (
          <div key={item.label} className="spotlight-card">
            <span>{item.label}</span>
            <strong>{item.value}</strong>
            <p>{item.note}</p>
          </div>
        ))}
      </div>
    </article>
  );
}

function FacilitiesSection({
  facilities,
  onAddFacility,
  onDeleteFacility,
}: {
  facilities: FacilityItem[];
  onAddFacility: (input: NewFacilityInput) => Promise<void>;
  onDeleteFacility: (id: string) => Promise<void>;
}) {
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [photoPreview, setPhotoPreview] = useState('');
  const photoInputRef = useRef<HTMLInputElement | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<null | { id: string; name: string }>(null);
  const [formState, setFormState] = useState<NewFacilityInput>({
    name: '',
    zone: '',
    status: 'Optimal',
    coveragePercent: '',
    photo: null,
  });

  useEffect(() => {
    if (!formState.photo) {
      setPhotoPreview('');
      return;
    }

    const nextPreview = URL.createObjectURL(formState.photo);
    setPhotoPreview(nextPreview);

    return () => {
      URL.revokeObjectURL(nextPreview);
    };
  }, [formState.photo]);

  useEffect(() => {
    if (!deleteTarget) {
      return;
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape' && !isDeleting) {
        setDeleteTarget(null);
      }
    }

    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [deleteTarget, isDeleting]);

  function handleFormChange<Key extends keyof NewFacilityInput>(key: Key, value: NewFacilityInput[Key]) {
    setFormState((current) => ({
      ...current,
      [key]: value,
    }));
  }

  function closeModal() {
    setIsAddOpen(false);
    setIsSubmitting(false);
    setSubmitError('');
    setFormState({
      name: '',
      zone: '',
      status: 'Optimal',
      coveragePercent: '',
      photo: null,
    });
    if (photoInputRef.current) {
      photoInputRef.current.value = '';
    }
  }

  async function handleConfirmDelete() {
    if (!deleteTarget) {
      return;
    }

    try {
      setIsDeleting(true);
      setSubmitError('');
      await onDeleteFacility(deleteTarget.id);
      setDeleteTarget(null);
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : 'Gagal menghapus alat keamanan.');
    } finally {
      setIsDeleting(false);
    }
  }

  function handlePhotoChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0] ?? null;
    if (!file) {
      return;
    }

    setSubmitError('');
    setFormState((current) => ({
      ...current,
      photo: file,
    }));
  }

  function handleRemovePhoto() {
    setFormState((current) => ({
      ...current,
      photo: null,
    }));
    if (photoInputRef.current) {
      photoInputRef.current.value = '';
    }
  }

  function handleExportDocument() {
    if (!facilities.length) {
      return;
    }

    const now = new Date();
    const dateFormatter = new Intl.DateTimeFormat('sv-SE', {
      timeZone: 'Asia/Jakarta',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });
    const labelFormatter = new Intl.DateTimeFormat('id-ID', {
      timeZone: 'Asia/Jakarta',
      dateStyle: 'long',
      timeStyle: 'short',
    });
    const exportDate = dateFormatter.format(now);
    const documentContent = buildFacilityExportDocument(facilities, labelFormatter.format(now));
    const blob = new Blob(['\ufeff', documentContent], {
      type: 'application/msword;charset=utf-8',
    });
    const downloadUrl = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = downloadUrl;
    link.download = `rekap-fasilitas-keamanan-${exportDate}.doc`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.setTimeout(() => URL.revokeObjectURL(downloadUrl), 1000);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const name = formState.name.trim();
    const zone = formState.zone.trim();
    const coveragePercent = Number.parseInt(formState.coveragePercent, 10);

    if (!name || !zone) {
      setSubmitError('Nama alat dan zona wajib diisi.');
      return;
    }

    if (!Number.isFinite(coveragePercent) || Number.isNaN(coveragePercent) || coveragePercent < 0 || coveragePercent > 100) {
      setSubmitError('Coverage harus diisi angka 0 sampai 100.');
      return;
    }

    try {
      setIsSubmitting(true);
      setSubmitError('');
      await onAddFacility({
        name,
        zone,
        status: formState.status,
        coveragePercent: String(coveragePercent),
        photo: formState.photo,
      });
      closeModal();
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : 'Gagal menambahkan alat keamanan.');
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <section className="section-grid">
      <article className="panel">
        <div className="panel-head">
          <div>
            <p className="eyebrow">Fasilitas Keamanan</p>
            <h2 className="panel-title">Status perangkat lapangan</h2>
            <p className="panel-copy">Pantau cakupan perangkat dan jadwal servis dari satu tabel.</p>
          </div>
          <div className="panel-head-actions">
            <button
              type="button"
              className="action-pill is-ghost"
              onClick={handleExportDocument}
              disabled={!facilities.length || isSubmitting || isDeleting}
            >
              Export dokumen
            </button>
            <button
              type="button"
              className="action-pill is-primary"
              onClick={() => setIsAddOpen(true)}
              disabled={isDeleting}
            >
              Tambah Alat
            </button>
          </div>
        </div>

        <div className="table-shell records-table-desktop">
          {facilities.length ? (
            <table className="data-table facility-table">
              <colgroup>
                <col className="facility-table-col facility-table-col--name" />
                <col className="facility-table-col facility-table-col--zone" />
                <col className="facility-table-col facility-table-col--status" />
                <col className="facility-table-col facility-table-col--coverage" />
                <col className="facility-table-col facility-table-col--updated" />
                <col className="facility-table-col facility-table-col--action" />
              </colgroup>
              <thead>
                <tr>
                  <th>Fasilitas</th>
                  <th>Zona</th>
                  <th>Status</th>
                  <th>Coverage</th>
                  <th>Pembaruan</th>
                  <th className="personnel-actions-head">Aksi</th>
                </tr>
              </thead>
              <tbody>
                {facilities.map((item) => (
                  <tr key={item.id}>
                    <td>
                      {item.photoUrl ? (
                        <a href={item.photoUrl} target="_blank" rel="noreferrer" className="facility-name-link">
                          {item.name}
                        </a>
                      ) : (
                        <span className="facility-name-text">{item.name}</span>
                      )}
                    </td>
                    <td>{item.zone}</td>
                    <td>
                      <StatusBadge status={item.status} />
                    </td>
                    <td>{item.coverage}</td>
                    <td>{item.updatedAt}</td>
                    <td className="personnel-actions-cell">
                      <button
                        type="button"
                        className="personnel-row-delete"
                        onClick={() => setDeleteTarget({ id: item.id, name: item.name })}
                        disabled={isDeleting || isSubmitting}
                        aria-label={`Hapus ${item.name}`}
                        title={`Hapus ${item.name}`}
                      >
                        <TrashIcon className="mini-icon personnel-row-delete-icon" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <EmptyRows copy="Tidak ada data fasilitas yang cocok dengan pencarian." />
          )}
        </div>

        <div className="records-mobile-list">
          {facilities.length ? (
            facilities.map((item) => (
              <article key={item.id} className="records-mobile-card">
                <div className="records-mobile-top">
                  <div className="records-mobile-copy">
                    <strong>
                      {item.photoUrl ? (
                        <a href={item.photoUrl} target="_blank" rel="noreferrer" className="facility-name-link">
                          {item.name}
                        </a>
                      ) : (
                        item.name
                      )}
                    </strong>
                    <p>{item.zone}</p>
                  </div>
                  <div className="records-mobile-actions">
                    <StatusBadge status={item.status} />
                    <button
                      type="button"
                      className="personnel-row-delete"
                      onClick={() => setDeleteTarget({ id: item.id, name: item.name })}
                      disabled={isDeleting || isSubmitting}
                      aria-label={`Hapus ${item.name}`}
                      title={`Hapus ${item.name}`}
                    >
                      <TrashIcon className="mini-icon personnel-row-delete-icon" />
                    </button>
                  </div>
                </div>

                <dl className="records-mobile-meta">
                  <div>
                    <dt>Coverage</dt>
                    <dd>{item.coverage}</dd>
                  </div>
                  <div>
                    <dt>Pembaruan</dt>
                    <dd>{item.updatedAt}</dd>
                  </div>
                </dl>
              </article>
            ))
          ) : (
            <EmptyRows copy="Tidak ada data fasilitas yang cocok dengan pencarian." />
          )}
        </div>
      </article>

      <article className="panel panel-side">
        <div className="panel-head">
          <div>
            <p className="eyebrow">Cakupan Area</p>
            <h2 className="panel-title">Fokus inspeksi</h2>
          </div>
        </div>

        <div className="mini-stat-list">
          <MiniStat label="Zona Airside" value="Stabil" note="CCTV dan perimeter tervalidasi 98%." />
          <MiniStat label="Zona Cargo" value="Perlu servis" note="Access gate perlu tindak lanjut vendor." />
          <MiniStat
            label="Terminal Kedatangan"
            value="Aman"
            note="X-Ray checkpoint beroperasi penuh selama shift pagi."
          />
        </div>
      </article>

      {deleteTarget ? (
        <div className="personnel-modal-overlay" onClick={() => (isDeleting ? null : setDeleteTarget(null))}>
          <div
            className="delete-confirm-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="delete-facility-title"
            onClick={(event) => event.stopPropagation()}
          >
            <button
              type="button"
              className="delete-confirm-close"
              aria-label="Tutup dialog hapus"
              onClick={() => setDeleteTarget(null)}
              disabled={isDeleting}
            >
              <CloseIcon className="mini-icon" />
            </button>

            <div className="delete-confirm-copy">
              <h3 id="delete-facility-title" className="delete-confirm-title">
                Hapus {deleteTarget.name}?
              </h3>
              <p className="delete-confirm-text">
                Data alat keamanan yang dipilih beserta foto tersimpan akan dihapus permanen.
              </p>
            </div>

            <div className="delete-confirm-actions">
              <button
                type="button"
                className="action-pill is-ghost delete-confirm-cancel"
                onClick={() => setDeleteTarget(null)}
                disabled={isDeleting}
              >
                Batal
              </button>
              <button
                type="button"
                className="action-pill action-pill--danger delete-confirm-submit"
                onClick={handleConfirmDelete}
                disabled={isDeleting}
              >
                {isDeleting ? 'Menghapus...' : 'Hapus Alat'}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {isAddOpen ? (
        <div className="personnel-modal-overlay" onClick={closeModal}>
          <div
            className="personnel-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="facility-modal-title"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="panel-head">
              <div>
                <p className="eyebrow">Tambah Fasilitas</p>
                <h2 id="facility-modal-title" className="panel-title">
                  Tambah Alat Keamanan
                </h2>
                <p className="panel-copy">Isi data alat agar langsung masuk ke tabel fasilitas keamanan.</p>
              </div>
              <button type="button" className="action-pill is-ghost" onClick={closeModal}>
                Tutup
              </button>
            </div>

            <form className="personnel-form" onSubmit={handleSubmit}>
              <div className="personnel-form-grid">
                <label className="personnel-field">
                  <span>Nama Alat</span>
                  <input
                    className="personnel-form-input"
                    type="text"
                    value={formState.name}
                    onChange={(event) => handleFormChange('name', event.target.value)}
                    placeholder="Contoh: CCTV Corridor Timur"
                    required
                  />
                </label>

                <label className="personnel-field">
                  <span>Zona</span>
                  <input
                    className="personnel-form-input"
                    type="text"
                    value={formState.zone}
                    onChange={(event) => handleFormChange('zone', event.target.value)}
                    placeholder="Contoh: Zona Airside"
                    required
                  />
                </label>

                <label className="personnel-field">
                  <span>Status</span>
                  <select
                    className="personnel-form-input"
                    value={formState.status}
                    onChange={(event) => handleFormChange('status', event.target.value as FacilityItem['status'])}
                  >
                    <option value="Optimal">Optimal</option>
                    <option value="Perlu Servis">Perlu Servis</option>
                  </select>
                </label>

                <label className="personnel-field">
                  <span>Coverage (%)</span>
                  <input
                    className="personnel-form-input"
                    type="number"
                    min={0}
                    max={100}
                    step={1}
                    value={formState.coveragePercent}
                    onChange={(event) => handleFormChange('coveragePercent', event.target.value)}
                    placeholder="0 - 100"
                    required
                  />
                </label>

                <div className="personnel-field personnel-field--full">
                  <span>Foto Alat</span>
                  <div className="photo-upload-card facility-photo-upload-card">
                    <div className="photo-preview-frame facility-photo-preview-frame">
                      {photoPreview ? (
                        <img src={photoPreview} alt="Preview foto alat keamanan" className="photo-preview-image" />
                      ) : (
                        <div className="photo-preview-placeholder">
                          <strong>+</strong>
                          <span>Belum ada foto alat dipilih</span>
                        </div>
                      )}
                    </div>

                    <div className="facility-photo-actions">
                      <label className="photo-upload-button">
                        Pilih Foto
                        <input ref={photoInputRef} type="file" accept="image/*" onChange={handlePhotoChange} />
                      </label>
                      {formState.photo ? (
                        <button type="button" className="action-pill is-ghost" onClick={handleRemovePhoto}>
                          Hapus Foto
                        </button>
                      ) : null}
                    </div>
                  </div>
                </div>
              </div>

              {submitError ? <div className="personnel-form-error">{submitError}</div> : null}

              <div className="personnel-form-actions">
                <button type="button" className="action-pill is-ghost" onClick={closeModal} disabled={isSubmitting}>
                  Batal
                </button>
                <button type="submit" className="action-pill is-primary" disabled={isSubmitting}>
                  {isSubmitting ? 'Menyimpan...' : 'Simpan Alat'}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </section>
  );
}

function PersonnelSection({
  eyebrow,
  title,
  subtitle,
  licenses,
  onAddPerson,
  onDeletePerson,
  onDeletePersonnelTable,
  onImportPersonnel,
  onSelectPerson,
}: {
  eyebrow: string;
  title: string;
  subtitle: string;
  licenses: LicenseItem[];
  onAddPerson: (input: NewPersonnelInput) => Promise<void>;
  onDeletePerson: (slug: string) => Promise<void>;
  onDeletePersonnelTable: () => Promise<void>;
  onImportPersonnel: (items: NewPersonnelInput[]) => Promise<PersonnelImportResult>;
  onSelectPerson: (slug: string) => void;
}) {
  const ITEMS_PER_PAGE = 6;
  const [currentPage, setCurrentPage] = useState(1);
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<null | { mode: 'all' } | { mode: 'item'; slug: string; name: string }>(
    null
  );
  const [submitError, setSubmitError] = useState('');
  const [importError, setImportError] = useState('');
  const [importMessage, setImportMessage] = useState('');
  const [importSuccess, setImportSuccess] = useState<{
    key: number;
    title: string;
    message: string;
  } | null>(null);
  const importInputRef = useRef<HTMLInputElement | null>(null);
  const importSuccessTimeoutRef = useRef<number | null>(null);
  const [formState, setFormState] = useState<NewPersonnelInput>({
    name: '',
    location: '',
    status: 'Valid',
    licenseNumber: '',
    address: '',
  });
  const totalPages = Math.max(1, Math.ceil(licenses.length / ITEMS_PER_PAGE));
  const safePage = Math.min(currentPage, totalPages);
  const startIndex = (safePage - 1) * ITEMS_PER_PAGE;
  const paginatedLicenses = licenses.slice(startIndex, startIndex + ITEMS_PER_PAGE);
  const showingFrom = licenses.length ? startIndex + 1 : 0;
  const showingTo = licenses.length ? Math.min(startIndex + ITEMS_PER_PAGE, licenses.length) : 0;
  const pageNumbers = Array.from({ length: totalPages }, (_, index) => index + 1).filter((page) => {
    if (totalPages <= 5) {
      return true;
    }

    if (safePage <= 3) {
      return page <= 5;
    }

    if (safePage >= totalPages - 2) {
      return page >= totalPages - 4;
    }

    return Math.abs(page - safePage) <= 2;
  });

  useEffect(() => {
    setCurrentPage((page) => Math.min(page, totalPages));
  }, [totalPages]);

  useEffect(() => {
    return () => {
      if (importSuccessTimeoutRef.current) {
        window.clearTimeout(importSuccessTimeoutRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (!deleteTarget) {
      return;
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape' && !isDeleting) {
        setDeleteTarget(null);
      }
    }

    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [deleteTarget, isDeleting]);

  function triggerImportSuccess(title: string, message: string) {
    if (importSuccessTimeoutRef.current) {
      window.clearTimeout(importSuccessTimeoutRef.current);
    }

    setImportSuccess((current) => ({
      key: (current?.key ?? 0) + 1,
      title,
      message,
    }));

    importSuccessTimeoutRef.current = window.setTimeout(() => {
      setImportSuccess(null);
      importSuccessTimeoutRef.current = null;
    }, 2200);
  }

  function handleFormChange<Key extends keyof NewPersonnelInput>(key: Key, value: NewPersonnelInput[Key]) {
    setFormState((current) => ({
      ...current,
      [key]: value,
    }));
  }

  function closeModal() {
    setIsAddOpen(false);
    setSubmitError('');
    setFormState({
      name: '',
      location: '',
      status: 'Valid',
      licenseNumber: '',
      address: '',
    });
  }

  async function handleImportChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    try {
      setIsImporting(true);
      setImportError('');
      setImportMessage('');

      const nextItems = parsePersonnelImportFile(await file.text());
      const result = await onImportPersonnel(nextItems);
      const failedCopy = result.failed.length
        ? ` ${result.failed.length} data belum masuk: ${result.failed.slice(0, 3).join(', ')}${
            result.failed.length > 3 ? ' dan lainnya.' : '.'
          }`
        : '';

      setImportMessage(`${result.imported} personel berhasil diimpor dari ${file.name}.${failedCopy}`);
      if (result.imported > 0) {
        triggerImportSuccess('Import dokumen berhasil', `${result.imported} personel berhasil ditambahkan dari ${file.name}.`);
      }
      setCurrentPage(1);
    } catch (error) {
      setImportError(error instanceof Error ? error.message : 'Gagal mengimpor dokumen personel.');
    } finally {
      setIsImporting(false);
      event.target.value = '';
    }
  }

  async function handleConfirmDelete() {
    if (!deleteTarget) {
      return;
    }

    try {
      setIsDeleting(true);
      setImportError('');
      setImportMessage('');
      if (deleteTarget.mode === 'all') {
        await onDeletePersonnelTable();
        setCurrentPage(1);
        setImportMessage('Seluruh data pada tabel personil keamanan berhasil dihapus.');
      } else {
        await onDeletePerson(deleteTarget.slug);
        setImportMessage(`${deleteTarget.name} berhasil dihapus dari tabel personil keamanan.`);
      }
      setDeleteTarget(null);
    } catch (error) {
      setImportError(
        error instanceof Error
          ? error.message
          : deleteTarget.mode === 'all'
            ? 'Gagal menghapus tabel personil keamanan.'
            : 'Gagal menghapus personil keamanan.'
      );
    } finally {
      setIsDeleting(false);
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!formState.name.trim() || !formState.location.trim()) {
      return;
    }

    try {
      setIsSubmitting(true);
      setSubmitError('');
      await onAddPerson(formState);
      setCurrentPage(1);
      closeModal();
    } catch (submitError) {
      setSubmitError(submitError instanceof Error ? submitError.message : 'Gagal menambahkan personil.');
    } finally {
      setIsSubmitting(false);
    }
  }

  function handleExportDocument() {
    if (!licenses.length) {
      return;
    }

    const now = new Date();
    const dateFormatter = new Intl.DateTimeFormat('sv-SE', {
      timeZone: 'Asia/Jakarta',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });
    const labelFormatter = new Intl.DateTimeFormat('id-ID', {
      timeZone: 'Asia/Jakarta',
      dateStyle: 'long',
      timeStyle: 'short',
    });
    const exportDate = dateFormatter.format(now);
    const documentContent = buildPersonnelExportDocument(licenses, labelFormatter.format(now));
    const blob = new Blob(['\ufeff', documentContent], {
      type: 'application/msword;charset=utf-8',
    });
    const downloadUrl = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = downloadUrl;
    link.download = `rekap-personil-keamanan-${exportDate}.doc`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.setTimeout(() => URL.revokeObjectURL(downloadUrl), 1000);
    triggerImportSuccess('Export dokumen berhasil', 'Data personil keamanan berhasil diekspor ke dokumen Word.');
  }

  return (
    <section className="section-grid section-grid--single">
      <article className="panel">
        <div className="panel-head">
          <div>
            <p className="eyebrow">{eyebrow}</p>
            <h2 className="panel-title">{title}</h2>
            <p className="panel-copy">{subtitle}</p>
          </div>
          <div className="panel-head-actions">
            <input
              ref={importInputRef}
              type="file"
              accept=".csv,text/csv"
              className="hidden"
              onChange={handleImportChange}
            />
            <button
              type="button"
              className="action-pill action-pill--danger"
              onClick={() => setDeleteTarget({ mode: 'all' })}
              disabled={!licenses.length || isDeleting || isImporting}
            >
              {isDeleting ? 'Menghapus...' : 'Hapus'}
            </button>
            <button
              type="button"
              className="action-pill is-ghost"
              onClick={() => importInputRef.current?.click()}
              disabled={isImporting || isDeleting}
            >
              {isImporting ? 'Mengimpor...' : 'Import dokumen'}
            </button>
            <button
              type="button"
              className="action-pill is-ghost"
              onClick={handleExportDocument}
              disabled={!licenses.length || isImporting || isDeleting}
            >
              Export dokumen
            </button>
            <button
              type="button"
              className="action-pill is-primary"
              onClick={() => setIsAddOpen(true)}
              disabled={isDeleting}
            >
              Tambah
            </button>
          </div>
        </div>

        {importMessage ? <div className="program-feedback is-success">{importMessage}</div> : null}
        {importError ? <div className="personnel-form-error">{importError}</div> : null}

        <div className="table-shell">
          {licenses.length ? (
            <>
              <table className="data-table personnel-table">
                <colgroup>
                  <col className="personnel-table-col personnel-table-col--name" />
                  <col className="personnel-table-col personnel-table-col--location" />
                  <col className="personnel-table-col personnel-table-col--action" />
                </colgroup>
                <thead>
                  <tr>
                    <th>Nama</th>
                    <th>Lokasi</th>
                    <th className="personnel-actions-head">Aksi</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedLicenses.map((item) => (
                    <tr key={item.slug} className="personnel-row">
                      <td>
                        <button
                          type="button"
                          className="personnel-name-link"
                          onClick={() => onSelectPerson(item.slug)}
                        >
                          <span className="personnel-name-text">{item.name}</span>
                          <span className="personnel-name-hint">Lihat detail</span>
                        </button>
                      </td>
                      <td className="personnel-location">{item.location}</td>
                      <td className="personnel-actions-cell">
                        <button
                          type="button"
                          className="personnel-row-delete"
                          onClick={() => setDeleteTarget({ mode: 'item', slug: item.slug, name: item.name })}
                          disabled={isDeleting || isImporting}
                          aria-label={`Hapus ${item.name}`}
                          title={`Hapus ${item.name}`}
                        >
                          <TrashIcon className="mini-icon personnel-row-delete-icon" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              <div className="personnel-pagination">
                <div className="personnel-pagination-meta">
                  Menampilkan {showingFrom}-{showingTo} dari {licenses.length} personel
                </div>

                <div className="personnel-pagination-controls">
                  <button
                    type="button"
                    className="personnel-pagination-button"
                    onClick={() => setCurrentPage((page) => Math.max(1, page - 1))}
                    disabled={safePage === 1}
                  >
                    Sebelumnya
                  </button>

                  <div className="personnel-pagination-pages" aria-label="Nomor halaman personel">
                    {pageNumbers.map((page) => (
                      <button
                        key={page}
                        type="button"
                        className={`personnel-pagination-button ${safePage === page ? 'is-active' : ''}`}
                        onClick={() => setCurrentPage(page)}
                        aria-current={safePage === page ? 'page' : undefined}
                      >
                        {page}
                      </button>
                    ))}
                  </div>

                  <button
                    type="button"
                    className="personnel-pagination-button"
                    onClick={() => setCurrentPage((page) => Math.min(totalPages, page + 1))}
                    disabled={safePage === totalPages}
                  >
                    Berikutnya
                  </button>
                </div>
              </div>
            </>
          ) : (
            <EmptyRows copy="Tidak ada data personel yang cocok dengan pencarian." />
          )}
        </div>
      </article>

      {deleteTarget ? (
        <div className="personnel-modal-overlay" onClick={() => (isDeleting ? null : setDeleteTarget(null))}>
          <div
            className="delete-confirm-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="delete-personnel-title"
            onClick={(event) => event.stopPropagation()}
          >
            <button
              type="button"
              className="delete-confirm-close"
              aria-label="Tutup dialog hapus"
              onClick={() => setDeleteTarget(null)}
              disabled={isDeleting}
            >
              <CloseIcon className="mini-icon" />
            </button>

            <div className="delete-confirm-copy">
              <h3 id="delete-personnel-title" className="delete-confirm-title">
                {deleteTarget.mode === 'all' ? 'Hapus semua personil?' : `Hapus ${deleteTarget.name}?`}
              </h3>
              <p className="delete-confirm-text">
                {deleteTarget.mode === 'all'
                  ? 'Semua data personil keamanan beserta foto yang sudah tersimpan akan dihapus permanen.'
                  : 'Data personil yang dipilih beserta foto yang sudah tersimpan akan dihapus permanen.'}
              </p>
            </div>

            <div className="delete-confirm-actions">
              <button
                type="button"
                className="action-pill is-ghost delete-confirm-cancel"
                onClick={() => setDeleteTarget(null)}
                disabled={isDeleting}
              >
                Batal
              </button>
              <button
                type="button"
                className="action-pill action-pill--danger delete-confirm-submit"
                onClick={handleConfirmDelete}
                disabled={isDeleting}
              >
                {isDeleting ? 'Menghapus...' : deleteTarget.mode === 'all' ? 'Hapus Semua' : 'Hapus Personil'}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {isAddOpen ? (
        <div className="personnel-modal-overlay" onClick={closeModal}>
          <div
            className="personnel-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="personnel-modal-title"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="panel-head">
              <div>
                <p className="eyebrow">Tambah Personil</p>
                <h2 id="personnel-modal-title" className="panel-title">
                  Tambah Data Personil Keamanan
                </h2>
                <p className="panel-copy">Isi data dasar personil agar langsung masuk ke daftar roster.</p>
              </div>
              <button type="button" className="action-pill is-ghost" onClick={closeModal}>
                Tutup
              </button>
            </div>

            <form className="personnel-form" onSubmit={handleSubmit}>
              <div className="personnel-form-grid">
                <label className="personnel-field">
                  <span>Nama Personil</span>
                  <input
                    className="personnel-form-input"
                    type="text"
                    value={formState.name}
                    onChange={(event) => handleFormChange('name', event.target.value)}
                    placeholder="Masukkan Nama Personil"
                    required
                  />
                </label>

                <label className="personnel-field">
                  <span>Lokasi</span>
                  <input
                    className="personnel-form-input"
                    type="text"
                    value={formState.location}
                    onChange={(event) => handleFormChange('location', event.target.value)}
                    placeholder="Masukkan Lokasi"
                    required
                  />
                </label>

                <label className="personnel-field">
                  <span>Status</span>
                  <select
                    className="personnel-form-input"
                    value={formState.status}
                    onChange={(event) => handleFormChange('status', event.target.value as LicenseItem['status'])}
                  >
                    <option value="Valid">Valid</option>
                    <option value="Perpanjangan">Perpanjangan</option>
                    <option value="Pelatihan">Pelatihan</option>
                  </select>
                </label>

                <label className="personnel-field">
                  <span>Nomor Lisensi</span>
                  <input
                    className="personnel-form-input"
                    type="text"
                    value={formState.licenseNumber}
                    onChange={(event) => handleFormChange('licenseNumber', event.target.value)}
                    placeholder="Opsional"
                  />
                </label>

                <label className="personnel-field personnel-field--full">
                  <span>Alamat</span>
                  <textarea
                    className="personnel-form-input personnel-form-textarea"
                    value={formState.address}
                    onChange={(event) => handleFormChange('address', event.target.value)}
                    placeholder="Masukkan Alamat"
                    rows={4}
                  />
                </label>
              </div>

              {submitError ? <div className="personnel-form-error">{submitError}</div> : null}

              <div className="personnel-form-actions">
                <button type="button" className="action-pill is-ghost" onClick={closeModal} disabled={isSubmitting}>
                  Batal
                </button>
                <button type="submit" className="action-pill is-primary" disabled={isSubmitting}>
                  {isSubmitting ? 'Menyimpan...' : 'Simpan'}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      {importSuccess ? (
        <div className="upload-success-overlay" aria-live="polite" aria-atomic="true">
          <div className="upload-success-indicator">
            <div className="upload-success-lottie">
              <Lottie key={importSuccess.key} animationData={successAnimation} loop={false} />
            </div>
            <div className="upload-success-copy">
              <strong>{importSuccess.title}</strong>
              <span>{importSuccess.message}</span>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}

function PersonnelDetailHero({
  person,
  onBack,
}: {
  person: LicenseItem;
  onBack: () => void;
}) {
  return (
    <section className="hero">
      <div className="hero-gradient" />
      <div className="hero-card">
        <div>
          <p className="eyebrow">Detail Personil Keamanan</p>
          <h2 className="hero-title">{person.name}</h2>
          <p className="hero-copy">
            {person.location} · {person.licenseNumber === '-' ? 'Nomor license belum tercatat' : person.licenseNumber}
          </p>
        </div>
        <div className="hero-actions">
          <button type="button" className="action-pill is-ghost" onClick={onBack}>
            Kembali ke daftar
          </button>
          <span className="data-chip">{person.documentPeriod}</span>
          <span className="data-chip">{person.religion}</span>
          <span className="data-chip">{person.status}</span>
        </div>
      </div>
    </section>
  );
}

function PersonnelDetailPage({
  person,
  certificates,
  onUploadPhoto,
  onUploadCertificate,
  onDeleteCertificate,
}: {
  person: LicenseItem;
  certificates: CertificateUpload[];
  onUploadPhoto: (file: File) => Promise<void>;
  onUploadCertificate: (file: File) => void;
  onDeleteCertificate: (certificateId: string) => void;
}) {
  const [photoPreview, setPhotoPreview] = useState<string | null>(person.photoUrl ?? null);
  const [photoError, setPhotoError] = useState('');
  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);
  const [uploadSuccess, setUploadSuccess] = useState<{
    key: number;
    title: string;
    message: string;
  } | null>(null);
  const uploadSuccessTimeoutRef = useRef<number | null>(null);

  useEffect(() => {
    setPhotoPreview(person.photoUrl ?? null);
    setPhotoError('');
  }, [person.photoUrl, person.slug]);

  useEffect(() => {
    return () => {
      if (uploadSuccessTimeoutRef.current) {
        window.clearTimeout(uploadSuccessTimeoutRef.current);
      }
    };
  }, []);

  function triggerUploadSuccess(title: string, message: string) {
    if (uploadSuccessTimeoutRef.current) {
      window.clearTimeout(uploadSuccessTimeoutRef.current);
    }

    setUploadSuccess((current) => ({
      key: (current?.key ?? 0) + 1,
      title,
      message,
    }));

    uploadSuccessTimeoutRef.current = window.setTimeout(() => {
      setUploadSuccess(null);
      uploadSuccessTimeoutRef.current = null;
    }, 2200);
  }

  async function handlePhotoChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    const nextPreview = await new Promise<string | null>((resolve) => {
      const reader = new FileReader();
      reader.onload = () => resolve(typeof reader.result === 'string' ? reader.result : null);
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(file);
    });

    if (nextPreview) {
      setPhotoPreview(nextPreview);
    }

    setPhotoError('');
    setIsUploadingPhoto(true);

    try {
      await onUploadPhoto(file);
      triggerUploadSuccess('Upload foto berhasil', 'Foto personel sudah diperbarui.');
    } catch (error) {
      setPhotoPreview(person.photoUrl ?? null);
      setPhotoError(error instanceof Error ? error.message : 'Gagal mengunggah foto personel.');
    } finally {
      setIsUploadingPhoto(false);
      event.target.value = '';
    }
  }

  function handleCertificateChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    onUploadCertificate(file);
    triggerUploadSuccess('Upload sertifikat berhasil', 'File sertifikat sudah siap dibuka.');
    event.target.value = '';
  }

  const initials = getPersonInitials(person.name);

  return (
    <>
      <section className="person-detail-columns">
        <div className="person-detail-column">
          <article className="panel panel-photo-upload">
            <div className="panel-head">
              <div>
                <p className="eyebrow">Upload Foto Karyawan</p>
                <h2 className="panel-title">Foto personel</h2>
                <p className="panel-copy">Unggah foto terbaru personel untuk melengkapi rekam jejak visual.</p>
              </div>
            </div>

            <div className="photo-upload-card">
              <div className="photo-preview-frame">
                {photoPreview ? (
                  <img src={photoPreview} alt={`Foto ${person.name}`} className="photo-preview-image" />
                ) : (
                  <div className="photo-preview-placeholder">
                    <strong>{initials}</strong>
                    <span>{person.name}</span>
                  </div>
                )}
              </div>

              {photoError ? <div className="personnel-form-error">{photoError}</div> : null}

              <label className="photo-upload-button">
                {isUploadingPhoto ? 'Mengunggah...' : 'Pilih Foto'}
                <input type="file" accept="image/*" onChange={handlePhotoChange} disabled={isUploadingPhoto} />
              </label>
            </div>
          </article>

          <article className="panel panel-side">
            <div className="panel-head">
              <div>
                <p className="eyebrow">Alamat</p>
                <h2 className="panel-title">Domisili tercatat</h2>
              </div>
            </div>

            <div className="person-note-card">
              <p>{person.address}</p>
            </div>
          </article>

          <article className="panel panel-side">
            <div className="panel-head">
              <div>
                <p className="eyebrow">Riwayat Pekerjaan</p>
                <h2 className="panel-title">Pengalaman kerja terdokumentasi</h2>
              </div>
            </div>

            <HistoryList items={person.workHistory} emptyCopy="Riwayat pekerjaan belum tercatat di dokumen." />
          </article>

          <article className="panel panel-side">
            <div className="panel-head">
              <div>
                <p className="eyebrow">Refreshment & Recurrent</p>
                <h2 className="panel-title">Jadwal pembaruan lisensi</h2>
              </div>
            </div>

            <div className="person-detail-grid person-detail-grid--compact">
              <DetailItem label="Refreshment Existing" value={person.refreshmentExisting} />
              <DetailItem label="Refreshment Rencana" value={person.refreshmentPlan} />
              <DetailItem label="Recurrent Existing" value={person.recurrentExisting} />
              <DetailItem label="Recurrent Rencana" value={person.recurrentPlan} />
            </div>
          </article>
        </div>

        <div className="person-detail-column">
          <article className="panel">
            <div className="panel-head">
              <div>
                <p className="eyebrow">Profil Personel</p>
                <h2 className="panel-title">Identitas dokumen personel</h2>
                <p className="panel-copy">Data dasar personel keamanan yang tercantum pada dokumen rekam jejak.</p>
              </div>
            </div>

            <div className="person-detail-grid">
              <DetailItem label="Cabang / Lokasi" value={person.location} />
              <DetailItem label="Periode Dokumen" value={person.documentPeriod} />
              <DetailItem label="Nomor License" value={person.licenseNumber} />
              <DetailItem label="Tempat, Tanggal Lahir" value={person.birthPlaceDate} />
              <DetailItem label="Status" value={person.maritalStatus} />
              <DetailItem label="Agama" value={person.religion} />
              <DetailItem label="Status Rekam Jejak" value={person.status} />
              <DetailItem label="Sumber Dokumen" value={person.sourceDocument} />
            </div>
          </article>

          <article className="panel">
            <div className="panel-head">
              <div>
                <p className="eyebrow">Riwayat Pendidikan</p>
                <h2 className="panel-title">Jenjang pendidikan personel</h2>
                <p className="panel-copy">Daftar tingkat pendidikan, sekolah, dan tahun yang tercatat di dokumen.</p>
              </div>
            </div>

            <HistoryList items={person.educationHistory} emptyCopy="Riwayat pendidikan belum tercatat di dokumen." />
          </article>

          <article className="panel">
            <div className="panel-head">
              <div>
                <p className="eyebrow">Riwayat Pelatihan</p>
                <h2 className="panel-title">Diklat dan kompetensi personel</h2>
                <p className="panel-copy">Pelatihan keamanan yang menjadi dasar kompetensi personel.</p>
              </div>
            </div>

            <HistoryList items={person.trainingHistory} emptyCopy="Riwayat pelatihan belum tercatat di dokumen." />
          </article>

          <article className="panel panel-side">
            <div className="panel-head">
              <div>
                <p className="eyebrow">Upload Sertifikat</p>
                <h2 className="panel-title">Sertifikat personel</h2>
                <p className="panel-copy">Unggah file sertifikat personel lalu tampilkan preview sederhananya di panel ini.</p>
              </div>
            </div>

            <div className="certificate-upload-card">
              <div className="certificate-meta-card">
                <span className="certificate-meta-label">File Sertifikat</span>
                <strong>
                  {certificates.length
                    ? `${certificates.length} sertifikat tersimpan untuk personel ini.`
                    : 'Belum ada sertifikat yang diunggah.'}
                </strong>
                <p>
                  {certificates.length
                    ? 'Setiap sertifikat bisa dibuka langsung dengan viewer bawaan browser atau dihapus jika salah upload.'
                    : 'Dukung unggahan PDF atau gambar sertifikat personel.'}
                </p>
              </div>

              <div className="certificate-action-row">
                <label className="photo-upload-button">
                  {certificates.length ? 'Tambah Sertifikat' : 'Upload Sertifikat'}
                  <input type="file" accept="application/pdf,image/*" onChange={handleCertificateChange} />
                </label>
              </div>

              {certificates.length ? (
                <div className="certificate-list">
                  {certificates.map((item, index) => (
                    <div key={item.id} className="certificate-item-card">
                      <div className="certificate-item-copy">
                        <span className="certificate-meta-label">Sertifikat {index + 1}</span>
                        <strong>{item.name}</strong>
                        <p>
                          {(item.mimeType || '').toLowerCase().includes('pdf')
                            ? 'Dokumen PDF siap dibuka.'
                            : item.mimeType.startsWith('image/')
                              ? 'Dokumen gambar siap dibuka.'
                              : 'File siap dibuka di browser.'}
                        </p>
                      </div>
                      <div className="certificate-item-actions">
                        <a href={item.url} target="_blank" rel="noreferrer" className="action-pill is-primary">
                          Lihat Sertifikat
                        </a>
                        <button
                          type="button"
                          className="action-pill action-pill--danger"
                          onClick={() => onDeleteCertificate(item.id)}
                        >
                          Hapus
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : null}
            </div>
          </article>
        </div>
      </section>

      {uploadSuccess ? (
        <div className="upload-success-overlay" aria-live="polite" aria-atomic="true">
          <div className="upload-success-indicator">
            <div className="upload-success-lottie">
              <Lottie key={uploadSuccess.key} animationData={successAnimation} loop={false} />
            </div>
            <div className="upload-success-copy">
              <strong>{uploadSuccess.title}</strong>
              <span>{uploadSuccess.message}</span>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}

function DetailItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="person-detail-item">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function HistoryList({ items, emptyCopy }: { items: string[]; emptyCopy: string }) {
  if (!items.length) {
    return <EmptyRows copy={emptyCopy} />;
  }

  return (
    <div className="person-history-list">
      {items.map((item, index) => (
        <div key={`${index}-${item}`} className="person-history-card">
          {item}
        </div>
      ))}
    </div>
  );
}

function getSupervisionStatusStyles(status: SupervisionStatusTag) {
  if (status === 'Sudah') {
    return {
      badge: 'bg-emerald-50 text-emerald-700 ring-1 ring-inset ring-emerald-200',
      dot: 'bg-emerald-500',
    };
  }

  return {
    badge: 'bg-slate-100 text-slate-600 ring-1 ring-inset ring-slate-200',
    dot: 'bg-slate-400',
  };
}

function getSupervisionCardAccent(kind: SupervisionSummaryCard['kind']) {
  if (kind === 'audit') {
    return 'from-emerald-500 via-emerald-400 to-teal-400';
  }

  if (kind === 'inspection') {
    return 'from-slate-500 via-slate-400 to-slate-300';
  }

  return 'from-sky-500 via-blue-500 to-cyan-400';
}

function getSupervisionHeatmapTone(level: SupervisionHeatmapLevel) {
  if (level > 0) {
    return 'bg-blue-600';
  }

  return 'bg-slate-100';
}

function TestsSection() {
  const [timelineFilter, setTimelineFilter] = useState<SupervisionHeatmapFilter>('Semua');
  const [isTimelineFilterOpen, setIsTimelineFilterOpen] = useState(false);
  const [openTimelineYearPicker, setOpenTimelineYearPicker] = useState<'from' | 'to' | null>(null);
  const [isScheduleComposerOpen, setIsScheduleComposerOpen] = useState(false);
  const [customScheduleEntries, setCustomScheduleEntries] = useState<SupervisionScheduleEntry[]>([]);
  const [timelineYearRange, setTimelineYearRange] = useState({ from: 2026, to: 2026 });
  const [scheduleDraft, setScheduleDraft] = useState<SupervisionScheduleDraft>({
    category: 'Audit',
    branch: 'Cabang Surabaya',
    year: 2026,
    monthIndex: 0,
    slotIndex: 0,
  });
  const timelineFilterRef = useRef<HTMLDivElement | null>(null);
  const timelineYearFilterRef = useRef<HTMLDivElement | null>(null);
  const activeBranchOptions = SUPERVISION_BRANCHES_BY_CATEGORY[scheduleDraft.category];
  const activeYearLabel =
    timelineYearRange.from === timelineYearRange.to
      ? `Tahun ${timelineYearRange.from}`
      : `${timelineYearRange.from} - ${timelineYearRange.to}`;
  const visibleScheduleEntries = [...BASE_SUPERVISION_SCHEDULE_ENTRIES, ...customScheduleEntries].filter(
    (entry) => entry.year >= timelineYearRange.from && entry.year <= timelineYearRange.to,
  );
  const heatmapRows = SUPERVISION_HEATMAP_ROWS.map((row) => {
    if (!row.isBranch || !row.category) {
      return {
        ...row,
        cells: buildSupervisionHeatmapCells([]),
      };
    }

    const matchingEntries = visibleScheduleEntries.filter(
      (entry) => entry.category === row.category && entry.branch === row.label,
    );

    const nextCells = buildSupervisionHeatmapCells(
      matchingEntries.map((entry) => ({
        monthIndex: entry.monthIndex,
        slotIndex: entry.slotIndex,
        level: 4 as SupervisionHeatmapLevel,
      })),
    );

    return {
      ...row,
      cells: nextCells,
    };
  });
  const filteredHeatmapRows =
    timelineFilter === 'Semua'
      ? heatmapRows
      : SUPERVISION_BRANCH_FILTERS.includes(timelineFilter as SupervisionBranchFilter)
        ? (() => {
            const matchingCategories = new Set(
              heatmapRows.filter(
                (row) => row.isBranch && row.label === timelineFilter && row.category,
              ).map((row) => row.category as SupervisionHeatmapCategory),
            );

            return heatmapRows.filter((row) => {
              if (row.isSpacer) return false;
              if (row.isGroup && row.category) return matchingCategories.has(row.category);
              return row.isBranch && row.label === timelineFilter;
            });
          })()
        : heatmapRows.filter(
            (row) => !row.isSpacer && row.category === timelineFilter,
          );

  useEffect(() => {
    if (activeBranchOptions.includes(scheduleDraft.branch)) {
      return;
    }

    setScheduleDraft((current) => ({
      ...current,
      branch: activeBranchOptions[0],
    }));
  }, [activeBranchOptions, scheduleDraft.branch]);

  useEffect(() => {
    if (!isTimelineFilterOpen) {
      return undefined;
    }

    const handlePointerDown = (event: MouseEvent) => {
      if (!timelineFilterRef.current?.contains(event.target as Node)) {
        setIsTimelineFilterOpen(false);
      }
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsTimelineFilterOpen(false);
      }
    };

    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('keydown', handleEscape);

    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [isTimelineFilterOpen]);

  const handleTimelineFilterSelect = (value: SupervisionHeatmapFilter) => {
    setTimelineFilter(value);
    setIsTimelineFilterOpen(false);
  };

  const handleTimelineYearSelect = (key: 'from' | 'to', value: number) => {
    handleTimelineYearChange(key, value);
    setOpenTimelineYearPicker(null);
  };

  const handleTimelineYearChange = (key: 'from' | 'to', value: number) => {
    setTimelineYearRange((current) => {
      if (key === 'from') {
        return {
          from: value,
          to: Math.max(value, current.to),
        };
      }

      return {
        from: Math.min(current.from, value),
        to: value,
      };
    });
  };

  useEffect(() => {
    if (!openTimelineYearPicker) {
      return undefined;
    }

    const handlePointerDown = (event: MouseEvent) => {
      if (!timelineYearFilterRef.current?.contains(event.target as Node)) {
        setOpenTimelineYearPicker(null);
      }
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpenTimelineYearPicker(null);
      }
    };

    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('keydown', handleEscape);

    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [openTimelineYearPicker]);

  const handleAddSchedule = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const nextEntry = {
      id:
        typeof crypto !== 'undefined' && 'randomUUID' in crypto
          ? crypto.randomUUID()
          : `${Date.now()}-${Math.random().toString(36).slice(2)}`,
      category: scheduleDraft.category,
      branch: scheduleDraft.branch,
      year: scheduleDraft.year,
      monthIndex: scheduleDraft.monthIndex,
      slotIndex: scheduleDraft.slotIndex,
    } satisfies SupervisionScheduleEntry;

    setCustomScheduleEntries((current) => {
      const alreadyExists = current.some(
        (entry) =>
          entry.category === nextEntry.category &&
          entry.branch === nextEntry.branch &&
          entry.year === nextEntry.year &&
          entry.monthIndex === nextEntry.monthIndex &&
          entry.slotIndex === nextEntry.slotIndex,
      );

      if (alreadyExists) {
        return current;
      }

      return [...current, nextEntry];
    });
    setTimelineFilter('Semua');
    setIsScheduleComposerOpen(false);
  };

  return (
    <section className="flex min-w-0 w-full max-w-none flex-col gap-4 sm:gap-5 md:gap-6">
      <div className="rounded-[26px] border border-slate-200/80 bg-white/95 px-4 py-5 shadow-[0_18px_50px_rgba(15,23,42,0.08)] backdrop-blur sm:rounded-[30px] sm:px-6 sm:py-6 md:px-8 md:py-8">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0 max-w-3xl">
            <p className="text-xs font-semibold uppercase tracking-[0.32em] text-slate-400">
              Program Pengawasan Keamanan
            </p>
            <h2 className="mt-3 break-words text-[1.9rem] font-semibold tracking-[-0.04em] text-slate-900 sm:text-3xl md:text-[2.35rem]">
              Dashboard Jadwal Pengawasan Internal
            </h2>
            <p className="mt-3 max-w-2xl text-sm leading-7 text-slate-500 sm:text-[15px] md:text-base">
              Monitoring pelaksanaan Audit, Inspeksi, dan Tes Keamanan secara terpusat untuk
              membantu tim internal melihat status utama dengan cepat.
            </p>
          </div>

          <div className="inline-flex w-fit items-center rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white shadow-[0_10px_30px_rgba(15,23,42,0.18)]">
            {activeYearLabel}
          </div>
        </div>
      </div>

      <div className="grid gap-4 sm:gap-5 md:grid-cols-2 xl:grid-cols-3">
        {SUPERVISION_SUMMARY_CARDS.map((card) => {
          const accent = getSupervisionCardAccent(card.kind);
          const inspectionCompletedCount =
            card.kind === 'inspection' ? card.locations.filter((location) => location.status === 'Sudah').length : 0;
          const inspectionPendingCount =
            card.kind === 'inspection' ? card.locations.length - inspectionCompletedCount : 0;

          return (
            <article
              key={card.id}
              className="relative min-w-0 overflow-hidden rounded-[24px] border border-slate-200/80 bg-white p-5 shadow-[0_18px_44px_rgba(15,23,42,0.08)] sm:rounded-[28px] sm:p-6"
            >
              <div className={`absolute inset-x-0 top-0 h-1 bg-gradient-to-r ${accent}`} />

              <div className="relative flex h-full flex-col gap-5 sm:gap-6">
                <div className="flex flex-col items-start justify-between gap-3 sm:flex-row sm:items-start">
                  <div className="min-w-0">
                    <p className="text-xs font-semibold uppercase tracking-[0.28em] text-slate-400">
                      {card.frequency}
                    </p>
                    <h3 className="mt-3 break-words text-[1.45rem] font-semibold tracking-[-0.03em] text-slate-900 sm:text-[1.6rem]">
                      {card.title}
                    </h3>
                  </div>

                  {'status' in card ? (
                    <span
                      className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ${getSupervisionStatusStyles(card.status).badge}`}
                    >
                      {card.status}
                    </span>
                  ) : (
                    <span className="inline-flex items-center rounded-full bg-sky-50 px-3 py-1 text-xs font-semibold text-sky-700 ring-1 ring-inset ring-sky-200">
                      {card.done} / {card.total} done
                    </span>
                  )}
                </div>

                {card.kind === 'audit' ? (
                  <>
                    <p className="text-sm leading-6 text-slate-500">{card.description}</p>
                    <div className="grid gap-3 sm:grid-cols-3">
                      <div className="rounded-[20px] border border-slate-200 bg-slate-50 px-4 py-4">
                        <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-400">Status</p>
                        <div className="mt-3 flex items-center gap-2">
                          <span className={`h-2.5 w-2.5 rounded-full ${getSupervisionStatusStyles(card.status).dot}`} />
                          <strong className="text-lg font-semibold tracking-[-0.03em] text-slate-900">{card.status}</strong>
                        </div>
                      </div>
                      <div className="rounded-[20px] border border-slate-200 bg-slate-50 px-4 py-4">
                        <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-400">Next</p>
                        <strong className="mt-3 block text-lg font-semibold tracking-[-0.03em] text-slate-900">
                          {card.nextSchedule}
                        </strong>
                      </div>
                      <div className="rounded-[20px] border border-slate-200 bg-slate-50 px-4 py-4">
                        <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-400">Cycle</p>
                        <strong className="mt-3 block text-lg font-semibold tracking-[-0.03em] text-slate-900">
                          2 Tahun
                        </strong>
                      </div>
                    </div>
                  </>
                ) : null}

                {card.kind === 'inspection' ? (
                  <>
                    <p className="text-sm leading-6 text-slate-500">{card.description}</p>
                    <div className="grid gap-3 sm:grid-cols-3">
                      <div className="rounded-[20px] border border-slate-200 bg-slate-50 px-4 py-4">
                        <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-400">Status</p>
                        <strong className="mt-3 block text-lg font-semibold tracking-[-0.03em] text-slate-900">
                          {card.status}
                        </strong>
                      </div>
                      <div className="rounded-[20px] border border-slate-200 bg-slate-50 px-4 py-4">
                        <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-400">Cabang</p>
                        <strong className="mt-3 block text-lg font-semibold tracking-[-0.03em] text-slate-900">
                          {card.locations.length}
                        </strong>
                      </div>
                      <div className="rounded-[20px] border border-slate-200 bg-slate-50 px-4 py-4">
                        <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-400">Belum</p>
                        <strong className="mt-3 block text-lg font-semibold tracking-[-0.03em] text-slate-900">
                          {inspectionPendingCount}
                        </strong>
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      {card.locations.map((location) => (
                        <span
                          key={location.name}
                          className={`inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-semibold ${getSupervisionStatusStyles(location.status).badge}`}
                        >
                          <span className={`h-2 w-2 rounded-full ${getSupervisionStatusStyles(location.status).dot}`} />
                          {location.name}
                        </span>
                      ))}
                    </div>
                  </>
                ) : null}

                {card.kind === 'testing' ? (
                  <>
                    <p className="text-sm leading-6 text-slate-500">{card.subtitle}</p>
                    <div className="grid gap-3 sm:grid-cols-3">
                      <div className="rounded-[20px] border border-slate-200 bg-slate-50 px-4 py-4">
                        <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-400">Progress</p>
                        <strong className="mt-3 block text-lg font-semibold tracking-[-0.03em] text-slate-900">
                          {card.done} / {card.total}
                        </strong>
                      </div>
                      <div className="rounded-[20px] border border-slate-200 bg-slate-50 px-4 py-4">
                        <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-400">Batch</p>
                        <strong className="mt-3 block text-lg font-semibold tracking-[-0.03em] text-slate-900">
                          {card.total}
                        </strong>
                      </div>
                      <div className="rounded-[20px] border border-slate-200 bg-slate-50 px-4 py-4">
                        <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-400">Next</p>
                        <strong className="mt-3 block text-lg font-semibold tracking-[-0.03em] text-slate-900">
                          {card.nextSchedule}
                        </strong>
                      </div>
                    </div>

                    <div className="space-y-3 rounded-[20px] border border-slate-200 bg-slate-50 px-4 py-4">
                      <div className="flex flex-wrap items-end justify-between gap-3">
                        <span className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-400">Progress Bar</span>
                        <span className="text-sm font-medium text-slate-500">
                          {Math.round((card.done / card.total) * 100)}%
                        </span>
                      </div>
                      <div className="h-2 rounded-full bg-slate-200">
                        <div
                          className="h-2 rounded-full bg-blue-600"
                          style={{ width: `${Math.round((card.done / card.total) * 100)}%` }}
                        />
                      </div>
                    </div>
                  </>
                ) : null}
              </div>
            </article>
          );
        })}
      </div>

      <article className="overflow-hidden rounded-[26px] border border-slate-200/80 bg-white shadow-[0_18px_50px_rgba(15,23,42,0.08)] sm:rounded-[32px]">
        <div className="border-b border-slate-200/80 px-4 py-5 sm:px-6 sm:py-6 md:px-8">
          <div className="flex flex-col gap-4">
            <div className="max-w-3xl">
              <p className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-400">
                Timeline / Calendar View
              </p>
              <h3 className="mt-3 text-[1.7rem] font-semibold tracking-[-0.04em] text-slate-900 sm:text-2xl md:text-[2rem]">
                Monitoring Timeline
              </h3>
              <p className="mt-3 text-sm leading-7 text-slate-500 md:text-base">
                Tampilan heatmap tahunan untuk melihat persebaran pelaksanaan Audit, Inspeksi,
                dan Tes Keamanan dalam satu panel monitoring.
              </p>
              <div className="mt-4 flex flex-wrap items-center gap-3">
                <div ref={timelineFilterRef} className="relative w-full max-w-[278px] sm:max-w-[290px]">
                  <button
                    type="button"
                    aria-haspopup="listbox"
                    aria-expanded={isTimelineFilterOpen}
                    aria-label="Filter timeline pengawasan"
                    onClick={() => {
                      setOpenTimelineYearPicker(null);
                      setIsTimelineFilterOpen((current) => !current);
                    }}
                    className="flex h-12 w-full items-center justify-between rounded-[18px] border border-slate-200 bg-white px-4 text-left text-base font-medium text-slate-800 shadow-[0_10px_24px_rgba(15,23,42,0.06)] outline-none transition hover:border-slate-300 hover:shadow-[0_14px_28px_rgba(15,23,42,0.08)] focus:border-slate-300 focus:shadow-[0_14px_28px_rgba(15,23,42,0.1)]"
                  >
                    <span className="truncate whitespace-nowrap">{timelineFilter}</span>
                    <ChevronDownIcon
                      className={`h-4.5 w-4.5 shrink-0 text-slate-500 transition-transform duration-200 ${
                        isTimelineFilterOpen ? 'rotate-180' : ''
                      }`}
                    />
                  </button>

                  {isTimelineFilterOpen ? (
                    <div
                      role="listbox"
                      aria-label="Daftar filter timeline pengawasan"
                      className="absolute left-0 top-full z-20 mt-3 w-full rounded-[24px] border border-slate-200 bg-white p-2 shadow-[0_24px_55px_rgba(15,23,42,0.16)]"
                    >
                      <div className="space-y-1">
                        <button
                          type="button"
                          role="option"
                          aria-selected={timelineFilter === 'Semua'}
                          onClick={() => handleTimelineFilterSelect('Semua')}
                          className={`flex w-full items-center justify-between rounded-[18px] px-3.5 py-2.5 text-left text-[15px] font-medium transition ${
                            timelineFilter === 'Semua'
                              ? 'bg-slate-900 text-white'
                              : 'text-slate-700 hover:bg-slate-50'
                          }`}
                        >
                          <span className="truncate whitespace-nowrap">Semua</span>
                          {timelineFilter === 'Semua' ? <span className="h-2.5 w-2.5 rounded-full bg-orange-500" /> : null}
                        </button>
                      </div>

                      <div className="mt-3 px-4 pb-1 pt-2 text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-400">
                        Kategori
                      </div>
                      <div className="space-y-1">
                        {SUPERVISION_CATEGORY_FILTERS.map((option) => (
                          <button
                            key={option}
                            type="button"
                            role="option"
                            aria-selected={timelineFilter === option}
                            onClick={() => handleTimelineFilterSelect(option)}
                            className={`flex w-full items-center justify-between rounded-[18px] px-3.5 py-2.5 text-left text-[15px] font-medium transition ${
                              timelineFilter === option
                                ? 'bg-slate-900 text-white'
                                : 'text-slate-700 hover:bg-slate-50'
                            }`}
                          >
                            <span className="truncate whitespace-nowrap">{option}</span>
                            {timelineFilter === option ? <span className="h-2.5 w-2.5 rounded-full bg-orange-500" /> : null}
                          </button>
                        ))}
                      </div>

                      <div className="mt-3 px-4 pb-1 pt-2 text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-400">
                        Cabang
                      </div>
                      <div className="space-y-1">
                        {SUPERVISION_BRANCH_FILTERS.map((option) => (
                          <button
                            key={option}
                            type="button"
                            role="option"
                            aria-selected={timelineFilter === option}
                            onClick={() => handleTimelineFilterSelect(option)}
                            className={`flex w-full items-center justify-between rounded-[18px] px-3.5 py-2.5 text-left text-[15px] font-medium transition ${
                              timelineFilter === option
                                ? 'bg-slate-900 text-white'
                                : 'text-slate-700 hover:bg-slate-50'
                            }`}
                          >
                            <span className="truncate whitespace-nowrap">{option}</span>
                            {timelineFilter === option ? <span className="h-2.5 w-2.5 rounded-full bg-orange-500" /> : null}
                          </button>
                        ))}
                      </div>
                    </div>
                  ) : null}
                </div>

                <div
                  ref={timelineYearFilterRef}
                  className="relative flex flex-wrap items-center gap-2 rounded-[18px] border border-slate-200 bg-white px-2.5 py-2 shadow-[0_10px_24px_rgba(15,23,42,0.06)]"
                >
                  <div className="relative">
                    <button
                      type="button"
                      aria-haspopup="listbox"
                      aria-expanded={openTimelineYearPicker === 'from'}
                      aria-label="Pilih tahun awal"
                      onClick={() => {
                        setIsTimelineFilterOpen(false);
                        setOpenTimelineYearPicker((current) =>
                          current === 'from' ? null : 'from',
                        );
                      }}
                      className="flex h-10 min-w-[120px] items-center justify-between rounded-[14px] border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-800 transition hover:border-slate-300"
                    >
                      <span>{timelineYearRange.from}</span>
                      <ChevronDownIcon
                        className={`h-3.5 w-3.5 text-slate-400 transition-transform ${
                          openTimelineYearPicker === 'from' ? 'rotate-180' : ''
                        }`}
                      />
                    </button>

                    {openTimelineYearPicker === 'from' ? (
                      <div className="absolute left-0 top-full z-20 mt-2 w-[138px] rounded-[18px] border border-slate-200 bg-white p-2 shadow-[0_24px_55px_rgba(15,23,42,0.16)]">
                        <div className="max-h-60 overflow-y-auto pr-1">
                          <div className="space-y-1">
                            {SUPERVISION_YEAR_OPTIONS.map((year) => (
                              <button
                                key={`picker-from-${year}`}
                                type="button"
                                role="option"
                                aria-selected={timelineYearRange.from === year}
                                onClick={() => handleTimelineYearSelect('from', year)}
                                className={`flex w-full items-center justify-between rounded-[12px] px-3 py-2 text-left text-sm font-medium transition ${
                                  timelineYearRange.from === year
                                    ? 'bg-slate-900 text-white'
                                    : 'text-slate-700 hover:bg-slate-50'
                                }`}
                              >
                                <span>{year}</span>
                                {timelineYearRange.from === year ? (
                                  <span className="h-2.5 w-2.5 rounded-full bg-orange-500" />
                                ) : null}
                              </button>
                            ))}
                          </div>
                        </div>
                      </div>
                    ) : null}
                  </div>

                  <span className="text-sm font-semibold text-slate-300">-</span>

                  <div className="relative">
                    <button
                      type="button"
                      aria-haspopup="listbox"
                      aria-expanded={openTimelineYearPicker === 'to'}
                      aria-label="Pilih tahun akhir"
                      onClick={() => {
                        setIsTimelineFilterOpen(false);
                        setOpenTimelineYearPicker((current) =>
                          current === 'to' ? null : 'to',
                        );
                      }}
                      className="flex h-10 min-w-[120px] items-center justify-between rounded-[14px] border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-800 transition hover:border-slate-300"
                    >
                      <span>{timelineYearRange.to}</span>
                      <ChevronDownIcon
                        className={`h-3.5 w-3.5 text-slate-400 transition-transform ${
                          openTimelineYearPicker === 'to' ? 'rotate-180' : ''
                        }`}
                      />
                    </button>

                    {openTimelineYearPicker === 'to' ? (
                      <div className="absolute right-0 top-full z-20 mt-2 w-[138px] rounded-[18px] border border-slate-200 bg-white p-2 shadow-[0_24px_55px_rgba(15,23,42,0.16)]">
                        <div className="max-h-60 overflow-y-auto pr-1">
                          <div className="space-y-1">
                            {SUPERVISION_YEAR_OPTIONS.map((year) => (
                              <button
                                key={`picker-to-${year}`}
                                type="button"
                                role="option"
                                aria-selected={timelineYearRange.to === year}
                                onClick={() => handleTimelineYearSelect('to', year)}
                                className={`flex w-full items-center justify-between rounded-[12px] px-3 py-2 text-left text-sm font-medium transition ${
                                  timelineYearRange.to === year
                                    ? 'bg-slate-900 text-white'
                                    : 'text-slate-700 hover:bg-slate-50'
                                }`}
                              >
                                <span>{year}</span>
                                {timelineYearRange.to === year ? (
                                  <span className="h-2.5 w-2.5 rounded-full bg-orange-500" />
                                ) : null}
                              </button>
                            ))}
                          </div>
                        </div>
                      </div>
                    ) : null}
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setIsScheduleComposerOpen((current) => !current)}
                  className="inline-flex h-12 items-center justify-center rounded-[18px] bg-slate-900 px-5 text-sm font-semibold text-white shadow-[0_14px_30px_rgba(15,23,42,0.16)] transition hover:bg-slate-800"
                >
                  {isScheduleComposerOpen ? 'Tutup' : 'Tambah'}
                </button>
              </div>

              {isScheduleComposerOpen ? (
                <form
                  className="mt-4 max-w-4xl rounded-[24px] border border-slate-200 bg-white p-4 shadow-[0_16px_36px_rgba(15,23,42,0.08)] sm:p-5"
                  onSubmit={handleAddSchedule}
                >
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-400">
                        Tambah Agenda Timeline
                      </p>
                      <h4 className="mt-2 text-lg font-semibold tracking-[-0.03em] text-slate-900">
                        Atur jadwal baru untuk heatmap monitoring
                      </h4>
                    </div>
                    <span className="inline-flex w-fit items-center rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700 ring-1 ring-inset ring-blue-200">
                      {customScheduleEntries.length} jadwal tambahan
                    </span>
                  </div>

                  <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-5">
                    <label className="grid gap-2">
                      <span className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Tahun</span>
                      <select
                        value={scheduleDraft.year}
                        onChange={(event) =>
                          setScheduleDraft((current) => ({
                            ...current,
                            year: Number(event.target.value),
                          }))
                        }
                        className="h-11 rounded-[16px] border border-slate-200 bg-white px-3.5 text-sm font-medium text-slate-700 outline-none transition focus:border-slate-300"
                      >
                        {SUPERVISION_YEAR_OPTIONS.map((year) => (
                          <option key={`draft-year-${year}`} value={year}>
                            {year}
                          </option>
                        ))}
                      </select>
                    </label>

                    <label className="grid gap-2">
                      <span className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Bulan</span>
                      <select
                        value={scheduleDraft.monthIndex}
                        onChange={(event) =>
                          setScheduleDraft((current) => ({
                            ...current,
                            monthIndex: Number(event.target.value),
                          }))
                        }
                        className="h-11 rounded-[16px] border border-slate-200 bg-white px-3.5 text-sm font-medium text-slate-700 outline-none transition focus:border-slate-300"
                      >
                        {YEAR_TIMELINE_MONTHS.map((month, index) => (
                          <option key={month} value={index}>
                            {month}
                          </option>
                        ))}
                      </select>
                    </label>

                    <label className="grid gap-2">
                      <span className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Periode</span>
                      <select
                        value={scheduleDraft.slotIndex}
                        onChange={(event) =>
                          setScheduleDraft((current) => ({
                            ...current,
                            slotIndex: Number(event.target.value),
                          }))
                        }
                        className="h-11 rounded-[16px] border border-slate-200 bg-white px-3.5 text-sm font-medium text-slate-700 outline-none transition focus:border-slate-300"
                      >
                        {TIMELINE_SLOT_LABELS.map((slot, index) => (
                          <option key={slot} value={index}>
                            Minggu {slot}
                          </option>
                        ))}
                      </select>
                    </label>

                    <label className="grid gap-2">
                      <span className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Scope</span>
                      <select
                        value={scheduleDraft.category}
                        onChange={(event) =>
                          setScheduleDraft((current) => {
                            const nextCategory = event.target.value as SupervisionHeatmapCategory;
                            return {
                              ...current,
                              category: nextCategory,
                              branch: SUPERVISION_BRANCHES_BY_CATEGORY[nextCategory][0],
                            };
                          })
                        }
                        className="h-11 rounded-[16px] border border-slate-200 bg-white px-3.5 text-sm font-medium text-slate-700 outline-none transition focus:border-slate-300"
                      >
                        {SUPERVISION_CATEGORY_FILTERS.map((option) => (
                          <option key={option} value={option}>
                            {option}
                          </option>
                        ))}
                      </select>
                    </label>

                    <label className="grid gap-2">
                      <span className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Cabang</span>
                      <select
                        value={scheduleDraft.branch}
                        onChange={(event) =>
                          setScheduleDraft((current) => ({
                            ...current,
                            branch: event.target.value as SupervisionBranchFilter,
                          }))
                        }
                        className="h-11 rounded-[16px] border border-slate-200 bg-white px-3.5 text-sm font-medium text-slate-700 outline-none transition focus:border-slate-300"
                      >
                        {activeBranchOptions.map((option) => (
                          <option key={option} value={option}>
                            {option}
                          </option>
                        ))}
                      </select>
                    </label>
                  </div>

                  <div className="mt-4 flex flex-wrap items-center justify-end gap-3">
                    <button
                      type="button"
                      onClick={() => setIsScheduleComposerOpen(false)}
                      className="inline-flex h-11 items-center justify-center rounded-[16px] border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                    >
                      Batal
                    </button>
                    <button
                      type="submit"
                      className="inline-flex h-11 items-center justify-center rounded-[16px] bg-blue-600 px-4 text-sm font-semibold text-white shadow-[0_12px_24px_rgba(37,99,235,0.22)] transition hover:bg-blue-500"
                    >
                      Simpan Ke Timeline
                    </button>
                  </div>
                </form>
              ) : null}
            </div>
          </div>
        </div>

        <div className="px-4 py-5 sm:px-6 sm:py-6 md:px-8">
          <div className="timeline-heatmap-scroll">
            <div className="timeline-heatmap-shell">
              <div
                className="timeline-heatmap-grid"
                style={{ gridTemplateColumns: `var(--timeline-label-column) repeat(${TIMELINE_TOTAL_COLUMNS}, var(--timeline-cell-size))` }}
              >
                <div className="timeline-heatmap-sticky-spacer" />
                {YEAR_TIMELINE_MONTHS.map((month) => (
                  <div
                    key={`heatmap-month-${month}`}
                    className="timeline-heatmap-month"
                    style={{ gridColumn: `span ${TIMELINE_SLOTS_PER_MONTH} / span ${TIMELINE_SLOTS_PER_MONTH}` }}
                  >
                    {month}
                  </div>
                ))}

                {filteredHeatmapRows.map((row) => (
                  <Fragment key={row.id}>
                    <div
                      className={`timeline-heatmap-label ${row.isSpacer ? 'is-spacer' : ''} ${
                        row.isGroup ? 'is-group' : ''
                      } ${row.isBranch ? 'is-branch' : ''}`}
                    >
                      {row.isBranch ? (
                        <span className="timeline-heatmap-branch-inline">
                          <span className="timeline-heatmap-branch-dash">-</span>
                          <span>{row.label}</span>
                        </span>
                      ) : (
                        row.label
                      )}
                    </div>
                    {row.cells.map((level, index) => (
                      <span
                        key={`${row.id}-${index}`}
                        className={`timeline-heatmap-cell ${getSupervisionHeatmapTone(level)}`}
                      />
                    ))}
                  </Fragment>
                ))}
              </div>

              <div className="timeline-heatmap-legend">
                <span>Indikator Aktif</span>
                {HEATMAP_LEGEND_LEVELS.map((level) => (
                  <span
                    key={`heatmap-legend-${level}`}
                    className={`timeline-heatmap-cell ${getSupervisionHeatmapTone(level)}`}
                  />
                ))}
              </div>
            </div>
          </div>
        </div>
      </article>
    </section>
  );
}

function DocumentsSection({
  documents,
  generatedAt,
  onDeleteDocument,
  onDeleteDocumentsTable,
}: {
  documents: DocumentItem[];
  generatedAt: string;
  onDeleteDocument: (sourceType: DocumentItem['sourceType'], id: string) => Promise<void>;
  onDeleteDocumentsTable: () => Promise<void>;
}) {
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState('');
  const [deleteMessage, setDeleteMessage] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<
    null | { mode: 'all' } | { mode: 'item'; id: string; title: string; sourceType: DocumentItem['sourceType'] }
  >(null);

  useEffect(() => {
    if (!deleteTarget) {
      return;
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape' && !isDeleting) {
        setDeleteTarget(null);
      }
    }

    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [deleteTarget, isDeleting]);

  async function handleConfirmDelete() {
    if (!deleteTarget) {
      return;
    }

    try {
      setIsDeleting(true);
      setDeleteError('');
      setDeleteMessage('');

      if (deleteTarget.mode === 'all') {
        await onDeleteDocumentsTable();
        setDeleteMessage('Seluruh data dokumen keamanan berhasil dihapus.');
      } else {
        await onDeleteDocument(deleteTarget.sourceType, deleteTarget.id);
        setDeleteMessage(`${deleteTarget.title} berhasil dihapus dari daftar dokumen keamanan.`);
      }

      setDeleteTarget(null);
    } catch (error) {
      setDeleteError(
        error instanceof Error
          ? error.message
          : deleteTarget.mode === 'all'
            ? 'Gagal menghapus seluruh dokumen keamanan.'
            : 'Gagal menghapus dokumen keamanan.'
      );
    } finally {
      setIsDeleting(false);
    }
  }

  return (
    <section className="section-grid section-grid--single">
      <article className="panel">
        <div className="panel-head">
          <div>
            <p className="eyebrow">Dokumen</p>
            <h2 className="panel-title">Kontrol revisi dokumen keamanan</h2>
            <p className="panel-copy">
              Dokumen aktif, review, revisi, dan hasil upload pelaksanaan pengawasan yang dipantau secara terpusat.
            </p>
          </div>
          <div className="panel-head-actions">
            <span className="data-chip">Sinkron {generatedAt}</span>
            <button
              type="button"
              className="action-pill action-pill--danger"
              onClick={() => setDeleteTarget({ mode: 'all' })}
              disabled={!documents.length || isDeleting}
            >
              {isDeleting ? 'Menghapus...' : 'Hapus'}
            </button>
          </div>
        </div>

        {deleteMessage ? <div className="program-feedback is-success">{deleteMessage}</div> : null}
        {deleteError ? <div className="personnel-form-error">{deleteError}</div> : null}

        <div className="table-shell records-table-desktop">
          {documents.length ? (
            <table className="data-table">
              <thead>
                <tr>
                  <th>Dokumen</th>
                  <th>Pemilik</th>
                  <th>Versi</th>
                  <th>Pembaruan</th>
                  <th className="personnel-actions-head">Aksi</th>
                </tr>
              </thead>
              <tbody>
                {documents.map((item) => (
                  <tr key={`${item.sourceType}-${item.id}`}>
                    <td>
                      {item.url ? (
                        <a href={item.url} target="_blank" rel="noreferrer" className="font-semibold text-slate-900 underline-offset-4 hover:underline">
                          {item.title}
                        </a>
                      ) : (
                        item.title
                      )}
                    </td>
                    <td>{item.owner}</td>
                    <td>{item.version}</td>
                    <td>{item.updatedAt}</td>
                    <td className="personnel-actions-cell">
                      <button
                        type="button"
                        className="personnel-row-delete"
                        onClick={() =>
                          setDeleteTarget({
                            mode: 'item',
                            id: item.id,
                            title: item.title,
                            sourceType: item.sourceType,
                          })
                        }
                        disabled={isDeleting}
                        aria-label={`Hapus ${item.title}`}
                        title={`Hapus ${item.title}`}
                      >
                        <TrashIcon className="mini-icon personnel-row-delete-icon" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <EmptyRows copy="Tidak ada dokumen yang cocok dengan pencarian." />
          )}
        </div>

        <div className="records-mobile-list">
          {documents.length ? (
            documents.map((item) => (
              <article key={`${item.sourceType}-${item.id}`} className="records-mobile-card">
                <div className="records-mobile-top">
                  <div className="records-mobile-copy">
                    {item.url ? (
                      <strong>
                        <a href={item.url} target="_blank" rel="noreferrer" className="underline-offset-4 hover:underline">
                          {item.title}
                        </a>
                      </strong>
                    ) : (
                      <strong>{item.title}</strong>
                    )}
                    <p>{item.owner}</p>
                  </div>
                  <button
                    type="button"
                    className="personnel-row-delete"
                    onClick={() =>
                      setDeleteTarget({
                        mode: 'item',
                        id: item.id,
                        title: item.title,
                        sourceType: item.sourceType,
                      })
                    }
                    disabled={isDeleting}
                    aria-label={`Hapus ${item.title}`}
                    title={`Hapus ${item.title}`}
                  >
                    <TrashIcon className="mini-icon personnel-row-delete-icon" />
                  </button>
                </div>

                <dl className="records-mobile-meta">
                  <div>
                    <dt>Versi</dt>
                    <dd>{item.version}</dd>
                  </div>
                  <div>
                    <dt>Pembaruan</dt>
                    <dd>{item.updatedAt}</dd>
                  </div>
                </dl>
              </article>
            ))
          ) : (
            <EmptyRows copy="Tidak ada dokumen yang cocok dengan pencarian." />
          )}
        </div>
      </article>

      {deleteTarget ? (
        <div className="personnel-modal-overlay" onClick={() => (isDeleting ? null : setDeleteTarget(null))}>
          <div
            className="delete-confirm-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="delete-document-title"
            onClick={(event) => event.stopPropagation()}
          >
            <button
              type="button"
              className="delete-confirm-close"
              aria-label="Tutup dialog hapus dokumen"
              onClick={() => setDeleteTarget(null)}
              disabled={isDeleting}
            >
              <CloseIcon className="mini-icon" />
            </button>

            <div className="delete-confirm-copy">
              <h3 id="delete-document-title" className="delete-confirm-title">
                {deleteTarget.mode === 'all' ? 'Hapus semua dokumen?' : `Hapus ${deleteTarget.title}?`}
              </h3>
              <p className="delete-confirm-text">
                {deleteTarget.mode === 'all'
                  ? 'Semua dokumen keamanan beserta file evidence yang sudah tersimpan akan dihapus permanen.'
                  : 'Dokumen yang dipilih akan dihapus permanen dari daftar dokumen keamanan.'}
              </p>
            </div>

            <div className="delete-confirm-actions">
              <button
                type="button"
                className="action-pill is-ghost delete-confirm-cancel"
                onClick={() => setDeleteTarget(null)}
                disabled={isDeleting}
              >
                Batal
              </button>
              <button
                type="button"
                className="action-pill action-pill--danger delete-confirm-submit"
                onClick={handleConfirmDelete}
                disabled={isDeleting}
              >
                {isDeleting ? 'Menghapus...' : deleteTarget.mode === 'all' ? 'Hapus Semua' : 'Hapus Dokumen'}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}

function MetricCard({ metric }: { metric: MetricCard }) {
  return (
    <article className="metric-card">
      <p className="eyebrow">{metric.label}</p>
      <strong className="metric-value">{metric.value}</strong>
      <span className="metric-delta">{metric.delta}</span>
      <p className="panel-copy">{metric.description}</p>
    </article>
  );
}

function MiniStat({ label, value, note }: { label: string; value: string; note: string }) {
  return (
    <div className="mini-stat-card">
      <span>{label}</span>
      <strong>{value}</strong>
      <p>{note}</p>
    </div>
  );
}
