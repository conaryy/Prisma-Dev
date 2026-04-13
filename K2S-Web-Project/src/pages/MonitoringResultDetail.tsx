import { useEffect, useMemo, useState } from 'react';
import { Check, ChevronLeft, Circle, SendHorizontal } from 'lucide-react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { toast } from '@/hooks/use-toast';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { resolveApiUrl } from '@/lib/api';
import { downloadFromSignedUrl } from '@/lib/download';
import {
  QUESTION_SECTION_LABELS,
  formatMonitoringDateTime as formatDateTime,
  isNotSatisfactoryStatus,
  resolveQuestionRowClass,
  resolveQuestionSection,
  resolveTime,
  toDisplayValue as toDisplay,
  toReviewedBadgeLabel,
} from '@/lib/monitoringReview';
import { fetchSelfAssessmentCap } from '@/lib/selfAssessment';

type MonitoringDetailItem = {
  answerId: string;
  questionCode: string;
  questionText: string;
  reference: string | null;
  review: {
    status: string;
    finding?: string | null;
    description?: string | null;
    reviewedBy?: { id: string; name: string; email?: string } | null;
    reviewedAt?: string | null;
  } | null;
  cap: {
    id: string;
    actionPlan: string;
    targetDate: string | null;
    monitoringReview?: {
      result: string | null;
      comment: string | null;
      status: string | null;
      reviewedBy?: { id: string; name: string; email?: string } | null;
      reviewedAt?: string | null;
    } | null;
    fulfillments: Array<{
      id: string;
      proposeAction: string;
      actionOffice: string;
      evidenceReference: string | null;
      completeDate: string | null;
      progress: number;
      submittedAt: string | null;
      createdAt?: string | null;
      files: Array<{ id: string; name: string; url: string }>;
    }>;
    extensions?: Array<{
      id: string;
      dueDate: string;
      fileName: string;
      fileUrl: string;
    }>;
  } | null;
};

const getPublishedMonitoringReview = (item?: MonitoringDetailItem | null) => {
  const review = item?.cap?.monitoringReview ?? null;
  if (!review?.reviewedAt) return null;
  return review;
};

export function MonitoringResultDetail() {
  const navigate = useNavigate();
  const { sessionAreaId } = useParams();
  const [searchParams] = useSearchParams();

  const [items, setItems] = useState<MonitoringDetailItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [activeAnswerId, setActiveAnswerId] = useState<string | null>(null);
  const [detailSearchText, setDetailSearchText] = useState('');

  useEffect(() => {
    if (!sessionAreaId) return;
    setIsLoading(true);
    fetchSelfAssessmentCap({
      scope: ((searchParams.get('scope') ?? 'monitoring') as 'audit' | 'monitoring' | 'inspeksi' | 'surveillance'),
      sessionAreaId,
      includeReviewed: true,
    })
      .then((data) => {
        const normalized = (data as MonitoringDetailItem[]).filter((item) => item.cap);
        setItems(normalized);
        setActiveAnswerId(normalized[0]?.answerId ?? null);
      })
      .finally(() => setIsLoading(false));
  }, [searchParams, sessionAreaId]);

  const filteredItems = useMemo(() => {
    const term = detailSearchText.trim().toLowerCase();
    if (!term) return items;
    return items.filter((item) =>
      `${item.questionCode ?? ''} ${item.questionText}`.toLowerCase().includes(term)
    );
  }, [detailSearchText, items]);

  const groupedItems = useMemo(() => {
    const grouped = new Map<string, MonitoringDetailItem[]>();
    filteredItems.forEach((item) => {
      const section = resolveQuestionSection(item.questionCode);
      const current = grouped.get(section) ?? [];
      current.push(item);
      grouped.set(section, current);
    });
    return Array.from(grouped.entries());
  }, [filteredItems]);

  const isClosedItem = (item: MonitoringDetailItem) => {
    const publishedReview = getPublishedMonitoringReview(item);
    const status = publishedReview?.status ?? publishedReview?.result;
    return Boolean(publishedReview) && !isNotSatisfactoryStatus(status);
  };

  const detailSummary = useMemo(() => {
    const total = filteredItems.length;
    const closed = filteredItems.reduce((count, item) => (isClosedItem(item) ? count + 1 : count), 0);
    return { total, closed, open: Math.max(0, total - closed) };
  }, [filteredItems]);

  const activeItem = useMemo(
    () => items.find((item) => item.answerId === activeAnswerId) ?? null,
    [items, activeAnswerId]
  );

  const latestFulfillment = useMemo(() => {
    const fulfillments = activeItem?.cap?.fulfillments ?? [];
    if (fulfillments.length === 0) return null;
    return [...fulfillments].sort((a, b) => {
      const timeA = Math.max(resolveTime(a.submittedAt), resolveTime(a.createdAt));
      const timeB = Math.max(resolveTime(b.submittedAt), resolveTime(b.createdAt));
      return timeB - timeA;
    })[0];
  }, [activeItem]);

  const latestExtension = useMemo(() => {
    const extensions = activeItem?.cap?.extensions ?? [];
    if (extensions.length === 0) return null;
    return [...extensions].sort((a, b) => resolveTime(b.dueDate) - resolveTime(a.dueDate))[0];
  }, [activeItem]);

  const fileEvidence = useMemo(() => {
    if (!activeItem?.cap) return [] as Array<{ id: string; name: string; url: string }>;
    if (latestFulfillment?.files?.length) return latestFulfillment.files;
    return activeItem.cap.fulfillments.flatMap((fulfillment) => fulfillment.files);
  }, [activeItem, latestFulfillment]);

  const activeProgress = Math.max(0, Math.min(100, latestFulfillment?.progress ?? 0));
  const activeMonitoringReview = getPublishedMonitoringReview(activeItem);
  const activeStatus =
    activeMonitoringReview?.status ?? activeMonitoringReview?.result ?? 'Not Satisfactory';
  const activeReviewed = Boolean(activeMonitoringReview?.reviewedAt);
  const infoText = activeReviewed
    ? `CAP sudah memiliki pemenuhan sebesar ${activeProgress}% dan sudah direview dengan status ${activeStatus}.`
    : `CAP sudah memiliki pemenuhan sebesar ${activeProgress}%.`;

  const areaLabel = searchParams.get('area') ?? '-';
  const scheduleLabel = searchParams.get('schedule') || '-';

  return (
    <div className="space-y-6">
      <section className="overflow-hidden rounded-[28px] border border-slate-200/80 bg-white shadow-[0_24px_60px_rgba(15,23,42,0.08)]">
        <header className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-100 px-6 py-5">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
              Monitoring / Hasil Monitoring
            </p>
            <h1 className="text-lg font-semibold text-slate-800">Detail Hasil Monitoring</h1>
            <p className="mt-1 text-sm text-slate-500">
              {areaLabel} • {scheduleLabel}
            </p>
          </div>
          <Button variant="outline" className="gap-2" onClick={() => navigate('/monitoring')}>
            <ChevronLeft className="h-4 w-4" />
            Kembali
          </Button>
        </header>

        <div className="grid gap-5 px-6 py-6 lg:grid-cols-[1fr_2fr]">
          <div className="space-y-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <h2 className="text-sm font-semibold text-slate-700">LIST PROTOCOL QUESTION</h2>
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-500">Search:</span>
              <Input
                value={detailSearchText}
                onChange={(event) => setDetailSearchText(event.target.value)}
                placeholder="Search..."
                className="h-8 max-w-xs text-xs"
              />
            </div>
            <div className="flex flex-wrap items-center gap-2 text-xs font-semibold text-slate-600">
              <span className="rounded-full bg-red-100 px-3 py-1 text-[#991b1b]">
                Not Satisfactory {detailSummary.open} / {detailSummary.total}
              </span>
              <span className="rounded-full border border-slate-200 bg-white px-3 py-1 text-slate-600">
                Satisfactory {detailSummary.closed} / {detailSummary.total}
              </span>
            </div>

            <div className="overflow-hidden rounded-xl border border-slate-200">
              <div className="border-b border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-700">
                {areaLabel}
              </div>
              {isLoading ? (
                <div className="px-3 py-4 text-sm text-slate-500">Memuat data...</div>
              ) : groupedItems.length === 0 ? (
                <div className="px-3 py-4 text-sm text-slate-500">Belum ada data protocol question.</div>
              ) : (
                groupedItems.map(([section, sectionItems], index) => (
                  <div
                    key={section}
                    className={index < groupedItems.length - 1 ? 'border-b border-slate-200' : ''}
                  >
                    <div className="border-b border-slate-200 bg-slate-100 px-3 py-2 text-xs font-semibold text-slate-700">
                      {section} - {QUESTION_SECTION_LABELS[section] ?? 'LAINNYA'}
                    </div>
                    <div className="divide-y divide-slate-200">
                      {sectionItems.map((item) => {
                        const isClosed = isClosedItem(item);
                        const isActive = activeAnswerId === item.answerId;
                        return (
                          <button
                            key={item.answerId}
                            type="button"
                            onClick={() => setActiveAnswerId(item.answerId)}
                            className={`flex w-full items-start gap-3 px-3 py-3 text-left text-sm transition-colors ${resolveQuestionRowClass(
                              isClosed,
                              isActive
                            )}`}
                          >
                            <span className="mt-1 inline-flex h-4 w-4 items-center justify-center">
                              {isClosed ? (
                                <Check className="h-3 w-3 text-slate-500 dark:text-slate-200" />
                              ) : (
                                <Circle className="h-3.5 w-3.5 text-red-500" />
                              )}
                            </span>
                            <div className="flex-1">
                              <span className="font-semibold">{item.questionCode ?? '-'}</span> -{' '}
                              {item.questionText || '-'}
                              {isClosed && (
                                <div className="mt-1 text-[11px] font-medium text-slate-500 dark:text-slate-300">
                                  {toReviewedBadgeLabel(getPublishedMonitoringReview(item)?.reviewedAt)}
                                </div>
                              )}
                            </div>
                            <SendHorizontal className="mt-1 h-4 w-4 shrink-0 text-slate-400 dark:text-slate-300" />
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-2 text-xs font-semibold text-slate-600">
              <span className="text-slate-500">{infoText}</span>
              <span className="text-slate-500">Ket :</span>
              <span
                className={`rounded-md px-2 py-1 ${
                  activeReviewed && !isNotSatisfactoryStatus(activeStatus)
                    ? 'bg-emerald-100 text-emerald-800'
                    : 'bg-red-100 text-[#991b1b]'
                }`}
              >
                {activeReviewed && !isNotSatisfactoryStatus(activeStatus)
                  ? 'Satisfactory'
                  : 'Not Satisfactory'}
              </span>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="mb-3 text-sm font-semibold text-slate-700">&gt;Temuan Kegiatan Sebelumnya</div>
              <div className="grid gap-3 md:grid-cols-2">
                <div className="space-y-1">
                  <label className="text-xs font-medium text-slate-600">Temuan</label>
                  <Textarea rows={4} readOnly value={toDisplay(activeItem?.review?.finding)} />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium text-slate-600">Current Mitigation</label>
                  <Textarea
                    rows={4}
                    readOnly
                    value={toDisplay(latestFulfillment?.proposeAction ?? activeItem?.cap?.actionPlan)}
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium text-slate-600">Remark</label>
                  <Textarea
                    rows={3}
                    readOnly
                    value={toDisplay(latestFulfillment?.actionOffice ?? activeItem?.cap?.monitoringReview?.comment)}
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium text-slate-600">Due Date</label>
                  <Input readOnly value={toDisplay(latestFulfillment?.completeDate ?? activeItem?.cap?.targetDate)} />
                </div>
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="mb-3 text-sm font-semibold text-slate-700">Self Assessment</div>
              <div className="grid gap-3 md:grid-cols-[2fr_1fr]">
                <div className="space-y-3">
                  <div className="grid gap-3 md:grid-cols-2">
                    <div className="space-y-1">
                      <label className="text-xs font-medium text-slate-600">Protocol Question</label>
                      <Textarea
                        rows={4}
                        readOnly
                        value={activeItem ? `${activeItem.questionCode ?? '-'} - ${activeItem.questionText}` : '-'}
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs font-medium text-slate-600">Comment</label>
                      <Textarea rows={4} readOnly value={toDisplay(activeItem?.review?.description)} />
                    </div>
                  </div>
                  <div className="grid gap-3 md:grid-cols-2">
                    <div className="space-y-1">
                      <label className="text-xs font-medium text-slate-600">Referensi Regulasi</label>
                      <Textarea rows={3} readOnly value={toDisplay(activeItem?.reference)} />
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs font-medium text-slate-600">Evidence Reference</label>
                      <Textarea rows={3} readOnly value={toDisplay(latestFulfillment?.evidenceReference)} />
                    </div>
                  </div>
                </div>
                <div className="space-y-2">
                  <div className="space-y-1">
                    <label className="text-xs font-medium text-slate-600">Review By</label>
                    <Input readOnly value={toDisplay(activeMonitoringReview?.reviewedBy?.name)} />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-medium text-slate-600">Review At</label>
                    <Input readOnly value={formatDateTime(activeMonitoringReview?.reviewedAt)} />
                  </div>
                </div>
              </div>
            </div>

            {activeMonitoringReview ? (
              <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                <div className="mb-3 text-sm font-semibold text-slate-700">Review Unit Safety</div>
                <div className="grid gap-3 md:grid-cols-3">
                  <div className="space-y-1 md:col-span-1">
                    <label className="text-xs font-medium text-slate-600">
                      Status Of Implementation
                    </label>
                    <Input
                      readOnly
                      className={
                        isNotSatisfactoryStatus(activeMonitoringReview.status ?? activeMonitoringReview.result)
                          ? 'border-red-200 bg-red-50 text-red-600 font-semibold'
                          : 'border-emerald-200 bg-emerald-50 text-emerald-700 font-semibold'
                      }
                      value={toDisplay(activeMonitoringReview.status ?? activeMonitoringReview.result)}
                    />
                  </div>
                  <div className="space-y-1 md:col-span-1">
                    <label className="text-xs font-medium text-slate-600">Remark</label>
                    <Textarea rows={3} readOnly value={toDisplay(activeMonitoringReview.comment)} />
                  </div>
                  <div className="space-y-2 md:col-span-1">
                    <div className="space-y-1">
                      <label className="text-xs font-medium text-slate-600">Review By</label>
                      <Input readOnly value={toDisplay(activeMonitoringReview.reviewedBy?.name)} />
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs font-medium text-slate-600">Review At</label>
                      <Input readOnly value={formatDateTime(activeMonitoringReview.reviewedAt)} />
                    </div>
                  </div>
                </div>
              </div>
            ) : null}

            <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="mb-3 text-sm font-semibold text-slate-700">File evidence</div>
              <div className="overflow-hidden rounded-lg border border-slate-200">
                <Table>
                  <TableHeader className="bg-slate-50">
                    <TableRow>
                      <TableHead className="w-16 text-center text-xs">NO</TableHead>
                      <TableHead className="text-xs">FILENAME</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {fileEvidence.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={2} className="text-center text-xs text-slate-500">
                          Tidak ada file evidence.
                        </TableCell>
                      </TableRow>
                    ) : (
                      fileEvidence.map((file, index) => (
                        <TableRow key={file.id}>
                          <TableCell className="text-center text-xs">{index + 1}</TableCell>
                          <TableCell className="text-xs text-blue-600">
                            <a
                              href={resolveApiUrl(file.url)}
                              className="hover:underline"
                              onClick={(event) => {
                                event.preventDefault();
                                void downloadFromSignedUrl(file.url, file.name).catch((error) => {
                                  toast({
                                    title: 'Gagal mengunduh file.',
                                    description:
                                      error instanceof Error ? error.message : undefined,
                                    variant: 'destructive',
                                  });
                                });
                              }}
                            >
                              {file.name}
                            </a>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="mb-3 text-sm font-semibold text-slate-700">Perpanjangan CAP</div>
              <div className="grid gap-3 md:grid-cols-2">
                <div className="space-y-1">
                  <label className="text-xs font-medium text-slate-600">Due Date</label>
                  <Input readOnly value={toDisplay(latestExtension?.dueDate)} />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium text-slate-600">File</label>
                  {latestExtension?.fileUrl ? (
                    <a
                      href={resolveApiUrl(latestExtension.fileUrl)}
                      target="_blank"
                      rel="noreferrer"
                      className="block truncate text-sm text-blue-600 underline"
                    >
                      {latestExtension.fileName}
                    </a>
                  ) : (
                    <Input readOnly value="-" />
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
