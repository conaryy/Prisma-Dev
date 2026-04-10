import {
  AlertTriangle,
  ClipboardCheck,
  ShieldCheck,
  Users,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { useEffect, useMemo, useState } from 'react';
import { apiFetch } from '@/lib/api';
import { getAuthPortalUrl } from '@/lib/authPortal';
import { toast } from '@/hooks/use-toast';

type AdminPriorityRow = {
  userId: string;
  userName: string;
  unopened: number;
  draft: number;
  stagnantReview: number;
  waitingReview: number;
  capOpen: number;
  capOverdue: number;
  monitoringActive: number;
  lastActivity: string | null;
  sla: 'Hijau' | 'Kuning' | 'Merah';
};

type AdminDeadlineRow = {
  capId: string;
  userId: string;
  userName: string;
  scope: string;
  area: string;
  targetDate: string;
  daysLeft: number;
  progress: number;
  status: string;
};

type AdminInsightPayload = {
  meta: {
    from: string;
    to: string;
    generatedAt: string;
  };
  priorities: AdminPriorityRow[];
  deadline7Days: AdminDeadlineRow[];
};

const formatDate = (value: string | null) => {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString('id-ID', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
};

const formatDateTime = (value: string | null) => {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString('id-ID', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
};

const DEADLINE_TONE_CLASSES = {
  overdue:
    'border-red-200 bg-red-50 text-red-700 dark:border-red-900/70 dark:bg-red-950/45 dark:text-red-200',
  warning:
    'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900/70 dark:bg-amber-950/45 dark:text-amber-200',
  safe:
    'border-blue-200 bg-blue-50 text-blue-700 dark:border-sky-900/70 dark:bg-sky-950/45 dark:text-sky-200',
} as const;

const PRIORITY_TONE_CLASSES = {
  critical:
    'border-red-200 bg-red-50 dark:border-red-900/70 dark:bg-red-950/32',
  warning:
    'border-amber-200 bg-amber-50 dark:border-amber-900/70 dark:bg-amber-950/32',
} as const;

const SLA_BADGE_CLASSES = {
  Merah:
    'border border-red-200/80 bg-red-100 text-red-700 dark:border-red-900/80 dark:bg-red-950/80 dark:text-red-200',
  Kuning:
    'border border-amber-200/80 bg-amber-100 text-amber-700 dark:border-amber-900/80 dark:bg-amber-950/80 dark:text-amber-200',
  Hijau:
    'border border-emerald-200/80 bg-emerald-100 text-emerald-700 dark:border-emerald-900/80 dark:bg-emerald-950/80 dark:text-emerald-200',
} as const;

const METRIC_CHIP_CLASS =
  'rounded-full border border-slate-200/80 bg-white/85 px-2 py-0.5 text-slate-700 dark:border-slate-700/80 dark:bg-slate-900/75 dark:text-slate-200';

export function AdminDashboard() {
  const [insightLoading, setInsightLoading] = useState(true);
  const [insightData, setInsightData] = useState<AdminInsightPayload>({
    meta: { from: '', to: '', generatedAt: '' },
    priorities: [],
    deadline7Days: [],
  });

  useEffect(() => {
    setInsightLoading(true);
    apiFetch<{ data: AdminInsightPayload }>('/api/dashboard/admin-insight-tables')
      .then((response) => {
        setInsightData(response.data);
      })
      .catch((error: Error) => {
        toast({
          title: 'Gagal memuat panel prioritas',
          description: error.message || 'Terjadi kesalahan.',
        });
      })
      .finally(() => setInsightLoading(false));
  }, []);

  const kpi = useMemo(() => {
    const waitingReview = insightData.priorities.reduce(
      (total, row) => total + row.waitingReview,
      0
    );
    const stagnantReview = insightData.priorities.reduce(
      (total, row) => total + row.stagnantReview,
      0
    );
    const criticalDeadlines = insightData.deadline7Days.filter(
      (item) => item.daysLeft >= 0 && item.daysLeft <= 3
    ).length;
    const overdueDeadlines = insightData.deadline7Days.filter(
      (item) => item.daysLeft < 0
    ).length;

    return {
      waitingReview,
      stagnantReview,
      criticalDeadlines,
      overdueDeadlines,
    };
  }, [insightData]);

  const priorityRows = useMemo(() => {
    return [...insightData.priorities]
      .sort((a, b) => {
        const scoreA =
          a.capOverdue * 5
          + a.stagnantReview * 4
          + a.waitingReview * 3
          + a.unopened * 2
          + a.draft;
        const scoreB =
          b.capOverdue * 5
          + b.stagnantReview * 4
          + b.waitingReview * 3
          + b.unopened * 2
          + b.draft;
        return scoreB - scoreA;
      })
      .slice(0, 8);
  }, [insightData.priorities]);

  const deadlineRows = useMemo(
    () => insightData.deadline7Days.slice(0, 10),
    [insightData.deadline7Days]
  );

  const overviewCards = useMemo(
    () => [
      {
        key: 'review-pending',
        label: 'Review Safety Pending',
        value: kpi.waitingReview,
        href: '/admin/self-assessment-reviews',
        description: 'Temuan review yang belum dikirim final.',
        isUrgent: kpi.waitingReview > 0,
      },
      {
        key: 'cap-overdue',
        label: 'CAP Overdue',
        value: kpi.overdueDeadlines,
        href: '/admin/self-assessment-cap-fulfillments',
        description: 'CAP yang sudah melewati deadline.',
        isUrgent: kpi.overdueDeadlines > 0,
      },
      {
        key: 'deadline-kritis',
        label: 'Deadline Kritis',
        value: kpi.criticalDeadlines,
        href: '/admin/self-assessment-cap-reviews',
        description: 'CAP jatuh tempo 0-3 hari.',
        isUrgent: kpi.criticalDeadlines > 0,
      },
      {
        key: 'review-stagnan',
        label: 'Review Stagnan (>3 Hari)',
        value: kpi.stagnantReview,
        href: '/admin/self-assessment-reviews',
        description: 'Temuan tanpa aktivitas lanjutan >3 hari.',
        isUrgent: kpi.stagnantReview > 0,
      },
    ],
    [kpi]
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <span className="flex h-10 w-10 items-center justify-center rounded-xl border border-blue-200 bg-blue-50 text-blue-600 shadow-sm dark:border-[#355791]/70 dark:bg-[#122b66] dark:text-blue-200 dark:shadow-none">
          <ShieldCheck className="h-5 w-5" />
        </span>
        <div>
          <h1 className="text-xl font-semibold text-slate-800 dark:text-slate-100">Dashboard Admin</h1>
          <p className="text-sm text-slate-500 dark:text-slate-300">
            Pusat kendali review safety dan jadwal deadline CAP.
          </p>
        </div>
      </div>

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {overviewCards.map((item) => {
          const isCriticalBlinking =
            item.key === 'deadline-kritis' && !insightLoading && item.value > 0;

          return (
            <Link
              key={item.key}
              to={item.href}
              className={`group relative overflow-hidden rounded-3xl border bg-white p-4 shadow-sm transition-shadow duration-200 hover:border-blue-200 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-200 dark:border-[#355791]/70 dark:bg-[#0b1736] dark:hover:border-[#6f97ea] dark:hover:shadow-[0_16px_36px_rgba(2,8,28,0.5)] dark:focus-visible:ring-[#2d4f98]/60 ${
                isCriticalBlinking
                  ? 'border-red-300/80 ring-2 ring-red-200/70 dark:border-red-500/60 dark:ring-red-500/20'
                  : 'border-slate-200/70'
              }`}
            >
              <div className="absolute -right-10 -top-10 h-20 w-20 rounded-full bg-blue-100/70 blur-2xl transition-opacity duration-200 group-hover:opacity-80 dark:bg-blue-500/10" />
              {isCriticalBlinking && (
                <span className="absolute right-4 top-4 flex h-3 w-3">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-400 opacity-75" />
                  <span className="relative inline-flex h-3 w-3 rounded-full bg-red-500" />
                </span>
              )}
              <div className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400 dark:text-blue-200/70">
                {item.label}
              </div>
              <div
                className={`mt-2 text-3xl font-semibold ${
                  item.isUrgent ? 'text-red-700 dark:text-red-200' : 'text-slate-800 dark:text-slate-100'
                } ${isCriticalBlinking ? 'animate-pulse' : ''}`}
              >
                {insightLoading ? '...' : item.value}
              </div>
              <div
                className={`mt-1 text-xs ${item.isUrgent ? 'text-red-600 dark:text-red-200/90' : 'text-slate-500 dark:text-slate-300'}`}
              >
                {item.description}
              </div>
            </Link>
          );
        })}
      </section>

      <section className="grid gap-4 xl:grid-cols-2">
        <div className="rounded-2xl border border-slate-200/70 bg-white p-4 shadow-sm dark:border-[#355791]/70 dark:bg-[#0b1736] dark:shadow-[0_16px_40px_rgba(2,8,28,0.45)]">
          <div className="mb-3 flex items-center justify-between gap-3">
            <div>
              <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-100">Alarm Deadline CAP</h3>
              <p className="text-xs text-slate-400 dark:text-blue-200/70">
                Overdue ditandai merah, semakin dekat deadline semakin prioritas.
              </p>
            </div>
            <Link
              to="/admin/self-assessment-cap-fulfillments"
              className="text-xs font-semibold text-blue-600 hover:text-blue-700 dark:text-blue-200 dark:hover:text-blue-100"
            >
              Buka CAP
            </Link>
          </div>

          <div className="space-y-2">
            {insightLoading ? (
              <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 text-sm text-slate-500 dark:border-slate-700/80 dark:bg-slate-900/55 dark:text-slate-300">
                Memuat data deadline...
              </div>
            ) : deadlineRows.length === 0 ? (
              <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 text-sm text-slate-500 dark:border-slate-700/80 dark:bg-slate-900/55 dark:text-slate-300">
                Tidak ada CAP yang mendekati deadline.
              </div>
            ) : (
              deadlineRows.map((row) => {
                const tone =
                  row.daysLeft < 0
                    ? DEADLINE_TONE_CLASSES.overdue
                    : row.daysLeft <= 3
                    ? DEADLINE_TONE_CLASSES.warning
                    : DEADLINE_TONE_CLASSES.safe;
                return (
                  <div
                    key={row.capId}
                    className={`rounded-xl border px-3 py-3 ${tone}`}
                  >
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div>
                        <div className="text-sm font-semibold">{row.userName}</div>
                        <div className="text-xs opacity-90">
                          {row.scope} • {row.area}
                        </div>
                      </div>
                      <span className={`${METRIC_CHIP_CLASS} text-[11px] font-semibold`}>
                        {row.status}
                      </span>
                    </div>
                    <div className="mt-2 flex flex-wrap gap-3 text-xs">
                      <span>Target: {formatDate(row.targetDate)}</span>
                      <span>Sisa: {row.daysLeft} hari</span>
                      <span>Progress: {row.progress}%</span>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200/70 bg-white p-4 shadow-sm dark:border-[#355791]/70 dark:bg-[#0b1736] dark:shadow-[0_16px_40px_rgba(2,8,28,0.45)]">
          <div className="mb-3 flex items-center justify-between gap-3">
            <div>
              <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-100">Temuan Review Safety</h3>
              <p className="text-xs text-slate-400 dark:text-blue-200/70">
                User dengan review pending dan backlog terbesar.
              </p>
            </div>
            <Link
              to="/admin/self-assessment-reviews"
              className="text-xs font-semibold text-blue-600 hover:text-blue-700 dark:text-blue-200 dark:hover:text-blue-100"
            >
              Buka Review
            </Link>
          </div>

          <div className="space-y-2">
            {insightLoading ? (
              <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 text-sm text-slate-500 dark:border-slate-700/80 dark:bg-slate-900/55 dark:text-slate-300">
                Memuat temuan review...
              </div>
            ) : priorityRows.length === 0 ? (
              <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 text-sm text-slate-500 dark:border-slate-700/80 dark:bg-slate-900/55 dark:text-slate-300">
                Tidak ada backlog review safety.
              </div>
            ) : (
              priorityRows.map((row) => {
                const isCritical = row.capOverdue > 0 || row.stagnantReview >= 5 || row.waitingReview >= 5;
                return (
                  <div
                    key={row.userId}
                    className={`rounded-xl border px-3 py-3 ${
                      isCritical
                        ? PRIORITY_TONE_CLASSES.critical
                        : PRIORITY_TONE_CLASSES.warning
                    }`}
                  >
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div>
                        <div className="text-sm font-semibold text-slate-800 dark:text-slate-100">{row.userName}</div>
                        <div className="text-xs text-slate-500 dark:text-slate-300">
                          Aktivitas terakhir: {formatDateTime(row.lastActivity)}
                        </div>
                      </div>
                      <span
                        className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                          SLA_BADGE_CLASSES[row.sla]
                        }`}
                      >
                        SLA {row.sla}
                      </span>
                    </div>

                    <div className="mt-2 flex flex-wrap gap-2 text-[11px] font-semibold">
                      <span className={METRIC_CHIP_CLASS}>
                        Stagnan {'>'}3 Hari: {row.stagnantReview}
                      </span>
                      <span className={METRIC_CHIP_CLASS}>
                        Waiting Review: {row.waitingReview}
                      </span>
                      <span className={METRIC_CHIP_CLASS}>
                        Belum Dibuka: {row.unopened}
                      </span>
                      <span className={METRIC_CHIP_CLASS}>
                        Draft: {row.draft}
                      </span>
                      <span className={METRIC_CHIP_CLASS}>
                        CAP Overdue: {row.capOverdue}
                      </span>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </section>

      <div className="grid gap-4 sm:grid-cols-2">
        <a
          href={getAuthPortalUrl('/portal-admin/users', { includeToken: true })}
          className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white p-4 text-sm font-semibold text-slate-700 shadow-sm transition hover:border-blue-200 hover:bg-blue-50 dark:border-[#355791]/70 dark:bg-[#0b1736] dark:text-slate-100 dark:hover:border-[#6f97ea] dark:hover:bg-[#102754]"
        >
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 text-blue-600 dark:bg-[#122b66] dark:text-blue-200">
            <Users className="h-5 w-5" />
          </span>
          Kelola User
        </a>
        <Link
          to="/admin/self-assessment-reviews"
          className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white p-4 text-sm font-semibold text-slate-700 shadow-sm transition hover:border-blue-200 hover:bg-blue-50 dark:border-[#355791]/70 dark:bg-[#0b1736] dark:text-slate-100 dark:hover:border-[#6f97ea] dark:hover:bg-[#102754]"
        >
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 text-blue-600 dark:bg-[#122b66] dark:text-blue-200">
            <ClipboardCheck className="h-5 w-5" />
          </span>
          Review Unit Safety
        </Link>
        <Link
          to="/admin/self-assessment-cap-reviews"
          className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white p-4 text-sm font-semibold text-slate-700 shadow-sm transition hover:border-blue-200 hover:bg-blue-50 dark:border-[#355791]/70 dark:bg-[#0b1736] dark:text-slate-100 dark:hover:border-[#6f97ea] dark:hover:bg-[#102754]"
        >
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 text-blue-600 dark:bg-[#122b66] dark:text-blue-200">
            <ClipboardCheck className="h-5 w-5" />
          </span>
          Review CAP
        </Link>
        <Link
          to="/admin/self-assessment-cap-fulfillments"
          className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white p-4 text-sm font-semibold text-slate-700 shadow-sm transition hover:border-blue-200 hover:bg-blue-50 dark:border-[#355791]/70 dark:bg-[#0b1736] dark:text-slate-100 dark:hover:border-[#6f97ea] dark:hover:bg-[#102754]"
        >
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 text-blue-600 dark:bg-[#122b66] dark:text-blue-200">
            <AlertTriangle className="h-5 w-5" />
          </span>
          Hasil Pemenuhan CAP
        </Link>
      </div>
    </div>
  );
}
