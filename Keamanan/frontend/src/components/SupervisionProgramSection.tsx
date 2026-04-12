import { Fragment, useEffect, useRef, useState, type ChangeEvent, type FormEvent } from 'react';
import type { TestItem } from '@/types/dashboard';

type HeatmapCategory = 'Audit' | 'Inspeksi' | 'Pengunjungan';
type HeatmapLevel = 0 | 1 | 2 | 3 | 4;
type BranchLabel = (typeof BRANCH_FILTERS)[number];
type HeatmapFilter = 'Semua' | HeatmapCategory | BranchLabel;
type HeatmapCellEntry = {
  item: TestItem;
  executionDateIso: string | null;
};
type HeatmapCell = {
  level: HeatmapLevel;
  entries: HeatmapCellEntry[];
};
type HeatmapRow = {
  id: string;
  label: string;
  category?: HeatmapCategory;
  cells: HeatmapCell[];
  isGroup?: boolean;
  isBranch?: boolean;
  isSpacer?: boolean;
};
type HeatmapSelection = {
  rowId: string;
  cellIndex: number;
  category: HeatmapCategory;
  branch: BranchLabel;
  level: HeatmapLevel;
  entries: HeatmapCellEntry[];
};
type StatusTag = 'Sudah' | 'Terjadwal';

const BRANCH_FILTERS = [
  'Cabang Surabaya',
  'KCP Banyuwangi',
  'KCP Malang',
  'KCP Sumenep',
  'Penyedia Personel AVSEC',
] as const;

const CATEGORY_FILTERS: HeatmapCategory[] = ['Audit', 'Inspeksi', 'Pengunjungan'];
const CATEGORY_BRANCHES: Record<HeatmapCategory, BranchLabel[]> = {
  Audit: ['Cabang Surabaya', 'KCP Banyuwangi', 'KCP Malang', 'KCP Sumenep'],
  Inspeksi: ['Cabang Surabaya', 'KCP Banyuwangi', 'KCP Malang', 'KCP Sumenep', 'Penyedia Personel AVSEC'],
  Pengunjungan: ['Cabang Surabaya', 'KCP Banyuwangi', 'KCP Sumenep'],
};
const MONTH_LABELS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const TIMELINE_SLOTS_PER_MONTH = 4;
const TIMELINE_TOTAL_COLUMNS = MONTH_LABELS.length * TIMELINE_SLOTS_PER_MONTH;

function matchesQuery(query: string, fields: Array<string | undefined>) {
  if (!query) {
    return true;
  }

  return fields.some((field) => (field ?? '').toLowerCase().includes(query));
}

function getStatusBadgeClasses(status: TestItem['status']) {
  if (status === 'Terlaksana') {
    return 'bg-emerald-50 text-emerald-700 ring-1 ring-inset ring-emerald-200';
  }

  if (status === 'Terjadwal') {
    return 'bg-slate-100 text-slate-600 ring-1 ring-inset ring-slate-200';
  }

  return 'bg-amber-50 text-amber-700 ring-1 ring-inset ring-amber-200';
}

function getSummaryStatusStyles(status: StatusTag) {
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

function getCategoryBadgeClasses(category: HeatmapCategory) {
  if (category === 'Audit') {
    return 'summary-category is-audit';
  }

  if (category === 'Inspeksi') {
    return 'summary-category is-inspeksi';
  }

  return 'summary-category is-pengunjungan';
}

function getCardAccent(category: HeatmapCategory) {
  if (category === 'Audit') {
    return 'from-emerald-500 via-emerald-400 to-teal-400';
  }

  if (category === 'Inspeksi') {
    return 'from-slate-500 via-slate-400 to-slate-300';
  }

  return 'from-sky-500 via-blue-500 to-cyan-400';
}

function getHeatmapTone(level: HeatmapLevel) {
  if (level >= 4) {
    return 'bg-blue-600';
  }

  if (level > 0) {
    return 'bg-blue-300';
  }

  return 'bg-slate-100';
}

function normalizeBranch(value: string | null) {
  const normalizedValue = (value ?? '').trim().toLowerCase();

  if (normalizedValue.includes('avsec')) {
    return 'Penyedia Personel AVSEC' as BranchLabel;
  }

  if (normalizedValue.includes('banyuwangi')) {
    return 'KCP Banyuwangi' as BranchLabel;
  }

  if (normalizedValue.includes('malang')) {
    return 'KCP Malang' as BranchLabel;
  }

  if (normalizedValue.includes('sumenep')) {
    return 'KCP Sumenep' as BranchLabel;
  }

  return 'Cabang Surabaya' as BranchLabel;
}

function buildCells(
  markers: Array<{
    monthIndex: number;
    slotIndex: number;
    level: HeatmapLevel;
    item?: TestItem;
    executionDateIso?: string | null;
  }>
) {
  const cells = Array.from({ length: TIMELINE_TOTAL_COLUMNS }, () => ({
    level: 0 as HeatmapLevel,
    entries: [] as HeatmapCellEntry[],
  }));

  markers.forEach(({ monthIndex, slotIndex, level, item, executionDateIso }) => {
    const normalizedMonthIndex = Math.max(0, Math.min(MONTH_LABELS.length - 1, monthIndex));
    const normalizedSlotIndex = Math.max(0, Math.min(TIMELINE_SLOTS_PER_MONTH - 1, slotIndex));
    const targetIndex = normalizedMonthIndex * TIMELINE_SLOTS_PER_MONTH + normalizedSlotIndex;
    const currentCell = cells[targetIndex];
    currentCell.level = Math.max(currentCell.level, level) as HeatmapLevel;

    if (item) {
      const alreadyTracked = currentCell.entries.some(
        (entry) => entry.item.id === item.id && entry.executionDateIso === (executionDateIso ?? null)
      );

      if (!alreadyTracked) {
        currentCell.entries.push({
          item,
          executionDateIso: executionDateIso ?? null,
        });
      }
    }
  });

  return cells;
}

function StatusBadge({ status }: { status: TestItem['status'] }) {
  return <span className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${getStatusBadgeClasses(status)}`}>{status}</span>;
}

function getPendingFileKey(file: File) {
  return `${file.name}-${file.size}-${file.lastModified}`;
}

export function SupervisionProgramSection({
  tests,
  searchQuery,
  onUpdateActivity,
  onUploadEvidence,
}: {
  tests: TestItem[];
  searchQuery: string;
  onUpdateActivity: (input: {
    activityId: string;
    status: 'Terlaksana' | 'Perlu Tindak Lanjut';
    completedAt?: string | null;
    completionNote?: string | null;
    inspectorNames?: string[] | null;
  }) => Promise<void>;
  onUploadEvidence: (activityId: string, files: File[]) => Promise<void>;
}) {
  const getTodayInputValue = () => {
    const now = new Date();
    const localValue = new Date(now.getTime() - now.getTimezoneOffset() * 60_000);
    return localValue.toISOString().slice(0, 10);
  };

  const toDateOnlyValue = (value: string | null) => {
    if (!value) {
      return null;
    }

    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) {
      return null;
    }

    const localValue = new Date(parsed.getTime() - parsed.getTimezoneOffset() * 60_000);
    return localValue.toISOString().slice(0, 10);
  };

  const toDateInputValue = (value: string | null) => toDateOnlyValue(value) ?? getTodayInputValue();

  const formatShortDate = (value: string | null) => {
    if (!value) {
      return 'Belum ada input';
    }

    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) {
      return 'Belum ada input';
    }

    return new Intl.DateTimeFormat('id-ID', { dateStyle: 'medium' }).format(parsed);
  };

  const getSortValue = (item: TestItem) => {
    if (item.completedAtIso) {
      const completedAt = new Date(item.completedAtIso);
      if (!Number.isNaN(completedAt.getTime())) {
        return completedAt.getTime();
      }
    }

    return Date.UTC(
      item.scheduleYear,
      Math.max((item.scheduleMonth ?? 1) - 1, 0),
      Math.max(((item.scheduleWeek ?? 1) - 1) * 7 + 1, 1)
    );
  };

  const getSlotFromDate = (date: Date) => Math.max(0, Math.min(3, Math.floor((date.getDate() - 1) / 7)));
  const toValidDate = (value: string | null) => {
    if (!value) {
      return null;
    }

    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  };

  const buildHeatmapRows = (selectedYear: number) => {
    const rows: HeatmapRow[] = [];

    CATEGORY_FILTERS.forEach((category, categoryIndex) => {
      rows.push({
        id: `group-${category}`,
        label: category,
        category,
        cells: buildCells([]),
        isGroup: true,
      });

      CATEGORY_BRANCHES[category].forEach((branch) => {
        const markers = tests
          .filter((item) => item.category === category)
          .filter((item) => normalizeBranch(item.location ?? item.owner) === branch)
          .flatMap((item) => {
            const completedAt = toValidDate(item.completedAtIso);
            const executionMarkers = [
              ...item.evidenceFiles.flatMap((file) => {
                const executionDate = toValidDate(file.executionDateIso);
                if (!executionDate || executionDate.getFullYear() !== selectedYear) {
                  return [];
                }

                return [
                  {
                    monthIndex: executionDate.getMonth(),
                    slotIndex: getSlotFromDate(executionDate),
                    level: 4 as HeatmapLevel,
                    item,
                    executionDateIso: file.executionDateIso,
                  },
                ];
              }),
              ...(() => {
                if (!completedAt || completedAt.getFullYear() !== selectedYear) {
                  return [];
                }

                return [
                  {
                    monthIndex: completedAt.getMonth(),
                    slotIndex: getSlotFromDate(completedAt),
                    level: 4 as HeatmapLevel,
                    item,
                    executionDateIso: item.completedAtIso,
                  },
                ];
              })(),
            ];
            const hasExecutionHistory = item.evidenceFiles.length > 0 || Boolean(completedAt);

            if (hasExecutionHistory) {
              return executionMarkers;
            }

            if (item.scheduleYear !== selectedYear || item.scheduleMonth === null) {
              return [];
            }

            return [
              {
                monthIndex: Math.max(item.scheduleMonth - 1, 0),
                slotIndex: Math.max(0, Math.min(3, (item.scheduleWeek ?? 1) - 1)),
                level: 2 as HeatmapLevel,
                item,
                executionDateIso: null,
              },
            ];
          });

        rows.push({
          id: `row-${category}-${branch}`,
          label: branch,
          category,
          cells: buildCells(markers),
          isBranch: true,
        });
      });

      if (categoryIndex < CATEGORY_FILTERS.length - 1) {
        rows.push({
          id: `spacer-${category}`,
          label: '',
          category,
          cells: buildCells([]),
          isSpacer: true,
        });
      }
    });

    return rows;
  };

  const currentYear = new Date().getFullYear();
  const MIN_TIMELINE_YEAR = 2000;
  const MAX_TIMELINE_YEAR = 2030;
  const availableYears = Array.from(
    new Set(
      tests.flatMap((item) => {
        const years = [item.scheduleYear];
        const completedAt = toValidDate(item.completedAtIso);
        if (completedAt) {
          years.push(completedAt.getFullYear());
        }

        item.evidenceFiles.forEach((file) => {
          const executionDate = toValidDate(file.executionDateIso);
          if (executionDate) {
            years.push(executionDate.getFullYear());
          }
        });

        return years;
      })
    )
  ).sort((left, right) => left - right);

  const defaultYear =
    availableYears.find((year) => year === currentYear && year >= MIN_TIMELINE_YEAR && year <= MAX_TIMELINE_YEAR) ??
    availableYears.find((year) => year >= MIN_TIMELINE_YEAR && year <= MAX_TIMELINE_YEAR) ??
    Math.max(MIN_TIMELINE_YEAR, Math.min(MAX_TIMELINE_YEAR, currentYear));
  const yearOptions = Array.from({ length: MAX_TIMELINE_YEAR - MIN_TIMELINE_YEAR + 1 }, (_, index) => MIN_TIMELINE_YEAR + index);

  const [selectedCategory, setSelectedCategory] = useState<HeatmapCategory>('Audit');
  const [selectedActivityId, setSelectedActivityId] = useState<string | null>(null);
  const [timelineFilter, setTimelineFilter] = useState<HeatmapFilter>('Semua');
  const [timelineYear, setTimelineYear] = useState(defaultYear);
  const [statusDraft, setStatusDraft] = useState<'Terlaksana' | 'Perlu Tindak Lanjut'>('Terlaksana');
  const [completedAtDraft, setCompletedAtDraft] = useState(getTodayInputValue());
  const [completionNoteDraft, setCompletionNoteDraft] = useState('');
  const [inspectorNamesDraft, setInspectorNamesDraft] = useState('');
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<{ tone: 'success' | 'error'; message: string } | null>(null);
  const [selectedHeatmapSelection, setSelectedHeatmapSelection] = useState<HeatmapSelection | null>(null);
  const evidenceInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    setTimelineYear((currentYear) => (yearOptions.includes(currentYear) ? currentYear : defaultYear));
  }, [defaultYear, yearOptions]);

  useEffect(() => {
    setSelectedHeatmapSelection(null);
  }, [timelineFilter, timelineYear, searchQuery]);

  useEffect(() => {
    if (!selectedHeatmapSelection) {
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setSelectedHeatmapSelection(null);
      }
    };

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [selectedHeatmapSelection]);

  const visibleTests = tests
    .filter((item) =>
      matchesQuery(searchQuery, [
        item.title,
        item.category,
        item.owner,
        item.location ?? undefined,
        item.inspector,
        item.date,
        item.status,
        item.completionNote ?? undefined,
        item.completedAt ?? undefined,
        item.sourceDocument,
        ...item.evidenceFiles.map((evidence) => evidence.name),
      ])
    )
    .sort((left, right) => getSortValue(right) - getSortValue(left));

  const testsByCategory = Object.fromEntries(
    CATEGORY_FILTERS.map((category) => [
      category,
      tests.filter((item) => item.category === category).sort((left, right) => getSortValue(right) - getSortValue(left)),
    ])
  ) as Record<HeatmapCategory, TestItem[]>;

  const visibleCategoryActivities = visibleTests.filter((item) => item.category === selectedCategory);

  useEffect(() => {
    if (visibleCategoryActivities.some((item) => item.id === selectedActivityId)) {
      return;
    }

    setSelectedActivityId(visibleCategoryActivities[0]?.id ?? null);
  }, [selectedActivityId, visibleCategoryActivities]);

  const selectedActivity = tests.find((item) => item.id === selectedActivityId && item.category === selectedCategory) ?? null;
  const selectedExecutionDateLabel = formatShortDate(completedAtDraft);
  const storedEvidenceFiles =
    selectedActivity?.evidenceFiles.filter((file) => toDateOnlyValue(file.executionDateIso) === completedAtDraft) ?? [];
  const selectedHeatmapItems = selectedHeatmapSelection?.entries ?? [];
  const parseInspectorNames = (value: string) =>
    Array.from(
      new Set(
        value
          .split(/[\n,]+/)
          .map((name) => name.trim())
          .filter(Boolean)
      )
    );

  useEffect(() => {
    if (!selectedActivity) {
      setPendingFiles([]);
      setFeedback(null);
      setInspectorNamesDraft('');
      if (evidenceInputRef.current) {
        evidenceInputRef.current.value = '';
      }
      return;
    }

    setStatusDraft(selectedActivity.status === 'Perlu Tindak Lanjut' ? 'Perlu Tindak Lanjut' : 'Terlaksana');
    setCompletedAtDraft(toDateInputValue(selectedActivity.completedAtIso));
    setCompletionNoteDraft(selectedActivity.completionNote ?? '');
    setInspectorNamesDraft(selectedActivity.inspector === '-' ? '' : selectedActivity.inspector.split(/\s*,\s*/).join('\n'));
    setPendingFiles([]);
    setFeedback(null);

    if (evidenceInputRef.current) {
      evidenceInputRef.current.value = '';
    }
  }, [selectedActivity]);

  const heatmapRows = buildHeatmapRows(timelineYear);
  const filteredHeatmapRows =
    timelineFilter === 'Semua'
      ? heatmapRows
      : BRANCH_FILTERS.includes(timelineFilter as BranchLabel)
        ? (() => {
            const matchingCategories = new Set(
              heatmapRows
                .filter((row) => row.isBranch && row.label === timelineFilter && row.category)
                .map((row) => row.category as HeatmapCategory)
            );

            return heatmapRows.filter((row) => {
              if (row.isSpacer) {
                return false;
              }

              if (row.isGroup && row.category) {
                return matchingCategories.has(row.category);
              }

              return row.isBranch && row.label === timelineFilter;
            });
          })()
        : heatmapRows.filter((row) => !row.isSpacer && row.category === timelineFilter);

  const hasHeatmapData = filteredHeatmapRows.some((row) => row.isBranch && row.cells.some((cell) => cell.level > 0));

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!selectedActivity) {
      return;
    }

    try {
      setIsSubmitting(true);
      setFeedback(null);

      await onUpdateActivity({
        activityId: selectedActivity.id,
        status: statusDraft,
        completedAt: completedAtDraft,
        completionNote: completionNoteDraft,
        inspectorNames: parseInspectorNames(inspectorNamesDraft),
      });

      if (pendingFiles.length) {
        await onUploadEvidence(selectedActivity.id, pendingFiles);
      }

      setPendingFiles([]);
      if (evidenceInputRef.current) {
        evidenceInputRef.current.value = '';
      }

      setFeedback({
        tone: 'success',
        message:
          pendingFiles.length > 0
            ? 'Dokumen agenda berhasil disimpan dan langsung masuk ke daftar dokumen tersimpan.'
            : 'Update pelaksanaan agenda berhasil disimpan.',
      });
    } catch (error) {
      setFeedback({
        tone: 'error',
        message:
          error instanceof Error
            ? error.message
            : 'Terjadi kesalahan saat menyimpan pelaksanaan pengawasan.',
      });
    } finally {
      setIsSubmitting(false);
    }
  }

  function handleSelectPendingFiles(event: ChangeEvent<HTMLInputElement>) {
    const nextFiles = Array.from(event.target.files ?? []);

    if (!nextFiles.length) {
      return;
    }

    setPendingFiles((currentFiles) => {
      const currentKeys = new Set(currentFiles.map((file) => getPendingFileKey(file)));
      const uniqueIncomingFiles = nextFiles.filter((file) => !currentKeys.has(getPendingFileKey(file)));
      return [...currentFiles, ...uniqueIncomingFiles];
    });

    event.target.value = '';
  }

  function handleRemovePendingFile(targetFile: File) {
    const targetKey = getPendingFileKey(targetFile);
    setPendingFiles((currentFiles) => currentFiles.filter((file) => getPendingFileKey(file) !== targetKey));

    if (evidenceInputRef.current && pendingFiles.length <= 1) {
      evidenceInputRef.current.value = '';
    }
  }

  return (
    <section className="flex min-w-0 w-full max-w-none flex-col gap-4 sm:gap-5 md:gap-6">
      <div className="rounded-[26px] border border-slate-200/80 bg-white/95 px-4 py-5 shadow-[0_18px_50px_rgba(15,23,42,0.08)] backdrop-blur sm:rounded-[30px] sm:px-6 sm:py-6 md:px-8 md:py-8">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0 max-w-3xl">
            <p className="text-xs font-semibold uppercase tracking-[0.32em] text-slate-400">Program Pengawasan Keamanan</p>
            <h2 className="mt-3 break-words text-[1.9rem] font-semibold tracking-[-0.04em] text-slate-900 sm:text-3xl md:text-[2.35rem]">
              Dashboard Jadwal Pengawasan Internal
            </h2>
            <p className="mt-3 max-w-2xl text-sm leading-7 text-slate-500 sm:text-[15px] md:text-base">
              Klik card Audit, Inspeksi, atau Pengunjungan untuk melihat agenda, memperbarui
              pelaksanaan pada hari berjalan, dan mengunggah dokumen yang otomatis masuk ke
              calendar heatmap.
            </p>
          </div>

          <div className="inline-flex w-fit items-center rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white shadow-[0_10px_30px_rgba(15,23,42,0.18)]">
            Tahun {timelineYear}
          </div>
        </div>
      </div>

      <div className="grid items-start gap-4 sm:gap-5 md:grid-cols-2 xl:grid-cols-3">
        {CATEGORY_FILTERS.map((category) => {
          const items = testsByCategory[category];
          const completedCount = items.filter((item) => item.status === 'Terlaksana').length;
          const pendingCount = items.filter((item) => item.status !== 'Terlaksana').length;
          const evidenceCount = items.reduce((total, item) => total + item.evidenceFiles.length, 0);
          const categoryStatus =
            items.length > 0 && items.every((item) => item.status === 'Terlaksana') ? ('Sudah' as StatusTag) : ('Terjadwal' as StatusTag);
          const lastCompleted = [...items].find((item) => Boolean(item.completedAtIso));
          const inspectionLocations =
            category === 'Inspeksi'
              ? CATEGORY_BRANCHES.Inspeksi.map((branch) => {
                  const branchItems = items.filter((item) => normalizeBranch(item.location ?? item.owner) === branch);
                  return {
                    name: branch,
                    status:
                      branchItems.length > 0 && branchItems.every((item) => item.status === 'Terlaksana')
                        ? ('Sudah' as StatusTag)
                        : ('Terjadwal' as StatusTag),
                  };
                })
              : [];

          return (
            <button
              key={category}
              type="button"
              onClick={() => {
                setSelectedCategory(category);
                setSelectedActivityId(null);
                setSelectedHeatmapSelection(null);
              }}
              className={`relative min-w-0 self-start overflow-hidden rounded-[22px] border border-slate-200/80 bg-white p-4 text-left shadow-[0_16px_38px_rgba(15,23,42,0.08)] transition hover:-translate-y-0.5 hover:shadow-[0_20px_42px_rgba(15,23,42,0.1)] sm:rounded-[24px] sm:p-5 ${
                selectedCategory === category ? 'ring-2 ring-slate-900 ring-offset-2 ring-offset-slate-100' : ''
              }`}
            >
              <div className={`absolute inset-x-0 top-0 h-1 bg-gradient-to-r ${getCardAccent(category)}`} />

              <div className="relative flex flex-col gap-4 sm:gap-5">
                <div className="flex flex-col items-start justify-between gap-2.5 sm:flex-row sm:items-start">
                  <div className="min-w-0">
                    <p className="text-xs font-semibold uppercase tracking-[0.28em] text-slate-400">
                      {category === 'Audit' ? '1 kali / 2 tahun' : category === 'Inspeksi' ? '1 kali / tahun' : 'Tiap 2 bulan'}
                    </p>
                    <h3 className="mt-2 break-words text-[1.28rem] font-semibold tracking-[-0.03em] text-slate-900 sm:text-[1.45rem]">
                      {category}
                    </h3>
                  </div>

                  {category === 'Pengunjungan' ? (
                    <span className="inline-flex items-center rounded-full bg-sky-50 px-2.5 py-1 text-[11px] font-semibold text-sky-700 ring-1 ring-inset ring-sky-200">
                      {completedCount} / {items.length} done
                    </span>
                  ) : (
                    <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-semibold ${getSummaryStatusStyles(categoryStatus).badge}`}>
                      {categoryStatus}
                    </span>
                  )}
                </div>

                <p className="text-sm leading-6 text-slate-500">
                  {category === 'Audit'
                    ? 'Audit internal berkala untuk memastikan evaluasi pengawasan berjalan menyeluruh.'
                    : category === 'Inspeksi'
                      ? 'Ringkasan lokasi prioritas yang menjadi fokus inspeksi tahunan dan status pelaksanaannya.'
                      : 'Agenda pengunjungan berkala yang dapat diperbarui harian lengkap dengan bukti dokumen.'}
                </p>

                {category === 'Audit' ? (
                  <div className="grid gap-2.5 sm:grid-cols-3">
                    <div className="rounded-[18px] border border-slate-200 bg-slate-50 px-3.5 py-3.5">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-400">Status</p>
                      <div className="mt-2.5 flex items-center gap-2">
                        <span className={`h-2.5 w-2.5 rounded-full ${getSummaryStatusStyles(categoryStatus).dot}`} />
                        <strong className="text-[1.2rem] font-semibold tracking-[-0.03em] text-slate-900 sm:text-[1.3rem]">{categoryStatus}</strong>
                      </div>
                    </div>
                    <div className="rounded-[18px] border border-slate-200 bg-slate-50 px-3.5 py-3.5">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-400">Dokumen</p>
                      <strong className="mt-2.5 block text-[1.2rem] font-semibold tracking-[-0.03em] text-slate-900 sm:text-[1.3rem]">{evidenceCount}</strong>
                    </div>
                    <div className="rounded-[18px] border border-slate-200 bg-slate-50 px-3.5 py-3.5">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-400">Terakhir</p>
                      <strong className="mt-2.5 block text-[1.2rem] font-semibold tracking-[-0.03em] text-slate-900 sm:text-[1.3rem]">
                        {formatShortDate(lastCompleted?.completedAtIso ?? null)}
                      </strong>
                    </div>
                  </div>
                ) : null}

                {category === 'Inspeksi' ? (
                  <>
                    <div className="grid gap-2.5 sm:grid-cols-3">
                      <div className="rounded-[18px] border border-slate-200 bg-slate-50 px-3.5 py-3.5">
                        <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-400">Status</p>
                        <strong className="mt-2.5 block text-[1.2rem] font-semibold tracking-[-0.03em] text-slate-900 sm:text-[1.3rem]">{categoryStatus}</strong>
                      </div>
                      <div className="rounded-[18px] border border-slate-200 bg-slate-50 px-3.5 py-3.5">
                        <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-400">Cabang</p>
                        <strong className="mt-2.5 block text-[1.2rem] font-semibold tracking-[-0.03em] text-slate-900 sm:text-[1.3rem]">{items.length}</strong>
                      </div>
                      <div className="rounded-[18px] border border-slate-200 bg-slate-50 px-3.5 py-3.5">
                        <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-400">Butuh Aksi</p>
                        <strong className="mt-2.5 block text-[1.2rem] font-semibold tracking-[-0.03em] text-slate-900 sm:text-[1.3rem]">{pendingCount}</strong>
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-1.5">
                      {inspectionLocations.map((location) => (
                        <span
                          key={location.name}
                          className={`inline-flex items-center gap-2 rounded-full px-2.5 py-1 text-[11px] font-semibold ${getSummaryStatusStyles(location.status).badge}`}
                        >
                          <span className={`h-2 w-2 rounded-full ${getSummaryStatusStyles(location.status).dot}`} />
                          {location.name}
                        </span>
                      ))}
                    </div>
                  </>
                ) : null}

                {category === 'Pengunjungan' ? (
                  <>
                    <div className="grid gap-2.5 sm:grid-cols-3">
                      <div className="rounded-[18px] border border-slate-200 bg-slate-50 px-3.5 py-3.5">
                        <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-400">Progress</p>
                        <strong className="mt-2.5 block text-[1.2rem] font-semibold tracking-[-0.03em] text-slate-900 sm:text-[1.3rem]">
                          {completedCount} / {items.length}
                        </strong>
                      </div>
                      <div className="rounded-[18px] border border-slate-200 bg-slate-50 px-3.5 py-3.5">
                        <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-400">Dokumen</p>
                        <strong className="mt-2.5 block text-[1.2rem] font-semibold tracking-[-0.03em] text-slate-900 sm:text-[1.3rem]">{evidenceCount}</strong>
                      </div>
                      <div className="rounded-[18px] border border-slate-200 bg-slate-50 px-3.5 py-3.5">
                        <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-400">Terakhir</p>
                        <strong className="mt-2.5 block text-[1.2rem] font-semibold tracking-[-0.03em] text-slate-900 sm:text-[1.3rem]">
                          {formatShortDate(lastCompleted?.completedAtIso ?? null)}
                        </strong>
                      </div>
                    </div>
                  </>
                ) : null}

                <div className="inline-flex items-center gap-2 text-sm font-semibold text-slate-700">
                  <span>{selectedCategory === category ? 'Panel aktif' : 'Klik untuk kelola'}</span>
                  <span className="h-2 w-2 rounded-full bg-orange-400" />
                </div>
              </div>
            </button>
          );
        })}
      </div>

      <article className="overflow-hidden rounded-[26px] border border-slate-200/80 bg-white shadow-[0_18px_44px_rgba(15,23,42,0.08)] sm:rounded-[30px]">
        <div className="border-b border-slate-200/80 px-4 py-5 sm:px-6 sm:py-6 md:px-8">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
            <div className="max-w-3xl">
              <p className="text-xs font-semibold uppercase tracking-[0.32em] text-slate-400">Detail Kategori</p>
              <h2 className="mt-2 text-[1.5rem] font-semibold tracking-[-0.04em] text-slate-900 sm:text-[1.8rem]">
                Kelola pelaksanaan {selectedCategory.toLowerCase()}
              </h2>
              <p className="mt-2 text-sm leading-7 text-slate-500 sm:text-[15px]">
                Gunakan form ini untuk memperbarui agenda yang sedang aktif. Detail card agenda
                sekarang dimunculkan dari heatmap saat kotak berwarna dipilih.
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              <span className="data-chip">{testsByCategory[selectedCategory].length} agenda total</span>
              <span className="data-chip">{visibleCategoryActivities.length} agenda sesuai pencarian</span>
              <span className="data-chip">Filter global: {searchQuery ? 'aktif' : 'tidak aktif'}</span>
            </div>
          </div>
        </div>

        <div className="px-4 py-5 sm:px-6 sm:py-6 md:px-8">
          <article className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-[0_12px_32px_rgba(15,23,42,0.06)] sm:p-6">
            {selectedActivity ? (
              <form onSubmit={handleSubmit} className="space-y-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-400">Form Update</p>
                    <h3 className="mt-2 text-xl font-semibold tracking-[-0.03em] text-slate-900">{selectedActivity.title}</h3>
                    <p className="mt-2 text-sm leading-6 text-slate-500">
                      {selectedActivity.owner} · {selectedActivity.date}
                    </p>
                  </div>
                  <StatusBadge status={selectedActivity.status} />
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <label className="grid gap-2">
                    <span className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Status Pelaksanaan</span>
                    <select
                      value={statusDraft}
                      onChange={(event) => setStatusDraft(event.target.value as 'Terlaksana' | 'Perlu Tindak Lanjut')}
                      className="h-11 rounded-[16px] border border-slate-200 bg-white px-3.5 text-sm font-medium text-slate-700 outline-none transition focus:border-slate-300"
                    >
                      <option value="Terlaksana">Terlaksana</option>
                      <option value="Perlu Tindak Lanjut">Perlu Tindak Lanjut</option>
                    </select>
                  </label>

                  <label className="grid gap-2">
                    <span className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Tanggal Pelaksanaan</span>
                    <input
                      type="date"
                      value={completedAtDraft}
                      onChange={(event) => setCompletedAtDraft(event.target.value)}
                      className="h-11 rounded-[16px] border border-slate-200 bg-white px-3.5 text-sm font-medium text-slate-700 outline-none transition focus:border-slate-300"
                    />
                  </label>
                </div>

                <div className="grid gap-4 lg:grid-cols-2">
                  <label className="grid gap-2">
                    <span className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Catatan Pelaksanaan</span>
                    <textarea
                      value={completionNoteDraft}
                      onChange={(event: ChangeEvent<HTMLTextAreaElement>) => setCompletionNoteDraft(event.target.value)}
                      rows={4}
                      placeholder="Contoh: audit selesai, temuan minor ditindaklanjuti unit terkait."
                      className="rounded-[18px] border border-slate-200 bg-white px-4 py-3 text-sm leading-6 text-slate-700 outline-none transition focus:border-slate-300"
                    />
                  </label>

                  <label className="grid gap-2">
                    <span className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Daftar Inspektor Internal</span>
                    <textarea
                      value={inspectorNamesDraft}
                      onChange={(event: ChangeEvent<HTMLTextAreaElement>) => setInspectorNamesDraft(event.target.value)}
                      rows={4}
                      placeholder="Tulis satu nama per baris atau pisahkan dengan koma."
                      className="rounded-[18px] border border-slate-200 bg-white px-4 py-3 text-sm leading-6 text-slate-700 outline-none transition focus:border-slate-300"
                    />
                  </label>
                </div>
              

                <div className="grid gap-2">
                  <span className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Dokumen Pelaksanaan</span>
                  <input
                    ref={evidenceInputRef}
                    type="file"
                    multiple
                    onChange={handleSelectPendingFiles}
                    className="hidden"
                  />
                  <div className="space-y-3 rounded-[20px] border border-dashed border-slate-300 bg-slate-50 px-4 py-4">
                    <div className="flex flex-wrap items-center gap-3">
                      <button
                        type="button"
                        onClick={() => evidenceInputRef.current?.click()}
                        className="inline-flex h-11 items-center justify-center rounded-full bg-slate-900 px-5 text-sm font-semibold text-white transition hover:bg-slate-800"
                      >
                        Pilih Dokumen
                      </button>
                      <span className="text-sm text-slate-500">
                        {pendingFiles.length
                          ? `${pendingFiles.length} file dipilih dan siap diunggah.`
                          : 'Belum ada file dipilih.'}
                      </span>
                    </div>

                    {pendingFiles.length ? (
                      <div className="space-y-2">
                        {pendingFiles.map((file) => (
                          <div
                            key={getPendingFileKey(file)}
                            className="flex flex-wrap items-center justify-between gap-3 rounded-[16px] border border-slate-200 bg-white px-4 py-3"
                          >
                            <div className="min-w-0">
                              <strong className="block truncate text-sm font-semibold text-slate-900">{file.name}</strong>
                              <span className="text-xs text-slate-500">
                                {(file.size / 1024 / 1024).toFixed(2)} MB
                              </span>
                            </div>
                            <button
                              type="button"
                              onClick={() => handleRemovePendingFile(file)}
                              className="inline-flex h-9 items-center justify-center rounded-full border border-rose-200 bg-rose-50 px-4 text-xs font-semibold text-rose-700 transition hover:bg-rose-100"
                            >
                              Hapus
                            </button>
                          </div>
                        ))}
                      </div>
                    ) : null}
                  </div>
                  <span className="text-sm text-slate-500">
                    {pendingFiles.length
                      ? `${pendingFiles.length} file siap disimpan ke dokumen agenda ini.`
                      : 'Pilih dokumen audit, inspeksi, atau pengunjungan yang dibuat pada hari pelaksanaan.'}
                  </span>
                </div>

                <div className="flex flex-wrap items-center justify-end gap-3">
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="inline-flex h-11 items-center justify-center rounded-[16px] bg-slate-900 px-5 text-sm font-semibold text-white shadow-[0_12px_24px_rgba(15,23,42,0.18)] transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-70"
                  >
                    {isSubmitting ? 'Menyimpan...' : 'Simpan Dokumen'}
                  </button>
                </div>

                <div className="rounded-[20px] border border-slate-200 bg-slate-50 px-4 py-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-400">Dokumen Tersimpan</p>
                      <p className="mt-2 text-sm text-slate-500">
                        {storedEvidenceFiles.length
                          ? `Dokumen yang terhubung ke agenda ini pada ${selectedExecutionDateLabel}.`
                          : `Belum ada dokumen yang tersimpan pada ${selectedExecutionDateLabel}.`}
                      </p>
                    </div>
                    <span className="data-chip">{storedEvidenceFiles.length} file</span>
                  </div>

                  <div className="mt-4 space-y-2">
                    {storedEvidenceFiles.length ? (
                      storedEvidenceFiles.map((file) => (
                        <a
                          key={file.id}
                          href={file.url}
                          target="_blank"
                          rel="noreferrer"
                          className="flex items-center justify-between rounded-[16px] border border-slate-200 bg-white px-4 py-3 text-sm font-medium text-slate-700 transition hover:border-slate-300 hover:text-slate-900"
                        >
                          <span className="truncate pr-4">{file.name}</span>
                          <span className="shrink-0 text-xs text-slate-400">{file.uploadedAt}</span>
                        </a>
                      ))
                    ) : (
                      <div className="empty-inline">Tidak ada dokumen tersimpan untuk tanggal pelaksanaan yang dipilih.</div>
                    )}
                  </div>
                </div>

                {feedback ? (
                  <div
                    className={`rounded-[18px] px-4 py-3 text-sm font-medium ${
                      feedback.tone === 'success'
                        ? 'bg-emerald-50 text-emerald-700 ring-1 ring-inset ring-emerald-200'
                        : 'bg-rose-50 text-rose-700 ring-1 ring-inset ring-rose-200'
                    }`}
                  >
                    {feedback.message}
                  </div>
                ) : null}

              </form>
            ) : (
              <div className="flex h-full min-h-[280px] items-center justify-center rounded-[20px] border border-dashed border-slate-200 bg-slate-50 px-6 text-center">
                <div className="empty-inline">Belum ada agenda aktif. Gunakan filter pencarian atau pilih data dari heatmap.</div>
              </div>
            )}
          </article>
        </div>
      </article>

      <article className="overflow-hidden rounded-[26px] border border-slate-200/80 bg-white shadow-[0_18px_44px_rgba(15,23,42,0.08)] sm:rounded-[30px]">
        <div className="border-b border-slate-200/80 px-4 py-5 sm:px-6 sm:py-6 md:px-8">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.32em] text-slate-400">Timeline / Calendar View</p>
              <h2 className="mt-2 text-[1.5rem] font-semibold tracking-[-0.04em] text-slate-900 sm:text-[1.8rem]">
                Calendar Heatmap Pelaksanaan Pengawasan
              </h2>
              <p className="mt-2 max-w-3xl text-sm leading-7 text-slate-500 sm:text-[15px]">
                Klik kotak biru tua pada heatmap untuk menampilkan detail agenda yang sudah
                terlaksana dalam modal terpisah.
              </p>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <label className="grid gap-2">
                <span className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Filter Heatmap</span>
                <select
                  value={timelineFilter}
                  onChange={(event) => setTimelineFilter(event.target.value as HeatmapFilter)}
                  className="h-11 min-w-[220px] rounded-[16px] border border-slate-200 bg-white px-3.5 text-sm font-medium text-slate-700 outline-none transition focus:border-slate-300"
                >
                  {(['Semua', ...CATEGORY_FILTERS, ...BRANCH_FILTERS] as const).map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              </label>

              <label className="grid gap-2">
                <span className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Tahun</span>
                <select
                  value={timelineYear}
                  onChange={(event) => setTimelineYear(Number(event.target.value))}
                  className="h-11 min-w-[160px] rounded-[16px] border border-slate-200 bg-white px-3.5 text-sm font-medium text-slate-700 outline-none transition focus:border-slate-300"
                >
                  {yearOptions.map((year) => (
                    <option key={year} value={year}>
                      {year}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          </div>
        </div>

        <div className="px-4 py-5 sm:px-6 sm:py-6 md:px-8">
          <div className="timeline-heatmap-stage">
            <div className="timeline-heatmap-scroll">
              <div className="timeline-heatmap-shell">
                {hasHeatmapData ? (
                  <div
                    className="timeline-heatmap-grid"
                    style={{ gridTemplateColumns: `var(--timeline-label-column) repeat(${TIMELINE_TOTAL_COLUMNS}, var(--timeline-cell-size))` }}
                  >
                    <div className="timeline-heatmap-sticky-spacer" />
                    {MONTH_LABELS.map((month) => (
                      <div
                        key={`month-${month}`}
                        className="timeline-heatmap-month"
                        style={{ gridColumn: `span ${TIMELINE_SLOTS_PER_MONTH} / span ${TIMELINE_SLOTS_PER_MONTH}` }}
                      >
                        {month}
                      </div>
                    ))}

                    {filteredHeatmapRows.map((row) => (
                      <Fragment key={row.id}>
                        <div
                          className={`timeline-heatmap-label ${row.isSpacer ? 'is-spacer' : ''} ${row.isGroup ? 'is-group' : ''} ${
                            row.isBranch ? 'is-branch' : ''
                          }`}
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
                        {row.cells.map((cell, index) => {
                          const isInteractive = row.isBranch && Boolean(row.category) && cell.level >= 4 && cell.entries.length > 0;
                          const isSelected =
                            selectedHeatmapSelection?.rowId === row.id && selectedHeatmapSelection?.cellIndex === index;
                          const cellLabel = `${row.label} ${MONTH_LABELS[Math.floor(index / TIMELINE_SLOTS_PER_MONTH)]} slot ${(
                            index % TIMELINE_SLOTS_PER_MONTH
                          ) + 1}`;

                          if (!isInteractive) {
                            return (
                              <span
                                key={`${row.id}-${index}`}
                                className={`timeline-heatmap-cell ${getHeatmapTone(cell.level)}`}
                              />
                            );
                          }

                          return (
                            <button
                              key={`${row.id}-${index}`}
                              type="button"
                              className={`timeline-heatmap-cell timeline-heatmap-cell-button ${getHeatmapTone(cell.level)} ${
                                isSelected ? 'is-selected' : ''
                              }`}
                              onClick={() => {
                                if (!row.category) {
                                  return;
                                }

                                const branch = row.label as BranchLabel;
                                const isSameCell =
                                  selectedHeatmapSelection?.rowId === row.id &&
                                  selectedHeatmapSelection?.cellIndex === index;

                                setSelectedHeatmapSelection(
                                  isSameCell
                                    ? null
                                    : {
                                        rowId: row.id,
                                        cellIndex: index,
                                        category: row.category,
                                        branch,
                                        level: cell.level,
                                        entries: cell.entries,
                                      }
                                );
                              }}
                              aria-pressed={isSelected}
                              title={cellLabel}
                            />
                          );
                        })}
                      </Fragment>
                    ))}
                  </div>
                ) : (
                  <div className="rounded-[22px] border border-dashed border-slate-200 bg-slate-50 px-5 py-10">
                    <div className="empty-inline">Belum ada data heatmap untuk filter dan tahun yang dipilih.</div>
                  </div>
                )}
              </div>
            </div>
            <div className="timeline-heatmap-legend">
              <span className={`timeline-heatmap-cell ${getHeatmapTone(2)}`} />
              <span>Jadwal</span>
              <span className={`timeline-heatmap-cell ${getHeatmapTone(4)}`} />
              <span>Terlaksana</span>
            </div>
          </div>
        </div>
      </article>

      {selectedHeatmapSelection ? (
        <div
          className="fixed inset-0 z-[120] grid place-items-center bg-slate-950/30 p-3 backdrop-blur-[6px] sm:p-5"
          onClick={() => setSelectedHeatmapSelection(null)}
        >
          <article
            className="flex max-h-[calc(100vh-24px)] w-full max-w-3xl flex-col overflow-hidden rounded-[22px] border border-slate-200 bg-white shadow-[0_24px_60px_rgba(15,23,42,0.16)] sm:max-h-[calc(100vh-40px)] sm:rounded-[24px]"
            role="dialog"
            aria-modal="true"
            aria-labelledby="heatmap-detail-modal-title"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="border-b border-slate-200 px-4 py-4 sm:px-5 sm:py-5">
              <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                <div className="max-w-3xl">
                  <p className="text-sm font-semibold uppercase tracking-[0.18em] text-emerald-700">Detail Heatmap</p>
                  <h2 id="heatmap-detail-modal-title" className="mt-2 text-[1.25rem] font-semibold tracking-[-0.04em] text-slate-900 sm:text-[1.45rem]">
                    Agenda Terlaksana {selectedHeatmapSelection.branch}
                  </h2>
                  <p className="mt-3 text-sm leading-7 text-slate-500 sm:text-[15px]">
                    Informasi agenda yang dipilih dari sel heatmap terlaksana ditampilkan dalam card detail berikut.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => setSelectedHeatmapSelection(null)}
                  className="inline-flex h-11 items-center justify-center rounded-[16px] border border-slate-200 bg-slate-50 px-4 text-sm font-semibold text-slate-700 transition hover:bg-white"
                >
                  Tutup
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto px-4 py-4 sm:px-5 sm:py-5">
              <div className="grid gap-4">
                {selectedHeatmapItems.map((entry, index) => {
                  const item = entry.item;
                  const selectedDateKey = toDateOnlyValue(entry.executionDateIso);
                  const documentCount = selectedDateKey
                    ? item.evidenceFiles.filter((file) => toDateOnlyValue(file.executionDateIso) === selectedDateKey).length
                    : item.evidenceFiles.length;
                  const executionLabel = entry.executionDateIso
                    ? formatShortDate(entry.executionDateIso)
                    : item.completedAt ?? item.date;
                  const categoryTone =
                    item.category === 'Audit'
                      ? 'bg-blue-500/15 text-blue-200'
                      : item.category === 'Inspeksi'
                        ? 'bg-slate-500/20 text-slate-200'
                        : 'bg-emerald-500/15 text-emerald-200';

                  return (
                    <article
                      key={`${item.id}-${entry.executionDateIso ?? `schedule-${index}`}`}
                      className="rounded-[20px] bg-slate-900 px-4 py-4 text-white shadow-[0_20px_36px_rgba(15,23,42,0.18)] sm:px-5 sm:py-5"
                    >
                      <div className="flex flex-col gap-4">
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div className="min-w-0">
                            <span className={`inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-sm font-semibold ${categoryTone}`}>
                              <span className="h-2.5 w-2.5 rounded-full bg-current opacity-90" />
                              {item.category}
                            </span>
                            <h3 className="mt-4 text-[1.2rem] font-semibold tracking-[-0.04em] text-white sm:text-[1.35rem]">
                              {item.title}
                            </h3>
                            <p className="mt-2 text-sm leading-6 text-slate-100 sm:text-base">
                              {item.owner} · {item.date}
                            </p>
                          </div>

                          <span className="inline-flex rounded-full bg-emerald-50 px-3 py-1.5 text-sm font-semibold text-emerald-700 ring-1 ring-inset ring-emerald-200">
                            {item.status}
                          </span>
                        </div>

                        <dl className="grid gap-4 pt-1 md:grid-cols-3">
                          <div>
                            <dt className="text-[11px] font-semibold uppercase tracking-[0.32em] text-slate-300">
                              Pelaksanaan
                            </dt>
                            <dd className="mt-2 text-sm font-medium text-white sm:text-base">
                              {executionLabel}
                            </dd>
                          </div>
                          <div>
                            <dt className="text-[11px] font-semibold uppercase tracking-[0.32em] text-slate-300">
                              Dokumen
                            </dt>
                            <dd className="mt-2 text-sm font-medium text-white sm:text-base">
                              {documentCount} file
                            </dd>
                          </div>
                          <div>
                            <dt className="text-[11px] font-semibold uppercase tracking-[0.32em] text-slate-300">
                              Inspektor
                            </dt>
                            <dd className="mt-2 text-sm font-medium leading-6 text-white sm:text-base">
                              {item.inspector}
                            </dd>
                          </div>
                        </dl>
                      </div>
                    </article>
                  );
                })}
              </div>
            </div>
          </article>
        </div>
      ) : null}
    </section>
  );
}
