import { Fragment, useDeferredValue, useEffect, useRef, useState, type ChangeEvent, type FormEvent } from 'react';
import Lottie from 'lottie-react';
import successAnimation from '@/assets/Success.json';
import {
  BellIcon,
  ChevronDownIcon,
  LogoutIcon,
  MenuIcon,
  PortalChecklistIcon,
  PortalDashboardIcon,
  PortalNotebookIcon,
  SearchIcon,
  ShieldIcon,
  UserIcon,
} from '@/components/icons';
import { Sidebar } from '@/components/Sidebar';
import {
  createPersonnel,
  fetchDashboard,
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
type SupervisionHeatmapCategory = 'Audit' | 'Inspeksi' | 'Pengujian';
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
const SUPERVISION_YEAR_OPTIONS = Array.from(
  { length: new Date().getFullYear() + 25 - 1980 + 1 },
  (_, index) => 1980 + index,
);
const YEAR_TIMELINE_MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const TIMELINE_SLOT_LABELS = ['I', 'II', 'III', 'IV'] as const;
const TIMELINE_SLOTS_PER_MONTH = 4;
const TIMELINE_TOTAL_COLUMNS = YEAR_TIMELINE_MONTHS.length * TIMELINE_SLOTS_PER_MONTH;
const HEATMAP_LEGEND_LEVELS: SupervisionHeatmapLevel[] = [1];
const SUPERVISION_CATEGORY_FILTERS: SupervisionHeatmapCategory[] = ['Audit', 'Inspeksi', 'Pengujian'];
const SUPERVISION_BRANCHES_BY_CATEGORY: Record<SupervisionHeatmapCategory, SupervisionBranchFilter[]> = {
  Audit: ['Cabang Surabaya', 'KCP Banyuwangi', 'KCP Malang', 'KCP Sumenep'],
  Inspeksi: ['Cabang Surabaya', 'KCP Banyuwangi', 'KCP Malang', 'KCP Sumenep', 'Penyedia Personel AVSEC'],
  Pengujian: ['Cabang Surabaya', 'KCP Banyuwangi', 'KCP Sumenep'],
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
    title: 'Pengujian',
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
  return SUPERVISION_BRANCHES_BY_CATEGORY.Pengujian.flatMap((branch) =>
    BIMONTHLY_TEST_MONTHS.map((monthIndex) => ({
      id: `testing-${year}-${branch}-${monthIndex}`,
      category: 'Pengujian' as const,
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
    cells[targetIndex] = level;
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
    category: 'Pengujian',
    label: 'Pengujian',
    cells: buildSupervisionHeatmapCells([]),
    isGroup: true,
  },
  {
    id: 'heatmap-testing-surabaya',
    category: 'Pengujian',
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
    category: 'Pengujian',
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
    category: 'Pengujian',
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
    {
      label: 'Jadwal Aktif',
      value: String(counts.Terjadwal ?? 0),
      delta: 'Servis terencana',
      description: 'Fasilitas yang sudah masuk rencana inspeksi atau perawatan berikutnya.',
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

function buildDocumentMetrics(items: DocumentItem[]): MetricCard[] {
  const counts = countByStatus(items);

  return [
    {
      label: 'Dokumen Terkontrol',
      value: String(items.length),
      delta: `${counts.Aktif ?? 0} aktif`,
      description: 'Dokumen keamanan yang dikelola pada repository versi operasional saat ini.',
    },
    {
      label: 'Dalam Review',
      value: String(counts.Review ?? 0),
      delta: 'Menunggu approval',
      description: 'Dokumen yang sedang menjalani telaah unit, approval, atau verifikasi terakhir.',
    },
    {
      label: 'Perlu Revisi',
      value: String(counts.Revisi ?? 0),
      delta: 'Update prioritas',
      description: 'Dokumen yang harus diperbarui agar selaras dengan data operasi terbaru.',
    },
  ];
}

function getStatusTone(status: string) {
  if (['Optimal', 'Valid', 'Aktif', 'Terlaksana'].includes(status)) {
    return 'good';
  }

  if (['Pelatihan', 'Review', 'Belum Terlaksana'].includes(status)) {
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
) {
  switch (routeId) {
    case 'fasilitas-keamanan':
      return {
        eyebrow: 'Fasilitas Keamanan',
        title: 'Status perangkat lapangan keamanan.',
        subtitle: `Pantau ${visibleFacilities.length} fasilitas berupa CCTV, access gate, X-Ray, dan perimeter secara terpisah.`,
        chips: ['CCTV', 'Access Gate', 'X-Ray', 'Perimeter'],
      };
    case 'personil-keamanan':
      return {
        eyebrow: 'Personil Keamanan',
        title: 'Roster personel dan kesiapan shift.',
        subtitle: `Data ${visibleLicenses.length} personel keamanan untuk memastikan coverage lisensi dan kesiapan operasional.`,
        chips: ['Roster', 'Shift', 'Kesiapan'],
      };
    case 'tes-keamanan':
      return {
        eyebrow: 'Program Pengawasan Keamanan',
        title: 'Agenda pengawasan dan tindak lanjut operasional.',
        subtitle: `Kelola ${visibleTests.length} agenda audit, inspeksi, dan test lengkap dengan evidence dan status pelaksanaan.`,
        chips: ['Audit', 'Inspeksi', 'Test'],
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

  async function handleAddPerson(input: NewPersonnelInput) {
    await createPersonnel(input);
    const nextDashboard = await fetchDashboard();
    setDashboard(nextDashboard);
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
  const personnelMetrics = buildPersonnelMetrics(dashboard.licenses);
  const documentMetrics = buildDocumentMetrics(dashboard.documents);
  const topbarTitle =
    activeId === 'dashboard'
      ? 'Dashboard'
      : activeId === 'fasilitas-keamanan'
        ? 'Fasilitas Keamanan'
        : activeId === 'personil-keamanan'
          ? selectedPerson?.name ?? 'Personil Keamanan'
          : activeId === 'tes-keamanan'
            ? 'Program Pengawasan Keamanan'
            : 'Dokumen';
  const topbarCaption =
    activeId === 'personil-keamanan' && selectedPerson
      ? `${selectedPerson.location} · ${selectedPerson.documentPeriod}`
      : dashboard.organization.branch;

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
            <button type="button" className="icon-button" aria-label="Notifikasi">
              <BellIcon className="mini-icon" />
            </button>
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
            visibleMetrics={visibleMetrics}
            visibleFacilities={visibleFacilities}
            visibleTests={visibleTests}
            visibleDocuments={visibleDocuments}
            visibleActivities={visibleActivities}
            visibleSpotlight={visibleSpotlight}
          />
        ) : activeId === 'personil-keamanan' && selectedPerson ? (
          <PersonnelDetailHero person={selectedPerson} onBack={() => handleSelect('personil-keamanan')} />
        ) : activeId === 'tes-keamanan' ? null : (
          <RouteHero
            eyebrow={routeHero.eyebrow}
            title={routeHero.title}
            subtitle={routeHero.subtitle}
            generatedAt={generatedAt}
            chips={routeHero.chips}
            resultCount={resultCount}
          />
        )}

        {activeId === 'fasilitas-keamanan' ? (
          <>
            <section className="metrics-grid">
              {facilityMetrics.map((metric) => (
                <MetricCard key={metric.label} metric={metric} />
              ))}
            </section>
            <FacilitiesSection facilities={visibleFacilities} />
          </>
        ) : null}

        {activeId === 'personil-keamanan' && !selectedPerson ? (
          <>
            <section className="metrics-grid">
              {personnelMetrics.map((metric) => (
              <MetricCard key={metric.label} metric={metric} />
              ))}
            </section>
            <PersonnelSection
              eyebrow="Personil Keamanan"
              title="Roster personel dan lisensi"
              subtitle="Pastikan ketersediaan lisensi kritis dan coverage setiap shift operasional."
              licenses={visibleLicenses}
              onAddPerson={handleAddPerson}
              onSelectPerson={handleSelectPerson}
            />
          </>
        ) : null}

        {activeId === 'personil-keamanan' && selectedPerson ? (
          <PersonnelDetailPage
            person={selectedPerson}
            certificates={selectedCertificates}
            onUploadCertificate={(file) => handleCertificateUpload(selectedPerson.slug, file)}
            onDeleteCertificate={(certificateId) => handleCertificateDelete(selectedPerson.slug, certificateId)}
          />
        ) : null}

        {activeId === 'tes-keamanan' ? (
          <TestsSection />
        ) : null}

        {activeId === 'dokumen' ? (
          <>
            <section className="metrics-grid">
              {documentMetrics.map((metric) => (
                <MetricCard key={metric.label} metric={metric} />
              ))}
            </section>
            <DocumentsSection documents={visibleDocuments} />
          </>
        ) : null}
      </main>
    </div>
  );
}

function DashboardPage({
  dashboard,
  generatedAt,
  visibleMetrics,
  visibleFacilities,
  visibleTests,
  visibleDocuments,
  visibleActivities,
  visibleSpotlight,
}: {
  dashboard: DashboardData;
  generatedAt: string;
  visibleMetrics: MetricCard[];
  visibleFacilities: FacilityItem[];
  visibleTests: TestItem[];
  visibleDocuments: DocumentItem[];
  visibleActivities: ActivityItem[];
  visibleSpotlight: SpotlightItem[];
}) {
  const [activeCategory, setActiveCategory] = useState<'Semua' | 'Fasilitas' | 'Tes' | 'Dokumen'>('Semua');
  const [showStatistics, setShowStatistics] = useState(true);
  const overviewRows = [
    ...visibleFacilities.map((item) => ({
      id: `facility-${item.name}`,
      category: 'Fasilitas',
      label: item.name,
      context: item.zone,
      detail: `Coverage ${item.coverage}`,
      status: item.status,
      updatedAt: item.updatedAt,
    })),
    ...visibleTests.map((item) => ({
      id: `test-${item.title}`,
      category: 'Tes',
      label: `${item.category} - ${item.title}`,
      context: item.owner,
      detail: `${item.date} · ${item.score}`,
      status: item.status,
      updatedAt: item.completedAt ?? item.date,
    })),
    ...visibleDocuments.map((item) => ({
      id: `document-${item.title}`,
      category: 'Dokumen',
      label: item.title,
      context: item.owner,
      detail: item.version,
      status: item.status,
      updatedAt: item.updatedAt,
    })),
  ];
  const visibleRows =
    activeCategory === 'Semua' ? overviewRows : overviewRows.filter((row) => row.category === activeCategory);
  const categoryFilters = ['Semua', 'Fasilitas', 'Tes', 'Dokumen'] as const;
  const quickActions = dashboard.quickActions.slice(-2);

  return (
    <>
      <section className="panel dashboard-header-panel">
        <div className="dashboard-header-copy">
          <div>
            <p className="eyebrow">Dashboard</p>
            <h2 className="dashboard-page-title">Ringkasan operasional keamanan</h2>
            <p className="panel-copy">
              {dashboard.hero.subtitle}
            </p>
          </div>
          <div className="dashboard-header-meta">
            <span className="data-chip">Sinkron {generatedAt}</span>
            <span className="data-chip">{overviewRows.length} item operasional</span>
            <span className="data-chip">{dashboard.organization.branch}</span>
          </div>
        </div>
      </section>

      <section className="panel dashboard-toolbar-panel">
        <div className="dashboard-toolbar">
          <div className="dashboard-toolbar-group">
            <button type="button" className="dashboard-toolbar-button is-active">
              Table View
            </button>
            {categoryFilters.map((filter) => (
              <button
                key={filter}
                type="button"
                className={`dashboard-toolbar-button ${activeCategory === filter ? 'is-active' : ''}`}
                onClick={() => setActiveCategory(filter)}
              >
                {filter}
              </button>
            ))}
          </div>

          <div className="dashboard-toolbar-group dashboard-toolbar-group--end">
            <div className="dashboard-toolbar-toggle-row">
              <span className="dashboard-toggle-label">Statistik</span>
              <button
                type="button"
                className={`dashboard-toggle ${showStatistics ? 'is-on' : ''}`}
                onClick={() => setShowStatistics((current) => !current)}
                aria-pressed={showStatistics}
              >
                <span className="dashboard-toggle-thumb" />
              </button>
            </div>

            <div className="dashboard-toolbar-actions">
              {quickActions.map((action) => (
                <button
                  key={action.label}
                  type="button"
                  className={`dashboard-toolbar-button ${action.variant === 'primary' ? 'is-primary' : ''}`}
                >
                  {action.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </section>

      {showStatistics ? (
        <section className="dashboard-stat-grid">
          {visibleMetrics.map((metric) => (
            <MetricCard key={metric.label} metric={metric} />
          ))}
        </section>
      ) : null}

      <section className="panel dashboard-table-panel">
        <div className="panel-head panel-head--table">
          <button type="button" className="dashboard-toolbar-button is-active">
            Operasional Hari Ini
          </button>
          <div>
            <p className="eyebrow">Daftar Utama</p>
            <h2 className="panel-title">Tabel monitoring keamanan</h2>
            <p className="panel-copy">Fasilitas, tes, dan dokumen prioritas ditampilkan dalam satu tabel utama.</p>
          </div>
          <div className="dashboard-inline-meta">
            <span className="data-chip">{dashboard.alert.title}</span>
            <span className="data-chip">{dashboard.alert.message}</span>
          </div>
        </div>

        <div className="table-shell dashboard-table-desktop">
          {visibleRows.length ? (
            <table className="data-table dashboard-summary-table">
              <thead>
                <tr>
                  <th>Item</th>
                  <th>Kategori</th>
                  <th>Area / PIC</th>
                  <th>Detail</th>
                  <th>Status</th>
                  <th>Pembaruan</th>
                </tr>
              </thead>
              <tbody>
                {visibleRows.map((row) => (
                  <tr key={row.id}>
                    <td>
                      <strong>{row.label}</strong>
                    </td>
                    <td>
                      <span className={`summary-category is-${row.category.toLowerCase()}`}>
                        <span className="summary-category-dot" />
                        {row.category}
                      </span>
                    </td>
                    <td>{row.context}</td>
                    <td>{row.detail}</td>
                    <td>
                      <StatusBadge status={row.status} />
                    </td>
                    <td>{row.updatedAt}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <EmptyRows copy="Tidak ada ringkasan operasional yang cocok dengan pencarian." />
          )}
        </div>

        <div className="dashboard-summary-mobile-list">
          {visibleRows.length ? (
            visibleRows.map((row) => (
              <article key={row.id} className="dashboard-summary-mobile-card">
                <div className="dashboard-summary-mobile-top">
                  <span className={`summary-category is-${row.category.toLowerCase()}`}>
                    <span className="summary-category-dot" />
                    {row.category}
                  </span>
                  <StatusBadge status={row.status} />
                </div>

                <div className="dashboard-summary-mobile-copy">
                  <strong>{row.label}</strong>
                  <p>{row.detail}</p>
                </div>

                <dl className="dashboard-summary-mobile-meta">
                  <div>
                    <dt>Area / PIC</dt>
                    <dd>{row.context}</dd>
                  </div>
                  <div>
                    <dt>Pembaruan</dt>
                    <dd>{row.updatedAt}</dd>
                  </div>
                </dl>
              </article>
            ))
          ) : (
            <EmptyRows copy="Tidak ada ringkasan operasional yang cocok dengan pencarian." />
          )}
        </div>
      </section>

      <section className="dashboard-secondary-grid">
        <article className="panel dashboard-feed-panel">
          <div className="panel-head">
            <div>
              <p className="eyebrow">Aktivitas</p>
              <h2 className="panel-title">Update terakhir</h2>
            </div>
          </div>

          <div className="dashboard-feed-list">
            {visibleActivities.length ? (
              visibleActivities.slice(0, 4).map((item) => (
                <div key={item.title} className="dashboard-feed-item">
                  <strong>{item.title}</strong>
                  <p>{item.detail}</p>
                  <small>{item.timestamp}</small>
                </div>
              ))
            ) : (
              <EmptyRows copy="Tidak ada aktivitas yang cocok dengan pencarian." />
            )}
          </div>
        </article>

        <article className="panel dashboard-feed-panel">
          <div className="panel-head">
            <div>
              <p className="eyebrow">Prioritas</p>
              <h2 className="panel-title">Snapshot singkat</h2>
            </div>
          </div>

          <div className="dashboard-spotlight-list">
            {visibleSpotlight.slice(0, 3).map((item) => (
              <div key={item.label} className="dashboard-spotlight-item">
                <span>{item.label}</span>
                <strong>{item.value}</strong>
                <p>{item.note}</p>
              </div>
            ))}
            <div className="dashboard-priority-note">
              <span className="eyebrow">Catatan Prioritas</span>
              <strong>{dashboard.alert.hint}</strong>
            </div>
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
}: {
  eyebrow: string;
  title: string;
  subtitle: string;
  generatedAt: string;
  chips: string[];
  resultCount: number;
}) {
  return (
    <section className="hero">
      <div className="hero-gradient" />
      <div className="hero-card">
        <div>
          <p className="eyebrow">{eyebrow}</p>
          <h2 className="hero-title">{title}</h2>
          <p className="hero-copy">{subtitle}</p>
        </div>
        <div className="hero-actions">
          <span className="data-chip">Sinkron {generatedAt}</span>
          <span className="data-chip">{resultCount} hasil cocok</span>
          {chips.slice(0, 2).map((chip) => (
            <span key={chip} className="data-chip">
              {chip}
            </span>
          ))}
        </div>
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

function FacilitiesSection({ facilities }: { facilities: FacilityItem[] }) {
  return (
    <section className="section-grid">
      <article className="panel">
        <div className="panel-head">
          <div>
            <p className="eyebrow">Fasilitas Keamanan</p>
            <h2 className="panel-title">Status perangkat lapangan</h2>
            <p className="panel-copy">Pantau cakupan perangkat dan jadwal servis dari satu tabel.</p>
          </div>
        </div>

        <div className="table-shell records-table-desktop">
          {facilities.length ? (
            <table className="data-table">
              <thead>
                <tr>
                  <th>Fasilitas</th>
                  <th>Zona</th>
                  <th>Status</th>
                  <th>Coverage</th>
                  <th>Pembaruan</th>
                </tr>
              </thead>
              <tbody>
                {facilities.map((item) => (
                  <tr key={item.name}>
                    <td>{item.name}</td>
                    <td>{item.zone}</td>
                    <td>
                      <StatusBadge status={item.status} />
                    </td>
                    <td>{item.coverage}</td>
                    <td>{item.updatedAt}</td>
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
              <article key={item.name} className="records-mobile-card">
                <div className="records-mobile-top">
                  <div className="records-mobile-copy">
                    <strong>{item.name}</strong>
                    <p>{item.zone}</p>
                  </div>
                  <StatusBadge status={item.status} />
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
    </section>
  );
}

function PersonnelSection({
  eyebrow,
  title,
  subtitle,
  licenses,
  onAddPerson,
  onSelectPerson,
}: {
  eyebrow: string;
  title: string;
  subtitle: string;
  licenses: LicenseItem[];
  onAddPerson: (input: NewPersonnelInput) => Promise<void>;
  onSelectPerson: (slug: string) => void;
}) {
  const ITEMS_PER_PAGE = 6;
  const [currentPage, setCurrentPage] = useState(1);
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');
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
            <button type="button" className="action-pill is-primary" onClick={() => setIsAddOpen(true)}>
              Tambah
            </button>
          </div>
        </div>

        <div className="table-shell">
          {licenses.length ? (
            <>
              <table className="data-table personnel-table">
                <colgroup>
                  <col className="personnel-table-col personnel-table-col--name" />
                  <col className="personnel-table-col personnel-table-col--location" />
                </colgroup>
                <thead>
                  <tr>
                    <th>Nama</th>
                    <th>Lokasi</th>
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
  onUploadCertificate,
  onDeleteCertificate,
}: {
  person: LicenseItem;
  certificates: CertificateUpload[];
  onUploadCertificate: (file: File) => void;
  onDeleteCertificate: (certificateId: string) => void;
}) {
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [uploadSuccess, setUploadSuccess] = useState<{
    key: number;
    title: string;
    message: string;
  } | null>(null);
  const uploadSuccessTimeoutRef = useRef<number | null>(null);

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

  function handlePhotoChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      setPhotoPreview(typeof reader.result === 'string' ? reader.result : null);
      triggerUploadSuccess('Upload foto berhasil', 'Foto personel sudah diperbarui.');
    };
    reader.readAsDataURL(file);
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

  const initials = person.name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('');

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

              <label className="photo-upload-button">
                Pilih Foto
                <input type="file" accept="image/*" onChange={handlePhotoChange} />
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
              Monitoring pelaksanaan Audit, Inspeksi, dan Pengujian secara terpusat untuk
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
                dan Pengujian dalam satu panel monitoring.
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

function DocumentsSection({ documents }: { documents: DocumentItem[] }) {
  return (
    <section className="section-grid">
      <article className="panel">
        <div className="panel-head">
          <div>
            <p className="eyebrow">Dokumen</p>
            <h2 className="panel-title">Kontrol revisi dokumen keamanan</h2>
            <p className="panel-copy">Dokumen aktif, review, dan revisi yang dipantau secara terpusat.</p>
          </div>
        </div>

        <div className="table-shell records-table-desktop">
          {documents.length ? (
            <table className="data-table">
              <thead>
                <tr>
                  <th>Dokumen</th>
                  <th>Pemilik</th>
                  <th>Versi</th>
                  <th>Pembaruan</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {documents.map((item) => (
                  <tr key={item.title}>
                    <td>{item.title}</td>
                    <td>{item.owner}</td>
                    <td>{item.version}</td>
                    <td>{item.updatedAt}</td>
                    <td>
                      <StatusBadge status={item.status} />
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
              <article key={item.title} className="records-mobile-card">
                <div className="records-mobile-top">
                  <div className="records-mobile-copy">
                    <strong>{item.title}</strong>
                    <p>{item.owner}</p>
                  </div>
                  <StatusBadge status={item.status} />
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

      <article className="panel panel-side">
        <div className="panel-head">
          <div>
            <p className="eyebrow">Queue Review</p>
            <h2 className="panel-title">Dokumen prioritas</h2>
          </div>
        </div>

        <div className="mini-stat-list">
          <MiniStat label="Aktif" value="02" note="SOP access gate dan checklist CCTV aman digunakan." />
          <MiniStat label="Review" value="01" note="Prosedur escalation alarm menunggu approval akhir." />
          <MiniStat label="Revisi" value="01" note="Matriks lisensi butuh pembaruan data April 2026." />
        </div>
      </article>
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
