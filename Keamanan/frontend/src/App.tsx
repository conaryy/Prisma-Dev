import { useDeferredValue, useEffect, useRef, useState, type ChangeEvent, type FormEvent } from 'react';
import Lottie from 'lottie-react';
import successAnimation from '@/assets/Success.json';
import { BellIcon, ChevronDownIcon, SearchIcon, UserIcon } from '@/components/icons';
import { Sidebar } from '@/components/Sidebar';
import { createPersonnel, fetchDashboard } from '@/lib/api';
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

const DASHBOARD_THEME_KEY = 'keamanan-dashboard-theme';
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

function buildTestMetrics(items: TestItem[]): MetricCard[] {
  const counts = countByStatus(items);

  return [
    {
      label: 'Agenda Tes',
      value: String(items.length),
      delta: `${counts.Selesai ?? 0} selesai`,
      description: 'Seluruh agenda program pengawasan keamanan yang dijadwalkan pada periode aktif.',
    },
    {
      label: 'Terjadwal',
      value: String(counts.Terjadwal ?? 0),
      delta: 'Menunggu eksekusi',
      description: 'Sesi tes yang sudah memiliki jadwal namun belum dieksekusi oleh tim lapangan.',
    },
    {
      label: 'Perlu Tindak Lanjut',
      value: String(counts['Perlu Tindak Lanjut'] ?? 0),
      delta: 'CAP internal',
      description: 'Hasil tes yang menuntut evaluasi lanjutan atau tindak korektif operasional.',
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
  if (['Optimal', 'Valid', 'Aktif', 'Selesai'].includes(status)) {
    return 'good';
  }

  if (['Terjadwal', 'Pelatihan', 'Review'].includes(status)) {
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
        subtitle: `Kelola ${visibleTests.length} agenda simulasi, random screening, dan evaluasi readiness tim keamanan.`,
        chips: ['Simulasi', 'Screening', 'Pengawasan'],
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

export default function App() {
  const [dashboard, setDashboard] = useState<DashboardData | null>(null);
  const [routeState, setRouteState] = useState<RouteState>(getInitialRouteState);
  const [personCertificates, setPersonCertificates] = useState<Record<string, CertificateUpload[]>>({});
  const [search, setSearch] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [theme, setTheme] = useState<ThemeMode>(getInitialTheme);
  const certificateRef = useRef(personCertificates);
  const deferredSearch = useDeferredValue(search.trim().toLowerCase());
  const activeId = routeState.routeId;

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
    matchesQuery(deferredSearch, [item.title, item.owner, item.date, item.score, item.status])
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
  const testMetrics = buildTestMetrics(dashboard.tests);
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
      <Sidebar
        activeId={activeId}
        navigation={dashboard.navigation}
        organization={dashboard.organization}
        onSelect={handleSelect}
      />

      <main className="workspace">
        <header className="topbar">
          <div className="topbar-profile">
            <div className="topbar-backdrop">
              <span className="topbar-chip">Workspace</span>
              <strong>{topbarTitle}</strong>
              <small className="topbar-caption">{topbarCaption}</small>
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
            <button type="button" className="topbar-pill topbar-pill--menu">
              Portal
              <ChevronDownIcon className="mini-icon" />
            </button>
            <button type="button" className="icon-button" aria-label="Notifikasi">
              <BellIcon className="mini-icon" />
            </button>
            <button type="button" className="icon-button" aria-label="Profil pengguna">
              <UserIcon className="mini-icon" />
            </button>
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
        ) : (
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
          <>
            <section className="metrics-grid">
              {testMetrics.map((metric) => (
                <MetricCard key={metric.label} metric={metric} />
              ))}
            </section>
            <TestsSection tests={visibleTests} />
          </>
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
      label: item.title,
      context: item.owner,
      detail: item.score,
      status: item.status,
      updatedAt: item.date,
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
            <span className="dashboard-toggle-label">Statistik</span>
            <button
              type="button"
              className={`dashboard-toggle ${showStatistics ? 'is-on' : ''}`}
              onClick={() => setShowStatistics((current) => !current)}
              aria-pressed={showStatistics}
            >
              <span className="dashboard-toggle-thumb" />
            </button>
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

        <div className="table-shell">
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

        <div className="table-shell">
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

function TestsSection({ tests }: { tests: TestItem[] }) {
  return (
    <section className="section-grid">
      <article className="panel">
        <div className="panel-head">
          <div>
            <p className="eyebrow">Program Pengawasan Keamanan</p>
            <h2 className="panel-title">Agenda dan hasil pengawasan</h2>
            <p className="panel-copy">Program rutin dan simulasi insiden untuk menjaga readiness tim.</p>
          </div>
        </div>

        <div className="test-grid">
          {tests.length ? (
            tests.map((item) => (
              <div key={item.title} className="test-card">
                <div className="test-card-top">
                  <StatusBadge status={item.status} />
                  <span className="data-chip">{item.date}</span>
                </div>
                <h3>{item.title}</h3>
                <p>{item.owner}</p>
                <strong>{item.score}</strong>
              </div>
            ))
          ) : (
            <EmptyRows copy="Tidak ada agenda program pengawasan yang cocok dengan pencarian." />
          )}
        </div>
      </article>

      <article className="panel panel-side">
        <div className="panel-head">
          <div>
            <p className="eyebrow">Checklist Latihan</p>
            <h2 className="panel-title">Prioritas tindak lanjut</h2>
          </div>
        </div>

        <div className="mini-stat-list">
          <MiniStat label="Simulasi berikutnya" value="04 Apr" note="Akses tidak sah di gate perimeter." />
          <MiniStat label="Nilai tertinggi" value="94/100" note="Random screening shift B memimpin pekan ini." />
          <MiniStat
            label="Action item"
            value="03"
            note="Tabletop exercise ancaman bagasi perlu skenario lanjutan."
          />
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

        <div className="table-shell">
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
