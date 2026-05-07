import { Fragment, useEffect, useRef, useState, type ChangeEvent, type FormEvent } from 'react';
import { CloseIcon, TrashIcon } from '@/components/icons';
import type { TestItem } from '@/types/dashboard';

type HeatmapCategory = 'Audit' | 'Inspeksi' | 'Tes Keamanan';
type HeatmapLevel = 0 | 1 | 2 | 3 | 4;
type BranchLabel = (typeof BRANCH_FILTERS)[number];
type HeatmapCategoryFilter = 'Semua' | HeatmapCategory;
type HeatmapBranchFilter = 'Semua' | BranchLabel;
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
type StatusTag = 'Terlaksana' | 'Terjadwal';
type HeatmapDeleteTarget =
  | {
      mode: 'entry';
      activityId: string;
      title: string;
    }
  | {
      mode: 'selection';
      activityIds: string[];
      branch: BranchLabel;
      count: number;
    };
type SupervisionTemplateInput = {
  title: string;
  category: HeatmapCategory;
  scheduleLabel: string;
  scheduleYear: number;
  scheduleMonth: number | null;
  scheduleWeek: number | null;
  sourceDocument: string;
  inspectorNames: string[];
};
type TemplateTestItem = TestItem & {
  template: SupervisionTemplateInput;
};

const BRANCH_FILTERS = [
  'Cabang Surabaya',
  'KCP Banyuwangi',
  'KCP Malang',
  'KCP Sumenep',
  'Penyedia Personel AVSEC',
] as const;

const CATEGORY_FILTERS: HeatmapCategory[] = ['Audit', 'Inspeksi', 'Tes Keamanan'];
const CATEGORY_BRANCHES: Record<HeatmapCategory, BranchLabel[]> = {
  Audit: ['Cabang Surabaya', 'KCP Banyuwangi', 'KCP Malang', 'KCP Sumenep'],
  Inspeksi: ['Cabang Surabaya', 'KCP Banyuwangi', 'KCP Malang', 'KCP Sumenep', 'Penyedia Personel AVSEC'],
  'Tes Keamanan': ['Cabang Surabaya', 'KCP Banyuwangi', 'KCP Sumenep'],
};
const MONTH_LABELS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const TEST_PERIOD_MONTHS = [2, 4, 6, 8, 10, 12] as const;
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
  if (status === 'Terlaksana') {
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

  return 'summary-category is-tes';
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

function hasRecordedExecution(item: TestItem) {
  return item.status !== 'Terjadwal' || Boolean(item.completedAtIso) || item.evidenceFiles.length > 0 || Boolean(item.completionNote?.trim());
}

function getActivityYears(item: TestItem) {
  const years = new Set<number>([item.scheduleYear]);

  if (item.completedAtIso) {
    const completedAt = new Date(item.completedAtIso);
    if (!Number.isNaN(completedAt.getTime())) {
      years.add(completedAt.getFullYear());
    }
  }

  item.evidenceFiles.forEach((file) => {
    if (!file.executionDateIso) {
      return;
    }

    const executionDate = new Date(file.executionDateIso);
    if (!Number.isNaN(executionDate.getTime())) {
      years.add(executionDate.getFullYear());
    }
  });

  return Array.from(years);
}

function matchesActivityYear(item: TestItem, selectedYear: number) {
  return getActivityYears(item).includes(selectedYear);
}

function matchesAuditWindow(item: TestItem, selectedYear: number) {
  return getActivityYears(item).some((year) => year >= selectedYear - 1 && year <= selectedYear);
}

function getTestPeriodKey(item: TestItem) {
  return `${item.scheduleYear}-${String(item.scheduleMonth ?? 0).padStart(2, '0')}`;
}

function getActivityScheduleTime(item: TestItem) {
  return Date.UTC(
    item.scheduleYear,
    Math.max((item.scheduleMonth ?? 1) - 1, 0),
    Math.max(((item.scheduleWeek ?? 1) - 1) * 7 + 1, 1)
  );
}

function comparePendingActivities(left: TestItem, right: TestItem) {
  const scheduleDiff = getActivityScheduleTime(left) - getActivityScheduleTime(right);
  if (scheduleDiff !== 0) {
    return scheduleDiff;
  }

  return normalizeBranch(left.location ?? left.owner).localeCompare(normalizeBranch(right.location ?? right.owner), 'id');
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

function getScheduledSlotIndex(item: Pick<TestItem, 'category' | 'scheduleWeek'>) {
  if (item.category === 'Tes Keamanan') {
    return 0;
  }

  return Math.max(0, Math.min(3, (item.scheduleWeek ?? 1) - 1));
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

function isTemplateTestItem(item: TestItem | TemplateTestItem | null): item is TemplateTestItem {
  return Boolean(item && 'template' in item);
}

export function SupervisionProgramSection({
  tests,
  searchQuery,
  onUpdateActivity,
  onUploadEvidence,
  onDeleteActivities,
}: {
  tests: TestItem[];
  searchQuery: string;
  onUpdateActivity: (input: {
    activityId: string;
    status: 'Terlaksana' | 'Perlu Tindak Lanjut';
    location?: string | null;
    completedAt?: string | null;
    completionNote?: string | null;
    inspectorNames?: string[] | null;
    template?: SupervisionTemplateInput;
  }) => Promise<TestItem>;
  onUploadEvidence: (activityId: string, files: File[]) => Promise<void>;
  onDeleteActivities: (activityIds: string[]) => Promise<void>;
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
      return 'N/A';
    }

    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) {
      return 'N/A';
    }

    return new Intl.DateTimeFormat('id-ID', { dateStyle: 'medium' }).format(parsed);
  };

  const formatTestPeriodLabel = (item: Pick<TestItem, 'scheduleMonth' | 'scheduleYear' | 'date'>) => {
    if (item.scheduleMonth) {
      return new Intl.DateTimeFormat('id-ID', { month: 'long', year: 'numeric' }).format(
        new Date(Date.UTC(item.scheduleYear, item.scheduleMonth - 1, 1))
      );
    }

    return item.date.replace(/^Minggu\s+[IVXLC]+\s+/i, '');
  };

  const buildTestPeriodLabel = (month: number, year: number) =>
    new Intl.DateTimeFormat('id-ID', { month: 'long', year: 'numeric' }).format(new Date(Date.UTC(year, month - 1, 1)));

  const getActivityDateLabel = (item: Pick<TestItem, 'category' | 'scheduleMonth' | 'scheduleYear' | 'date'>) =>
    item.category === 'Tes Keamanan' ? formatTestPeriodLabel(item) : item.date;

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
                slotIndex: getScheduledSlotIndex(item),
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
  const MIN_TIMELINE_YEAR = 2024;
  const MAX_TIMELINE_YEAR = 2030;
  const defaultYear = Math.max(MIN_TIMELINE_YEAR, Math.min(MAX_TIMELINE_YEAR, currentYear));
  const baseYearOptions = Array.from({ length: MAX_TIMELINE_YEAR - MIN_TIMELINE_YEAR + 1 }, (_, index) => MIN_TIMELINE_YEAR + index);

  const [selectedCategory, setSelectedCategory] = useState<HeatmapCategory>('Audit');
  const [selectedActivityId, setSelectedActivityId] = useState<string | null>(null);
  const [timelineCategoryFilter, setTimelineCategoryFilter] = useState<HeatmapCategoryFilter>('Semua');
  const [timelineBranchFilter, setTimelineBranchFilter] = useState<HeatmapBranchFilter>('Semua');
  const [timelineYear, setTimelineYear] = useState(defaultYear);
  const [customYearOptions, setCustomYearOptions] = useState<number[]>([]);
  const [yearEditorTarget, setYearEditorTarget] = useState<'detail' | 'heatmap' | null>(null);
  const [yearDraft, setYearDraft] = useState('');
  const [selectedDetailBranch, setSelectedDetailBranch] = useState<BranchLabel>('Cabang Surabaya');
  const [selectedTestPeriodKey, setSelectedTestPeriodKey] = useState('');
  const [statusDraft, setStatusDraft] = useState<'Terlaksana' | 'Perlu Tindak Lanjut'>('Terlaksana');
  const [locationDraft, setLocationDraft] = useState<string>('Cabang Surabaya');
  const [completedAtDraft, setCompletedAtDraft] = useState(getTodayInputValue());
  const [completionNoteDraft, setCompletionNoteDraft] = useState('');
  const [inspectorNamesDraft, setInspectorNamesDraft] = useState('');
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const [isEditingRecordedActivity, setIsEditingRecordedActivity] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDeletingHeatmap, setIsDeletingHeatmap] = useState(false);
  const [feedback, setFeedback] = useState<{ tone: 'success' | 'error'; message: string } | null>(null);
  const [selectedHeatmapSelection, setSelectedHeatmapSelection] = useState<HeatmapSelection | null>(null);
  const [heatmapDeleteTarget, setHeatmapDeleteTarget] = useState<HeatmapDeleteTarget | null>(null);
  const evidenceInputRef = useRef<HTMLInputElement | null>(null);

  const yearOptions = [...baseYearOptions, ...customYearOptions.filter((year) => !baseYearOptions.includes(year))];
  const parsedYearDraft = Number(yearDraft);
  const canSaveCustomYear = /^\d{4}$/.test(yearDraft.trim()) && Number.isInteger(parsedYearDraft) && parsedYearDraft >= 2000 && parsedYearDraft <= 2100;

  useEffect(() => {
    setTimelineYear((currentValue) => (yearOptions.includes(currentValue) ? currentValue : defaultYear));
  }, [defaultYear, yearOptions]);

  function handleYearSelectChange(value: string, target: 'detail' | 'heatmap') {
    if (value === '__add_year__') {
      setYearEditorTarget(target);
      setYearDraft('');
      return;
    }

    setTimelineYear(Number(value));
    setYearEditorTarget(null);
    setYearDraft('');
  }

  function handleSaveCustomYear() {
    if (!canSaveCustomYear) {
      return;
    }

    setCustomYearOptions((currentOptions) =>
      currentOptions.includes(parsedYearDraft) ? currentOptions : [...currentOptions, parsedYearDraft]
    );
    setTimelineYear(parsedYearDraft);
    setYearEditorTarget(null);
    setYearDraft('');
  }

  useEffect(() => {
    setSelectedHeatmapSelection(null);
  }, [timelineBranchFilter, timelineCategoryFilter, timelineYear, searchQuery]);

  useEffect(() => {
    if (!selectedHeatmapSelection) {
      setHeatmapDeleteTarget(null);
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
  const detailBranchOptions = CATEGORY_BRANCHES[selectedCategory];

  useEffect(() => {
    setSelectedDetailBranch((currentBranch) =>
      detailBranchOptions.includes(currentBranch) ? currentBranch : detailBranchOptions[0]
    );
  }, [detailBranchOptions]);

  const testPeriodOptions = TEST_PERIOD_MONTHS.map((month) => ({
    key: `${timelineYear}-${String(month).padStart(2, '0')}`,
    label: buildTestPeriodLabel(month, timelineYear),
  }));

  useEffect(() => {
    if (selectedCategory !== 'Tes Keamanan') {
      setSelectedTestPeriodKey('');
      return;
    }

    const firstUnlockedPeriodKey =
      testPeriodOptions.find(
        (option) =>
          !testsByCategory['Tes Keamanan'].some(
            (item) =>
              item.scheduleYear === timelineYear &&
              getTestPeriodKey(item) === option.key &&
              hasRecordedExecution(item)
          )
      )?.key ?? testPeriodOptions[0]?.key ?? '';

    setSelectedTestPeriodKey((currentKey) =>
      testPeriodOptions.some((option) => option.key === currentKey) ? currentKey : firstUnlockedPeriodKey
    );
  }, [selectedCategory, testPeriodOptions, testsByCategory, timelineYear]);

  const categoryActivities = testsByCategory[selectedCategory];
  const periodScopeActivities = (() => {
    if (selectedCategory === 'Audit') {
      return categoryActivities.filter((item) => matchesAuditWindow(item, timelineYear));
    }

    if (selectedCategory === 'Inspeksi') {
      return categoryActivities.filter((item) => matchesActivityYear(item, timelineYear));
    }

    return categoryActivities.filter(
      (item) => item.scheduleYear === timelineYear && (!selectedTestPeriodKey || getTestPeriodKey(item) === selectedTestPeriodKey)
    );
  })();
  const branchScopeActivities = periodScopeActivities.filter(
    (item) => normalizeBranch(item.location ?? item.owner) === selectedDetailBranch
  );
  const recordedScopeActivities = branchScopeActivities
    .filter((item) => hasRecordedExecution(item))
    .sort((left, right) => getSortValue(right) - getSortValue(left));
  const detailRuleLocked = recordedScopeActivities.length > 0;
  const fallbackTemplateActivity =
    branchScopeActivities[0] ??
    periodScopeActivities.find((item) => !hasRecordedExecution(item)) ??
    periodScopeActivities[0] ??
    null;
  const virtualTemplateActivity: TemplateTestItem | null =
    detailRuleLocked || fallbackTemplateActivity
      ? null
      : (() => {
          if (selectedCategory === 'Tes Keamanan' && !selectedTestPeriodKey) {
            return null;
          }

          const scheduleMonth =
            selectedCategory === 'Tes Keamanan' ? Number(selectedTestPeriodKey.split('-')[1] ?? 0) || null : null;
          const scheduleWeek = selectedCategory === 'Tes Keamanan' ? 1 : null;
          const title =
            selectedCategory === 'Audit'
              ? 'Audit Internal Keamanan'
              : selectedCategory === 'Inspeksi'
                ? 'Inspeksi Keamanan'
                : 'Tes Keamanan';
          const dateLabel =
            selectedCategory === 'Tes Keamanan'
              ? buildTestPeriodLabel(scheduleMonth ?? 2, timelineYear)
              : selectedCategory === 'Audit'
                ? '1 kali dalam 2 tahun (internal)'
                : `1 kali dalam tahun ${timelineYear} (lokasi pelaksanaan menyesuaikan program pengawasan)`;

          return {
            id: `virtual:${selectedCategory}:${selectedDetailBranch}:${timelineYear}:${scheduleMonth ?? 'na'}`,
            title,
            category: selectedCategory,
            owner: selectedDetailBranch,
            location: selectedDetailBranch,
            inspector: 'Arif Hartono, Adhe Rafika Yulianti',
            date: dateLabel,
            score: 'Belum ada evidence',
            status: 'Terjadwal',
            completedAt: null,
            completedAtIso: null,
            completionNote: null,
            sourceDocument: `Jadwal Kegiatan Pengawasan Keamanan - Tahun ${timelineYear}.pdf`,
            scheduleYear: timelineYear,
            scheduleMonth,
            scheduleWeek,
            evidenceFiles: [],
            template: {
              title,
              category: selectedCategory,
              scheduleLabel:
                selectedCategory === 'Tes Keamanan'
                  ? `Minggu I ${buildTestPeriodLabel(scheduleMonth ?? 2, timelineYear)}`
                  : dateLabel,
              scheduleYear: timelineYear,
              scheduleMonth,
              scheduleWeek,
              sourceDocument: `Jadwal Kegiatan Pengawasan Keamanan - Tahun ${timelineYear}.pdf`,
              inspectorNames: ['Arif Hartono', 'Adhe Rafika Yulianti'],
            },
          };
        })();
  const prioritizedCategoryActivities = (
    detailRuleLocked
      ? recordedScopeActivities
      : fallbackTemplateActivity
        ? [fallbackTemplateActivity]
        : virtualTemplateActivity
          ? [virtualTemplateActivity]
          : []
  ).sort((left, right) => (detailRuleLocked ? getSortValue(right) - getSortValue(left) : comparePendingActivities(left, right)));

  useEffect(() => {
    if (prioritizedCategoryActivities.some((item) => item.id === selectedActivityId)) {
      return;
    }

    setSelectedActivityId(prioritizedCategoryActivities[0]?.id ?? null);
  }, [prioritizedCategoryActivities, selectedActivityId]);

  const selectedActivity =
    prioritizedCategoryActivities.find((item) => item.id === selectedActivityId) ?? prioritizedCategoryActivities[0] ?? null;
  const selectedExecutionDateLabel = formatShortDate(completedAtDraft);
  const storedEvidenceFiles =
    selectedActivity?.evidenceFiles.filter((file) => toDateOnlyValue(file.executionDateIso) === completedAtDraft) ?? [];
  const selectedHeatmapItems = selectedHeatmapSelection?.entries ?? [];
  const selectedActivityHasInput = Boolean(selectedActivity) && detailRuleLocked;
  const selectedTestPeriodLabel =
    testPeriodOptions.find((option) => option.key === selectedTestPeriodKey)?.label ?? 'periode tes keamanan yang dipilih';
  const detailRuleDescription =
    selectedCategory === 'Audit'
      ? selectedActivityHasInput
        ? `Audit ${selectedDetailBranch} untuk rentang ${timelineYear - 1}-${timelineYear} sudah tersimpan. Gunakan tombol Edit jika perlu koreksi data.`
        : `Audit ${selectedDetailBranch} hanya dapat diinput 1 kali dalam rentang ${timelineYear - 1}-${timelineYear}.`
      : selectedCategory === 'Inspeksi'
        ? selectedActivityHasInput
          ? `Inspeksi ${selectedDetailBranch} tahun ${timelineYear} sudah tersimpan. Gunakan tombol Edit jika perlu koreksi data.`
          : `Inspeksi ${selectedDetailBranch} hanya dapat diinput 1 kali pada tahun ${timelineYear}.`
        : selectedActivityHasInput
          ? `Tes keamanan ${selectedDetailBranch} untuk ${selectedTestPeriodLabel.toLowerCase()} sudah tersimpan. Gunakan tombol Edit jika perlu koreksi data.`
          : `Tes keamanan ${selectedDetailBranch} hanya dapat diinput 1 kali pada ${selectedTestPeriodLabel.toLowerCase()}.`;
  const selectedActivityInspectorNames =
    selectedActivity?.inspector && selectedActivity.inspector !== '-'
      ? selectedActivity.inspector
          .split(/\s*,\s*/)
          .map((name) => name.trim())
          .filter(Boolean)
      : [];
  const selectedActivityDocuments = selectedActivityHasInput ? selectedActivity?.evidenceFiles ?? [] : storedEvidenceFiles;
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
      setIsEditingRecordedActivity(false);
      if (evidenceInputRef.current) {
        evidenceInputRef.current.value = '';
      }
      return;
    }

    if (selectedActivityHasInput) {
      setStatusDraft(selectedActivity.status === 'Perlu Tindak Lanjut' ? 'Perlu Tindak Lanjut' : 'Terlaksana');
      setLocationDraft(normalizeBranch(selectedActivity.location ?? selectedActivity.owner));
      setCompletedAtDraft(toDateInputValue(selectedActivity.completedAtIso));
      setCompletionNoteDraft(selectedActivity.completionNote ?? '');
    } else {
      setStatusDraft('Terlaksana');
      setLocationDraft(selectedDetailBranch);
      setCompletedAtDraft(getTodayInputValue());
      setCompletionNoteDraft('');
    }

    setInspectorNamesDraft(selectedActivity.inspector === '-' ? '' : selectedActivity.inspector.split(/\s*,\s*/).join('\n'));
    setPendingFiles([]);
    setFeedback(null);
    setIsEditingRecordedActivity(false);

    if (evidenceInputRef.current) {
      evidenceInputRef.current.value = '';
    }
  }, [selectedActivity, selectedActivityHasInput, selectedDetailBranch]);

  const heatmapRows = buildHeatmapRows(timelineYear);
  const filteredHeatmapRows = (() => {
    const visibleBranches =
      timelineBranchFilter === 'Semua'
        ? BRANCH_FILTERS
        : ([timelineBranchFilter] as BranchLabel[]);
    const visibleCategories =
      timelineCategoryFilter === 'Semua'
        ? CATEGORY_FILTERS
        : ([timelineCategoryFilter] as HeatmapCategory[]);
    const visibleCategorySet = new Set<HeatmapCategory>(visibleCategories);
    const visibleBranchSet = new Set<BranchLabel>(visibleBranches);

    return heatmapRows.filter((row) => {
      if (row.isSpacer) {
        return false;
      }

      if (row.isGroup && row.category) {
        return visibleCategorySet.has(row.category);
      }

      if (row.isBranch && row.category) {
        return visibleCategorySet.has(row.category) && visibleBranchSet.has(row.label as BranchLabel);
      }

      return false;
    });
  })();

  const hasHeatmapData = filteredHeatmapRows.some((row) => row.isBranch && row.cells.some((cell) => cell.level > 0));

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!selectedActivity) {
      return;
    }

    try {
      setIsSubmitting(true);
      setFeedback(null);

      const updatedActivity = await onUpdateActivity({
        activityId: selectedActivity.id,
        status: statusDraft,
        location: locationDraft,
        completedAt: completedAtDraft,
        completionNote: completionNoteDraft,
        inspectorNames: parseInspectorNames(inspectorNamesDraft),
        template: isTemplateTestItem(selectedActivity) ? selectedActivity.template : undefined,
      });
      setSelectedActivityId(updatedActivity.id);

      if (pendingFiles.length) {
        await onUploadEvidence(updatedActivity.id, pendingFiles);
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
      setIsEditingRecordedActivity(false);
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

  async function handleConfirmHeatmapDelete() {
    if (!heatmapDeleteTarget) {
      return;
    }

    const targetIds =
      heatmapDeleteTarget.mode === 'entry'
        ? [heatmapDeleteTarget.activityId]
        : Array.from(new Set(heatmapDeleteTarget.activityIds));

    if (!targetIds.length) {
      setHeatmapDeleteTarget(null);
      return;
    }

    try {
      setIsDeletingHeatmap(true);
      setFeedback(null);
      await onDeleteActivities(targetIds);

      if (heatmapDeleteTarget.mode === 'entry') {
        setSelectedHeatmapSelection((currentSelection) => {
          if (!currentSelection) {
            return null;
          }

          const nextEntries = currentSelection.entries.filter((entry) => entry.item.id !== heatmapDeleteTarget.activityId);
          if (!nextEntries.length) {
            return null;
          }

          return {
            ...currentSelection,
            entries: nextEntries,
          };
        });
        setFeedback({
          tone: 'success',
          message: 'Agenda heatmap berhasil dihapus.',
        });
      } else {
        setSelectedHeatmapSelection(null);
        setFeedback({
          tone: 'success',
          message: 'Detail heatmap berhasil dihapus.',
        });
      }

      setHeatmapDeleteTarget(null);
    } catch (error) {
      setFeedback({
        tone: 'error',
        message: error instanceof Error ? error.message : 'Gagal menghapus agenda heatmap.',
      });
    } finally {
      setIsDeletingHeatmap(false);
    }
  }

  return (
    <section className="security-program-section flex min-w-0 w-full max-w-none flex-col gap-4 sm:gap-5 md:gap-6">
      <div className="rounded-[26px] border border-slate-200/80 bg-white/95 px-4 py-5 shadow-[0_18px_50px_rgba(15,23,42,0.08)] backdrop-blur sm:rounded-[30px] sm:px-6 sm:py-6 md:px-8 md:py-8">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0 max-w-3xl">
            <p className="text-xs font-semibold uppercase tracking-[0.32em] text-slate-400">Program Pengawasan Keamanan</p>
            <h2 className="mt-3 break-words text-[1.9rem] font-semibold tracking-[-0.04em] text-slate-900 sm:text-3xl md:text-[2.35rem]">
              Dashboard Jadwal Pengawasan Internal
            </h2>
            <p className="mt-3 max-w-2xl text-sm leading-7 text-slate-500 sm:text-[15px] md:text-base">
              Klik card Audit, Inspeksi, atau Tes Keamanan untuk melihat agenda, memperbarui
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
          const items =
            category === 'Audit'
              ? testsByCategory[category].filter((item) => matchesAuditWindow(item, currentYear))
              : category === 'Inspeksi'
                ? testsByCategory[category].filter((item) => item.scheduleYear === currentYear)
                : testsByCategory[category].filter((item) => item.scheduleYear === currentYear);
          const completedCount = items.filter((item) => item.status === 'Terlaksana').length;
          const evidenceCount = items.reduce((total, item) => total + item.evidenceFiles.length, 0);
          const categoryStatus =
            category !== 'Tes Keamanan' && items.some((item) => hasRecordedExecution(item))
              ? ('Terlaksana' as StatusTag)
              : ('Terjadwal' as StatusTag);
          const lastCompleted = [...items].find((item) => Boolean(item.completedAtIso));

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

                  {category === 'Tes Keamanan' ? (
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
                      : 'Agenda tes keamanan berkala yang dapat diperbarui harian lengkap dengan bukti dokumen.'}
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
                  </>
                ) : null}

                {category === 'Tes Keamanan' ? (
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
          <div className="flex flex-col gap-3">
            <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_auto] xl:items-start">
              <div className="max-w-3xl xl:max-w-none">
                <p className="text-xs font-semibold uppercase tracking-[0.32em] text-slate-400">Detail Kategori</p>
                <h2 className="mt-2 text-[1.5rem] font-semibold tracking-[-0.04em] text-slate-900 sm:text-[1.8rem]">
                  Kelola pelaksanaan {selectedCategory.toLowerCase()}
                </h2>
              </div>

              <div
                className={`grid gap-3 sm:grid-cols-2 xl:justify-self-end xl:self-start ${
                  selectedCategory === 'Tes Keamanan' ? 'xl:grid-cols-3' : 'xl:grid-cols-2'
                }`}
              >
                <label className="grid gap-2 xl:min-w-[160px]">
                  <span className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Tahun</span>
                  <select
                    value={timelineYear}
                    onChange={(event) => handleYearSelectChange(event.target.value, 'detail')}
                    className="h-11 min-w-[160px] rounded-[16px] border border-slate-200 bg-white px-3.5 text-sm font-medium text-slate-700 outline-none transition focus:border-slate-300"
                  >
                    {yearOptions.map((year) => (
                      <option key={year} value={year}>
                        {year}
                      </option>
                    ))}
                    <option value="__add_year__">Tambah tahun lain...</option>
                  </select>
                  {yearEditorTarget === 'detail' ? (
                    <div className="grid gap-2 rounded-[16px] border border-slate-200 bg-slate-50 p-2.5">
                      <input
                        type="number"
                        min={2000}
                        max={2100}
                        step={1}
                        inputMode="numeric"
                        placeholder="Masukkan tahun"
                        value={yearDraft}
                        onChange={(event) => setYearDraft(event.target.value)}
                        className="h-10 rounded-[12px] border border-slate-200 bg-white px-3 text-sm font-medium text-slate-700 outline-none transition focus:border-slate-300"
                      />
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={handleSaveCustomYear}
                          disabled={!canSaveCustomYear}
                          className="inline-flex h-9 items-center justify-center rounded-[12px] bg-slate-900 px-3 text-xs font-semibold text-white transition disabled:cursor-not-allowed disabled:opacity-40"
                        >
                          Simpan
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setYearEditorTarget(null);
                            setYearDraft('');
                          }}
                          className="inline-flex h-9 items-center justify-center rounded-[12px] border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-600 transition hover:bg-slate-50"
                        >
                          Batal
                        </button>
                      </div>
                    </div>
                  ) : null}
                </label>

                <label className="grid gap-2 xl:min-w-[220px]">
                  <span className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Wilayah</span>
                  <select
                    value={selectedDetailBranch}
                    onChange={(event) => setSelectedDetailBranch(event.target.value as BranchLabel)}
                    className="h-11 min-w-[220px] rounded-[16px] border border-slate-200 bg-white px-3.5 text-sm font-medium text-slate-700 outline-none transition focus:border-slate-300"
                  >
                    {detailBranchOptions.map((branch) => (
                      <option key={branch} value={branch}>
                        {branch}
                      </option>
                    ))}
                  </select>
                </label>

                {selectedCategory === 'Tes Keamanan' ? (
                  <label className="grid gap-2 xl:min-w-[240px]">
                    <span className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Periode Tes</span>
                    <select
                      value={selectedTestPeriodKey}
                      onChange={(event) => setSelectedTestPeriodKey(event.target.value)}
                      className="h-11 min-w-[240px] rounded-[16px] border border-slate-200 bg-white px-3.5 text-sm font-medium text-slate-700 outline-none transition focus:border-slate-300"
                    >
                      {testPeriodOptions.map((option) => (
                        <option key={option.key} value={option.key}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </label>
                ) : null}
              </div>
            </div>

            <div className="max-w-3xl">
              <p className="text-sm leading-7 text-slate-500 sm:text-[15px]">Pengisian data program kerja pengawasan internal</p>
              <p className="mt-2 text-sm font-medium text-slate-600">{detailRuleDescription}</p>
            </div>
          </div>
        </div>

        <div className="px-4 py-5 sm:px-6 sm:py-6 md:px-8">
          <article className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-[0_12px_32px_rgba(15,23,42,0.06)] sm:p-6">
            {selectedActivity ? (
              selectedActivityHasInput && !isEditingRecordedActivity ? (
                <div className="space-y-5">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-400">Informasi Agenda</p>
                      <h3 className="mt-2 text-xl font-semibold tracking-[-0.03em] text-slate-900">{selectedActivity.title}</h3>
                      <p className="mt-2 text-sm leading-6 text-slate-500">
                        {locationDraft} · {getActivityDateLabel(selectedActivity)}
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center justify-end gap-3">
                      <button
                        type="button"
                        onClick={() => setIsEditingRecordedActivity(true)}
                        className="inline-flex h-10 items-center justify-center rounded-[14px] border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                      >
                        Edit
                      </button>
                      <StatusBadge status={selectedActivity.status} />
                    </div>
                  </div>

                  <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                    <div className="rounded-[18px] border border-slate-200 bg-slate-50 px-4 py-4">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-400">Status Pelaksanaan</p>
                      <strong className="mt-2.5 block text-base font-semibold text-slate-900">{selectedActivity.status}</strong>
                    </div>
                    <div className="rounded-[18px] border border-slate-200 bg-slate-50 px-4 py-4">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-400">Tanggal Pelaksanaan</p>
                      <strong className="mt-2.5 block text-base font-semibold text-slate-900">
                        {selectedActivity.completedAt ?? 'Belum ada tanggal tersimpan'}
                      </strong>
                    </div>
                    <div className="rounded-[18px] border border-slate-200 bg-slate-50 px-4 py-4">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-400">Lokasi Pelaksanaan</p>
                      <strong className="mt-2.5 block text-base font-semibold text-slate-900">{locationDraft}</strong>
                    </div>
                    <div className="rounded-[18px] border border-slate-200 bg-slate-50 px-4 py-4">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-400">Dokumen Tersimpan</p>
                      <strong className="mt-2.5 block text-base font-semibold text-slate-900">{selectedActivityDocuments.length} file</strong>
                    </div>
                  </div>

                  <div className="grid gap-4 lg:grid-cols-2">
                    <div className="rounded-[20px] border border-slate-200 bg-white px-4 py-4">
                      <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-400">Catatan Pelaksanaan</p>
                      <p className="mt-3 text-sm leading-7 text-slate-600">
                        {selectedActivity.completionNote?.trim() || 'Belum ada catatan tambahan untuk agenda ini.'}
                      </p>
                    </div>
                    <div className="rounded-[20px] border border-slate-200 bg-white px-4 py-4">
                      <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-400">Daftar Inspektor Internal</p>
                      {selectedActivityInspectorNames.length ? (
                        <div className="mt-3 flex flex-wrap gap-2">
                          {selectedActivityInspectorNames.map((name) => (
                            <span
                              key={name}
                              className="inline-flex items-center rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-sm font-medium text-slate-700"
                            >
                              {name}
                            </span>
                          ))}
                        </div>
                      ) : (
                        <p className="mt-3 text-sm leading-7 text-slate-600">Belum ada nama inspektor tersimpan.</p>
                      )}
                    </div>
                  </div>

                  <div className="rounded-[20px] border border-slate-200 bg-slate-50 px-4 py-4">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-400">Dokumen Pelaksanaan</p>
                        <p className="mt-2 text-sm text-slate-500">
                          {selectedActivityDocuments.length
                            ? 'Dokumen yang sudah terhubung ke agenda pelaksanaan ini.'
                            : 'Agenda sudah tercatat, tetapi belum ada dokumen evidence yang terhubung.'}
                        </p>
                      </div>
                      <span className="data-chip">{selectedActivityDocuments.length} file</span>
                    </div>

                    <div className="mt-4 space-y-2">
                      {selectedActivityDocuments.length ? (
                        selectedActivityDocuments.map((file) => (
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
                        <div className="empty-inline">Belum ada dokumen evidence pada agenda yang sudah tersimpan ini.</div>
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
                </div>
              ) : (
                <form onSubmit={handleSubmit} className="space-y-5">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-400">
                        {selectedActivityHasInput ? 'Edit Agenda' : 'Form Update'}
                      </p>
                      <h3 className="mt-2 text-xl font-semibold tracking-[-0.03em] text-slate-900">{selectedActivity.title}</h3>
                      <p className="mt-2 text-sm leading-6 text-slate-500">
                        {locationDraft} · {getActivityDateLabel(selectedActivity)}
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center justify-end gap-3">
                      {selectedActivityHasInput ? (
                        <button
                          type="button"
                          onClick={() => {
                            setIsEditingRecordedActivity(false);
                            setPendingFiles([]);
                            setFeedback(null);
                            if (evidenceInputRef.current) {
                              evidenceInputRef.current.value = '';
                            }
                          }}
                          className="inline-flex h-10 items-center justify-center rounded-[14px] border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                        >
                          Batal Edit
                        </button>
                      ) : null}
                      <StatusBadge status={selectedActivity.status} />
                    </div>
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
                        : 'Pilih dokumen audit, inspeksi, atau tes keamanan yang dibuat pada hari pelaksanaan.'}
                    </span>
                  </div>

                  <div className="flex flex-wrap items-center justify-end gap-3">
                    <button
                      type="submit"
                      disabled={isSubmitting}
                      className="inline-flex h-11 items-center justify-center rounded-[16px] bg-slate-900 px-5 text-sm font-semibold text-white shadow-[0_12px_24px_rgba(15,23,42,0.18)] transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-70"
                    >
                      {isSubmitting ? 'Menyimpan...' : selectedActivityHasInput ? 'Simpan Perubahan' : 'Simpan Dokumen'}
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
              )
            ) : (
              <div className="flex h-full min-h-[280px] items-center justify-center rounded-[20px] border border-dashed border-slate-200 bg-slate-50 px-6 text-center">
                <div className="empty-inline">
                  {selectedCategory === 'Tes Keamanan'
                    ? `Belum ada agenda tes keamanan ${selectedDetailBranch} untuk ${selectedTestPeriodLabel.toLowerCase()}.`
                    : `Belum ada agenda ${selectedCategory.toLowerCase()} ${selectedDetailBranch} untuk periode yang dipilih.`}
                </div>
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
                Klik kotak biru tua untuk melihat detail agenda terlaksana.
              </p>
            </div>

            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              <label className="grid gap-2">
                <span className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Kategori</span>
                <select
                  value={timelineCategoryFilter}
                  onChange={(event) => setTimelineCategoryFilter(event.target.value as HeatmapCategoryFilter)}
                  className="h-11 min-w-[220px] rounded-[16px] border border-slate-200 bg-white px-3.5 text-sm font-medium text-slate-700 outline-none transition focus:border-slate-300"
                >
                  {(['Semua', ...CATEGORY_FILTERS] as const).map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              </label>

              <label className="grid gap-2">
                <span className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Wilayah</span>
                <select
                  value={timelineBranchFilter}
                  onChange={(event) => setTimelineBranchFilter(event.target.value as HeatmapBranchFilter)}
                  className="h-11 min-w-[220px] rounded-[16px] border border-slate-200 bg-white px-3.5 text-sm font-medium text-slate-700 outline-none transition focus:border-slate-300"
                >
                  {(['Semua', ...BRANCH_FILTERS] as const).map((option) => (
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
                  onChange={(event) => handleYearSelectChange(event.target.value, 'heatmap')}
                  className="h-11 min-w-[160px] rounded-[16px] border border-slate-200 bg-white px-3.5 text-sm font-medium text-slate-700 outline-none transition focus:border-slate-300"
                >
                  {yearOptions.map((year) => (
                    <option key={year} value={year}>
                      {year}
                    </option>
                  ))}
                  <option value="__add_year__">Tambah tahun lain...</option>
                </select>
                {yearEditorTarget === 'heatmap' ? (
                  <div className="grid gap-2 rounded-[16px] border border-slate-200 bg-slate-50 p-2.5">
                    <input
                      type="number"
                      min={2000}
                      max={2100}
                      step={1}
                      inputMode="numeric"
                      placeholder="Masukkan tahun"
                      value={yearDraft}
                      onChange={(event) => setYearDraft(event.target.value)}
                      className="h-10 rounded-[12px] border border-slate-200 bg-white px-3 text-sm font-medium text-slate-700 outline-none transition focus:border-slate-300"
                    />
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={handleSaveCustomYear}
                        disabled={!canSaveCustomYear}
                        className="inline-flex h-9 items-center justify-center rounded-[12px] bg-slate-900 px-3 text-xs font-semibold text-white transition disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        Simpan
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setYearEditorTarget(null);
                          setYearDraft('');
                        }}
                        className="inline-flex h-9 items-center justify-center rounded-[12px] border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-600 transition hover:bg-slate-50"
                      >
                        Batal
                      </button>
                    </div>
                  </div>
                ) : null}
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

                <div className="flex items-center justify-end gap-3 self-end md:self-start">
                  <button
                    type="button"
                    onClick={() =>
                      setHeatmapDeleteTarget({
                        mode: 'selection',
                        activityIds: selectedHeatmapItems.map((entry) => entry.item.id),
                        branch: selectedHeatmapSelection.branch,
                        count: Array.from(new Set(selectedHeatmapItems.map((entry) => entry.item.id))).length,
                      })
                    }
                    disabled={isDeletingHeatmap || !selectedHeatmapItems.length}
                    className="inline-flex h-11 items-center justify-center gap-2 rounded-[16px] border border-rose-200 bg-rose-50 px-4 text-sm font-semibold text-rose-700 transition hover:bg-rose-100 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <TrashIcon className="h-4 w-4" />
                    Hapus
                  </button>
                  <button
                    type="button"
                    onClick={() => setSelectedHeatmapSelection(null)}
                    className="inline-flex h-11 items-center justify-center rounded-[16px] border border-slate-200 bg-slate-50 px-4 text-sm font-semibold text-slate-700 transition hover:bg-white"
                  >
                    Tutup
                  </button>
                </div>
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
                    : item.completedAt ?? getActivityDateLabel(item);
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
                              {item.owner} · {getActivityDateLabel(item)}
                            </p>
                          </div>

                          <div className="flex flex-wrap items-center justify-end gap-2">
                            <button
                              type="button"
                              onClick={() =>
                                setHeatmapDeleteTarget({
                                  mode: 'entry',
                                  activityId: item.id,
                                  title: item.title,
                                })
                              }
                              disabled={isDeletingHeatmap}
                              className="inline-flex items-center gap-2 rounded-full border border-rose-200/20 bg-rose-500/10 px-3 py-1.5 text-sm font-semibold text-rose-100 transition hover:bg-rose-500/20 disabled:cursor-not-allowed disabled:opacity-50"
                            >
                              <TrashIcon className="h-4 w-4" />
                              Hapus
                            </button>
                            <span className="inline-flex rounded-full bg-emerald-50 px-3 py-1.5 text-sm font-semibold text-emerald-700 ring-1 ring-inset ring-emerald-200">
                              {item.status}
                            </span>
                          </div>
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

      {heatmapDeleteTarget ? (
        <div
          className="fixed inset-0 z-[130] grid place-items-center bg-slate-950/40 p-4 backdrop-blur-[6px]"
          onClick={() => (isDeletingHeatmap ? null : setHeatmapDeleteTarget(null))}
        >
          <div className="delete-confirm-modal" role="dialog" aria-modal="true" onClick={(event) => event.stopPropagation()}>
            <button
              type="button"
              className="delete-confirm-close"
              aria-label="Tutup dialog hapus agenda heatmap"
              onClick={() => setHeatmapDeleteTarget(null)}
              disabled={isDeletingHeatmap}
            >
              <CloseIcon className="mini-icon" />
            </button>

            <div className="delete-confirm-copy">
              <h3 className="delete-confirm-title">
                {heatmapDeleteTarget.mode === 'entry' ? 'Hapus card agenda ini?' : 'Hapus detail heatmap ini?'}
              </h3>
              <p className="delete-confirm-text">
                {heatmapDeleteTarget.mode === 'entry'
                  ? `${heatmapDeleteTarget.title} beserta evidence terkait akan dihapus dari heatmap dan daftar dokumen.`
                  : `${heatmapDeleteTarget.count} agenda pada detail heatmap ${heatmapDeleteTarget.branch} beserta evidence terkait akan dihapus dari heatmap dan daftar dokumen.`}
              </p>
            </div>

            <div className="delete-confirm-actions">
              <button
                type="button"
                className="action-pill is-ghost delete-confirm-cancel"
                onClick={() => setHeatmapDeleteTarget(null)}
                disabled={isDeletingHeatmap}
              >
                Batal
              </button>
              <button
                type="button"
                className="action-pill action-pill--danger delete-confirm-submit"
                onClick={handleConfirmHeatmapDelete}
                disabled={isDeletingHeatmap}
              >
                {isDeletingHeatmap ? 'Menghapus...' : heatmapDeleteTarget.mode === 'entry' ? 'Hapus Card' : 'Hapus Detail'}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}
