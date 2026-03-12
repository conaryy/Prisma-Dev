import {
  AlertTriangle,
  ClipboardCheck,
  ShieldCheck,
  Users,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { useEffect, useMemo, useState } from 'react';
import { apiFetch } from '@/lib/api';
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
        <span className="flex h-10 w-10 items-center justify-center rounded-xl border border-blue-200 bg-blue-50 text-blue-600 shadow-sm">
          <ShieldCheck className="h-5 w-5" />
        </span>
        <div>
          <h1 className="text-xl font-semibold text-slate-800">Dashboard Admin</h1>
          <p className="text-sm text-slate-500">
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
              className={`group relative overflow-hidden rounded-3xl border bg-white p-4 shadow-sm transition-shadow duration-200 hover:border-blue-200 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-200 ${
                isCriticalBlinking
                  ? 'border-red-300/80 ring-2 ring-red-200/70'
                  : 'border-slate-200/70'
              }`}
            >
              <div className="absolute -right-10 -top-10 h-20 w-20 rounded-full bg-blue-100/70 blur-2xl transition-opacity duration-200 group-hover:opacity-80" />
              {isCriticalBlinking && (
                <span className="absolute right-4 top-4 flex h-3 w-3">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-400 opacity-75" />
                  <span className="relative inline-flex h-3 w-3 rounded-full bg-red-500" />
                </span>
              )}
              <div className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
                {item.label}
              </div>
              <div
                className={`mt-2 text-3xl font-semibold ${
                  item.isUrgent ? 'text-red-700' : 'text-slate-800'
                } ${isCriticalBlinking ? 'animate-pulse' : ''}`}
              >
                {insightLoading ? '...' : item.value}
              </div>
              <div
                className={`mt-1 text-xs ${item.isUrgent ? 'text-red-600' : 'text-slate-500'}`}
              >
                {item.description}
              </div>
            </Link>
          );
        })}
      </section>

      <section className="grid gap-4 xl:grid-cols-2">
        <div className="rounded-2xl border border-slate-200/70 bg-white p-4 shadow-sm">
          <div className="mb-3 flex items-center justify-between gap-3">
            <div>
              <h3 className="text-sm font-semibold text-slate-800">Alarm Deadline CAP</h3>
              <p className="text-xs text-slate-400">
                Overdue ditandai merah, semakin dekat deadline semakin prioritas.
              </p>
            </div>
            <Link
              to="/admin/self-assessment-cap-fulfillments"
              className="text-xs font-semibold text-blue-600 hover:text-blue-700"
            >
              Buka CAP
            </Link>
          </div>

          <div className="space-y-2">
            {insightLoading ? (
              <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 text-sm text-slate-500">
                Memuat data deadline...
              </div>
            ) : deadlineRows.length === 0 ? (
              <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 text-sm text-slate-500">
                Tidak ada CAP yang mendekati deadline.
              </div>
            ) : (
              deadlineRows.map((row) => {
                const tone =
                  row.daysLeft < 0
                    ? 'border-red-200 bg-red-50 text-red-700'
                    : row.daysLeft <= 3
                    ? 'border-amber-200 bg-amber-50 text-amber-700'
                    : 'border-blue-200 bg-blue-50 text-blue-700';
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
                      <span className="rounded-full bg-white/80 px-2 py-0.5 text-[11px] font-semibold">
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

        <div className="rounded-2xl border border-slate-200/70 bg-white p-4 shadow-sm">
          <div className="mb-3 flex items-center justify-between gap-3">
            <div>
              <h3 className="text-sm font-semibold text-slate-800">Temuan Review Safety</h3>
              <p className="text-xs text-slate-400">
                User dengan review pending dan backlog terbesar.
              </p>
            </div>
            <Link
              to="/admin/self-assessment-reviews"
              className="text-xs font-semibold text-blue-600 hover:text-blue-700"
            >
              Buka Review
            </Link>
          </div>

          <div className="space-y-2">
            {insightLoading ? (
              <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 text-sm text-slate-500">
                Memuat temuan review...
              </div>
            ) : priorityRows.length === 0 ? (
              <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 text-sm text-slate-500">
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
                        ? 'border-red-200 bg-red-50'
                        : 'border-amber-200 bg-amber-50'
                    }`}
                  >
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div>
                        <div className="text-sm font-semibold text-slate-800">{row.userName}</div>
                        <div className="text-xs text-slate-500">
                          Aktivitas terakhir: {formatDateTime(row.lastActivity)}
                        </div>
                      </div>
                      <span
                        className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                          row.sla === 'Merah'
                            ? 'bg-red-100 text-red-700'
                            : row.sla === 'Kuning'
                            ? 'bg-amber-100 text-amber-700'
                            : 'bg-emerald-100 text-emerald-700'
                        }`}
                      >
                        SLA {row.sla}
                      </span>
                    </div>

                    <div className="mt-2 flex flex-wrap gap-2 text-[11px] font-semibold">
                      <span className="rounded-full bg-white/80 px-2 py-0.5 text-slate-700">
                        Stagnan {'>'}3 Hari: {row.stagnantReview}
                      </span>
                      <span className="rounded-full bg-white/80 px-2 py-0.5 text-slate-700">
                        Waiting Review: {row.waitingReview}
                      </span>
                      <span className="rounded-full bg-white/80 px-2 py-0.5 text-slate-700">
                        Belum Dibuka: {row.unopened}
                      </span>
                      <span className="rounded-full bg-white/80 px-2 py-0.5 text-slate-700">
                        Draft: {row.draft}
                      </span>
                      <span className="rounded-full bg-white/80 px-2 py-0.5 text-slate-700">
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
        <Link
          to="/admin/users"
          className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white p-4 text-sm font-semibold text-slate-700 shadow-sm transition hover:border-blue-200 hover:bg-blue-50"
        >
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
            <Users className="h-5 w-5" />
          </span>
          Kelola User
        </Link>
        <Link
          to="/admin/self-assessment-reviews"
          className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white p-4 text-sm font-semibold text-slate-700 shadow-sm transition hover:border-blue-200 hover:bg-blue-50"
        >
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
            <ClipboardCheck className="h-5 w-5" />
          </span>
          Review Unit Safety
        </Link>
        <Link
          to="/admin/self-assessment-cap-reviews"
          className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white p-4 text-sm font-semibold text-slate-700 shadow-sm transition hover:border-blue-200 hover:bg-blue-50"
        >
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
            <ClipboardCheck className="h-5 w-5" />
          </span>
          Review CAP
        </Link>
        <Link
          to="/admin/self-assessment-cap-fulfillments"
          className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white p-4 text-sm font-semibold text-slate-700 shadow-sm transition hover:border-blue-200 hover:bg-blue-50"
        >
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
            <AlertTriangle className="h-5 w-5" />
          </span>
          Hasil Pemenuhan CAP
        </Link>
      </div>
    </div>
  );
}
