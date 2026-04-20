import { useEffect, useMemo, useRef, useState } from 'react';
import { CalendarDays, Pencil, Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { apiFetch } from '@/lib/api';
import { toast } from '@/hooks/use-toast';

type SessionItem = {
  id: string;
  scope: string;
  title: string | null;
  start_date: string;
  end_date: string;
  is_published: boolean;
  users?: Array<{ id: string; name: string; email?: string }>;
  question_category_counts?: Record<string, number>;
  areas?: string[];
};

type QuestionCategory = {
  id: string;
  scope: string;
  name: string;
  prefix: string;
  is_active: boolean;
  sort_order: number;
  users?: Array<{ id: string; name: string; email?: string }>;
};

type AreaCategory = {
  id: string;
  scope: string;
  name: string;
  is_active?: boolean;
  sort_order?: number;
};

type UserItem = {
  id: string;
  name: string;
  email: string | null;
  role: string;
  status: string;
};

const DEFAULT_SCOPE_OPTIONS = [
  { value: 'audit', label: 'Audit' },
  { value: 'inspeksi', label: 'Inspeksi' },
  { value: 'surveillance', label: 'Surveillance' },
];

type ScopeOption = { value: string; label: string };

type SelfAssessmentSessionsProps = {
  initialScope?: string;
  scopeOptions?: ScopeOption[];
  lockScope?: boolean;
  title?: string;
  description?: string;
};

const resolveInitialScope = (options: ScopeOption[], initialScope?: string) => {
  if (initialScope && options.some((item) => item.value === initialScope)) {
    return initialScope;
  }
  return options[0]?.value ?? 'audit';
};

const formatDateLabel = (value: string) => {
  if (!value) {
    return '';
  }
  const trimmed = value.trim();
  const datePart = trimmed.split('T')[0] ?? trimmed;
  return datePart.length > 10 ? datePart.slice(0, 10) : datePart;
};

const formatDateDisplayId = (value: string) => {
  const normalized = formatDateLabel(value);
  if (!normalized) return '-';
  const parsed = new Date(`${normalized}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) return normalized;
  return parsed.toLocaleDateString('id-ID', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  });
};

export function SelfAssessmentSessions({
  initialScope,
  scopeOptions,
  lockScope = false,
  title,
  description,
}: SelfAssessmentSessionsProps) {
  const resolvedScopeOptions = useMemo(
    () => (scopeOptions && scopeOptions.length > 0 ? scopeOptions : DEFAULT_SCOPE_OPTIONS),
    [scopeOptions]
  );
  const [scope, setScope] = useState(() =>
    resolveInitialScope(resolvedScopeOptions, initialScope)
  );
  const [sessions, setSessions] = useState<SessionItem[]>([]);
  const [questionCategories, setQuestionCategories] = useState<QuestionCategory[]>([]);
  const [areaCategories, setAreaCategories] = useState<AreaCategory[]>([]);
  const [selectedAreas, setSelectedAreas] = useState<string[]>([]);
  const [activeArea, setActiveArea] = useState('');
  const [areaCategorySelections, setAreaCategorySelections] = useState<
    Record<string, string[]>
  >({});
  const [sessionAreas, setSessionAreas] = useState<string[]>([]);
  const [sessionAreaItems, setSessionAreaItems] = useState<
    Array<{ id: string; category: string }>
  >([]);
  const [availableCategoryIdsByArea, setAvailableCategoryIdsByArea] = useState<
    Record<string, string[]>
  >({});
  const [committedAreaSummaries, setCommittedAreaSummaries] = useState<
    Array<{ area: string; categoryCount: number }>
  >([]);
  const [availableCategoryIds, setAvailableCategoryIds] = useState<string[] | null>(null);
  const [users, setUsers] = useState<UserItem[]>([]);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [sessionForm, setSessionForm] = useState({
    title: '',
    teamLeader: '',
    teamMembers: '',
    teamAudity: '',
    startDate: '',
    endDate: '',
    isPublished: true,
  });
  const [editingSessionId, setEditingSessionId] = useState<string | null>(null);
  const [questionCategoryTarget, setQuestionCategoryTarget] = useState({
    userIds: [] as string[],
    categoryIds: [] as string[],
  });
  const [questionCategoryAssignments, setQuestionCategoryAssignments] = useState<
    Record<string, string[]>
  >({});
  const selectionSyncRef = useRef({ pending: false, userKey: '' });

  const scopeLabel = useMemo(
    () => resolvedScopeOptions.find((item) => item.value === scope)?.label ?? '',
    [resolvedScopeOptions, scope]
  );
  const targetUsers = useMemo(() => users, [users]);
  const categoryCountByUserId = useMemo(() => {
    const counts: Record<string, number> = {};
    Object.entries(questionCategoryAssignments).forEach(([userId, categoryIds]) => {
      counts[userId] = categoryIds.length;
    });
    return counts;
  }, [questionCategoryAssignments]);
  const questionCategoryTotal = questionCategories.length;
  const hasAreaOptions = areaCategories.length > 0;
  const hasSelectedAreas = selectedAreas.length > 0;
  const hasActiveArea = activeArea.length > 0;
  const hasActiveAreaCategories = useMemo(() => {
    if (!activeArea) {
      return false;
    }
    return Object.prototype.hasOwnProperty.call(availableCategoryIdsByArea, activeArea);
  }, [activeArea, availableCategoryIdsByArea]);
  const activeCategoryIds = useMemo(
    () => (activeArea ? areaCategorySelections[activeArea] ?? [] : []),
    [activeArea, areaCategorySelections]
  );
  const selectedCategoryIdsUnion = useMemo(() => {
    const merged = new Set<string>();
    selectedAreas.forEach((area) => {
      (areaCategorySelections[area] ?? []).forEach((id) => merged.add(id));
    });
    return Array.from(merged);
  }, [areaCategorySelections, selectedAreas]);
  const isAreaSelectionSynced = useMemo(() => {
    if (sessionAreas.length === 0) {
      return selectedAreas.length === 0;
    }
    if (sessionAreas.length !== selectedAreas.length) {
      return false;
    }
    const sessionSet = new Set(sessionAreas);
    return selectedAreas.every((area) => sessionSet.has(area));
  }, [selectedAreas, sessionAreas]);
  const canSubmitSession = sessionAreas.length > 0 && isAreaSelectionSynced;
  const availableCategoryIdSet = useMemo(() => {
    return hasSelectedAreas && availableCategoryIds ? new Set(availableCategoryIds) : null;
  }, [availableCategoryIds, hasSelectedAreas]);
  const activeAreaCategoryIdSet = useMemo(() => {
    if (!activeArea) {
      return null;
    }
    const ids = availableCategoryIdsByArea[activeArea] ?? [];
    return new Set(ids);
  }, [activeArea, availableCategoryIdsByArea]);
  const displayQuestionCategories = useMemo(() => {
    if (!hasAreaOptions || !activeAreaCategoryIdSet) {
      return [];
    }
    return questionCategories.filter((category) => activeAreaCategoryIdSet.has(category.id));
  }, [activeAreaCategoryIdSet, hasAreaOptions, questionCategories]);
  const sortedQuestionCategories = useMemo(() => {
    return [...displayQuestionCategories].sort((a, b) => {
      const prefixA = (a.prefix ?? '').toString();
      const prefixB = (b.prefix ?? '').toString();
      const prefixCompare = prefixA.localeCompare(prefixB, 'id', {
        sensitivity: 'base',
        numeric: true,
      });
      if (prefixCompare !== 0) return prefixCompare;
      return (a.name ?? '').toString().localeCompare((b.name ?? '').toString(), 'id', {
        sensitivity: 'base',
        numeric: true,
      });
    });
  }, [displayQuestionCategories]);

  const loadQuestionCategories = () => {
    apiFetch<{ data: QuestionCategory[] }>(
      `/api/admin/self-assessment/question-categories?scope=${scope}`
    )
      .then((response) => setQuestionCategories(response.data))
      .catch((error: Error) =>
        setErrorMessage(error.message || 'Gagal memuat kategori pertanyaan.')
      );
  };

  const loadAreaCategories = () => {
    apiFetch<{ data: AreaCategory[] }>(
      `/api/admin/self-assessment/categories?scope=${scope}`
    )
      .then((response) => {
        const items = response.data ?? [];
        setAreaCategories(items);
        setSelectedAreas((prev) =>
          prev.filter((area) => items.some((item) => item.name === area))
        );
        setSessionAreas((prev) =>
          prev.filter((area) => items.some((item) => item.name === area))
        );
        setCommittedAreaSummaries((prev) =>
          prev.filter((summary) => items.some((item) => item.name === summary.area))
        );
      })
      .catch((error: Error) =>
        setErrorMessage(error.message || 'Gagal memuat kategori area.')
      );
  };

  const loadSessions = () => {
    apiFetch<{ data: SessionItem[] }>(
      `/api/admin/self-assessment/sessions?scope=${scope}`
    )
      .then((response) => setSessions(response.data))
      .catch((error: Error) =>
        setErrorMessage(error.message || 'Gagal memuat sesi.')
      );
  };

  const loadUsers = () => {
    apiFetch<{ data: UserItem[] }>('/api/users?limit=200')
      .then((response) => setUsers(response.data))
      .catch((error: Error) =>
        setErrorMessage(error.message || 'Gagal memuat user.')
      );
  };

  const loadSessionAreas = (sessionId: string) => {
    return apiFetch<{ data: Array<{ id: string; category: string }> }>(
      `/api/admin/self-assessment/sessions/${sessionId}/areas`
    )
      .then((response) => {
        const items = response.data ?? [];
        setSessionAreaItems(items);
        const categories = items.map((item) => item.category).filter(Boolean);
        setSessionAreas(categories);
        setSelectedAreas(categories);
        setCommittedAreaSummaries([]);
      })
      .catch((error: Error) =>
        setErrorMessage(error.message || 'Gagal memuat area sesi.')
      );
  };

  useEffect(() => {
    setErrorMessage(null);
    setAreaCategories([]);
    setSelectedAreas([]);
    setActiveArea('');
    setSessionAreas([]);
    setSessionAreaItems([]);
    setCommittedAreaSummaries([]);
    setAvailableCategoryIds(null);
    setAvailableCategoryIdsByArea({});
    setAreaCategorySelections({});
    loadSessions();
    loadQuestionCategories();
    loadAreaCategories();
    setQuestionCategoryTarget({ userIds: [], categoryIds: [] });
    setQuestionCategoryAssignments({});
    selectionSyncRef.current = { pending: false, userKey: '' };
  }, [scope]);

  useEffect(() => {
    loadUsers();
  }, []);

  useEffect(() => {
    setScope(resolveInitialScope(resolvedScopeOptions, initialScope));
  }, [initialScope, resolvedScopeOptions]);

  useEffect(() => {
    if (!hasSelectedAreas) {
      setAvailableCategoryIds(null);
      return;
    }
    setAvailableCategoryIds(null);
    const areas = [...selectedAreas];
    const requests = areas.map((area) =>
      apiFetch<{ data: { categoryIds: string[] } }>(
        `/api/admin/self-assessment/question-categories/available?scope=${scope}&area=${encodeURIComponent(
          area
        )}`
      )
    );
    Promise.all(requests)
      .then((responses) => {
        const merged = new Set<string>();
        const byArea: Record<string, string[]> = {};
        responses.forEach((response, index) => {
          const ids = response.data?.categoryIds ?? [];
          ids.forEach((id) => merged.add(id));
          byArea[areas[index]] = ids;
        });
        setAvailableCategoryIdsByArea((prev) => ({ ...prev, ...byArea }));
        setAvailableCategoryIds(Array.from(merged));
      })
      .catch((error: Error) =>
        setErrorMessage(error.message || 'Gagal memuat kategori pertanyaan area.')
      );
  }, [hasSelectedAreas, scope, selectedAreas]);

  useEffect(() => {
    if (!activeArea) {
      return;
    }
    if (Object.prototype.hasOwnProperty.call(availableCategoryIdsByArea, activeArea)) {
      return;
    }
    apiFetch<{ data: { categoryIds: string[] } }>(
      `/api/admin/self-assessment/question-categories/available?scope=${scope}&area=${encodeURIComponent(
        activeArea
      )}`
    )
      .then((response) => {
        const ids = response.data?.categoryIds ?? [];
        setAvailableCategoryIdsByArea((prev) => ({ ...prev, [activeArea]: ids }));
      })
      .catch((error: Error) =>
        setErrorMessage(error.message || 'Gagal memuat kategori pertanyaan area.')
      );
  }, [activeArea, availableCategoryIdsByArea, scope]);

  useEffect(() => {
    const selectedUserIds = questionCategoryTarget.userIds;
    if (selectedUserIds.length === 0) {
      setQuestionCategoryTarget((prev) =>
        prev.categoryIds.length === 0 ? prev : { ...prev, categoryIds: [] }
      );
      setAreaCategorySelections((prev) => (Object.keys(prev).length === 0 ? prev : {}));
      selectionSyncRef.current = { pending: false, userKey: '' };
      return;
    }
    const userKey = [...selectedUserIds].sort().join('|');
    if (selectionSyncRef.current.userKey !== userKey) {
      selectionSyncRef.current.userKey = userKey;
      selectionSyncRef.current.pending = true;
    }
    if (!selectionSyncRef.current.pending) {
      return;
    }
    if (!hasSelectedAreas || !availableCategoryIdSet) {
      return;
    }
    const hasAllAreaCategories = selectedAreas.every((area) =>
      Object.prototype.hasOwnProperty.call(availableCategoryIdsByArea, area)
    );
    if (!hasAllAreaCategories) {
      return;
    }
    const availableScopeCategoryIds = new Set(
      questionCategories.map((category) => category.id)
    );
    const nextCategoryIds = Array.from(
      new Set(
        selectedUserIds.flatMap(
          (userId) => questionCategoryAssignments[userId] ?? []
        )
      )
    ).filter((categoryId) => availableScopeCategoryIds.has(categoryId));
    const filteredCategoryIds =
      hasSelectedAreas && availableCategoryIdSet
        ? nextCategoryIds.filter((categoryId) => availableCategoryIdSet.has(categoryId))
        : [];
    setAreaCategorySelections((prev) => {
      const next = { ...prev };
      selectedAreas.forEach((area) => {
        const allowedIds = availableCategoryIdsByArea[area] ?? [];
        next[area] = filteredCategoryIds.filter((categoryId) =>
          allowedIds.includes(categoryId)
        );
      });
      return next;
    });
    selectionSyncRef.current.pending = false;
  }, [
    availableCategoryIdSet,
    availableCategoryIdsByArea,
    hasSelectedAreas,
    questionCategories,
    questionCategoryAssignments,
    questionCategoryTarget.userIds,
    selectedAreas,
  ]);

  useEffect(() => {
    setQuestionCategoryTarget((prev) => {
      const sameLength = prev.categoryIds.length === selectedCategoryIdsUnion.length;
      const sameItems =
        sameLength &&
        prev.categoryIds.every((categoryId) => selectedCategoryIdsUnion.includes(categoryId));
      return sameItems ? prev : { ...prev, categoryIds: selectedCategoryIdsUnion };
    });
  }, [selectedCategoryIdsUnion]);

  const handleClearActiveArea = () => {
    setErrorMessage(null);
    setActiveArea('');
  };

  const validateAreaMappings = async (areas: string[]) => {
    const normalized = Array.from(
      new Set(areas.map((area) => area.trim()).filter((area) => area.length > 0))
    );
    if (normalized.length === 0) {
      return { invalidAreas: normalized, areaCategoryMap: {} as Record<string, string[]> };
    }

    const requests = normalized.map((area) =>
      apiFetch<{ data: { categoryIds: string[] } }>(
        `/api/admin/self-assessment/question-categories/available?scope=${scope}&area=${encodeURIComponent(
          area
        )}`
      )
    );

    const responses = await Promise.all(requests);
    const invalidAreas: string[] = [];
    const areaCategoryMap: Record<string, string[]> = {};
    responses.forEach((response, index) => {
      const categoryIds = response.data?.categoryIds ?? [];
      areaCategoryMap[normalized[index]] = categoryIds;
      if (categoryIds.length === 0) {
        invalidAreas.push(normalized[index]);
      }
    });

    return { invalidAreas, areaCategoryMap };
  };

  const syncSessionAreas = (sessionId: string) => {
    const normalized = Array.from(
      new Set(
        sessionAreas.map((area) => area.trim()).filter((area) => area.length > 0)
      )
    );
    const existing = sessionAreaItems;
    const existingNames = new Set(existing.map((item) => item.category));
    const toAdd = normalized.filter((area) => !existingNames.has(area));
    const toRemove = existing.filter((item) => !normalized.includes(item.category));
    const requests: Array<Promise<unknown>> = [];

    toRemove.forEach((item) => {
      requests.push(
        apiFetch(`/api/admin/self-assessment/areas/${item.id}`, {
          method: 'DELETE',
        })
      );
    });

    toAdd.forEach((area) => {
      requests.push(
        apiFetch(`/api/admin/self-assessment/sessions/${sessionId}/areas`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ category: area, isActive: true }),
        })
      );
    });

    if (requests.length === 0) {
      return Promise.resolve();
    }

    return Promise.all(requests).then(() => loadSessionAreas(sessionId));
  };


  const handleSessionSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setErrorMessage(null);
    if (sessionAreas.length === 0) {
      setErrorMessage(
        activeArea
          ? 'Klik Simpan untuk mengunci area terlebih dahulu.'
          : 'Pilih area terlebih dahulu.'
      );
      return;
    }
    if (!isAreaSelectionSynced) {
      setErrorMessage('Klik Simpan untuk mengunci area terlebih dahulu.');
      return;
    }
    try {
      const { invalidAreas } = await validateAreaMappings(sessionAreas);
      if (invalidAreas.length > 0) {
        setErrorMessage(
          `Area belum memiliki mapping kategori pertanyaan: ${invalidAreas.join(', ')}.`
        );
        return;
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Gagal memeriksa mapping area.';
      setErrorMessage(message);
      return;
    }
    const fallbackCategoryIds = selectedCategoryIdsUnion;
    const categoryAssignments = questionCategoryTarget.userIds.map((userId) => ({
      userId,
      categoryIds: questionCategoryAssignments[userId] ?? fallbackCategoryIds,
    }));
    const payload = {
      scope,
      title: sessionForm.title || null,
      teamLeader: sessionForm.teamLeader.trim(),
      teamMembers: sessionForm.teamMembers
        .split('\n')
        .map((item) => item.trim())
        .filter(Boolean),
      teamAudity: sessionForm.teamAudity
        .split('\n')
        .map((item) => item.trim())
        .filter(Boolean),
      startDate: sessionForm.startDate,
      endDate: sessionForm.endDate,
      isPublished: sessionForm.isPublished,
      userIds: questionCategoryTarget.userIds,
      categoryAssignments,
    };
    const request = editingSessionId
      ? apiFetch<{ data: SessionItem }>(
          `/api/admin/self-assessment/sessions/${editingSessionId}`,
          {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
          }
        )
      : apiFetch<{ data: SessionItem }>('/api/admin/self-assessment/sessions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
    request
      .then(async (response) => {
        const sessionId = response?.data?.id ?? editingSessionId;
        if (!sessionId) return;
        await syncSessionAreas(sessionId);
      })
      .then(() => {
        setSessionForm({
          title: '',
          teamLeader: '',
          teamMembers: '',
          teamAudity: '',
          startDate: '',
          endDate: '',
          isPublished: true,
        });
        setQuestionCategoryTarget({ userIds: [], categoryIds: [] });
        setQuestionCategoryAssignments({});
        setSessionAreas([]);
        setSessionAreaItems([]);
        setSelectedAreas([]);
        setCommittedAreaSummaries([]);
        setEditingSessionId(null);
        selectionSyncRef.current = { pending: false, userKey: '' };
        loadSessions();
      })
      .catch((error: Error) =>
        setErrorMessage(
          error.message || (editingSessionId ? 'Gagal memperbarui sesi.' : 'Gagal membuat sesi.')
        )
      );
  };

  const handleSessionEdit = (sessionId: string) => {
    setErrorMessage(null);
    apiFetch<{
      data: {
        id: string;
        title: string | null;
        team?: { leader?: string; dnp?: string[]; kobo?: string[] } | null;
        startDate: string;
        endDate: string;
        isPublished: boolean;
        userIds: string[];
        categoryAssignments: Array<{ userId: string; categoryIds: string[] }>;
      };
    }>(`/api/admin/self-assessment/sessions/${sessionId}`)
      .then((response) => {
        const data = response.data;
        setEditingSessionId(data.id);
        setSessionForm({
          title: data.title ?? '',
          teamLeader: data.team?.leader ?? '',
          teamMembers: (data.team?.dnp ?? []).join('\n'),
          teamAudity: (data.team?.kobo ?? []).join('\n'),
          startDate: data.startDate ?? '',
          endDate: data.endDate ?? '',
          isPublished: data.isPublished ?? true,
        });
        setQuestionCategoryTarget({
          userIds: data.userIds ?? [],
          categoryIds: [],
        });
        const assignments: Record<string, string[]> = {};
        data.categoryAssignments?.forEach((item) => {
          assignments[item.userId] = item.categoryIds ?? [];
        });
        setQuestionCategoryAssignments(assignments);
        loadSessionAreas(sessionId);
      })
      .catch((error: Error) =>
        setErrorMessage(error.message || 'Gagal memuat detail sesi.')
      );
  };

  const handleSessionEditCancel = () => {
    setEditingSessionId(null);
    setSessionForm({
      title: '',
      teamLeader: '',
      teamMembers: '',
      teamAudity: '',
      startDate: '',
      endDate: '',
      isPublished: true,
    });
    setQuestionCategoryTarget({ userIds: [], categoryIds: [] });
    setQuestionCategoryAssignments({});
    setSessionAreas([]);
    setSessionAreaItems([]);
    setSelectedAreas([]);
    setCommittedAreaSummaries([]);
    selectionSyncRef.current = { pending: false, userKey: '' };
  };

  const handleSessionDelete = (id: string) => {
    setErrorMessage(null);
    apiFetch(`/api/admin/self-assessment/sessions/${id}`, { method: 'DELETE' })
      .then(() => loadSessions())
      .catch((error: Error) =>
        setErrorMessage(error.message || 'Gagal menghapus sesi.')
      );
  };

  const handleTargetUserToggle = (userId: string, checked: boolean) => {
    setQuestionCategoryTarget((prev) => {
      const exists = prev.userIds.includes(userId);
      if (checked && !exists) {
        return { ...prev, userIds: [...prev.userIds, userId] };
      }
      if (!checked && exists) {
        const nextUserIds = prev.userIds.filter((id) => id !== userId);
        return {
          ...prev,
          userIds: nextUserIds,
          categoryIds: nextUserIds.length === 0 ? [] : prev.categoryIds,
        };
      }
      return prev;
    });
  };

  const handleSelectAllTargetUsers = () => {
    setQuestionCategoryTarget((prev) => ({
      ...prev,
      userIds: targetUsers.map((user) => user.id),
    }));
  };

  const handleClearTargetUsers = () => {
    setQuestionCategoryTarget({ userIds: [], categoryIds: [] });
  };

  const handleTargetCategoryToggle = (categoryId: string, checked: boolean) => {
    if (!activeArea) {
      return;
    }
    selectionSyncRef.current.pending = false;
    setAreaCategorySelections((prev) => {
      const current = prev[activeArea] ?? [];
      const exists = current.includes(categoryId);
      if (checked && !exists) {
        return { ...prev, [activeArea]: [...current, categoryId] };
      }
      if (!checked && exists) {
        return { ...prev, [activeArea]: current.filter((id) => id !== categoryId) };
      }
      return prev;
    });
  };

  const handleSelectAllTargetCategories = () => {
    if (!activeArea) {
      return;
    }
    selectionSyncRef.current.pending = false;
    setAreaCategorySelections((prev) => ({
      ...prev,
      [activeArea]: displayQuestionCategories.map((item) => item.id),
    }));
  };

  const handleClearTargetCategories = () => {
    if (!activeArea) {
      return;
    }
    selectionSyncRef.current.pending = false;
    setAreaCategorySelections((prev) => ({ ...prev, [activeArea]: [] }));
  };

  const handleSaveTargetCategories = async () => {
    if (!activeArea) {
      setErrorMessage('Pilih area terlebih dahulu.');
      return;
    }
    if (questionCategoryTarget.userIds.length === 0) {
      setErrorMessage('Pilih user terlebih dahulu.');
      return;
    }
    if (activeCategoryIds.length === 0) {
      setErrorMessage('Pilih kategori pertanyaan terlebih dahulu.');
      return;
    }
    const nextSelectedAreas = Array.from(new Set([...selectedAreas, activeArea]));
    const selectedCategoryIds = Array.from(
      new Set(
        nextSelectedAreas.flatMap((area) => areaCategorySelections[area] ?? [])
      )
    );
    setErrorMessage(null);
    try {
      const { invalidAreas, areaCategoryMap } = await validateAreaMappings([activeArea]);
      if (invalidAreas.length > 0) {
        setErrorMessage(
          `Area belum memiliki mapping kategori pertanyaan: ${invalidAreas.join(', ')}.`
        );
        return;
      }
      const summaries = nextSelectedAreas.map((area) => {
        const availableIds =
          areaCategoryMap[area] ??
          availableCategoryIdsByArea[area] ??
          [];
        const selectedIds = areaCategorySelections[area] ?? [];
        const availableSet = new Set(availableIds);
        const count = selectedIds.filter((id) => availableSet.has(id)).length;
        return { area, categoryCount: count };
      });
      setCommittedAreaSummaries(summaries);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Gagal memeriksa mapping area.';
      setErrorMessage(message);
      return;
    }
    setQuestionCategoryAssignments((prev) => {
      const next = { ...prev };
      const areaCategorySet =
        hasSelectedAreas && availableCategoryIdSet ? availableCategoryIdSet : null;
      questionCategoryTarget.userIds.forEach((userId) => {
        if (!areaCategorySet) {
          next[userId] = selectedCategoryIds;
          return;
        }
        const preserved = (prev[userId] ?? []).filter(
          (categoryId) => !areaCategorySet.has(categoryId)
        );
        next[userId] = [...preserved, ...selectedCategoryIds];
      });
      return next;
    });
    setSelectedAreas(nextSelectedAreas);
    setSessionAreas(nextSelectedAreas);
    toast({
      title: 'Kategori tersimpan',
      description: 'Kategori pertanyaan untuk user terpilih sudah disimpan.',
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <span className="flex h-10 w-10 items-center justify-center rounded-xl border border-blue-200 bg-blue-50 text-blue-600 shadow-sm">
          <CalendarDays className="h-5 w-5" />
        </span>
        <div>
          <h1 className="text-xl font-semibold text-slate-800">
            {title ?? 'Sesi Self Assessment'}
          </h1>
          <p className="text-sm text-slate-500">
            {description ?? 'Buat sesi berdasarkan periode.'}
          </p>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        {!lockScope && resolvedScopeOptions.length > 1 ? (
          <Select value={scope} onValueChange={setScope}>
            <SelectTrigger className="w-48">
              <SelectValue placeholder="Pilih scope" />
            </SelectTrigger>
            <SelectContent>
              {resolvedScopeOptions.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        ) : null}
        <span className="text-xs font-semibold text-slate-500">
          Scope aktif: {scopeLabel}
        </span>
      </div>

      <form
        className="space-y-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"
        onSubmit={handleSessionSubmit}
      >
          <div className="text-sm font-semibold text-slate-700">
            {editingSessionId ? 'Edit Sesi' : 'Buat Sesi'}
          </div>
          <Input
            value={sessionForm.title}
            onChange={(event) =>
              setSessionForm((prev) => ({ ...prev, title: event.target.value }))
            }
            placeholder="Judul (opsional)"
          />
          <div className="grid gap-3 sm:grid-cols-2">
            <Input
              value={sessionForm.teamLeader}
              onChange={(event) =>
                setSessionForm((prev) => ({ ...prev, teamLeader: event.target.value }))
              }
              placeholder="Ketua Tim"
              required
            />
            <div className="rounded-xl border border-dashed border-slate-200 px-4 py-3 text-xs text-slate-500">
              Ketua tim, anggota, dan audity wajib diisi sebelum sesi dibuat.
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <Textarea
              value={sessionForm.teamMembers}
              onChange={(event) =>
                setSessionForm((prev) => ({ ...prev, teamMembers: event.target.value }))
              }
              placeholder="Anggota (satu nama per baris)"
              rows={3}
              required
            />
            <Textarea
              value={sessionForm.teamAudity}
              onChange={(event) =>
                setSessionForm((prev) => ({ ...prev, teamAudity: event.target.value }))
              }
              placeholder="Auditee (satu nama per baris)"
              rows={3}
              required
            />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <Input
              type="date"
              value={sessionForm.startDate}
              onChange={(event) =>
                setSessionForm((prev) => ({ ...prev, startDate: event.target.value }))
              }
              required
            />
            <Input
              type="date"
              value={sessionForm.endDate}
              onChange={(event) =>
                setSessionForm((prev) => ({ ...prev, endDate: event.target.value }))
              }
              required
            />
          </div>
          <label className="flex items-center gap-2 text-sm text-slate-600">
            <Checkbox
              checked={sessionForm.isPublished}
              onCheckedChange={(checked) =>
                setSessionForm((prev) => ({ ...prev, isPublished: checked === true }))
              }
            />
            Rilis langsung
          </label>
          <div className="space-y-4 rounded-xl border border-slate-200 bg-slate-50/70 p-3 dark:border-slate-700 dark:bg-slate-900/60">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <div className="text-sm font-semibold text-slate-700 dark:text-slate-100">
                  Target user kategori pertanyaan
                </div>
                <div className="text-xs text-slate-500 dark:text-slate-300">
                  Atur kategori pertanyaan untuk user terpilih pada scope aktif.
                </div>
              </div>
              <span className="text-xs font-semibold text-slate-500 dark:text-slate-300">
                {questionCategoryTarget.userIds.length} user dipilih
              </span>
            </div>
            <div className="space-y-3 rounded-xl border border-slate-200 bg-white p-3 dark:border-slate-700 dark:bg-[#0f1e45]">
              <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500 dark:text-slate-300">
                <span>Pilih user yang mau diatur.</span>
                <span className="font-semibold">
                  {questionCategoryTarget.userIds.length} / {targetUsers.length} user
                </span>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleSelectAllTargetUsers}
                  disabled={targetUsers.length === 0}
                >
                  Pilih semua user
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={handleClearTargetUsers}
                  disabled={questionCategoryTarget.userIds.length === 0}
                >
                  Bersihkan
                </Button>
              </div>
              <ScrollArea className="h-32 rounded-xl border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900/70">
                <div className="space-y-2 p-3">
                  {targetUsers.length === 0 ? (
                    <div className="text-xs text-slate-500 dark:text-slate-300">Belum ada user.</div>
                  ) : (
                    targetUsers.map((user) => {
                      const checkboxId = `target-user-${user.id}`;
                      return (
                        <div
                          key={user.id}
                          className="flex items-start gap-2 rounded-lg border border-slate-200 px-3 py-2 dark:border-slate-700 dark:bg-slate-900/60"
                        >
                          <Checkbox
                            id={checkboxId}
                            checked={questionCategoryTarget.userIds.includes(user.id)}
                            onCheckedChange={(checked) =>
                              handleTargetUserToggle(user.id, checked === true)
                            }
                          />
                          <div className="flex flex-col">
                            <Label
                              htmlFor={checkboxId}
                              className="cursor-pointer text-sm font-medium text-slate-700 dark:text-slate-100"
                            >
                              {user.name}
                            </Label>
                            <span className="text-xs text-slate-500 dark:text-slate-300">
                              {categoryCountByUserId[user.id] ?? 0} kategori
                            </span>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </ScrollArea>
            </div>
            {questionCategoryTarget.userIds.length === 0 ? (
              <div className="text-sm text-slate-500 dark:text-slate-300">
                Pilih user untuk mengatur kategori pertanyaan.
              </div>
            ) : (
              <div className="space-y-3 rounded-xl border border-slate-200 bg-white p-3 dark:border-slate-700 dark:bg-[#0f1e45]">
                <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500 dark:text-slate-300">
                  <span>Pilih kategori untuk user terpilih.</span>
                  <div className="flex items-center gap-2">
                    <span className="font-semibold">
                      {activeCategoryIds.length} / {displayQuestionCategories.length} kategori
                    </span>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={handleSaveTargetCategories}
                      disabled={
                        !activeArea ||
                        questionCategoryTarget.userIds.length === 0 ||
                        activeCategoryIds.length === 0
                      }
                    >
                      Simpan
                    </Button>
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <Select
                    value={activeArea}
                    onValueChange={(value) => {
                      setErrorMessage(null);
                      setActiveArea(value);
                    }}
                  >
                    <SelectTrigger className="w-48">
                      <SelectValue placeholder="Pilih area" />
                    </SelectTrigger>
                    <SelectContent>
                      {areaCategories.length === 0 ? (
                        <SelectItem value="__empty" disabled>
                          Belum ada area
                        </SelectItem>
                      ) : (
                        areaCategories.map((item) => (
                          <SelectItem key={item.id} value={item.name}>
                            {item.name}
                          </SelectItem>
                        ))
                      )}
                    </SelectContent>
                  </Select>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={handleClearActiveArea}
                    disabled={!activeArea}
                  >
                    Bersihkan area
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleSelectAllTargetCategories}
                    disabled={displayQuestionCategories.length === 0 || !activeArea}
                  >
                    Pilih semua
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={handleClearTargetCategories}
                    disabled={activeCategoryIds.length === 0 || !activeArea}
                  >
                    Bersihkan
                  </Button>
                </div>
                {committedAreaSummaries.length > 0 && isAreaSelectionSynced && (
                  <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
                    <span>Area dipilih:</span>
                    {committedAreaSummaries.map((summary) => (
                      <span
                        key={`selected-area-${summary.area}`}
                        className="inline-flex items-center rounded-full bg-blue-50 px-2 py-0.5 text-[11px] font-semibold text-blue-700"
                      >
                        {summary.area} - {summary.categoryCount} kategori
                      </span>
                    ))}
                  </div>
                )}
                <ScrollArea className="h-40 rounded-xl border border-slate-200 bg-white">
                  <div className="space-y-2 p-3">
                    {!hasAreaOptions ? (
                      <div className="text-xs text-slate-500">Belum ada area.</div>
                    ) : !hasActiveArea ? (
                      <div className="text-xs text-slate-500">
                        Pilih area terlebih dahulu.
                      </div>
                    ) : !hasActiveAreaCategories ? (
                      <div className="text-xs text-slate-500">
                        Memuat kategori pertanyaan untuk area...
                      </div>
                    ) : questionCategories.length === 0 ? (
                      <div className="text-xs text-slate-500">
                        Belum ada kategori pertanyaan.
                      </div>
                    ) : displayQuestionCategories.length === 0 ? (
                      <div className="text-xs text-slate-500">
                        Belum ada kategori pertanyaan untuk area dipilih.
                      </div>
                    ) : (
                      sortedQuestionCategories.map((category) => {
                        const checkboxId = `question-category-${category.id}`;
                        return (
                          <div
                            key={category.id}
                            className="flex items-start gap-2 rounded-lg border border-slate-200 px-3 py-2"
                          >
                            <Checkbox
                              id={checkboxId}
                              checked={activeCategoryIds.includes(category.id)}
                              onCheckedChange={(checked) =>
                                handleTargetCategoryToggle(category.id, checked === true)
                              }
                            />
                            <div className="flex flex-col">
                              <Label
                                htmlFor={checkboxId}
                                className="cursor-pointer text-sm font-medium text-slate-700"
                              >
                                {category.prefix} - {category.name}
                              </Label>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                </ScrollArea>
              </div>
            )}
          </div>
        <div className="flex flex-wrap gap-2">
          <Button type="submit" className="gap-2" disabled={!canSubmitSession}>
            <Plus className="h-4 w-4" />
            {editingSessionId ? 'Simpan Perubahan' : 'Buat Sesi'}
          </Button>
          {editingSessionId && (
            <Button type="button" variant="outline" onClick={handleSessionEditCancel}>
              Batal
            </Button>
          )}
          {!canSubmitSession && (
            <span className="text-xs text-slate-500">
              Pilih area dan klik Simpan untuk membuat sesi.
            </span>
          )}
        </div>
      </form>

      {errorMessage && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {errorMessage}
        </div>
      )}

      <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Periode</TableHead>
              <TableHead>Judul</TableHead>
              <TableHead>Rilis</TableHead>
              <TableHead>User</TableHead>
              <TableHead>Area</TableHead>
              <TableHead className="text-right">Aksi</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sessions.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-sm text-slate-500">
                  Belum ada sesi.
                </TableCell>
              </TableRow>
            ) : (
              sessions.map((session) => {
                const sessionUsers = session.users ?? [];
                const sessionCategoryCounts = session.question_category_counts ?? {};
                const sessionAreas = session.areas ?? [];
                return (
                  <TableRow key={session.id}>
                    <TableCell>
                      {formatDateDisplayId(session.start_date)} - {formatDateDisplayId(session.end_date)}
                    </TableCell>
                    <TableCell>{session.title ?? '-'}</TableCell>
                    <TableCell>{session.is_published ? 'Ya' : 'Tidak'}</TableCell>
                    <TableCell>
                      {sessionUsers.length === 0 ? (
                        <span className="text-xs text-slate-500">
                          Semua user · {questionCategoryTotal} kategori
                        </span>
                      ) : (
                        <div className="flex flex-wrap gap-2">
                          {sessionUsers.map((user) => (
                            <span
                              key={user.id}
                              className="inline-flex items-center rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600"
                            >
                              {user.name} · {sessionCategoryCounts[user.id] ?? 0} kategori
                            </span>
                          ))}
                        </div>
                      )}
                    </TableCell>
                    <TableCell>
                      {sessionAreas.length === 0 ? (
                        <span className="text-xs text-slate-500">-</span>
                      ) : (
                        <div className="flex flex-wrap gap-2">
                          {sessionAreas.map((area) => (
                            <span
                              key={`${session.id}-${area}`}
                              className="inline-flex items-center rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700"
                            >
                              {area}
                            </span>
                          ))}
                        </div>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleSessionEdit(session.id)}
                          aria-label="Edit sesi"
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleSessionDelete(session.id)}
                          aria-label="Hapus sesi"
                        >
                          <Trash2 className="h-4 w-4 text-red-500" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
