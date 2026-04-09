import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { apiFetch, getAuthUser } from '@/lib/api';
import { downloadFromSignedUrl } from '@/lib/download';
import { toast } from '@/hooks/use-toast';
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { CalendarHeatmap } from '@/components/charts/CalendarHeatmap';

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

type DashboardUrgentAlertItem = {
  key: string;
  label: string;
  count: number;
  href: string;
  description: string;
};

type DashboardRotatingCard = {
  key: string;
  label: string;
  value: number;
  href: string;
  description: string;
  isUrgent: boolean;
};

type UserOption = {
  id: string;
  name: string;
};

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];

const formatDateLabel = (date: Date, mode: 'month' | 'day') => {
  if (mode === 'month') return `${MONTHS[date.getMonth()]} ${date.getFullYear()}`;
  return `${date.getDate()} ${MONTHS[date.getMonth()]}`;
};

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

export function Dashboard() {
  const [isLoading, setIsLoading] = useState(true);
  const [activityLoading, setActivityLoading] = useState(true);
  const [summary, setSummary] = useState({
    totalQuestions: 0,
    openSessions: 0,
    overdueCaps: 0,
    closedCaps: 0,
    dueSoonCaps: 0,
  });
  const [activeCapTickerIndex, setActiveCapTickerIndex] = useState(0);
  const [isCapTickerAnimating, setIsCapTickerAnimating] = useState(false);
  const [activeFocusTickerIndex, setActiveFocusTickerIndex] = useState(0);
  const [isFocusTickerAnimating, setIsFocusTickerAnimating] = useState(false);
  const [focusLoading, setFocusLoading] = useState(true);
  const [focusAlerts, setFocusAlerts] = useState<DashboardUrgentAlertItem[]>([]);
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
  const [downloadingManual, setDownloadingManual] = useState<'user' | 'admin' | null>(null);
  const isAdmin = activeUser?.role === 'Admin';
  const profileName = activeUser?.name?.trim() || 'Pengguna';

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
    apiFetch<{ data: {
      totalQuestions: number;
      openSessions: number;
      overdueCaps: number;
      closedCaps: number;
      dueSoonCaps: number;
    } }>('/api/dashboard/cap-summary')
      .then((response) => {
        setSummary(response.data);
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
    setFocusLoading(true);
    apiFetch<{ data: DashboardUrgentAlertItem[] }>('/api/dashboard/user-alerts')
      .then((response) => {
        setFocusAlerts(response.data);
      })
      .catch((error: Error) => {
        toast({
          title: 'Gagal memuat panel fokus dashboard',
          description: error.message || 'Terjadi kesalahan.',
        });
      })
      .finally(() => setFocusLoading(false));
  }, []);

  useEffect(() => {
    const user = getAuthUser<{ id: string; name: string; role: string }>();
    if (user) {
      setActiveUser(user);
      if (user.role !== 'Admin') setSelectedUser(user.id);
    }
  }, []);

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
        const response = await apiFetch<{ data: DashboardOpenCapItem[] }>(
          '/api/dashboard/cap-open-trend'
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
  }, [activeUser]);

  const filteredActivity = useMemo(() => {
    if (isAdmin && selectedUser !== 'all') {
      return rawActivity.filter((item) => item.userId === selectedUser);
    }
    return rawActivity;
  }, [rawActivity, isAdmin, selectedUser]);

  const capTickerCards = useMemo<DashboardRotatingCard[]>(() => {
    return [
      {
        key: 'open-cap',
        label: 'Open CAP',
        value: summary.openSessions,
        href: '/cap?status=open',
        description: 'Temuan CAP yang masih perlu ditindaklanjuti.',
        isUrgent: summary.openSessions > 0,
      },
      {
        key: 'closed-cap',
        label: 'Closed CAP',
        value: summary.closedCaps,
        href: '/cap?status=closed',
        description: 'CAP yang sudah selesai dan sudah dikirim.',
        isUrgent: false,
      },
    ];
  }, [summary.openSessions, summary.closedCaps]);

  useEffect(() => {
    if (capTickerCards.length < 2) return;
    const timerId = window.setInterval(() => {
      setIsCapTickerAnimating(true);
    }, 4500);
    return () => window.clearInterval(timerId);
  }, [capTickerCards.length]);

  useEffect(() => {
    if (!isCapTickerAnimating) return;
    const timerId = window.setTimeout(() => {
      setActiveCapTickerIndex((current) => (current + 1) % capTickerCards.length);
      setIsCapTickerAnimating(false);
    }, 520);
    return () => window.clearTimeout(timerId);
  }, [isCapTickerAnimating, capTickerCards.length]);

  const focusTickerCards = useMemo<DashboardRotatingCard[]>(() => {
    return focusAlerts
      .filter((item) => item.count > 0)
      .map((item) => ({
        key: item.key,
        label: item.label,
        value: item.count,
        href: item.href,
        description: item.description,
        isUrgent: true,
      }));
  }, [focusAlerts]);

  useEffect(() => {
    if (focusTickerCards.length < 2) return;
    const timerId = window.setInterval(() => {
      setIsFocusTickerAnimating(true);
    }, 5200);
    return () => window.clearInterval(timerId);
  }, [focusTickerCards.length]);

  useEffect(() => {
    if (!isFocusTickerAnimating) return;
    if (focusTickerCards.length === 0) {
      setIsFocusTickerAnimating(false);
      return;
    }
    const timerId = window.setTimeout(() => {
      setActiveFocusTickerIndex((current) => (current + 1) % focusTickerCards.length);
      setIsFocusTickerAnimating(false);
    }, 520);
    return () => window.clearTimeout(timerId);
  }, [isFocusTickerAnimating, focusTickerCards.length]);

  const activeCapTickerCard = capTickerCards[activeCapTickerIndex % capTickerCards.length];
  const incomingCapTickerCard =
    capTickerCards[(activeCapTickerIndex + 1) % capTickerCards.length];
  const hasFocusTickerCard = focusTickerCards.length > 0;
  const activeFocusTickerCard = hasFocusTickerCard
    ? focusTickerCards[activeFocusTickerIndex % focusTickerCards.length]
    : null;
  const incomingFocusTickerCard = hasFocusTickerCard
    ? focusTickerCards[(activeFocusTickerIndex + 1) % focusTickerCards.length]
    : null;

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
                  {`Halo, ${profileName}!`}
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

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Link
          to="/cap"
          className="group relative overflow-hidden rounded-3xl border border-slate-200/70 bg-white p-4 shadow-sm transition-shadow duration-200 hover:border-blue-200 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-200"
        >
          <div className="absolute -right-10 -top-10 h-20 w-20 rounded-full bg-blue-100/70 blur-2xl transition-opacity duration-200 group-hover:opacity-80" />
          <div className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
            Total Temuan
          </div>
          <div className="mt-2 text-3xl font-semibold text-slate-800">
            {isLoading ? '...' : summary.totalQuestions}
          </div>
          <div className="mt-1 text-xs text-slate-500">
            Update otomatis dari data CAP dan temuan.
          </div>
        </Link>

        <div className="relative h-[168px] overflow-hidden">
          <Link
            key={`${activeCapTickerCard.key}-active`}
            to={activeCapTickerCard.href}
            className={`group absolute inset-0 overflow-hidden rounded-3xl border bg-white p-4 shadow-sm transition-all duration-500 ease-in-out hover:border-blue-200 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-200 will-change-transform ${
              activeCapTickerCard.isUrgent
                ? 'border-red-300/80 ring-2 ring-red-200/70'
                : 'border-slate-200/70'
            } ${
              isCapTickerAnimating
                ? '-translate-y-[115%] scale-[0.96] opacity-0 pointer-events-none'
                : 'translate-y-0 scale-100 opacity-100'
            }`}
          >
            <div className="absolute -right-10 -top-10 h-20 w-20 rounded-full bg-blue-100/70 blur-2xl transition-opacity duration-200 group-hover:opacity-80" />
            {activeCapTickerCard.isUrgent && (
              <span className="absolute right-4 top-4 flex h-3 w-3">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-400 opacity-75" />
                <span className="relative inline-flex h-3 w-3 rounded-full bg-red-500" />
              </span>
            )}
            <div className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
              {activeCapTickerCard.label}
            </div>
            <div
              className={`mt-2 text-3xl font-semibold ${
                activeCapTickerCard.isUrgent ? 'animate-pulse text-red-700' : 'text-slate-800'
              }`}
            >
              {isLoading ? '...' : activeCapTickerCard.value}
            </div>
            <div className="mt-1 text-xs text-slate-500">
              {activeCapTickerCard.description}
            </div>
          </Link>

          <Link
            key={`${incomingCapTickerCard.key}-incoming`}
            to={incomingCapTickerCard.href}
            className={`group absolute inset-0 overflow-hidden rounded-3xl border bg-white p-4 shadow-sm transition-all duration-500 ease-in-out hover:border-blue-200 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-200 will-change-transform ${
              incomingCapTickerCard.isUrgent
                ? 'border-red-300/80 ring-2 ring-red-200/70'
                : 'border-slate-200/70'
            } ${
              isCapTickerAnimating
                ? 'translate-y-0 scale-100 opacity-100'
                : 'translate-y-[115%] scale-[0.96] opacity-0 pointer-events-none'
            }`}
          >
            <div className="absolute -right-10 -top-10 h-20 w-20 rounded-full bg-blue-100/70 blur-2xl transition-opacity duration-200 group-hover:opacity-80" />
            {incomingCapTickerCard.isUrgent && (
              <span className="absolute right-4 top-4 flex h-3 w-3">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-400 opacity-75" />
                <span className="relative inline-flex h-3 w-3 rounded-full bg-red-500" />
              </span>
            )}
            <div className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
              {incomingCapTickerCard.label}
            </div>
            <div
              className={`mt-2 text-3xl font-semibold ${
                incomingCapTickerCard.isUrgent ? 'animate-pulse text-red-700' : 'text-slate-800'
              }`}
            >
              {isLoading ? '...' : incomingCapTickerCard.value}
            </div>
            <div className="mt-1 text-xs text-slate-500">
              {incomingCapTickerCard.description}
            </div>
          </Link>
        </div>

        <Link
          to="/cap?overdue=1"
          className={`group relative overflow-hidden rounded-3xl border bg-white p-4 shadow-sm transition-shadow duration-200 hover:border-blue-200 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-200 ${
            summary.overdueCaps > 0
              ? 'border-red-300/80 ring-2 ring-red-200/70'
              : 'border-slate-200/70'
          }`}
        >
          <div className="absolute -right-10 -top-10 h-20 w-20 rounded-full bg-blue-100/70 blur-2xl transition-opacity duration-200 group-hover:opacity-80" />
          {summary.overdueCaps > 0 && (
            <span className="absolute right-4 top-4 flex h-3 w-3">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-400 opacity-75" />
              <span className="relative inline-flex h-3 w-3 rounded-full bg-red-500" />
            </span>
          )}
          <div className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
            Overdue
          </div>
          <div
            className={`mt-2 text-3xl font-semibold ${
              summary.overdueCaps > 0 ? 'animate-pulse text-red-700' : 'text-slate-800'
            }`}
          >
            {isLoading ? '...' : summary.overdueCaps}
          </div>
          <div className="mt-1 text-xs text-slate-500">
            CAP melewati deadline dan butuh tindak lanjut segera.
          </div>
        </Link>

        {focusLoading ? (
          <div className="rounded-3xl border border-slate-200/70 bg-white p-4 shadow-sm">
            <div className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
              Notifikasi Prioritas
            </div>
            <div className="mt-2 text-3xl font-semibold text-slate-800">...</div>
            <div className="mt-1 text-xs text-slate-500">
              Menyiapkan notifikasi penting terbaru.
            </div>
          </div>
        ) : !activeFocusTickerCard || !incomingFocusTickerCard ? (
          <div className="rounded-3xl border border-emerald-200/70 bg-emerald-50/70 p-4 shadow-sm dark:border-emerald-400/30 dark:bg-[#153b33]/55">
            <div className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-700 dark:text-emerald-200">
              Notifikasi Prioritas
            </div>
            <div className="mt-8 text-center text-sm font-semibold text-emerald-800 dark:text-emerald-100">
              Tidak ada alarm urgent saat ini.
            </div>
          </div>
        ) : (
          <div className="space-y-2">
            <div className="relative h-[168px] overflow-hidden">
              <Link
              key={`${activeFocusTickerCard.key}-active`}
              to={activeFocusTickerCard.href}
              className={`group absolute inset-0 overflow-hidden rounded-3xl border bg-white p-4 shadow-sm transition-all duration-500 ease-in-out hover:border-blue-200 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-200 will-change-transform ${
                activeFocusTickerCard.isUrgent
                  ? 'border-red-300/80 ring-2 ring-red-200/70'
                  : 'border-slate-200/70'
              } ${
                isFocusTickerAnimating
                  ? '-translate-y-[115%] scale-[0.96] opacity-0 pointer-events-none'
                  : 'translate-y-0 scale-100 opacity-100'
              }`}
            >
              <div className="absolute -right-10 -top-10 h-20 w-20 rounded-full bg-blue-100/70 blur-2xl transition-opacity duration-200 group-hover:opacity-80" />
              {activeFocusTickerCard.isUrgent && (
                <span className="absolute right-4 top-4 flex h-3 w-3">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-400 opacity-75" />
                  <span className="relative inline-flex h-3 w-3 rounded-full bg-red-500" />
                </span>
              )}
              <div className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
                {activeFocusTickerCard.label}
              </div>
              <div
                className={`mt-2 text-3xl font-semibold ${
                  activeFocusTickerCard.isUrgent ? 'animate-pulse text-red-700' : 'text-slate-800'
                }`}
              >
                {activeFocusTickerCard.value}
              </div>
              <div className="mt-1 text-xs text-slate-500">
                {activeFocusTickerCard.description}
              </div>
              </Link>

              <Link
              key={`${incomingFocusTickerCard.key}-incoming`}
              to={incomingFocusTickerCard.href}
              className={`group absolute inset-0 overflow-hidden rounded-3xl border bg-white p-4 shadow-sm transition-all duration-500 ease-in-out hover:border-blue-200 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-200 will-change-transform ${
                incomingFocusTickerCard.isUrgent
                  ? 'border-red-300/80 ring-2 ring-red-200/70'
                  : 'border-slate-200/70'
              } ${
                isFocusTickerAnimating
                  ? 'translate-y-0 scale-100 opacity-100'
                  : 'translate-y-[115%] scale-[0.96] opacity-0 pointer-events-none'
              }`}
            >
              <div className="absolute -right-10 -top-10 h-20 w-20 rounded-full bg-blue-100/70 blur-2xl transition-opacity duration-200 group-hover:opacity-80" />
              {incomingFocusTickerCard.isUrgent && (
                <span className="absolute right-4 top-4 flex h-3 w-3">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-400 opacity-75" />
                  <span className="relative inline-flex h-3 w-3 rounded-full bg-red-500" />
                </span>
              )}
              <div className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
                {incomingFocusTickerCard.label}
              </div>
              <div
                className={`mt-2 text-3xl font-semibold ${
                  incomingFocusTickerCard.isUrgent ? 'animate-pulse text-red-700' : 'text-slate-800'
                }`}
              >
                {incomingFocusTickerCard.value}
              </div>
              <div className="mt-1 text-xs text-slate-500">
                {incomingFocusTickerCard.description}
              </div>
              </Link>
            </div>
          </div>
        )}
      </section>

      <section className="overflow-hidden rounded-2xl border border-slate-200/70 bg-white shadow-sm [--chart-audit:#1e293b] [--chart-inspeksi:#ec4899] [--chart-surveillance:#3b82f6] [--chart-grid:#e2e8f0] [--chart-axis:#94a3b8] [--chart-dot-fill:#ffffff] [--chart-tooltip-bg:#ffffff] [--chart-tooltip-border:#e2e8f0] [--chart-tooltip-label:#94a3b8] [--chart-tooltip-text:#64748b] [--chart-tooltip-value:#334155] dark:border-[#355791]/70 dark:bg-[#0b1736] dark:[--chart-audit:#bcdbff] dark:[--chart-inspeksi:#fbcfe8] dark:[--chart-surveillance:#9ccfff] dark:[--chart-grid:#334155] dark:[--chart-axis:#cbd5e1] dark:[--chart-dot-fill:#0b1736] dark:[--chart-tooltip-bg:#102754] dark:[--chart-tooltip-border:#365f9f] dark:[--chart-tooltip-label:#9fb7e6] dark:[--chart-tooltip-text:#dbeafe] dark:[--chart-tooltip-value:#eff6ff]">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-6 py-4 dark:border-[#365891]/80">
          <div className="flex flex-wrap items-center gap-4">
            <div>
              <h2 className="text-base font-semibold text-slate-800 dark:text-slate-100">CAP Activity Overview</h2>
              <p className="text-xs text-slate-400 dark:text-blue-200/75">
                Tren jumlah CAP yang memiliki data pemenuhan
              </p>
            </div>
            {isAdmin ? (
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
            )}
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
              <AreaChart data={trendData} margin={{ top: 5, right: 20, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="gradAudit" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="var(--chart-audit)" stopOpacity={0.18} />
                    <stop offset="100%" stopColor="var(--chart-audit)" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="gradInspeksi" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="var(--chart-inspeksi)" stopOpacity={0.16} />
                    <stop offset="100%" stopColor="var(--chart-inspeksi)" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="gradSurveillance" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="var(--chart-surveillance)" stopOpacity={0.14} />
                    <stop offset="100%" stopColor="var(--chart-surveillance)" stopOpacity={0} />
                  </linearGradient>
                </defs>
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
                <Area
                  type="monotone"
                  dataKey="audit"
                  stroke="var(--chart-audit)"
                  strokeWidth={2.5}
                  fill="url(#gradAudit)"
                  name="Audit"
                  dot={{ r: 4, strokeWidth: 2, fill: 'var(--chart-dot-fill)', stroke: 'var(--chart-audit)' }}
                  activeDot={{ r: 6, strokeWidth: 2, fill: 'var(--chart-dot-fill)', stroke: 'var(--chart-audit)' }}
                />
                <Area
                  type="monotone"
                  dataKey="inspeksi"
                  stroke="var(--chart-inspeksi)"
                  strokeWidth={2}
                  fill="url(#gradInspeksi)"
                  name="Inspeksi"
                  dot={{ r: 3.5, strokeWidth: 2, fill: 'var(--chart-dot-fill)', stroke: 'var(--chart-inspeksi)' }}
                  activeDot={{ r: 5, strokeWidth: 2, fill: 'var(--chart-dot-fill)', stroke: 'var(--chart-inspeksi)' }}
                />
                <Area
                  type="monotone"
                  dataKey="surveillance"
                  stroke="var(--chart-surveillance)"
                  strokeWidth={2}
                  fill="url(#gradSurveillance)"
                  name="Surveillance"
                  dot={{ r: 3.5, strokeWidth: 2, fill: 'var(--chart-dot-fill)', stroke: 'var(--chart-surveillance)' }}
                  activeDot={{ r: 5, strokeWidth: 2, fill: 'var(--chart-dot-fill)', stroke: 'var(--chart-surveillance)' }}
                />
              </AreaChart>
            </ResponsiveContainer>
          )}

          <div className="mt-2 flex flex-wrap items-center justify-center gap-5 pb-2 text-xs text-slate-500 dark:text-slate-300">
            <span className="flex items-center gap-1.5">
              <span className="inline-block h-0.5 w-5 rounded" style={{ background: 'var(--chart-audit)' }} />
              Audit
            </span>
            <span className="flex items-center gap-1.5">
              <span className="inline-block h-0.5 w-5 rounded" style={{ background: 'var(--chart-inspeksi)' }} />
              Inspeksi
            </span>
            <span className="flex items-center gap-1.5">
              <span className="inline-block h-0.5 w-5 rounded" style={{ background: 'var(--chart-surveillance)' }} />
              Surveillance
            </span>
          </div>
        </div>
      </section>

      <section className="overflow-hidden rounded-2xl border border-slate-200/70 bg-white p-6 shadow-sm">
        <div className="mb-6">
          <h2 className="text-base font-semibold text-slate-800">Aktivitas CAP</h2>
          <p className="text-xs text-slate-400">Intensitas penyelesaian & progress harian.</p>
        </div>
        <CalendarHeatmap
          userId={isAdmin && selectedUser !== 'all' ? selectedUser : activeUser?.id || 'all'}
          data={filteredActivity}
        />
      </section>
    </div>
  );
}
