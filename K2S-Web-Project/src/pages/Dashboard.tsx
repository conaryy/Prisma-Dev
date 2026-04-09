import { memo, useEffect, useMemo, useRef, useState, type Dispatch, type SetStateAction } from 'react';
import { Link } from 'react-router-dom';
import Lottie, { type LottieRefCurrentProps } from 'lottie-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import map22Image from '@/assets/map22.png';
import locationMapAnimation from '@/assets/location-map.json';
import { useAppData } from '@/contexts/AppDataContext';
import { fetchExternalDnpDashboardCapList } from '@/lib/externalDnp';
import { apiFetch, getAuthUser } from '@/lib/api';
import { downloadFromSignedUrl } from '@/lib/download';
import { toast } from '@/hooks/use-toast';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

type ChartPoint = {
  label: string;
  audit: number;
  inspeksi: number;
  surveillance: number;
};

type DashboardActivityItem = {
  scope: string;
  date: Date;
  userId?: string;
};

type DashboardOpenCapItem = {
  capId: string;
  userId: string;
  scope: string;
  progress: number;
  activityAt: string;
};

type TrendSource = 'internal' | 'dnp';

type UserOption = {
  id: string;
  name: string;
};

type RgbColor = [number, number, number];

type MapKcpMarker = {
  key: string;
  x: number;
  y: number;
  color: string;
  code: string;
  title: string;
  region: string;
  description: string;
};

type MapScopeCounts = {
  audit: number;
  inspeksi: number;
  surveillance: number;
};

type MapScopeKey = keyof MapScopeCounts;
type MapScopeAvailability = Record<MapScopeKey, boolean>;

type MapMarkerSummary = {
  key: string;
  title: string;
  hasData: boolean;
  counts: MapScopeCounts;
  scopeAvailability: MapScopeAvailability;
  latestActivityAt: string | null;
};

type MapMarkerDetailReview = {
  status: string;
  severity?: string | null;
  probability?: string | null;
  resume?: string | null;
  finding?: string | null;
  recommendations?: string | null;
  description?: string | null;
  reviewedBy?: { id: string; name: string; email?: string } | null;
  reviewedAt?: string | null;
};

type MapMarkerDetailCapReview = {
  result: string | null;
  comment: string | null;
  status: string | null;
  reviewedBy?: { id: string; name: string; email?: string } | null;
  reviewedAt?: string | null;
};

type MapMarkerDetailLatestFulfillment = {
  id: string;
  step: number;
  progress: number;
  status: string;
  completeDate: string | null;
  submittedAt: string | null;
  createdAt: string | null;
  proposeAction: string;
  actionOffice: string;
  evidenceReference: string | null;
};

type MapMarkerDetailItem = {
  answerId: string;
  questionCode: string;
  questionText: string;
  instansiName?: string | null;
  area?: string | null;
  progress: number | null;
  itemState: string;
  latestActivityAt: string | null;
  review: MapMarkerDetailReview | null;
  cap: {
    id: string;
    status: string;
    actionPlan: string;
    sentAt: string | null;
    review: MapMarkerDetailCapReview | null;
    latestFulfillment: MapMarkerDetailLatestFulfillment | null;
  } | null;
};

type MapMarkerScopeDetailPayload = {
  hasAccess: boolean;
  markerKey: string;
  scope: MapScopeKey;
  items: MapMarkerDetailItem[];
};

type MapCategoryBreakdownItem = {
  year: number;
  counts: Record<string, number>;
};

type MapCategoryBreakdownPayload = {
  hasAccess: boolean;
  markerKey: string | null;
  categories: string[];
  locationLabel: string;
  totalFindings: number;
  items: MapCategoryBreakdownItem[];
};

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
const MAP_SCOPE_LABELS: Record<MapScopeKey, string> = {
  audit: 'Audit',
  inspeksi: 'Inspeksi',
  surveillance: 'Surveillance',
};
const EMPTY_MAP_SCOPE_COUNTS: MapScopeCounts = {
  audit: 0,
  inspeksi: 0,
  surveillance: 0,
};
const EMPTY_MAP_SCOPE_AVAILABILITY: MapScopeAvailability = {
  audit: false,
  inspeksi: false,
  surveillance: false,
};

const MAP_KCP_MARKERS: MapKcpMarker[] = [
  {
    key: 'bawean',
    x: 980,
    y: 195,
    color: '#ff4148',
    code: 'BXW',
    title: 'Unit Bawean',
    region: 'Harun Thohir Airport',
    description: 'Menandai unit layanan Bawean sebagai titik referensi utara pada cakupan peta KCP.',
  },
  {
    key: 'north-west',
    x: 562,
    y: 550,
    color: '#ffd95a',
    code: 'CPF',
    title: 'Unit Blora',
    region: 'Ngloram Airport',
    description: 'Menunjukkan Unit Ngloram pada sisi barat laut sebagai bagian dari cakupan koordinasi KCP.',
  },
  {
    key: 'north-central',
    x: 978,
    y: 522,
    color: '#6129ef',
    code: 'SUB',
    title: 'Cabang Surabaya',
    region: 'Juanda International Airport',
    description: 'Menjadi titik koordinasi utama untuk monitoring, inspeksi, dan tindak lanjut wilayah inti.',
  },
  {
    key: 'madura-east',
    x: 1360,
    y: 454,
    color: '#62dbe8',
    code: 'SUP',
    title: 'KCP Sumenep',
    region: 'Trunojoyo Airport',
    description: 'Mencakup wilayah operasional timur Pulau Madura dan area pendukungnya.',
  },
  {
    key: 'central-west',
    x: 830,
    y: 705,
    color: '#79767c',
    code: 'DHX',
    title: 'Unit Kediri',
    region: 'Dhoho Airport',
    description: 'Mewakili unit Kediri sebagai bagian dari cakupan pemantauan wilayah tengah-barat.',
  },
  {
    key: 'central-south',
    x: 994,
    y: 790,
    color: '#8f4302',
    code: 'MLG',
    title: 'KCP Malang',
    region: 'Abdul Rachman Saleh Airport',
    description: 'Menunjukkan cakupan lokasi KCP pada wilayah selatan-tengah Jawa Timur.',
  },
  {
    key: 'east-south',
    x: 1322,
    y: 806,
    color: '#3b0442',
    code: 'JBB',
    title: 'Unit Jember',
    region: 'Notohadinegoro Airport',
    description: 'Menandai unit Jember pada koridor timur selatan dalam sebaran layanan KCP.',
  },
  {
    key: 'far-east',
    x: 1520,
    y: 850,
    color: '#f48bc8',
    code: 'BWX',
    title: 'KCP Banyuwangi',
    region: 'Banyuwangi Airport / Blimbingsari Airpor',
    description: 'Menandai lokasi KCP paling timur untuk cakupan operasional Banyuwangi dan sekitarnya.',
  },
];

const MAP_KCP_SELECTOR_KEYS = [
  'north-central',
  'central-south',
  'far-east',
  'madura-east',
  'central-west',
  'north-west',
  'bawean',
  'east-south',
] as const;

const MAP_KCP_IMAGE_SIZE = {
  width: 1920,
  height: 1080,
} as const;

const MAP_KCP_MARKER_IDLE_COLOR = '#9ebfd9';
const MAP_KCP_MARKER_ACTIVE_COLOR = '#ef4444';

const toPercent = (value: number, total: number) => `${((value / total) * 100).toFixed(3)}%`;

const clampChannel = (value: number) => Math.min(1, Math.max(0, value));

const hexToRgb = (hex: string): RgbColor => {
  const normalized = hex.replace('#', '');
  const expanded =
    normalized.length === 3
      ? normalized
          .split('')
          .map((char) => `${char}${char}`)
          .join('')
      : normalized;

  return [
    parseInt(expanded.slice(0, 2), 16) / 255,
    parseInt(expanded.slice(2, 4), 16) / 255,
    parseInt(expanded.slice(4, 6), 16) / 255,
  ];
};

const blendRgb = (color: RgbColor, target: number, amount: number): RgbColor => [
  Number(clampChannel(color[0] + (target - color[0]) * amount).toFixed(6)),
  Number(clampChannel(color[1] + (target - color[1]) * amount).toFixed(6)),
  Number(clampChannel(color[2] + (target - color[2]) * amount).toFixed(6)),
];

const buildMarkerAnimation = (color: string) => {
  const animation = JSON.parse(JSON.stringify(locationMapAnimation)) as typeof locationMapAnimation;
  const base = hexToRgb(color);
  const palette: RgbColor[] = [
    blendRgb(base, 1, 0.45),
    blendRgb(base, 1, 0.72),
    blendRgb(base, 0, 0.3),
    base,
    blendRgb(base, 1, 0.24),
    blendRgb(base, 0, 0.18),
  ];
  let fillIndex = 0;

  const visit = (value: unknown) => {
    if (!value || typeof value !== 'object') return;
    if (Array.isArray(value)) {
      value.forEach(visit);
      return;
    }

    const node = value as {
      ty?: string;
      c?: { k?: number[] };
      [key: string]: unknown;
    };

    if (node.ty === 'fl' && node.c && Array.isArray(node.c.k)) {
      const nextColor = palette[Math.min(fillIndex, palette.length - 1)];
      node.c.k = [...nextColor, 1];
      fillIndex += 1;
    }

    Object.values(node).forEach(visit);
  };

  visit(animation);
  return animation;
};

const MAP_KCP_MARKER_IDLE_ANIMATION = buildMarkerAnimation(MAP_KCP_MARKER_IDLE_COLOR);

const MAP_KCP_MARKER_ACTIVE_ANIMATION = buildMarkerAnimation(MAP_KCP_MARKER_ACTIVE_COLOR);
const CHART_SERIES_COLORS: Record<string, string> = {
  Organisasi: 'var(--chart-series-organisasi)',
  Prosedur: 'var(--chart-series-prosedur)',
  Fasilitas: 'var(--chart-series-fasilitas)',
  Personel: 'var(--chart-series-personel)',
  Dokumen: 'var(--chart-series-dokumen)',
};
const CHART_SERIES_SHADOWS: Record<string, string> = {
  Organisasi: 'rgba(236, 72, 153, 0.18)',
  Prosedur: 'rgba(37, 99, 235, 0.18)',
  Fasilitas: 'rgba(30, 41, 59, 0.18)',
  Personel: 'rgba(15, 118, 110, 0.18)',
  Dokumen: 'rgba(249, 115, 22, 0.18)',
};
const CHART_SERIES_GRADIENTS: Record<string, [string, string]> = {
  Organisasi: ['rgba(236, 72, 153, 0.24)', 'rgba(236, 72, 153, 0.02)'],
  Prosedur: ['rgba(37, 99, 235, 0.24)', 'rgba(37, 99, 235, 0.02)'],
  Fasilitas: ['rgba(30, 41, 59, 0.24)', 'rgba(30, 41, 59, 0.02)'],
  Personel: ['rgba(15, 118, 110, 0.24)', 'rgba(15, 118, 110, 0.02)'],
  Dokumen: ['rgba(249, 115, 22, 0.24)', 'rgba(249, 115, 22, 0.02)'],
};

const MAP_KCP_MARKER_LOTTIE_END = Math.max(
  0,
  Math.floor((locationMapAnimation as { op?: number }).op ?? 120)
);

const formatDateLabel = (date: Date, mode: 'month' | 'day') => {
  if (mode === 'month') return `${MONTHS[date.getMonth()]} ${date.getFullYear()}`;
  return `${date.getDate()} ${MONTHS[date.getMonth()]}`;
};

const formatMapSummaryTimestamp = (value: string | null) => {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  return new Intl.DateTimeFormat('id-ID', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date);
};

const resolveMapScopeDisplayValue = (count: number, isAvailable: boolean) =>
  isAvailable ? String(count) : 'N/A';

function ChartTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: Array<{ color: string; name: string; value: number }>;
  label?: string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div
      className="rounded-lg border px-3 py-2 shadow-xl"
      style={{
        borderColor: 'var(--chart-tooltip-border)',
        backgroundColor: 'var(--chart-tooltip-bg)',
      }}
    >
      <p className="mb-1 text-[11px] font-medium" style={{ color: 'var(--chart-tooltip-label)' }}>
        {label}
      </p>
      {payload.map((item, index) => (
        <div key={`${item.name}-${index}`} className="flex items-center gap-1.5 text-xs">
          <span className="h-2 w-2 rounded-full" style={{ background: item.color }} />
          <span style={{ color: 'var(--chart-tooltip-text)' }}>{item.name}:</span>
          <span className="font-semibold" style={{ color: 'var(--chart-tooltip-value)' }}>
            {item.value}
          </span>
        </div>
      ))}
    </div>
  );
}

const MapMarkerLottie = memo(function MapMarkerLottie({
  animationData,
  isActive,
}: {
  animationData: typeof locationMapAnimation;
  isActive: boolean;
}) {
  const lottieRef = useRef<LottieRefCurrentProps | null>(null);
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    if (!isReady) return;
    const lottie = lottieRef.current;
    if (!lottie) return;
    lottie.setSubframe(false);

    if (isActive) {
      lottie.playSegments([0, MAP_KCP_MARKER_LOTTIE_END], true);
      return;
    }

    lottie.goToAndStop(0, true);
  }, [isActive, isReady]);

  return (
    <Lottie
      lottieRef={lottieRef}
      animationData={animationData}
      autoplay={false}
      loop={isActive}
      renderer={"canvas" as never}
      onDOMLoaded={() => setIsReady(true)}
      className="pointer-events-none h-9 w-9 transform-gpu sm:h-11 sm:w-11 lg:h-12 lg:w-12"
      aria-hidden="true"
    />
  );
});

const MapKcpSection = memo(function MapKcpSection({
  hoveredMapMarkerKey,
  pinnedMapMarkerKey,
  animateAllMapMarkers,
  setHoveredMapMarkerKey,
  setPinnedMapMarkerKey,
  setAnimateAllMapMarkers,
  mapSummaryLoading,
  hasExternalDnpMapAccess,
  mapSummaryByKey,
}: {
  hoveredMapMarkerKey: string | null;
  pinnedMapMarkerKey: string | null;
  animateAllMapMarkers: boolean;
  setHoveredMapMarkerKey: Dispatch<SetStateAction<string | null>>;
  setPinnedMapMarkerKey: Dispatch<SetStateAction<string | null>>;
  setAnimateAllMapMarkers: Dispatch<SetStateAction<boolean>>;
  mapSummaryLoading: boolean;
  hasExternalDnpMapAccess: boolean | null;
  mapSummaryByKey: Record<string, MapMarkerSummary>;
}) {
  const displayedMapMarkerKey = pinnedMapMarkerKey;
  const activeMapMarker =
    MAP_KCP_MARKERS.find((marker) => marker.key === displayedMapMarkerKey) ?? null;
  const activeMapSummary = activeMapMarker ? mapSummaryByKey[activeMapMarker.key] ?? null : null;
  const activeMapCounts: MapScopeCounts = activeMapSummary?.counts ?? EMPTY_MAP_SCOPE_COUNTS;
  const activeMapScopeAvailability: MapScopeAvailability =
    activeMapSummary?.scopeAvailability ?? EMPTY_MAP_SCOPE_AVAILABILITY;
  const activeMapHasData = activeMapSummary?.hasData ?? false;
  const isAllMarkersMode = !activeMapMarker && hasExternalDnpMapAccess === true;
  const [detailScope, setDetailScope] = useState<MapScopeKey | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailItems, setDetailItems] = useState<MapMarkerDetailItem[]>([]);
  const detailCacheRef = useRef<Record<string, MapMarkerScopeDetailPayload>>({});
  const detailRequestRef = useRef(0);
  const selectorMarkers = MAP_KCP_SELECTOR_KEYS
    .map((key) => MAP_KCP_MARKERS.find((marker) => marker.key === key))
    .filter((marker): marker is MapKcpMarker => Boolean(marker));
  const selectedMarker =
    MAP_KCP_MARKERS.find((marker) => marker.key === pinnedMapMarkerKey) ?? null;
  const allMapMarkerSummaries = MAP_KCP_MARKERS.map((marker) => {
    const summary = mapSummaryByKey[marker.key] ?? null;

    return {
      marker,
      summary,
      counts: summary?.counts ?? EMPTY_MAP_SCOPE_COUNTS,
      scopeAvailability: summary?.scopeAvailability ?? EMPTY_MAP_SCOPE_AVAILABILITY,
      hasData: summary?.hasData ?? false,
    };
  });

  useEffect(() => {
    detailRequestRef.current += 1;
    setDetailScope(null);
    setDetailLoading(false);
    setDetailItems([]);
  }, [activeMapMarker?.key]);

  const openScopeDetail = async (scope: MapScopeKey) => {
    if (!activeMapMarker) return;

    setDetailScope(scope);

    const cacheKey = `${activeMapMarker.key}:${scope}`;
    const cachedPayload = detailCacheRef.current[cacheKey];
    if (cachedPayload) {
      setDetailItems(cachedPayload.items ?? []);
      setDetailLoading(false);
      return;
    }

    const requestId = detailRequestRef.current + 1;
    detailRequestRef.current = requestId;
    setDetailLoading(true);
    setDetailItems([]);

    try {
      const query = new URLSearchParams({
        markerKey: activeMapMarker.key,
        scope,
      });
      const response = await apiFetch<{ data: MapMarkerScopeDetailPayload }>(
        `/api/dashboard/external-dnp-map-detail?${query.toString()}`
      );

      if (detailRequestRef.current !== requestId) return;

      detailCacheRef.current[cacheKey] = response.data;
      setDetailItems(response.data.items ?? []);
    } catch (error) {
      if (detailRequestRef.current !== requestId) return;

      setDetailItems([]);
      toast({
        title: 'Gagal memuat detail PQ',
        description:
          error instanceof Error && error.message ? error.message : 'Terjadi kesalahan.',
      });
    } finally {
      if (detailRequestRef.current === requestId) {
        setDetailLoading(false);
      }
    }
  };

  return (
    <>
      <section className="grid w-full gap-5 lg:grid-cols-[minmax(0,1.34fr)_minmax(500px,1.12fr)] lg:items-stretch">
        <article className="overflow-hidden rounded-2xl border border-slate-200/70 bg-white shadow-sm dark:border-[#355791]/70 dark:bg-[#0b1736]">
        <div className="flex flex-wrap items-start justify-between gap-4 border-b border-slate-100 px-5 py-4 dark:border-[#365891]/80">
          <div>
            <h2 className="text-base font-semibold text-slate-800 dark:text-slate-100">Wilayah Kerja Perum LPPNPI Cabang Surabaya</h2>
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="outline"
                className="h-9 min-w-[220px] justify-between rounded-xl border-slate-200 bg-white text-xs font-semibold text-slate-700 shadow-sm hover:border-slate-300 hover:bg-slate-50 dark:border-[#365891]/70 dark:bg-[#102754] dark:text-blue-50 dark:hover:border-[#6f97ea] dark:hover:bg-[#16336d]"
              >
                <span>{selectedMarker?.title ?? 'Pilih Semua'}</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-[220px]">
              <DropdownMenuItem
                onSelect={() => {
                  setHoveredMapMarkerKey(null);
                  setPinnedMapMarkerKey(null);
                  setAnimateAllMapMarkers(true);
                }}
              >
                Pilih Semua
              </DropdownMenuItem>
              {selectorMarkers.map((marker) => (
                <DropdownMenuItem
                  key={marker.key}
                  onSelect={() => {
                    setHoveredMapMarkerKey(null);
                    setPinnedMapMarkerKey(marker.key);
                    setAnimateAllMapMarkers(false);
                  }}
                >
                  {marker.title}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        <div className="px-4 py-4 sm:px-6 sm:py-5">
          <div
            className="flex justify-start"
            onMouseLeave={() => setHoveredMapMarkerKey(null)}
          >
            <div className="relative inline-block max-w-full rounded-2xl bg-white">
              <img
                src={map22Image}
                alt="Map KCP Jawa Timur"
                className="block max-h-[320px] w-auto max-w-full object-contain brightness-[1.16] contrast-[1.06] saturate-[1.08] sm:max-h-[390px] lg:max-h-[430px] dark:brightness-[1.2] dark:contrast-105"
                loading="lazy"
              />

              <div className="absolute inset-0">
                {MAP_KCP_MARKERS.map((marker) => {
                  const isMarkerHighlighted =
                    animateAllMapMarkers ||
                    hoveredMapMarkerKey === marker.key ||
                    pinnedMapMarkerKey === marker.key;

                  return (
                    <button
                      key={marker.key}
                      type="button"
                      className="absolute flex flex-col items-center rounded-xl transition-transform duration-200 hover:scale-105 focus-visible:scale-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-300/80"
                      style={{
                        left: toPercent(marker.x, MAP_KCP_IMAGE_SIZE.width),
                        top: toPercent(marker.y, MAP_KCP_IMAGE_SIZE.height),
                        transform: 'translate(-50%, -84%)',
                      }}
                      onMouseEnter={() => {
                        if (animateAllMapMarkers) return;
                        setHoveredMapMarkerKey(marker.key);
                      }}
                      onMouseLeave={() =>
                        setHoveredMapMarkerKey((current) =>
                          current === marker.key ? null : current
                        )
                      }
                      onFocus={() => {
                        if (animateAllMapMarkers) return;
                        setHoveredMapMarkerKey(marker.key);
                      }}
                      onBlur={() =>
                        setHoveredMapMarkerKey((current) =>
                          current === marker.key ? null : current
                        )
                      }
                      onClick={() => {
                        setAnimateAllMapMarkers(false);
                        setPinnedMapMarkerKey(marker.key);
                      }}
                      aria-label={`${marker.title} - ${marker.region}`}
                      aria-pressed={pinnedMapMarkerKey === marker.key}
                    >
                      <MapMarkerLottie
                        key={`${marker.key}-${isMarkerHighlighted ? 'active' : 'idle'}`}
                        animationData={
                          isMarkerHighlighted
                            ? MAP_KCP_MARKER_ACTIVE_ANIMATION
                            : MAP_KCP_MARKER_IDLE_ANIMATION
                        }
                        isActive={animateAllMapMarkers || pinnedMapMarkerKey === marker.key}
                      />
                      <span
                        className="mt-0.5 rounded-md border px-1.5 py-0.5 text-[9px] font-semibold uppercase leading-none tracking-[0.16em] shadow-sm sm:text-[10px]"
                        style={{
                          color: isMarkerHighlighted
                            ? MAP_KCP_MARKER_ACTIVE_COLOR
                            : '#5f7993',
                          backgroundColor: 'rgba(255, 255, 255, 0.88)',
                          borderColor: isMarkerHighlighted
                            ? 'rgba(239, 68, 68, 0.18)'
                            : 'rgba(158, 191, 217, 0.28)',
                        }}
                      >
                        {marker.code}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
        </article>

        <aside
          className={`min-h-[180px] w-full rounded-2xl border border-slate-200/80 bg-slate-50/80 p-5 shadow-sm transition-colors lg:h-full dark:border-[#4268c4]/60 dark:bg-[#102754]/80 ${
            isAllMarkersMode ? 'overflow-hidden lg:max-h-[590px]' : ''
          }`}
          style={
            activeMapMarker
              ? {
                  borderColor: `${activeMapMarker.color}55`,
                  boxShadow: `0 10px 28px ${activeMapMarker.color}18`,
                }
              : undefined
          }
        >
          {activeMapMarker ? (
            <div className="flex h-full flex-col gap-4">
              <div className="flex items-start gap-3">
                <span
                  className="mt-0.5 h-3.5 w-3.5 rounded-full"
                  style={{ backgroundColor: activeMapMarker.color }}
                  aria-hidden="true"
                />
                <div>
                  <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">
                    {activeMapMarker.title}
                  </p>
                  <p className="text-xs font-medium text-slate-500 dark:text-blue-200/80">
                    {activeMapMarker.region}
                  </p>
                </div>
              </div>

              {hasExternalDnpMapAccess === true ? (
                mapSummaryLoading ? (
                  <div className="flex flex-1 items-center rounded-xl border border-dashed border-slate-200 bg-white/70 px-4 py-5 text-sm text-slate-500 dark:border-[#365891]/70 dark:bg-[#0b1736] dark:text-blue-100/75">
                    Memuat ringkasan data pemenuhan CAP External DNP...
                  </div>
                ) : (
                  <>
                    <div className="grid gap-3 sm:grid-cols-3">
                      {([
                        ['audit', 'text-slate-800 dark:text-slate-100', 'bg-slate-100 dark:bg-slate-800/70'],
                        ['inspeksi', 'text-pink-700 dark:text-pink-200', 'bg-pink-50 dark:bg-pink-900/20'],
                        ['surveillance', 'text-blue-700 dark:text-blue-200', 'bg-blue-50 dark:bg-blue-900/20'],
                      ] as const).map(([scopeKey, textClassName, bgClassName]) => {
                        const total = activeMapCounts[scopeKey];
                        const scopeAvailable = activeMapScopeAvailability[scopeKey];
                        const canOpenDetail = total > 0;
                        const isActiveScope = detailScope === scopeKey;

                        return (
                          <button
                            key={scopeKey}
                            type="button"
                            disabled={!canOpenDetail}
                            onClick={() => {
                              void openScopeDetail(scopeKey);
                            }}
                            className={`rounded-xl border px-4 py-3 text-left shadow-sm transition dark:border-[#365891]/70 ${bgClassName} ${
                              canOpenDetail
                                ? `hover:-translate-y-0.5 hover:shadow-md ${
                                    isActiveScope
                                      ? 'border-slate-400 dark:border-[#8fb5ff]'
                                      : 'border-slate-200/80 hover:border-slate-300'
                                  }`
                                : 'cursor-not-allowed opacity-70'
                            }`}
                          >
                            <div className={`text-xs font-semibold uppercase tracking-[0.16em] ${textClassName}`}>
                              {MAP_SCOPE_LABELS[scopeKey]}
                            </div>
                            <div className="mt-2 text-2xl font-semibold text-slate-800 dark:text-slate-100">
                              {resolveMapScopeDisplayValue(total, scopeAvailable)}
                            </div>
                            <div className="text-[11px] text-slate-500 dark:text-blue-100/70">
                              {scopeAvailable ? 'Temuan' : 'Tidak ada data'}
                            </div>
                            <div className="mt-2 text-[11px] font-medium text-slate-500 dark:text-blue-100/70">
                              {scopeAvailable
                                ? canOpenDetail
                                  ? 'Klik untuk lihat daftar PQ'
                                  : 'Belum ada detail'
                                : 'Belum di update'}
                            </div>
                          </button>
                        );
                      })}
                    </div>

                    <div className="rounded-xl border border-white/70 bg-white/85 px-3 py-3 text-[11px] font-medium leading-6 text-slate-500 shadow-sm dark:border-[#365891]/70 dark:bg-[#0b1736] dark:text-blue-100/75">
                      {activeMapHasData ? (
                        <>
                          Data bersumber dari pemenuhan CAP pada menu External DNP.
                          {activeMapSummary?.latestActivityAt
                            ? ` Update terakhir ${formatMapSummaryTimestamp(activeMapSummary.latestActivityAt)}.`
                            : ''}
                        </>
                      ) : (
                        <span className="text-amber-700 dark:text-amber-100/90">
                          Data Belum di Update. Belum ditemukan data pemenuhan CAP External DNP untuk lokasi ini.
                        </span>
                      )}
                    </div>

                    <div className="rounded-xl border border-slate-200/80 bg-white/90 p-3 shadow-sm dark:border-[#365891]/70 dark:bg-[#0b1736]">
                      <div className="flex items-center justify-between gap-3">
                        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-600 dark:text-blue-100/80">
                          {detailScope ? `Daftar PQ ${MAP_SCOPE_LABELS[detailScope]}` : 'Daftar PQ'}
                        </p>
                        {detailScope && !detailLoading ? (
                          <span className="text-[11px] text-slate-500 dark:text-blue-100/70">
                            {detailItems.length} PQ
                          </span>
                        ) : null}
                      </div>

                      <div className="mt-3 h-[220px]">
                        {detailLoading ? (
                          <div className="flex h-full items-center justify-center rounded-lg border border-dashed border-slate-200 px-3 py-4 text-sm text-slate-500 dark:border-[#365891]/70 dark:text-blue-100/75">
                            Memuat daftar PQ...
                          </div>
                        ) : !activeMapHasData ? (
                          <div className="flex h-full items-center justify-center rounded-lg border border-dashed border-slate-200 px-3 py-4 text-sm text-slate-500 dark:border-[#365891]/70 dark:text-blue-100/75">
                            Belum ada data PQ untuk lokasi ini.
                          </div>
                        ) : detailScope && detailItems.length > 0 ? (
                          <div className="h-full space-y-2 overflow-y-auto pr-1">
                            {detailItems.map((item) => (
                              <div
                                key={item.answerId}
                                className="flex items-center justify-between gap-3 rounded-lg border border-slate-200/80 bg-slate-50/80 px-3 py-2 text-sm dark:border-[#365891]/60 dark:bg-[#102754]/60"
                              >
                                <span className="font-semibold text-slate-700 dark:text-slate-100">
                                  {item.questionCode}
                                </span>
                                <span className="text-sm font-semibold text-slate-500 dark:text-blue-100/80">
                                  {item.progress !== null ? `${item.progress}%` : '-'}
                                </span>
                              </div>
                            ))}
                          </div>
                        ) : detailScope ? (
                          <div className="flex h-full items-center justify-center rounded-lg border border-dashed border-slate-200 px-3 py-4 text-sm text-slate-500 dark:border-[#365891]/70 dark:text-blue-100/75">
                            Belum ada daftar PQ untuk {MAP_SCOPE_LABELS[detailScope]}.
                          </div>
                        ) : (
                          <div className="flex h-full items-center justify-center rounded-lg border border-dashed border-slate-200 px-3 py-4 text-sm text-slate-500 dark:border-[#365891]/70 dark:text-blue-100/75">
                            Klik Audit, Inspeksi, atau Surveillance untuk melihat daftar PQ.
                          </div>
                        )}
                      </div>
                    </div>

                    <p className="flex-1 text-sm leading-7 text-slate-600 dark:text-slate-200/90">
                      {activeMapMarker.description}
                    </p>
                  </>
                )
              ) : (
                <>
                  <p className="flex-1 text-base leading-8 text-slate-600 dark:text-slate-200/90">
                    {activeMapMarker.description}
                  </p>
                  <div className="rounded-xl border border-white/70 bg-white/80 px-3 py-3 text-[11px] font-medium leading-6 text-slate-500 shadow-sm dark:border-[#365891]/70 dark:bg-[#0b1736] dark:text-blue-100/75">
                    {pinnedMapMarkerKey
                      ? 'Informasi ini sedang dikunci. Klik pin lain untuk menampilkan titik KCP yang berbeda.'
                      : animateAllMapMarkers
                        ? 'Semua pin sedang aktif. Klik salah satu pin untuk menampilkan detail lokasinya di panel kanan.'
                        : 'Informasi di panel ini hanya tampil saat pin dipilih.'}
                  </div>
                </>
              )}
            </div>
          ) : (
            hasExternalDnpMapAccess === true ? (
              mapSummaryLoading ? (
                <div className="flex h-full min-h-[148px] items-center rounded-xl border border-dashed border-slate-200 bg-white/70 px-4 text-sm text-slate-500 dark:border-[#365891]/70 dark:bg-[#0b1736] dark:text-blue-100/75">
                  Memuat ringkasan seluruh titik KCP...
                </div>
              ) : (
                <div className="flex h-full min-h-0 flex-col gap-4">
                  <div>
                    <p className="text-sm font-semibold text-slate-700 dark:text-slate-100">
                      Summary Temuan
                    </p>
                    <p className="mt-1 text-xs leading-5 text-slate-500 dark:text-blue-100/75">
                      Ringkasan Temuan Pengawasan di Seluruh Lokasi Kerja Binaan Perum LPPNPI Cabang Surabaya
                    </p>
                  </div>

                  <div className="rounded-xl border border-white/70 bg-white/85 px-3 py-3 text-[11px] font-medium leading-6 text-slate-500 shadow-sm dark:border-[#365891]/70 dark:bg-[#0b1736] dark:text-blue-100/75">
                    Data bersumber dari pemenuhan CAP pada menu External DNP untuk semua wilayah.
                  </div>

                  <div className="min-h-0 flex-1 overflow-hidden rounded-xl border border-slate-200/80 bg-white/90 p-3 shadow-sm dark:border-[#365891]/70 dark:bg-[#0b1736]">
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-600 dark:text-blue-100/80">
                        Daftar Semua Titik
                      </p>
                      <span className="text-[11px] text-slate-500 dark:text-blue-100/70">
                        {allMapMarkerSummaries.length} titik
                      </span>
                    </div>

                    <div className="mt-3 h-[360px] space-y-2 overflow-y-auto pr-2 pb-6">
                      {allMapMarkerSummaries.map(({ marker, counts, scopeAvailability, hasData, summary }) => (
                        <div
                          key={marker.key}
                          className="rounded-xl border border-slate-200/80 bg-white/90 px-3 py-2.5 shadow-sm dark:border-[#365891]/70 dark:bg-[#102754]/60"
                        >
                          <div className="flex flex-wrap items-start justify-between gap-2">
                            <div className="flex min-w-0 items-start gap-3">
                              <span
                                className="mt-0.5 h-3.5 w-3.5 rounded-full"
                                style={{ backgroundColor: marker.color }}
                                aria-hidden="true"
                              />
                              <div className="min-w-0">
                                <p className="truncate text-sm font-semibold text-slate-800 dark:text-slate-100">
                                  {marker.title}
                                </p>
                                <p className="text-xs font-medium text-slate-500 dark:text-blue-200/80">
                                  {marker.region}
                                </p>
                              </div>
                            </div>
                            <span
                              className={`rounded-full px-2 py-1 text-[10px] font-semibold ${
                                hasData
                                  ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-100'
                                  : 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-100'
                              }`}
                            >
                              {hasData ? 'Ada data' : 'Tidak ada data'}
                            </span>
                          </div>

                          <div className="mt-2 grid grid-cols-3 gap-2">
                            {([
                              ['audit', 'text-slate-800 dark:text-slate-100', 'bg-slate-100 dark:bg-slate-800/70'],
                              ['inspeksi', 'text-pink-700 dark:text-pink-200', 'bg-pink-50 dark:bg-pink-900/20'],
                              ['surveillance', 'text-blue-700 dark:text-blue-200', 'bg-blue-50 dark:bg-blue-900/20'],
                            ] as const).map(([scopeKey, textClassName, bgClassName]) => (
                              <div
                                key={scopeKey}
                                className={`rounded-lg border border-slate-200/80 px-2.5 py-2 shadow-sm dark:border-[#365891]/70 ${bgClassName}`}
                              >
                                <div className={`text-[9px] font-semibold uppercase tracking-[0.14em] ${textClassName}`}>
                                  {MAP_SCOPE_LABELS[scopeKey]}
                                </div>
                                <div className="mt-1 text-base font-semibold text-slate-800 dark:text-slate-100">
                                  {resolveMapScopeDisplayValue(counts[scopeKey], scopeAvailability[scopeKey])}
                                </div>
                                <div className="text-[10px] text-slate-500 dark:text-blue-100/70">
                                  {scopeAvailability[scopeKey] ? 'Temuan' : ''}
                                </div>
                              </div>
                            ))}
                          </div>

                          <div className="mt-2 text-[10px] text-slate-500 dark:text-blue-100/70">
                            {summary?.latestActivityAt
                              ? `Update terakhir ${formatMapSummaryTimestamp(summary.latestActivityAt)}.`
                              : 'Belum ada pembaruan External DNP untuk titik ini.'}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )
            ) : (
              <div className="flex h-full min-h-[148px] flex-col justify-center rounded-xl border border-dashed border-slate-200 bg-white/70 px-4 text-sm text-slate-500 dark:border-[#365891]/70 dark:bg-[#0b1736] dark:text-blue-100/75">
                <p className="font-semibold text-slate-700 dark:text-slate-100">
                  Informasi titik KCP
                </p>
                <p className="mt-2 leading-6">
                  {animateAllMapMarkers
                    ? 'Semua pin sedang bergerak. Klik salah satu pin pada peta untuk menampilkan detail lokasi di panel kanan ini.'
                    : 'Klik pin Lottie pada peta untuk menampilkan detail lokasi di panel kanan ini.'}
                </p>
              </div>
            )
          )}
        </aside>
      </section>
    </>
  );
});

export function Dashboard() {
  const { instansi } = useAppData();
  const [isLoading, setIsLoading] = useState(true);
  const [activityLoading, setActivityLoading] = useState(true);
  const [hoveredMapMarkerKey, setHoveredMapMarkerKey] = useState<string | null>(null);
  const [pinnedMapMarkerKey, setPinnedMapMarkerKey] = useState<string | null>(null);
  const [animateAllMapMarkers, setAnimateAllMapMarkers] = useState(false);
  const [mapSummaryLoading, setMapSummaryLoading] = useState(true);
  const [hasExternalDnpMapAccess, setHasExternalDnpMapAccess] = useState<boolean | null>(null);
  const [mapSummaryByKey, setMapSummaryByKey] = useState<Record<string, MapMarkerSummary>>({});
  const [mapCategoryBreakdownLoading, setMapCategoryBreakdownLoading] = useState(false);
  const [mapCategoryBreakdown, setMapCategoryBreakdown] = useState<MapCategoryBreakdownPayload | null>(null);
  const [summary, setSummary] = useState({
    totalQuestions: 0,
    openCaps: 0,
    openSessions: 0,
    overdueCaps: 0,
    closedCaps: 0,
    dueSoonCaps: 0,
  });
  const [dateFrom, setDateFrom] = useState(() => {
    const date = new Date();
    date.setMonth(date.getMonth() - 6);
    return date.toISOString().slice(0, 10);
  });
  const [dateTo, setDateTo] = useState(() => new Date().toISOString().slice(0, 10));
  const [activeUser, setActiveUser] = useState<{ id: string; name: string; role: string } | null>(null);
  const [selectedUser, setSelectedUser] = useState('all');
  const [userOptions, setUserOptions] = useState<UserOption[]>([]);
  const [rawActivity, setRawActivity] = useState<DashboardActivityItem[]>([]);
  const [trendSource, setTrendSource] = useState<TrendSource>('internal');
  const [downloadingManual, setDownloadingManual] = useState<'user' | 'admin' | null>(null);
  const isAdmin = activeUser?.role === 'Admin';
  const dashboardProfileName =
    activeUser?.name?.trim() || instansi?.name?.trim() || 'Pengguna';

  const handleDownloadManual = async (type: 'user' | 'admin') => {
    const endpoint =
      type === 'admin'
        ? '/api/guide/manual/admin-url'
        : '/api/guide/manual/user-url';

    setDownloadingManual(type);
    try {
      const response = await apiFetch<{ data: { url: string } }>(endpoint);
      await downloadFromSignedUrl(
        response.data.url,
        type === 'admin' ? 'Admin Guide.pdf' : 'User Guide.pdf'
      );
    } catch (error) {
      toast({
        title: 'Gagal mengunduh manual',
        description:
          error instanceof Error && error.message
            ? error.message
            : 'Terjadi kesalahan saat mengunduh file.',
      });
    } finally {
      setDownloadingManual(null);
    }
  };

  useEffect(() => {
    setIsLoading(true);
    Promise.all([
      apiFetch<{ data: {
        totalQuestions: number;
        openCaps?: number;
        openSessions: number;
        overdueCaps: number;
        closedCaps: number;
        dueSoonCaps: number;
      } }>('/api/dashboard/cap-summary'),
      fetchExternalDnpDashboardCapList().catch(() => null),
    ])
      .then(([response, capItems]) => {
        const derivedOpenCaps = capItems
          ? capItems.filter((item) => item.hasCap && (item.latestProgress ?? 0) < 100).length
          : null;
        const derivedClosedCaps = capItems
          ? capItems.filter((item) => item.hasCap && (item.latestProgress ?? 0) >= 100).length
          : null;

        setSummary({
          ...response.data,
          openCaps: derivedOpenCaps ?? response.data.openCaps ?? response.data.openSessions,
          openSessions: derivedOpenCaps ?? response.data.openSessions,
          closedCaps: derivedClosedCaps ?? response.data.closedCaps,
        });
      })
      .catch((error: Error) => {
        toast({
          title: 'Gagal memuat dashboard',
          description: error.message || 'Terjadi kesalahan.',
        });
      })
      .finally(() => setIsLoading(false));
  }, []);

  useEffect(() => {
    let cancelled = false;
    setMapSummaryLoading(true);

    apiFetch<{ data: { hasAccess: boolean; markers: MapMarkerSummary[] } }>(
      '/api/dashboard/external-dnp-map-summary'
    )
      .then((response) => {
        if (cancelled) return;
        const markers = response.data.markers ?? [];
        setHasExternalDnpMapAccess(response.data.hasAccess);
        setMapCategoryBreakdownLoading(response.data.hasAccess === true);
        setMapSummaryByKey(
          Object.fromEntries(markers.map((item) => [item.key, item]))
        );
      })
      .catch((error: Error) => {
        if (cancelled) return;
        setHasExternalDnpMapAccess(null);
        setMapCategoryBreakdownLoading(false);
        setMapSummaryByKey({});
        toast({
          title: 'Gagal memuat ringkasan map',
          description: error.message || 'Terjadi kesalahan.',
        });
      })
      .finally(() => {
        if (!cancelled) {
          setMapSummaryLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const user = getAuthUser<{ id: string; name: string; role: string }>();
    if (user) {
      setActiveUser(user);
      if (user.role !== 'Admin') setSelectedUser(user.id);
    }
  }, []);

  useEffect(() => {
    if (hasExternalDnpMapAccess !== true) {
      setMapCategoryBreakdown(null);
      setMapCategoryBreakdownLoading(false);
      return;
    }

    let cancelled = false;
    const query = new URLSearchParams();
    if (pinnedMapMarkerKey) {
      query.set('markerKey', pinnedMapMarkerKey);
    }

    setMapCategoryBreakdownLoading(true);
    apiFetch<{ data: MapCategoryBreakdownPayload }>(
      `/api/dashboard/external-dnp-map-category-breakdown${query.toString() ? `?${query.toString()}` : ''}`
    )
      .then((response) => {
        if (cancelled) return;
        setMapCategoryBreakdown(response.data);
      })
      .catch((error: Error) => {
        if (cancelled) return;
        setMapCategoryBreakdown(null);
        toast({
          title: 'Gagal memuat grafik kategori temuan',
          description: error.message || 'Terjadi kesalahan.',
        });
      })
      .finally(() => {
        if (!cancelled) {
          setMapCategoryBreakdownLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [hasExternalDnpMapAccess, pinnedMapMarkerKey]);

  useEffect(() => {
    if (!isAdmin) return;
    apiFetch<{ data: Array<{ id: string; name: string }> }>('/api/users?limit=200')
      .then((response) => {
        setUserOptions([{ id: 'all', name: 'Semua User' }, ...response.data]);
      })
      .catch(() => toast({ title: 'Gagal memuat user' }));
  }, [isAdmin]);

  useEffect(() => {
    if (!activeUser) return;

    const loadActivity = async () => {
      setActivityLoading(true);
      try {
        const endpoint =
          trendSource === 'dnp'
            ? '/api/dashboard/cap-open-trend/external-dnp'
            : '/api/dashboard/cap-open-trend';
        const response = await apiFetch<{ data: DashboardOpenCapItem[] }>(
          endpoint
        );
        const activityItems = response.data.reduce<DashboardActivityItem[]>((acc, item) => {
          const date = new Date(item.activityAt);
          if (Number.isNaN(date.getTime())) return acc;
          acc.push({
            scope: item.scope,
            date,
            userId: item.userId,
          });
          return acc;
        }, []);

        setRawActivity(activityItems);
      } catch (error) {
        console.error(error);
        toast({ title: 'Gagal memuat grafik dashboard' });
      } finally {
        setActivityLoading(false);
      }
    };

    loadActivity();
  }, [activeUser, trendSource]);

  const filteredActivity = useMemo(() => {
    if (trendSource === 'dnp') return rawActivity;
    if (isAdmin && selectedUser !== 'all') {
      return rawActivity.filter((item) => item.userId === selectedUser);
    }
    return rawActivity;
  }, [rawActivity, isAdmin, selectedUser, trendSource]);

  const trendData = useMemo<ChartPoint[]>(() => {
    const from = new Date(`${dateFrom}T00:00:00`);
    const to = new Date(`${dateTo}T23:59:59`);

    if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime()) || from > to) {
      return [];
    }

    const diffDays = Math.max(Math.round((to.getTime() - from.getTime()) / 86400000), 1);
    const mode: 'month' | 'week' | 'day' = diffDays > 60 ? 'month' : diffDays > 14 ? 'week' : 'day';
    const labels: string[] = [];
    const labelSet = new Set<string>();

    if (mode === 'month') {
      const cursor = new Date(from.getFullYear(), from.getMonth(), 1);
      while (cursor <= to) {
        const key = formatDateLabel(cursor, 'month');
        if (!labelSet.has(key)) {
          labels.push(key);
          labelSet.add(key);
        }
        cursor.setMonth(cursor.getMonth() + 1);
      }
    } else if (mode === 'week') {
      const cursor = new Date(from);
      const dayOfWeek = cursor.getDay();
      cursor.setDate(cursor.getDate() - ((dayOfWeek + 6) % 7));

      while (cursor <= to) {
        const weekEnd = new Date(cursor);
        weekEnd.setDate(weekEnd.getDate() + 6);
        const key = `${formatDateLabel(cursor, 'day')}-${formatDateLabel(weekEnd, 'day')}`;
        if (!labelSet.has(key)) {
          labels.push(key);
          labelSet.add(key);
        }
        cursor.setDate(cursor.getDate() + 7);
      }
    } else {
      const cursor = new Date(from);
      while (cursor <= to) {
        const key = formatDateLabel(cursor, 'day');
        if (!labelSet.has(key)) {
          labels.push(key);
          labelSet.add(key);
        }
        cursor.setDate(cursor.getDate() + 1);
      }
    }

    const buckets: Record<string, Omit<ChartPoint, 'label'>> = {};
    labels.forEach((label) => {
      buckets[label] = { audit: 0, inspeksi: 0, surveillance: 0 };
    });

    filteredActivity.forEach((item) => {
      if (item.date < from || item.date > to) return;

      let key = '';
      if (mode === 'month') {
        key = formatDateLabel(item.date, 'month');
      } else if (mode === 'week') {
        const cursor = new Date(from);
        const dayOfWeek = cursor.getDay();
        cursor.setDate(cursor.getDate() - ((dayOfWeek + 6) % 7));

        while (cursor <= to) {
          const weekEnd = new Date(cursor);
          weekEnd.setDate(weekEnd.getDate() + 6);
          if (item.date >= cursor && item.date <= weekEnd) {
            key = `${formatDateLabel(cursor, 'day')}-${formatDateLabel(weekEnd, 'day')}`;
            break;
          }
          cursor.setDate(cursor.getDate() + 7);
        }
      } else {
        key = formatDateLabel(item.date, 'day');
      }

      if (!buckets[key]) return;
      const scope = item.scope.toLowerCase();
      if (scope === 'audit') buckets[key].audit += 1;
      if (scope === 'inspeksi') buckets[key].inspeksi += 1;
      if (scope === 'surveillance') buckets[key].surveillance += 1;
    });

    return labels.map((label) => ({
      label,
      ...buckets[label],
    }));
  }, [dateFrom, dateTo, filteredActivity]);

  const selectedMapMarker =
    MAP_KCP_MARKERS.find((marker) => marker.key === pinnedMapMarkerKey) ?? null;
  const openCapCount = summary.openCaps ?? summary.openSessions;
  const mapCategoryTrendData = useMemo(() => {
    if (!mapCategoryBreakdown) return [];

    return mapCategoryBreakdown.items.map((item) => ({
      year: String(item.year),
      ...item.counts,
    }));
  }, [mapCategoryBreakdown]);

  return (
    <div className="space-y-6">
      <div className="relative">
        <section className="zoom-performance relative z-0 mt-2 overflow-hidden rounded-2xl bg-white p-5 shadow-sm">
          <div className="relative space-y-3">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
                  Dashboard
                </p>
                <h1 className="mt-2 text-2xl font-semibold text-slate-800">
                  Halo, {dashboardProfileName}!
                </h1>
                <p className="mt-1 text-sm text-slate-500">
                  Ringkasan data pengawasan dan tindak lanjut terbaru.
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  disabled={downloadingManual !== null}
                  onClick={() => void handleDownloadManual('user')}
                  className="border border-emerald-200/80 bg-emerald-500/20 text-emerald-700 transition hover:border-emerald-300/80 hover:bg-emerald-500 hover:bg-gradient-to-r hover:from-emerald-500 hover:to-emerald-600 hover:text-white"
                >
                  {downloadingManual === 'user' ? 'Downloading...' : 'User Manual'}
                </Button>
                {isAdmin && (
                  <Button
                    type="button"
                    disabled={downloadingManual !== null}
                    onClick={() => void handleDownloadManual('admin')}
                    className="border border-amber-200/80 bg-amber-500/20 text-amber-700 transition hover:border-amber-300/80 hover:bg-amber-500 hover:bg-gradient-to-r hover:from-amber-500 hover:to-amber-600 hover:text-white"
                  >
                    {downloadingManual === 'admin' ? 'Downloading...' : 'Admin Manual'}
                  </Button>
                )}
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button className="border border-slate-200/80 bg-slate-200/20 text-slate-700 transition hover:border-slate-300/80 hover:bg-slate-600 hover:bg-gradient-to-r hover:from-slate-500 hover:to-slate-600 hover:text-white">
                      Profil Akun
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem asChild>
                      <Link to="/profile?tab=profile">Edit Profil</Link>
                    </DropdownMenuItem>
                    <DropdownMenuItem asChild>
                      <Link to="/profile?tab=password">Ganti Password</Link>
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>
          </div>

        </section>
      </div>

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Link
          to="/cap?source=external-dnp"
          className="group relative overflow-hidden rounded-3xl border border-sky-200/80 bg-white p-4 shadow-sm transition-all duration-200 hover:border-sky-300 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-200 dark:border-sky-500/45 dark:bg-[#101b39] dark:hover:border-sky-400 dark:hover:shadow-[0_18px_42px_rgba(56,189,248,0.14)] dark:focus-visible:ring-sky-500/30"
        >
          <div className="absolute inset-x-0 top-0 h-1 bg-sky-500" />
          <div className="text-xs font-semibold uppercase tracking-[0.2em] text-sky-700/65 dark:text-sky-300/90">
            Total Temuan
          </div>
          <div className="mt-2 text-3xl font-semibold text-sky-950 dark:text-sky-100">
            {isLoading ? '...' : summary.totalQuestions}
          </div>
          <div className="mt-1 text-xs text-sky-900/65 dark:text-sky-100/75">
            Update otomatis dari data CAP dan temuan.
          </div>
        </Link>

        <Link
          to="/cap?source=external-dnp&status=open"
          className={`group relative overflow-hidden rounded-3xl border bg-white p-4 shadow-sm transition-all duration-200 hover:border-red-200 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-200 dark:bg-[#101b39] dark:hover:border-red-400 dark:hover:shadow-[0_18px_42px_rgba(248,113,113,0.16)] dark:focus-visible:ring-red-500/30 ${
            openCapCount > 0
              ? 'border-red-300/80 ring-1 ring-red-100/80 dark:border-red-400/55 dark:ring-red-500/10'
              : 'border-slate-200/70 dark:border-[#365891]/70'
          }`}
        >
          <div className="absolute inset-x-0 top-0 h-1 bg-red-400" />
          {openCapCount > 0 && (
            <span className="absolute right-4 top-4 flex h-3 w-3">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-400 opacity-75" />
              <span className="relative inline-flex h-3 w-3 rounded-full bg-red-500 shadow-[0_0_0_6px_rgba(239,68,68,0.14)]" />
            </span>
          )}
          {openCapCount > 0 && (
            <div className="pointer-events-none absolute inset-x-0 top-0 h-1 animate-pulse bg-red-500/80" />
          )}
          <div className="text-xs font-semibold uppercase tracking-[0.2em] text-red-600/75 dark:text-red-300/90">
            Open CAP
          </div>
          <div
            className={`mt-2 text-3xl font-semibold ${
              openCapCount > 0
                ? 'text-red-700 dark:text-red-200'
                : 'text-slate-800 dark:text-slate-100'
            }`}
          >
            {isLoading ? '...' : openCapCount}
          </div>
          <div className="mt-1 text-xs text-slate-500 dark:text-slate-300">
            Pemenuhan CAP dengan progress di bawah 100%.
          </div>
        </Link>

        <Link
          to="/cap?source=external-dnp&status=closed"
          className="group relative overflow-hidden rounded-3xl border border-emerald-200/80 bg-white p-4 shadow-sm transition-all duration-200 hover:border-emerald-300 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-200 dark:border-emerald-500/45 dark:bg-[#101b39] dark:hover:border-emerald-400 dark:hover:shadow-[0_18px_42px_rgba(16,185,129,0.14)] dark:focus-visible:ring-emerald-500/30"
        >
          <div className="absolute inset-x-0 top-0 h-1 bg-emerald-500" />
          {summary.closedCaps > 0 && (
            <span className="absolute right-4 top-4 inline-flex h-3 w-3 rounded-full bg-emerald-500 shadow-[0_0_0_6px_rgba(16,185,129,0.14)]" />
          )}
          <div className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-700/65 dark:text-emerald-300/90">
            Closed CAP
          </div>
          <div className="mt-2 text-3xl font-semibold text-emerald-700 dark:text-emerald-200">
            {isLoading ? '...' : summary.closedCaps}
          </div>
          <div className="mt-1 text-xs text-slate-500 dark:text-slate-300">
            Pemenuhan CAP dengan progress sudah mencapai 100%.
          </div>
        </Link>
      </section>

      <MapKcpSection
        hoveredMapMarkerKey={hoveredMapMarkerKey}
        pinnedMapMarkerKey={pinnedMapMarkerKey}
        animateAllMapMarkers={animateAllMapMarkers}
        setHoveredMapMarkerKey={setHoveredMapMarkerKey}
        setPinnedMapMarkerKey={setPinnedMapMarkerKey}
        setAnimateAllMapMarkers={setAnimateAllMapMarkers}
        mapSummaryLoading={mapSummaryLoading}
        hasExternalDnpMapAccess={hasExternalDnpMapAccess}
        mapSummaryByKey={mapSummaryByKey}
      />

      {hasExternalDnpMapAccess === true ? (
        <section className="overflow-hidden rounded-2xl border border-slate-200/70 bg-white shadow-sm [--chart-grid:#e2e8f0] [--chart-axis:#94a3b8] [--chart-tooltip-bg:#ffffff] [--chart-tooltip-border:#e2e8f0] [--chart-tooltip-label:#94a3b8] [--chart-tooltip-text:#64748b] [--chart-tooltip-value:#334155] [--chart-series-organisasi:#ec4899] [--chart-series-prosedur:#2563eb] [--chart-series-fasilitas:#1e293b] [--chart-series-personel:#0f766e] [--chart-series-dokumen:#f97316] dark:border-[#355791]/70 dark:bg-[#0b1736] dark:[--chart-grid:#334155] dark:[--chart-axis:#cbd5e1] dark:[--chart-tooltip-bg:#102754] dark:[--chart-tooltip-border:#365f9f] dark:[--chart-tooltip-label:#9fb7e6] dark:[--chart-tooltip-text:#dbeafe] dark:[--chart-tooltip-value:#eff6ff] dark:[--chart-series-organisasi:#fbcfe8] dark:[--chart-series-prosedur:#9ccfff] dark:[--chart-series-fasilitas:#bcdbff] dark:[--chart-series-personel:#7dd3fc] dark:[--chart-series-dokumen:#fdba74]">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-6 py-4 dark:border-[#365891]/80">
            <div>
              <h2 className="text-base font-semibold text-slate-800 dark:text-slate-100">Temuan per Kategori</h2>
              <p className="text-xs text-slate-400 dark:text-blue-200/75">
                {selectedMapMarker
                  ? `Distribusi jumlah temuan untuk ${selectedMapMarker.title}.`
                  : 'Distribusi jumlah temuan untuk seluruh wilayah kerja Cabang Surabaya.'}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <div className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-semibold text-slate-600 shadow-sm dark:border-[#4268c4]/70 dark:bg-[#122b66] dark:text-blue-50">
                {mapCategoryBreakdown?.locationLabel ??
                  selectedMapMarker?.title ??
                  'Semua Wilayah Kerja Cabang Surabaya'}
              </div>
            </div>
          </div>

          <div className="px-2 pb-2 pt-4 sm:px-4">
            {mapCategoryBreakdownLoading ? (
              <div className="flex h-[240px] items-center justify-center">
                <div className="h-6 w-6 animate-spin rounded-full border-2 border-blue-500 border-t-transparent" />
              </div>
            ) : mapCategoryBreakdown && mapCategoryBreakdown.items.length > 0 ? (
              <>
                <ResponsiveContainer width="100%" height={240}>
                  <AreaChart data={mapCategoryTrendData} margin={{ top: 8, right: 20, left: 0, bottom: 0 }}>
                    <defs>
                      {mapCategoryBreakdown.categories.map((category) => {
                        const gradientId = `map-category-gradient-${category.toLowerCase()}`;
                        const [startColor, endColor] = CHART_SERIES_GRADIENTS[category] ?? [
                          'rgba(37, 99, 235, 0.24)',
                          'rgba(37, 99, 235, 0.02)',
                        ];

                        return (
                          <linearGradient key={gradientId} id={gradientId} x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor={startColor} />
                            <stop offset="100%" stopColor={endColor} />
                          </linearGradient>
                        );
                      })}
                    </defs>
                    <CartesianGrid vertical={false} stroke="var(--chart-grid)" />
                    <XAxis
                      dataKey="year"
                      axisLine={false}
                      tickLine={false}
                      tick={{ fontSize: 10, fill: 'var(--chart-axis)' }}
                      dy={8}
                    />
                    <YAxis
                      axisLine={false}
                      tickLine={false}
                      tick={{ fontSize: 10, fill: 'var(--chart-axis)' }}
                      width={32}
                      allowDecimals={false}
                    />
                    <Tooltip content={<ChartTooltip />} />
                    {mapCategoryBreakdown.categories.map((category) => {
                      const gradientId = `map-category-gradient-${category.toLowerCase()}`;
                      const strokeColor =
                        CHART_SERIES_COLORS[category] ?? 'var(--chart-series-prosedur)';
                      const shadowColor =
                        CHART_SERIES_SHADOWS[category] ?? 'rgba(37, 99, 235, 0.18)';

                      return (
                        <Area
                          key={category}
                          type="monotone"
                          dataKey={category}
                          name={category}
                          stroke={strokeColor}
                          fill={`url(#${gradientId})`}
                          strokeWidth={2.5}
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          dot={{
                            r: 3,
                            strokeWidth: 1.5,
                            fill: strokeColor,
                            stroke: 'var(--chart-tooltip-bg)',
                          }}
                          activeDot={{
                            r: 5,
                            strokeWidth: 2,
                            fill: strokeColor,
                            stroke: 'var(--chart-tooltip-bg)',
                          }}
                          style={{
                            filter: `drop-shadow(0px 6px 8px ${shadowColor})`,
                          }}
                          connectNulls
                        />
                      );
                    })}
                  </AreaChart>
                </ResponsiveContainer>

                <div className="mt-3 flex flex-wrap items-center justify-between gap-3 px-2 pb-2 text-xs text-slate-500 dark:text-slate-300">
                  <div className="flex flex-wrap items-center gap-4">
                    {mapCategoryBreakdown.categories.map((category) => (
                      <span key={category} className="flex items-center gap-1.5">
                        <span
                          className="inline-block h-2.5 w-2.5 rounded-full"
                          style={{
                            background: CHART_SERIES_COLORS[category] ?? 'var(--chart-series-prosedur)',
                          }}
                        />
                        {category}
                      </span>
                    ))}
                  </div>
                  <span className="font-semibold text-slate-600 dark:text-slate-100">
                    Total {mapCategoryBreakdown.totalFindings} temuan
                  </span>
                </div>
              </>
            ) : (
              <div className="flex h-[240px] flex-col items-center justify-center gap-2 text-center">
                <p className="text-sm font-semibold text-slate-700 dark:text-slate-100">
                  Belum ada temuan untuk lokasi ini.
                </p>
                <p className="max-w-md text-xs leading-6 text-slate-500 dark:text-blue-100/75">
                  {selectedMapMarker
                    ? `Belum ditemukan temuan External DNP untuk ${selectedMapMarker.title}.`
                    : 'Pilih pin di map untuk melihat breakdown kategori temuan per lokasi, atau biarkan pada Semua Wilayah Kerja Cabang Surabaya untuk melihat agregat.'}
                </p>
              </div>
            )}
          </div>
        </section>
      ) : (
        <section className="overflow-hidden rounded-2xl border border-slate-200/70 bg-white shadow-sm [--chart-audit:#1e293b] [--chart-inspeksi:#ec4899] [--chart-surveillance:#3b82f6] [--chart-grid:#e2e8f0] [--chart-axis:#94a3b8] [--chart-dot-fill:#ffffff] [--chart-tooltip-bg:#ffffff] [--chart-tooltip-border:#e2e8f0] [--chart-tooltip-label:#94a3b8] [--chart-tooltip-text:#64748b] [--chart-tooltip-value:#334155] dark:border-[#355791]/70 dark:bg-[#0b1736] dark:[--chart-audit:#bcdbff] dark:[--chart-inspeksi:#fbcfe8] dark:[--chart-surveillance:#9ccfff] dark:[--chart-grid:#334155] dark:[--chart-axis:#cbd5e1] dark:[--chart-dot-fill:#0b1736] dark:[--chart-tooltip-bg:#102754] dark:[--chart-tooltip-border:#365f9f] dark:[--chart-tooltip-label:#9fb7e6] dark:[--chart-tooltip-text:#dbeafe] dark:[--chart-tooltip-value:#eff6ff]">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-6 py-4 dark:border-[#365891]/80">
            <div className="flex flex-wrap items-center gap-4">
              <div>
                <h2 className="text-base font-semibold text-slate-800 dark:text-slate-100">CAP Activity Overview</h2>
                <p className="text-xs text-slate-400 dark:text-blue-200/75">
                  {trendSource === 'dnp'
                    ? 'Tren jumlah CAP pemenuhan dari External DNP'
                    : 'Tren jumlah CAP yang memiliki data pemenuhan'}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant={trendSource === 'dnp' ? 'default' : 'outline'}
                  className="h-8 px-3 text-xs"
                  onClick={() =>
                    setTrendSource((current) => (current === 'dnp' ? 'internal' : 'dnp'))
                  }
                >
                  DNP
                </Button>
              </div>
              {trendSource === 'internal' &&
                (isAdmin ? (
                  <select
                    value={selectedUser}
                    onChange={(event) => setSelectedUser(event.target.value)}
                    className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 shadow-sm outline-none transition hover:border-slate-300 focus:border-blue-300 focus:ring-2 focus:ring-blue-100 dark:border-[#4268c4]/70 dark:bg-[#122b66] dark:text-blue-50 dark:hover:border-[#7ea9ff] dark:focus:border-[#8eb6ff] dark:focus:ring-[#2d4f98]/60"
                  >
                    {userOptions.map((user) => (
                      <option key={user.id} value={user.id}>
                        {user.name}
                      </option>
                    ))}
                  </select>
                ) : (
                  <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-medium text-slate-500 shadow-sm dark:border-[#4268c4]/70 dark:bg-[#132a60] dark:text-blue-100">
                    {activeUser?.name}
                  </div>
                ))}
            </div>

            <div className="flex items-center gap-2">
              <input
                type="date"
                value={dateFrom}
                max={dateTo}
                onChange={(event) => setDateFrom(event.target.value)}
                className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 outline-none transition hover:border-slate-300 focus:border-blue-300 focus:ring-2 focus:ring-blue-100 dark:border-[#4268c4]/70 dark:bg-[#122b66] dark:text-blue-50 dark:hover:border-[#7ea9ff] dark:focus:border-[#8eb6ff] dark:focus:ring-[#2d4f98]/60"
              />
              <span className="text-xs text-slate-400 dark:text-blue-200/70">-</span>
              <input
                type="date"
                value={dateTo}
                min={dateFrom}
                onChange={(event) => setDateTo(event.target.value)}
                className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 outline-none transition hover:border-slate-300 focus:border-blue-300 focus:ring-2 focus:ring-blue-100 dark:border-[#4268c4]/70 dark:bg-[#122b66] dark:text-blue-50 dark:hover:border-[#7ea9ff] dark:focus:border-[#8eb6ff] dark:focus:ring-[#2d4f98]/60"
              />
            </div>
          </div>

          <div className="px-2 pb-2 pt-4 sm:px-4">
            {activityLoading ? (
              <div className="flex h-[300px] items-center justify-center">
                <div className="h-6 w-6 animate-spin rounded-full border-2 border-blue-500 border-t-transparent" />
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={trendData} margin={{ top: 5, right: 20, left: 0, bottom: 0 }}>
                  <CartesianGrid vertical={false} stroke="var(--chart-grid)" />
                  <XAxis
                    dataKey="label"
                    axisLine={false}
                    tickLine={false}
                    tick={{ fontSize: 11, fill: 'var(--chart-axis)' }}
                    dy={8}
                  />
                  <YAxis
                    axisLine={false}
                    tickLine={false}
                    tick={{ fontSize: 11, fill: 'var(--chart-axis)' }}
                    width={32}
                    allowDecimals={false}
                  />
                  <Tooltip content={<ChartTooltip />} />
                  <Bar dataKey="audit" name="Audit" fill="var(--chart-audit)" radius={[8, 8, 0, 0]} />
                  <Bar dataKey="inspeksi" name="Inspeksi" fill="var(--chart-inspeksi)" radius={[8, 8, 0, 0]} />
                  <Bar dataKey="surveillance" name="Surveillance" fill="var(--chart-surveillance)" radius={[8, 8, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}

            <div className="mt-2 flex flex-wrap items-center justify-center gap-5 pb-2 text-xs text-slate-500 dark:text-slate-300">
              <span className="flex items-center gap-1.5">
                <span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ background: 'var(--chart-audit)' }} />
                Audit
              </span>
              <span className="flex items-center gap-1.5">
                <span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ background: 'var(--chart-inspeksi)' }} />
                Inspeksi
              </span>
              <span className="flex items-center gap-1.5">
                <span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ background: 'var(--chart-surveillance)' }} />
                Surveillance
              </span>
            </div>
          </div>
        </section>
      )}

    </div>
  );
}
