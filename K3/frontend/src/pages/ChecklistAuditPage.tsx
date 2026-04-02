import Lottie from 'lottie-react';
import { useDeferredValue, useEffect, useMemo, useState } from 'react';
import { useOutletContext, useSearchParams } from 'react-router-dom';
import { EmptyState } from '@/components/EmptyState';
import type { AppShellOutletContext } from '@/components/AppShell';
import loadingSpinnerAnimation from '@/loading-spinner-simplui.json';
import successCheckAnimation from '@/success-check.json';
import {
  createQuestionGroup,
  deleteQuestionEvidence,
  fetchChecklistDocument,
  fetchChecklistDocuments,
  fetchGoogleDriveFolders,
  removeQuestionGroup,
  syncQuestionEvidenceToDrive,
  uploadQuestionEvidence,
  updateQuestionGroup,
} from '@/lib/api';
import { getDisplayEvidence } from '@/lib/evidence';
import type {
  AuditAnalysis,
  ChecklistDocumentSummary,
  ChecklistItem,
  GoogleDriveFolder,
  GoogleDriveItem,
  QuestionGroup,
} from '@/types';

type QuestionListBlock =
  | { type: 'single'; item: ChecklistItem }
  | { type: 'group'; group: QuestionGroup; label: string; items: ChecklistItem[] };

type DriveSendDialogState = {
  path: GoogleDriveFolder[];
  children: GoogleDriveItem[];
  isLoading: boolean;
  mode: 'existing' | 'new';
  subfolderName: string;
};

type DriveSyncSuccessState = {
  message: string;
  syncedFileCount: number;
  destinationLabel: string | null;
};

const EMPTY_SECTION_FILTER = '__tanpa_bab__';
const DEFAULT_CHECKLIST_FEEDBACK = 'Pilih dokumen audit yang ingin dipakai di checklist.';

function formatDateTime(value: string) {
  return new Date(value).toLocaleString('id-ID', {
    dateStyle: 'medium',
    timeStyle: 'short',
  });
}

function formatFileSize(size: number) {
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}

function statusLabel(status: ChecklistItem['status']) {
  if (status === 'V') return 'Sesuai';
  if (status === 'M') return 'Major';
  if (status === 'm') return 'Minor';
  if (status === 'X') return 'Tidak Berlaku';
  return 'Belum Terbaca';
}

function matchesChecklistQuery(item: ChecklistItem, normalizedQuery: string) {
  const haystack = [
    item.code,
    item.description,
    item.sectionTitle,
    item.categoryTitle,
    item.status,
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();

  return haystack.includes(normalizedQuery);
}

function formatQuestionCodeRange(questionCodes: string[]) {
  const uniqueCodes = Array.from(new Set(questionCodes.filter(Boolean)));
  if (uniqueCodes.length === 0) return '';
  if (uniqueCodes.length === 1) return uniqueCodes[0];
  return `${uniqueCodes[0]} - ${uniqueCodes[uniqueCodes.length - 1]}`;
}

function buildQuestionBlocks(
  items: ChecklistItem[],
  groupLookup: Map<string, QuestionGroup>,
  groupDisplayLookup: Map<string, string>
) {
  const blocks: QuestionListBlock[] = [];
  const renderedGroupIds = new Set<string>();
  const groupedItemsLookup = new Map<string, ChecklistItem[]>();

  items.forEach((item) => {
    if (!item.groupId) {
      return;
    }

    const nextItems = groupedItemsLookup.get(item.groupId) ?? [];
    nextItems.push(item);
    groupedItemsLookup.set(item.groupId, nextItems);
  });

  for (const item of items) {
    if (!item.groupId) {
      blocks.push({ type: 'single', item });
      continue;
    }

    if (renderedGroupIds.has(item.groupId)) {
      continue;
    }

    const group = groupLookup.get(item.groupId);
    const groupedItems = groupedItemsLookup.get(item.groupId) ?? [];

    if (!group || groupedItems.length === 0) {
      blocks.push({ type: 'single', item });
      continue;
    }

    blocks.push({
      type: 'group',
      group,
      label: groupDisplayLookup.get(group.id) ?? group.name,
      items: groupedItems,
    });

    renderedGroupIds.add(group.id);
  }

  return blocks;
}

export function ChecklistAuditPage() {
  const {
    connectGoogleDrive,
    googleDriveStatus,
    isConnectingGoogleDrive,
    isLoadingGoogleDriveStatus,
    refreshGoogleDriveStatus,
  } = useOutletContext<AppShellOutletContext>();
  const [searchParams, setSearchParams] = useSearchParams();
  const requestedDocumentId = searchParams.get('document') ?? '';
  const [documents, setDocuments] = useState<ChecklistDocumentSummary[]>([]);
  const [selectedDocumentId, setSelectedDocumentId] = useState('');
  const [analysis, setAnalysis] = useState<AuditAnalysis | null>(null);
  const [query, setQuery] = useState('');
  const [groupFilterId, setGroupFilterId] = useState('');
  const [feedback, setFeedback] = useState(DEFAULT_CHECKLIST_FEEDBACK);
  const [feedbackTone, setFeedbackTone] = useState<'success' | 'error' | 'neutral'>('neutral');
  const [isLoadingDocuments, setIsLoadingDocuments] = useState(true);
  const [isLoadingAnalysis, setIsLoadingAnalysis] = useState(false);
  const [isUploadingEvidence, setIsUploadingEvidence] = useState(false);
  const [isLoadingDriveFolderPicker, setIsLoadingDriveFolderPicker] = useState(false);
  const [isSyncingEvidenceToDrive, setIsSyncingEvidenceToDrive] = useState(false);
  const [isGroupModalOpen, setIsGroupModalOpen] = useState(false);
  const [groupModalRangeStart, setGroupModalRangeStart] = useState('');
  const [groupModalRangeEnd, setGroupModalRangeEnd] = useState('');
  const [groupModalSectionFilter, setGroupModalSectionFilter] = useState('');
  const [selectedQuestionCode, setSelectedQuestionCode] = useState<string | null>(null);
  const [selectedGroupCodes, setSelectedGroupCodes] = useState<string[]>([]);
  const [focusedModalGroupId, setFocusedModalGroupId] = useState<string | null>(null);
  const [editingGroupId, setEditingGroupId] = useState<string | null>(null);
  const [isSavingGroup, setIsSavingGroup] = useState(false);
  const [removingGroupId, setRemovingGroupId] = useState<string | null>(null);
  const [deletingEvidenceFileId, setDeletingEvidenceFileId] = useState<string | null>(null);
  const [driveSendDialog, setDriveSendDialog] = useState<DriveSendDialogState | null>(null);
  const [driveSyncSuccess, setDriveSyncSuccess] = useState<DriveSyncSuccessState | null>(null);
  const shouldShowFeedback =
    feedbackTone !== 'neutral' || feedback.trim() !== DEFAULT_CHECKLIST_FEEDBACK;

  useEffect(() => {
    let ignore = false;

    fetchChecklistDocuments()
      .then((payload) => {
        if (ignore) {
          return;
        }

        setDocuments(payload.data);
      })
      .catch((reason) => {
        if (ignore) {
          return;
        }

        setFeedback(reason instanceof Error ? reason.message : 'Gagal memuat daftar dokumen audit.');
        setFeedbackTone('error');
      })
      .finally(() => {
        if (!ignore) {
          setIsLoadingDocuments(false);
        }
      });

    return () => {
      ignore = true;
    };
  }, []);

  useEffect(() => {
    if (documents.length === 0) {
      setSelectedDocumentId('');
      setAnalysis(null);
      setSelectedQuestionCode(null);
      return;
    }

    const requestedExists = requestedDocumentId
      ? documents.some((document) => document.id === requestedDocumentId)
      : false;
    const currentExists = selectedDocumentId
      ? documents.some((document) => document.id === selectedDocumentId)
      : false;
    const nextDocumentId = requestedExists
      ? requestedDocumentId
      : currentExists
        ? selectedDocumentId
        : documents[0]?.id ?? '';

    if (nextDocumentId !== selectedDocumentId) {
      setSelectedDocumentId(nextDocumentId);
    }

    if (nextDocumentId && nextDocumentId !== requestedDocumentId) {
      setSearchParams({ document: nextDocumentId }, { replace: true });
    }
  }, [documents, requestedDocumentId, selectedDocumentId, setSearchParams]);

  useEffect(() => {
    const googleDriveResult = searchParams.get('googleDrive');
    const googleDriveMessage = searchParams.get('googleDriveMessage');

    if (!googleDriveResult) {
      return;
    }

    void refreshGoogleDriveStatus();

    if (googleDriveMessage) {
      setFeedback(googleDriveMessage);
      setFeedbackTone(googleDriveResult === 'connected' ? 'success' : 'error');
    }

    const nextParams = new URLSearchParams(searchParams);
    nextParams.delete('googleDrive');
    nextParams.delete('googleDriveMessage');
    setSearchParams(nextParams, { replace: true });
  }, [refreshGoogleDriveStatus, searchParams, setSearchParams]);

  useEffect(() => {
    if (!selectedDocumentId) {
      setAnalysis(null);
      setSelectedQuestionCode(null);
      return;
    }

    let ignore = false;
    setIsLoadingAnalysis(true);
    setAnalysis(null);

    fetchChecklistDocument(selectedDocumentId)
      .then((payload) => {
        if (ignore) {
          return;
        }

        setAnalysis(payload.data);
      })
      .catch((reason) => {
        if (ignore) {
          return;
        }

        setFeedback(reason instanceof Error ? reason.message : 'Gagal memuat dokumen audit terpilih.');
        setFeedbackTone('error');
      })
      .finally(() => {
        if (!ignore) {
          setIsLoadingAnalysis(false);
        }
      });

    return () => {
      ignore = true;
    };
  }, [selectedDocumentId]);

  useEffect(() => {
    if (!analysis?.items.length) {
      setSelectedQuestionCode(null);
      return;
    }

    if (!selectedQuestionCode || !analysis.items.some((item) => item.code === selectedQuestionCode)) {
      setSelectedQuestionCode(analysis.items[0].code);
    }
  }, [analysis, selectedQuestionCode]);

  const deferredQuery = useDeferredValue(query);
  const filteredItems = useMemo(() => {
    if (!analysis) return [];

    const normalizedQuery = deferredQuery.trim().toLowerCase();
    if (!normalizedQuery) return analysis.items;

    return analysis.items.filter((item) => matchesChecklistQuery(item, normalizedQuery));
  }, [analysis, deferredQuery]);

  const groupModalSectionOptions = useMemo(() => {
    if (!analysis) return [] as Array<{ value: string; label: string }>;

    const seen = new Set<string>();
    const options: Array<{ value: string; label: string }> = [];

    analysis.items.forEach((item) => {
      const normalizedSection = item.sectionTitle?.trim() || EMPTY_SECTION_FILTER;
      if (seen.has(normalizedSection)) {
        return;
      }

      seen.add(normalizedSection);
      options.push({
        value: normalizedSection,
        label: item.sectionTitle?.trim() || 'Tanpa bab',
      });
    });

    return options;
  }, [analysis]);
  const groupModalSectionItems = useMemo(() => {
    if (!analysis) return [];

    return groupModalSectionFilter
      ? analysis.items.filter(
          (item) => (item.sectionTitle?.trim() || EMPTY_SECTION_FILTER) === groupModalSectionFilter
        )
      : analysis.items;
  }, [analysis, groupModalSectionFilter]);
  const groupModalItems = groupModalSectionItems;

  useEffect(() => {
    if (filteredItems.length === 0) {
      return;
    }

    if (!filteredItems.some((item) => item.code === selectedQuestionCode)) {
      setSelectedQuestionCode(filteredItems[0].code);
    }
  }, [filteredItems, selectedQuestionCode]);

  const groupLookup = useMemo(() => {
    return new Map((analysis?.groups ?? []).map((group) => [group.id, group]));
  }, [analysis]);

  const groupDisplayLookup = useMemo(() => {
    return new Map((analysis?.groups ?? []).map((group, index) => [group.id, `Kelompok ${index + 1}`]));
  }, [analysis]);
  const selectedDocumentSummary =
    documents.find((document) => document.id === selectedDocumentId) ?? null;

  const activeItem =
    (filteredItems.length > 0
      ? analysis?.items.find((item) => item.code === selectedQuestionCode)
      : null) ??
    filteredItems[0] ??
    null;

  const activeGroup: QuestionGroup | null =
    activeItem?.groupId ? groupLookup.get(activeItem.groupId) ?? null : null;
  const activeUploadedFiles = activeGroup ? activeGroup.uploadedFiles : activeItem?.uploadedFiles ?? [];
  const pendingDriveSyncCount = activeUploadedFiles.filter(
    (file) => file.storageProvider !== 'google-drive' && file.driveSyncStatus !== 'synced'
  ).length;
  const activeGroupLabel = activeGroup ? groupDisplayLookup.get(activeGroup.id) ?? activeGroup.name : null;
  const editingGroup = editingGroupId ? groupLookup.get(editingGroupId) ?? null : null;
  const editingGroupLabel = editingGroup ? groupDisplayLookup.get(editingGroup.id) ?? editingGroup.name : null;
  const activeGroupItems = useMemo(() => {
    if (!analysis || !activeGroup) {
      return [] as ChecklistItem[];
    }

    const itemLookup = new Map(analysis.items.map((item) => [item.code, item]));
    return activeGroup.questionCodes
      .map((code) => itemLookup.get(code))
      .filter((item): item is ChecklistItem => Boolean(item));
  }, [activeGroup, analysis]);
  const activeGroupCodeRange = activeGroup
    ? formatQuestionCodeRange(activeGroupItems.map((item) => item.code))
    : null;
  const detailQuestionItems = activeGroup ? activeGroupItems : activeItem ? [activeItem] : [];
  const detailTitle = activeItem
    ? activeGroupCodeRange
      ? `${activeGroupCodeRange} - ${activeItem.categoryTitle || activeItem.sectionTitle || 'Checklist SMK3'}`
      : `${activeItem.code} - ${activeItem.categoryTitle || activeItem.sectionTitle || 'Checklist SMK3'}`
    : '';
  const detailDescription = activeGroup
    ? `${activeGroupItems.length} butir tergabung dalam ${activeGroupLabel}. Semua pertanyaan dan evidence dokumen ditampilkan bersama di bawah.`
    : activeItem?.description ?? '';
  const questionListBlocks = useMemo(
    () => buildQuestionBlocks(filteredItems, groupLookup, groupDisplayLookup),
    [filteredItems, groupDisplayLookup, groupLookup]
  );
  const groupFilterOptions = useMemo(() => {
    if (!analysis) {
      return [] as Array<{ value: string; label: string }>;
    }

    const itemLookup = new Map(analysis.items.map((item) => [item.code, item]));

    return analysis.groups.map((group) => {
      const sectionCodes = Array.from(
        new Set(
          group.questionCodes
            .map((code) => itemLookup.get(code)?.sectionCode?.trim())
            .filter((value): value is string => Boolean(value))
        )
      );
      const sectionLabel =
        sectionCodes.length === 0
          ? 'Tanpa bab'
          : sectionCodes.length === 1
            ? `Bab ${sectionCodes[0]}`
            : `Lintas Bab ${sectionCodes.join(', ')}`;

      return {
        value: group.id,
        label: `${groupDisplayLookup.get(group.id) ?? group.name} (${sectionLabel})`,
      };
    });
  }, [analysis, groupDisplayLookup]);
  const visibleQuestionListBlocks = useMemo(() => {
    if (!groupFilterId) {
      return questionListBlocks;
    }

    return questionListBlocks.filter((block) => block.type === 'group' && block.group.id === groupFilterId);
  }, [groupFilterId, questionListBlocks]);
  const visibleQuestionCodes = useMemo(
    () =>
      visibleQuestionListBlocks.flatMap((block) =>
        block.type === 'group' ? block.items.map((item) => item.code) : [block.item.code]
      ),
    [visibleQuestionListBlocks]
  );
  useEffect(() => {
    if (!groupFilterId) {
      return;
    }

    if (!groupFilterOptions.some((option) => option.value === groupFilterId)) {
      setGroupFilterId('');
    }
  }, [groupFilterId, groupFilterOptions]);
  useEffect(() => {
    if (visibleQuestionCodes.length === 0) {
      return;
    }

    if (!selectedQuestionCode || !visibleQuestionCodes.includes(selectedQuestionCode)) {
      setSelectedQuestionCode(visibleQuestionCodes[0]);
    }
  }, [selectedQuestionCode, visibleQuestionCodes]);
  const groupModalBlocks = useMemo(
    () => buildQuestionBlocks(groupModalItems, groupLookup, groupDisplayLookup),
    [groupDisplayLookup, groupLookup, groupModalItems]
  );
  const isGroupSelectionDisabled = (item: ChecklistItem) =>
    editingGroupId ? Boolean(item.groupId && item.groupId !== editingGroupId) : Boolean(item.groupId);

  const renderQuestionRow = (
    item: ChecklistItem,
    options?: {
      isGroupedMember?: boolean;
      metaLabel?: string;
      interactive?: boolean;
      showCategoryMeta?: boolean;
    }
  ) => {
    const rowGroup = item.groupId ? groupLookup.get(item.groupId) ?? null : null;
    const rowGroupLabel = rowGroup ? groupDisplayLookup.get(rowGroup.id) ?? rowGroup.name : null;
    const sectionMetaLabel = options?.metaLabel ?? item.sectionTitle ?? rowGroupLabel ?? 'Tanpa bab';
    const categoryMetaLabel = options?.showCategoryMeta && item.categoryTitle
      ? `${item.categoryCode ? `${item.categoryCode} ` : ''}${item.categoryTitle}`
      : null;

    const className = `question-row${options?.interactive === false ? '' : item.code === activeItem?.code ? ' is-active' : ''}${options?.isGroupedMember ? ' is-group-member' : ''}${options?.interactive === false ? ' is-static' : ''}`;
    const content = (
      <>
        <div className="question-row-top">
          <strong>{item.code}</strong>
          <span className={`status-pill ${item.status}`}>{statusLabel(item.status)}</span>
        </div>

        <p className="question-row-title">{item.description}</p>

        <div className="question-row-meta">
          <div className="question-row-meta-copy">
            {categoryMetaLabel && <span className="question-row-subcategory">{categoryMetaLabel}</span>}
            <span className={categoryMetaLabel ? 'question-row-section-meta' : undefined}>{sectionMetaLabel}</span>
          </div>
          <span>{rowGroup ? `${rowGroup.uploadedFiles.length} file gabung` : `${item.uploadedFiles.length} file`}</span>
        </div>
      </>
    );

    if (options?.interactive === false) {
      return (
        <div key={item.code} className={className}>
          {content}
        </div>
      );
    }

    return (
      <button
        key={item.code}
        type="button"
        className={className}
        onClick={() => setSelectedQuestionCode(item.code)}
      >
        {content}
      </button>
    );
  };

  const renderGroupModalSelectionRow = (item: ChecklistItem) => {
    const rowGroup = item.groupId ? groupLookup.get(item.groupId) ?? null : null;
    const rowGroupLabel = rowGroup ? groupDisplayLookup.get(rowGroup.id) ?? rowGroup.name : null;
    const sectionMetaLabel = item.sectionTitle ?? 'Tanpa bab';
    const categoryMetaLabel = item.categoryTitle
      ? `${item.categoryCode ? `${item.categoryCode} ` : ''}${item.categoryTitle}`
      : null;
    const displayEvidence = getDisplayEvidence(item.evidence);
    const isSelected = selectedGroupCodes.includes(item.code);
    const isDisabled = isGroupSelectionDisabled(item);

    return (
      <button
        key={`group-editor-${item.code}`}
        type="button"
        className={`group-modal-row${isSelected ? ' is-selected' : ''}${isDisabled ? ' is-disabled' : ''}`}
        onClick={() => {
          if (!isDisabled) {
            if (!editingGroupId) {
              setFocusedModalGroupId(null);
            }
            toggleGroupSelection(item.code);
          }
        }}
        disabled={isDisabled}
      >
        <div className="group-modal-row-top">
          <div className="group-modal-row-head">
            <strong>{item.code}</strong>
            {isSelected && <span className="group-selection-pill">Dipilih</span>}
            {isDisabled && rowGroupLabel && (
              <span className="group-selection-pill is-muted">{rowGroupLabel}</span>
            )}
          </div>
          <span className={`status-pill ${item.status}`}>{statusLabel(item.status)}</span>
        </div>

        <p className="question-row-title">{item.description}</p>

        <div className="group-modal-evidence">
          <span className="group-modal-evidence-label">Evidence yang dibutuhkan</span>
          {displayEvidence.length > 0 ? (
            <ul className="group-modal-evidence-list">
              {displayEvidence.map((entry, index) => (
                <li key={`${item.code}-evidence-${index}`}>{entry}</li>
              ))}
            </ul>
          ) : (
            <p className="group-modal-evidence-empty">Belum ada evidence bawaan yang terbaca.</p>
          )}
        </div>

        <div className="question-row-meta">
          <div className="question-row-meta-copy">
            {categoryMetaLabel && <span className="question-row-subcategory">{categoryMetaLabel}</span>}
            <span className={categoryMetaLabel ? 'question-row-section-meta' : undefined}>{sectionMetaLabel}</span>
          </div>
          <span>
            {rowGroup ? `${rowGroup.uploadedFiles.length} file gabung` : `${item.uploadedFiles.length} file`}
          </span>
        </div>
      </button>
    );
  };

  const closeGroupModal = () => {
    setIsGroupModalOpen(false);
    setGroupModalRangeStart('');
    setGroupModalRangeEnd('');
    setGroupModalSectionFilter('');
    setSelectedGroupCodes([]);
    setFocusedModalGroupId(null);
    setEditingGroupId(null);
  };

  const openGroupModal = () => {
    setGroupModalRangeStart('');
    setGroupModalRangeEnd('');
    setGroupModalSectionFilter('');
    setSelectedGroupCodes([]);
    setFocusedModalGroupId(null);
    setEditingGroupId(null);
    setIsGroupModalOpen(true);
  };

  const cancelGroupEditing = () => {
    setEditingGroupId(null);
    setGroupModalRangeStart('');
    setGroupModalRangeEnd('');
    setSelectedGroupCodes([]);
  };

  useEffect(() => {
    setSelectedQuestionCode(null);
    setQuery('');
    setGroupFilterId('');
    setIsGroupModalOpen(false);
    setDriveSendDialog(null);
    setDriveSyncSuccess(null);
    setGroupModalRangeStart('');
    setGroupModalRangeEnd('');
    setGroupModalSectionFilter('');
    setSelectedGroupCodes([]);
    setFocusedModalGroupId(null);
    setEditingGroupId(null);
  }, [requestedDocumentId]);

  useEffect(() => {
    if (!isGroupModalOpen) {
      return;
    }

    const previousOverflow = document.body.style.overflow;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        closeGroupModal();
      }
    };

    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isGroupModalOpen]);

  useEffect(() => {
    if (!driveSendDialog) {
      return;
    }

    const previousOverflow = document.body.style.overflow;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setDriveSendDialog(null);
      }
    };

    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [driveSendDialog]);

  useEffect(() => {
    if (!analysis) {
      return;
    }

    if (focusedModalGroupId && !analysis.groups.some((group) => group.id === focusedModalGroupId)) {
      setFocusedModalGroupId(null);
    }

    if (editingGroupId && !analysis.groups.some((group) => group.id === editingGroupId)) {
      setEditingGroupId(null);
      setGroupModalRangeStart('');
      setGroupModalRangeEnd('');
      setSelectedGroupCodes([]);
    }
  }, [analysis, editingGroupId, focusedModalGroupId]);

  useEffect(() => {
    if (!driveSyncSuccess) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      setDriveSyncSuccess(null);
    }, 3000);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [driveSyncSuccess]);

  useEffect(() => {
    if (!groupModalSectionFilter) {
      return;
    }

    if (!groupModalSectionOptions.some((option) => option.value === groupModalSectionFilter)) {
      setGroupModalSectionFilter('');
    }
  }, [groupModalSectionFilter, groupModalSectionOptions]);

  const handleEvidenceUpload = async (files: FileList | null) => {
    if (!files || files.length === 0 || !activeItem || !selectedDocumentId) {
      setFeedback('Pilih dokumen, pertanyaan, dan file evidence terlebih dahulu.');
      setFeedbackTone('error');
      return;
    }

    setIsUploadingEvidence(true);
    setFeedback(
      `Menyimpan ${files.length} file ke web untuk ${activeGroupLabel ?? `butir ${activeItem.code}`}...`
    );
    setFeedbackTone('neutral');

    try {
      let nextAnalysis: AuditAnalysis | null = analysis;

      for (const file of Array.from(files)) {
        const payload = await uploadQuestionEvidence(selectedDocumentId, activeItem.code, file);
        nextAnalysis = payload.data;
      }

      if (nextAnalysis) {
        setAnalysis(nextAnalysis);
      }

      setFeedback(
        activeGroupLabel
          ? `Evidence berhasil ditambahkan ke ${activeGroupLabel}.`
          : `Evidence untuk butir ${activeItem.code} berhasil ditambahkan.`
      );
      setFeedbackTone('success');
    } catch (reason) {
      setFeedback(reason instanceof Error ? reason.message : 'Terjadi kesalahan saat upload evidence.');
      setFeedbackTone('error');
    } finally {
      setIsUploadingEvidence(false);
    }
  };

  const runDriveSync = async (
    targetFolderId?: string,
    targetFolderName?: string | null,
    targetSubfolderName?: string
  ) => {
    if (!activeItem || !selectedDocumentId) {
      setFeedback('Pilih dokumen dan pertanyaan terlebih dahulu.');
      setFeedbackTone('error');
      return;
    }

    const syncedFileCount = pendingDriveSyncCount;
    const destinationLabel = targetSubfolderName?.trim() || targetFolderName?.trim() || null;

    setIsSyncingEvidenceToDrive(true);
    setDriveSyncSuccess(null);
    setFeedback(
      targetFolderName && targetSubfolderName
        ? `Mengirim ${pendingDriveSyncCount} file lokal ke folder ${targetSubfolderName} di dalam ${targetFolderName}...`
        : targetFolderName
          ? `Mengirim ${pendingDriveSyncCount} file lokal ke folder ${targetFolderName} di Google Drive...`
          : `Mengirim ${pendingDriveSyncCount} file lokal ke Google Drive untuk ${activeGroupLabel ?? `butir ${activeItem.code}`}...`
    );
    setFeedbackTone('neutral');

    try {
      const payload = await syncQuestionEvidenceToDrive(
        selectedDocumentId,
        activeItem.code,
        targetFolderId,
        targetSubfolderName
      );
      setAnalysis(payload.data);
      setFeedback(payload.message);
      setFeedbackTone('success');
      setDriveSyncSuccess({
        message: payload.message,
        syncedFileCount,
        destinationLabel,
      });
    } catch (reason) {
      setFeedback(
        reason instanceof Error ? reason.message : 'Terjadi kesalahan saat sinkronisasi ke Google Drive.'
      );
      setFeedbackTone('error');
    } finally {
      setIsSyncingEvidenceToDrive(false);
    }
  };

  const handleSyncEvidenceToDrive = async () => {
    if (!activeItem || !selectedDocumentId) {
      setFeedback('Pilih dokumen dan pertanyaan terlebih dahulu.');
      setFeedbackTone('error');
      return;
    }

    if (!googleDriveStatus?.uploadReady) {
      setFeedback('Google Drive backend belum siap untuk sinkronisasi evidence.');
      setFeedbackTone('error');
      return;
    }

    if (pendingDriveSyncCount === 0) {
      setFeedback('Tidak ada file lokal yang menunggu sinkronisasi ke Google Drive.');
      setFeedbackTone('neutral');
      return;
    }

    try {
      setIsLoadingDriveFolderPicker(true);
      setFeedback('Memuat isi Google Drive...');
      setFeedbackTone('neutral');
      const payload = await fetchGoogleDriveFolders();
      setDriveSendDialog({
        path: [payload.data.currentFolder],
        children: payload.data.children,
        isLoading: false,
        mode: 'existing',
        subfolderName: activeGroupCodeRange ?? activeItem.code,
      });
    } catch (reason) {
      setFeedback(reason instanceof Error ? reason.message : 'Gagal memuat isi Google Drive.');
      setFeedbackTone('error');
    } finally {
      setIsLoadingDriveFolderPicker(false);
    }
  };

  const handleBrowseDriveFolder = async (folder: GoogleDriveFolder, nextPath: GoogleDriveFolder[]) => {
    setDriveSendDialog((previous) =>
      previous
        ? {
            ...previous,
            path: nextPath,
            children: previous.children,
            isLoading: true,
          }
        : previous
    );

    try {
      const payload = await fetchGoogleDriveFolders(folder.id);
      setDriveSendDialog((previous) =>
        previous
          ? {
              ...previous,
              path: nextPath,
              children: payload.data.children,
              isLoading: false,
            }
          : previous
      );
    } catch (reason) {
      setDriveSendDialog((previous) =>
        previous
          ? {
              ...previous,
              isLoading: false,
            }
          : previous
      );
      setFeedback(reason instanceof Error ? reason.message : 'Gagal memuat isi Google Drive.');
      setFeedbackTone('error');
    }
  };

  const handleConfirmDriveSendDialog = async () => {
    if (!driveSendDialog) {
      return;
    }

    const targetSubfolderName =
      driveSendDialog.mode === 'new' ? driveSendDialog.subfolderName.trim() : undefined;

    if (driveSendDialog.mode === 'new' && !targetSubfolderName) {
      setFeedback('Nama folder Google Drive tidak boleh kosong.');
      setFeedbackTone('error');
      return;
    }

    const dialogSnapshot = driveSendDialog;
    const currentFolder = dialogSnapshot.path[dialogSnapshot.path.length - 1];
    if (!currentFolder) {
      setFeedback('Pilih folder Google Drive terlebih dahulu.');
      setFeedbackTone('error');
      return;
    }

    setDriveSendDialog(null);
    await runDriveSync(
      currentFolder.id,
      currentFolder.name,
      targetSubfolderName
    );
  };

  const handleDeleteEvidence = async (fileId: string) => {
    if (!activeItem || !selectedDocumentId) {
      return;
    }

    try {
      setDeletingEvidenceFileId(fileId);
      const payload = await deleteQuestionEvidence(selectedDocumentId, activeItem.code, fileId);
      setAnalysis(payload.data);
      setFeedback(payload.message);
      setFeedbackTone('success');
    } catch (reason) {
      setFeedback(reason instanceof Error ? reason.message : 'Gagal menghapus file evidence.');
      setFeedbackTone('error');
    } finally {
      setDeletingEvidenceFileId(null);
    }
  };

  const toggleGroupSelection = (code: string) => {
    setSelectedGroupCodes((previous) =>
      previous.includes(code) ? previous.filter((entry) => entry !== code) : [...previous, code]
    );
  };

  const startEditingGroup = (groupId: string) => {
    const group = groupLookup.get(groupId);
    if (!group) {
      return;
    }

    setGroupModalRangeStart('');
    setGroupModalRangeEnd('');
    setGroupModalSectionFilter('');
    setFocusedModalGroupId(groupId);
    setEditingGroupId(groupId);
    setSelectedGroupCodes([...group.questionCodes]);
  };

  const handleApplyRangeSelection = () => {
    if (!analysis) {
      return;
    }

    const normalizedStartCode = groupModalRangeStart.trim().toLowerCase();
    const normalizedEndCode = groupModalRangeEnd.trim().toLowerCase();
    if (!normalizedStartCode || !normalizedEndCode) {
      setFeedback('Isi kode awal dan kode akhir untuk memilih rentang.');
      setFeedbackTone('error');
      return;
    }

    const startIndex = groupModalSectionItems.findIndex(
      (item) => item.code.trim().toLowerCase() === normalizedStartCode
    );
    const endIndex = groupModalSectionItems.findIndex(
      (item) => item.code.trim().toLowerCase() === normalizedEndCode
    );
    const activeSectionLabel = groupModalSectionOptions.find(
      (option) => option.value === groupModalSectionFilter
    )?.label;

    if (startIndex === -1 || endIndex === -1) {
      setFeedback(
        activeSectionLabel
          ? `Kode rentang tidak ditemukan pada bab ${activeSectionLabel}.`
          : 'Kode rentang tidak ditemukan di daftar checklist.'
      );
      setFeedbackTone('error');
      return;
    }

    const [fromIndex, toIndex] = startIndex <= endIndex ? [startIndex, endIndex] : [endIndex, startIndex];
    const rangeItems = groupModalSectionItems.slice(fromIndex, toIndex + 1);
    const selectableItems = rangeItems.filter((item) => !isGroupSelectionDisabled(item));

    if (selectableItems.length === 0) {
      setFeedback('Semua butir pada rentang ini sedang terkunci oleh kelompok lain.');
      setFeedbackTone('error');
      return;
    }

    const nextCodes = new Set(selectedGroupCodes);
    selectableItems.forEach((item) => nextCodes.add(item.code));
    const orderedSelectedCodes = analysis.items
      .filter((item) => nextCodes.has(item.code))
      .map((item) => item.code);
    const skippedItems = rangeItems.length - selectableItems.length;

    if (!editingGroupId) {
      setFocusedModalGroupId(null);
    }

    setSelectedGroupCodes(orderedSelectedCodes);
    setFeedback(
      skippedItems > 0
        ? `Rentang ${groupModalRangeStart.trim()} sampai ${groupModalRangeEnd.trim()} dipilih. ${skippedItems} butir dari kelompok lain dilewati.`
        : `Rentang ${groupModalRangeStart.trim()} sampai ${groupModalRangeEnd.trim()} berhasil dipilih.`
    );
    setFeedbackTone('success');
  };

  const handleSaveGroup = async () => {
    if (!selectedDocumentId) {
      setFeedback('Pilih dokumen audit terlebih dahulu.');
      setFeedbackTone('error');
      return;
    }

    if (selectedGroupCodes.length < 2) {
      setFeedback('Pilih minimal 2 butir untuk digabungkan.');
      setFeedbackTone('error');
      return;
    }

    try {
      setIsSavingGroup(true);
      const payload = editingGroupId
        ? await updateQuestionGroup(selectedDocumentId, editingGroupId, selectedGroupCodes)
        : await createQuestionGroup(selectedDocumentId, selectedGroupCodes);
      setAnalysis(payload.data);
      setSelectedQuestionCode(selectedGroupCodes[0]);
      closeGroupModal();
      setFeedback(payload.message);
      setFeedbackTone('success');
    } catch (reason) {
      setFeedback(
        reason instanceof Error
          ? reason.message
          : editingGroupId
            ? 'Gagal memperbarui kelompok evidence.'
            : 'Gagal membuat kelompok evidence.'
      );
      setFeedbackTone('error');
    } finally {
      setIsSavingGroup(false);
    }
  };

  const handleRemoveGroup = async (groupId: string) => {
    if (!selectedDocumentId) {
      return;
    }

    const targetGroup = groupLookup.get(groupId);
    const targetLabel = targetGroup ? groupDisplayLookup.get(groupId) ?? targetGroup.name : 'kelompok ini';

    if (!targetGroup) {
      return;
    }

    if (!window.confirm(`Hapus ${targetLabel}? Kelompok akan dibubarkan dan anggotanya menjadi butir biasa.`)) {
      return;
    }

    try {
      setRemovingGroupId(groupId);
      const payload = await removeQuestionGroup(selectedDocumentId, groupId);
      setAnalysis(payload.data);
      setSelectedQuestionCode(targetGroup.questionCodes[0] ?? payload.data.items[0]?.code ?? null);
      if (editingGroupId === groupId) {
        cancelGroupEditing();
      }
      setFocusedModalGroupId(null);
      setFeedback(payload.message);
      setFeedbackTone('success');
    } catch (reason) {
      setFeedback(reason instanceof Error ? reason.message : 'Gagal menghapus kelompok evidence.');
      setFeedbackTone('error');
    } finally {
      setRemovingGroupId(null);
    }
  };

  return (
    <div className="content-stack checklist-page">
      <section className="workspace-toolbar checklist-overview-strip">
        <div className="workspace-toolbar-stats checklist-overview-grid">
          <div className="mini-stat checklist-mini-stat">
            <span>Target</span>
            <strong>{analysis?.totals.expectedCriteria ?? selectedDocumentSummary?.expectedCriteria ?? 166}</strong>
          </div>
          <div className="mini-stat checklist-mini-stat">
            <span>Terdeteksi</span>
            <strong>{analysis?.totals.detectedCriteria ?? selectedDocumentSummary?.detectedCriteria ?? 0}</strong>
          </div>
          <div className="mini-stat checklist-mini-stat">
            <span>Kelompok</span>
            <strong>{analysis?.groups.length ?? selectedDocumentSummary?.groupCount ?? 0}</strong>
          </div>
          <div className="mini-stat checklist-mini-stat">
            <span>Penerapan</span>
            <strong>
              {analysis
                ? `${analysis.totals.compliancePercentage.toFixed(2)}%`
                : selectedDocumentSummary
                  ? `${selectedDocumentSummary.compliancePercentage.toFixed(2)}%`
                  : '0.00%'}
            </strong>
          </div>
        </div>

        {shouldShowFeedback && (
          <p className={`feedback-line checklist-feedback${feedbackTone !== 'neutral' ? ` is-${feedbackTone}` : ''}`}>
            {feedback}
          </p>
        )}
      </section>

      {isLoadingDocuments || (selectedDocumentId !== '' && isLoadingAnalysis && !analysis) ? (
        <EmptyState
          title="Memuat dokumen audit"
          description="Checklist sedang mengambil data dokumen audit dari database PostgreSQL."
        />
      ) : documents.length === 0 ? (
        <EmptyState
          title="Belum ada dokumen audit tersimpan"
          description="Buka menu Upload Dokumen untuk menambahkan dokumen Word, lalu kembali ke checklist untuk memilih dokumen yang ingin dipakai."
        />
      ) : !analysis ? (
        <EmptyState
          title="Pilih dokumen audit terlebih dahulu"
          description="Gunakan selector dokumen di topbar untuk membuka hasil analisis yang ingin diedit evidence dan kelompoknya."
        />
      ) : (
        <section className="checklist-workspace">
          <aside className="question-list-panel panel">
            <div className="question-list-header">
              <div>
                <p className="panel-kicker">Navigasi butir</p>
                <h3 className="panel-title">Daftar Pertanyaan</h3>
              </div>

              <div className="question-list-actions">
                <span className="question-count">{filteredItems.length} item</span>
                <button
                  type="button"
                  className={`secondary-action${isGroupModalOpen ? ' is-active' : ''}`}
                  onClick={openGroupModal}
                >
                  Edit Kelompok
                </button>
              </div>
            </div>

            <div className="question-filter-row">
              <input
                className="criteria-search"
                type="search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Cari kode atau isi pertanyaan..."
              />

              <div className="question-group-filter">
                <select
                  className="question-group-select"
                  value={groupFilterId}
                  onChange={(event) => setGroupFilterId(event.target.value)}
                  disabled={groupFilterOptions.length === 0}
                  aria-label="Filter kelompok"
                >
                  <option value="">
                    {groupFilterOptions.length === 0 ? 'Belum ada kelompok' : 'Cari kelompok...'}
                  </option>
                  {groupFilterOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="question-list-scroll">
              {visibleQuestionListBlocks.length === 0 ? (
                <div className="question-empty">
                  {groupFilterId
                    ? 'Kelompok yang dipilih tidak tersedia pada hasil saat ini.'
                    : 'Tidak ada pertanyaan yang cocok.'}
                </div>
              ) : (
                visibleQuestionListBlocks.map((block) => {
                  if (block.type === 'single') {
                    return renderQuestionRow(block.item);
                  }

                  const isGroupActive = block.items.some((item) => item.code === activeItem?.code);

                  return (
                    <button
                      key={`group-${block.group.id}-${block.items[0]?.code ?? 'empty'}`}
                      type="button"
                      className={`question-group-card${isGroupActive ? ' has-active' : ''}`}
                      onClick={() => setSelectedQuestionCode(block.items[0]?.code ?? null)}
                    >
                      <div className="question-group-card-header">
                        <span className="question-group-badge">{block.label}</span>
                        <span className="question-group-summary">
                          {block.items.length} butir • {block.group.uploadedFiles.length} file gabung
                        </span>
                      </div>

                      <div className="question-group-items">
                        {block.items.map((item) =>
                          renderQuestionRow(item, {
                            isGroupedMember: true,
                            interactive: false,
                            metaLabel: item.sectionTitle || 'Tanpa bab',
                            showCategoryMeta: true,
                          })
                        )}
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          </aside>

          <section className="question-detail-panel panel">
	            {activeItem ? (
	              <div className="question-detail-scroll">
	                <div className="question-detail-header">
	                  <div>
	                    <p className="panel-kicker">Detail pertanyaan</p>
	                    <h3 className="question-detail-title">{detailTitle}</h3>
	                    <p className="panel-description">{detailDescription}</p>
	                  </div>
	                  <div className="question-detail-badges">
	                    {activeGroupLabel && (
	                      <span className="question-detail-group-pill">{activeGroupLabel}</span>
	                    )}
	                    <span className={`status-pill ${activeItem.status}`}>{statusLabel(activeItem.status)}</span>
	                  </div>
	                </div>

	                {activeGroup && (
                  <article className="detail-card detail-card-wide">
                    <div className="detail-card-header">
                      <h4>Pertanyaan dalam kelompok</h4>
                    </div>

                    <div className="detail-question-list">
                      {detailQuestionItems.map((item) => (
                        <section key={`detail-question-${item.code}`} className="detail-question-item">
                          <div className="detail-question-item-top">
                            <strong>{item.code}</strong>
                            <span className={`status-pill ${item.status}`}>{statusLabel(item.status)}</span>
                          </div>
                          <p className="detail-question-item-copy">{item.description}</p>
                        </section>
                      ))}
                    </div>
                  </article>
                )}

                <div className="detail-meta-grid">
                  <div className="detail-meta-card">
                    <span className="detail-meta-label">Bab</span>
                    <strong>
                      {activeItem.sectionCode || '-'} {activeItem.sectionTitle || '-'}
                    </strong>
                  </div>
                  <div className="detail-meta-card">
                    <span className="detail-meta-label">Sub Kategori</span>
                    <strong>
                      {activeItem.categoryCode || '-'} {activeItem.categoryTitle || '-'}
                    </strong>
                  </div>
                  <div className="detail-meta-card">
                    <span className="detail-meta-label">Mode Evidence</span>
                    <strong>{activeGroupLabel ? `${activeGroupLabel} (gabungan)` : 'Per pertanyaan'}</strong>
                  </div>
                </div>

                <div className="detail-section-grid">
                  <article className="detail-card">
                    <div className="detail-card-header">
                      <h4>Evidence dari dokumen audit</h4>
                    </div>
                    {activeGroup ? (
                      <div className="detail-evidence-group-list">
                        {detailQuestionItems.map((item) => {
                          const displayEvidence = getDisplayEvidence(item.evidence);

                          return (
                            <section key={`document-evidence-${item.code}`} className="detail-evidence-group-item">
                              <div className="detail-evidence-group-head">
                                <strong>{item.code}</strong>
                                <span>{item.description}</span>
                              </div>

                              {displayEvidence.length > 0 ? (
                                <ul className="detail-bullet-list">
                                  {displayEvidence.map((entry) => (
                                    <li key={`${item.code}-${entry}`}>{entry}</li>
                                  ))}
                                </ul>
                              ) : (
                                <p className="detail-empty-copy">
                                  Belum ada evidence bawaan yang terbaca untuk butir ini.
                                </p>
                              )}
                            </section>
                          );
                        })}
                      </div>
                    ) : getDisplayEvidence(activeItem.evidence).length > 0 ? (
                      <ul className="detail-bullet-list">
                        {getDisplayEvidence(activeItem.evidence).map((entry) => (
                          <li key={`${activeItem.code}-${entry}`}>{entry}</li>
                        ))}
                      </ul>
                    ) : (
                      <p className="detail-empty-copy">Belum ada evidence bawaan yang terbaca dari dokumen.</p>
                    )}
                  </article>

                  <article className="detail-card">
                    <div className="detail-card-header">
                      <h4>{activeGroup ? 'File evidence gabungan kelompok' : 'Upload file evidence per pertanyaan'}</h4>
                    </div>

                    {googleDriveStatus?.uploadReady ? null : googleDriveStatus?.oauthReady ? null : googleDriveStatus ? (
                      <div className="drive-target-panel">
                        <p className="detail-help">Google Drive belum dikonfigurasi.</p>
                      </div>
                    ) : null}

                    <div className="evidence-action-row">
                      {googleDriveStatus?.uploadReady ? null : googleDriveStatus?.oauthReady ? (
                        <button
                          type="button"
                          className="secondary-action drive-connect-link"
                          onClick={() => void connectGoogleDrive()}
                          disabled={isConnectingGoogleDrive || isLoadingGoogleDriveStatus}
                        >
                          {isConnectingGoogleDrive ? 'Mengarahkan...' : 'Connect Google'}
                        </button>
                      ) : null}

                      <label className="secondary-upload" htmlFor="evidence-upload">
                        <input
                          id="evidence-upload"
                          type="file"
                          multiple
                          disabled={isUploadingEvidence}
                          onChange={(event) => {
                            void handleEvidenceUpload(event.target.files);
                            event.target.value = '';
                          }}
                        />
                        <span>{isUploadingEvidence ? 'Menyimpan file...' : 'Simpan File Evidence ke Web'}</span>
                      </label>
                    </div>

                    {googleDriveStatus?.uploadReady && pendingDriveSyncCount > 0 && (
                      <button
                        type="button"
                        className="secondary-action evidence-drive-action"
                        onClick={() => void handleSyncEvidenceToDrive()}
                        disabled={isLoadingDriveFolderPicker || isSyncingEvidenceToDrive}
                      >
                        <span className="button-loading-content">
                          {(isLoadingDriveFolderPicker || isSyncingEvidenceToDrive) && (
                            <span className="button-loading-spinner" aria-hidden="true">
                              <Lottie animationData={loadingSpinnerAnimation} loop />
                            </span>
                          )}
                          <span>
                            {isLoadingDriveFolderPicker
                              ? 'Memuat Folder Google Drive...'
                              : isSyncingEvidenceToDrive
                                ? 'Mengirim ke Google Drive...'
                              : `Pilih Folder dan Kirim ${pendingDriveSyncCount} File ke Google Drive`}
                          </span>
                        </span>
                      </button>
                    )}

                    {driveSyncSuccess && (
                      <div className="drive-success-inline" role="status" aria-live="polite">
                        <div className="drive-success-inline-animation" aria-hidden="true">
                          <Lottie animationData={successCheckAnimation} loop={false} />
                        </div>

                        <div className="drive-success-inline-copy">
                          <strong>{driveSyncSuccess.syncedFileCount} file berhasil dikirim</strong>
                          <span>
                            {driveSyncSuccess.destinationLabel
                              ? `Masuk ke ${driveSyncSuccess.destinationLabel}.`
                              : 'Berhasil dikirim ke Google Drive.'}
                          </span>
                        </div>
                      </div>
                    )}

                    <div className="uploaded-file-list">
                      {activeUploadedFiles.length === 0 ? (
                        <p className="detail-empty-copy">Belum ada file.</p>
                      ) : (
                        activeUploadedFiles.map((file) => (
                          <div key={file.id} className="uploaded-file-row">
                            <div className="uploaded-file-copy">
                              <a href={file.url} target="_blank" rel="noreferrer" className="uploaded-file-name">
                                {file.name}
                              </a>
                              <p className="uploaded-file-meta">
                                {formatFileSize(file.size)} • {formatDateTime(file.uploadedAt)}
                              </p>
                              <p className="uploaded-file-meta">
                                {file.driveSyncStatus === 'synced' ? 'Tersinkron ke Drive' : 'Tersimpan di web'}
                              </p>
                            </div>
                            <button
                              type="button"
                              className={`text-action danger uploaded-file-delete-action${deletingEvidenceFileId === file.id ? ' is-loading' : ''}`}
                              onClick={() => void handleDeleteEvidence(file.id)}
                              disabled={deletingEvidenceFileId !== null}
                              aria-label={deletingEvidenceFileId === file.id ? 'Menghapus file evidence' : 'Hapus file evidence'}
                            >
                              {deletingEvidenceFileId === file.id ? (
                                <span className="uploaded-file-delete-spinner" aria-hidden="true">
                                  <Lottie animationData={loadingSpinnerAnimation} loop />
                                </span>
                              ) : (
                                'Hapus'
                              )}
                            </button>
                          </div>
                        ))
                      )}
                    </div>
                  </article>
                </div>
              </div>
            ) : (
              <EmptyState
                title="Pilih pertanyaan"
                description="Klik salah satu butir checklist di panel kiri untuk melihat detail. Pengelompokan butir dilakukan lewat tombol Edit Kelompok, lalu hasilnya tampil kembali di daftar utama."
              />
            )}
          </section>
        </section>
      )}

      {driveSendDialog && (
        <div className="modal-overlay" role="presentation" onClick={() => setDriveSendDialog(null)}>
          <div
            className="modal-dialog drive-send-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="drive-send-title"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="modal-header">
              <div>
                <h3 className="panel-title" id="drive-send-title">
                  Kirim ke Google Drive
                </h3>
              </div>
            </div>

            <div className="drive-send-body">
              <div className="drive-folder-browser">
                <div className="drive-folder-breadcrumbs">
                  {driveSendDialog.path.map((folder, index) => (
                    <button
                      key={folder.id}
                      type="button"
                      className={`drive-folder-crumb${index === driveSendDialog.path.length - 1 ? ' is-active' : ''}`}
                      onClick={() =>
                        void handleBrowseDriveFolder(folder, driveSendDialog.path.slice(0, index + 1))
                      }
                      disabled={driveSendDialog.isLoading}
                    >
                      {folder.name}
                    </button>
                  ))}
                </div>

                <div className="drive-folder-list">
                  {driveSendDialog.isLoading ? (
                    <p className="detail-help">Memuat folder dan file...</p>
                  ) : driveSendDialog.children.length === 0 ? (
                    <p className="detail-help">Folder ini belum punya subfolder atau file.</p>
                  ) : (
                    driveSendDialog.children.map((item) =>
                      item.type === 'folder' ? (
                        <button
                          key={item.id}
                          type="button"
                          className="drive-folder-row"
                          onClick={() =>
                            void handleBrowseDriveFolder(item, [...driveSendDialog.path, item])
                          }
                          disabled={driveSendDialog.isLoading}
                        >
                          <span>{item.name}</span>
                          <span>Buka</span>
                        </button>
                      ) : (
                        <div key={item.id} className="drive-folder-row is-file">
                          <div className="drive-folder-row-copy">
                            <span>{item.name}</span>
                            <span className="drive-folder-row-meta">
                              {item.mimeType?.trim() || 'File Google Drive'}
                            </span>
                          </div>
                          {item.webViewLink ? (
                            <a
                              href={item.webViewLink}
                              target="_blank"
                              rel="noreferrer"
                              className="text-action"
                            >
                              Lihat
                            </a>
                          ) : (
                            <span className="drive-folder-row-meta">File</span>
                          )}
                        </div>
                      )
                    )
                  )}
                </div>
              </div>

              <div className="drive-send-parent">
                <strong>{driveSendDialog.path[driveSendDialog.path.length - 1]?.name ?? 'Folder'}</strong>
              </div>

              <div className="drive-send-choice-row">
                <button
                  type="button"
                  className={`secondary-action${driveSendDialog.mode === 'existing' ? ' is-active' : ''}`}
                  onClick={() =>
                    setDriveSendDialog((previous) =>
                      previous ? { ...previous, mode: 'existing' } : previous
                    )
                  }
                  disabled={driveSendDialog.isLoading}
                >
                  Kirim ke Folder Ini
                </button>
                <button
                  type="button"
                  className={`secondary-action${driveSendDialog.mode === 'new' ? ' is-active' : ''}`}
                  onClick={() =>
                    setDriveSendDialog((previous) =>
                      previous ? { ...previous, mode: 'new' } : previous
                    )
                  }
                  disabled={driveSendDialog.isLoading}
                >
                  Buat Folder Baru
                </button>
              </div>

              {driveSendDialog.mode === 'new' && (
                <div className="drive-send-input-group">
                  <label className="group-modal-evidence-label" htmlFor="drive-subfolder-name">
                    Nama folder baru
                  </label>
                  <input
                    id="drive-subfolder-name"
                    className="criteria-search drive-send-field"
                    type="text"
                    value={driveSendDialog.subfolderName}
                    onChange={(event) =>
                      setDriveSendDialog((previous) =>
                        previous ? { ...previous, subfolderName: event.target.value } : previous
                      )
                    }
                    placeholder="Misal: Kelompok 1"
                    autoFocus
                  />
                </div>
              )}
            </div>

            <div className="modal-action-buttons">
              <button
                type="button"
                className="secondary-action"
                onClick={() => setDriveSendDialog(null)}
                disabled={isSyncingEvidenceToDrive || driveSendDialog.isLoading}
              >
                Batal
              </button>
              <button
                type="button"
                className={
                  isSyncingEvidenceToDrive
                    ? 'secondary-action drive-send-submit-action is-loading'
                    : 'primary-action drive-send-submit-action'
                }
                onClick={() => void handleConfirmDriveSendDialog()}
                disabled={isSyncingEvidenceToDrive || driveSendDialog.isLoading}
              >
                <span className="button-loading-content">
                  {isSyncingEvidenceToDrive && (
                    <span className="button-loading-spinner" aria-hidden="true">
                      <Lottie animationData={loadingSpinnerAnimation} loop />
                    </span>
                  )}
                  <span>
                    {isSyncingEvidenceToDrive
                      ? 'Mengirim...'
                      : 'Kirim'}
                  </span>
                </span>
              </button>
            </div>
          </div>
        </div>
      )}

      {analysis && isGroupModalOpen && (
        <div className="modal-overlay" role="presentation" onClick={closeGroupModal}>
          <div
            className="modal-dialog group-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="group-editor-title"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="modal-header">
              <div>
                <p className="panel-kicker">Edit kelompok</p>
                <h3 className="panel-title" id="group-editor-title">
                  {editingGroupId
                    ? `Ubah anggota ${editingGroupLabel}`
                    : 'Pilih butir untuk kelompok evidence'}
                </h3>
                <p className="panel-description">
                  {editingGroupId
                    ? 'Pilih butir dari kelompok ini atau butir yang belum punya kelompok. Butir dari kelompok lain dikunci.'
                    : 'Kelompok yang sudah ada ditandai garis putus-putus. Klik grup untuk menampilkan aksi Edit atau Remove.'}
                </p>
              </div>

              <button type="button" className="modal-close" onClick={closeGroupModal}>
                Tutup
              </button>
            </div>

            <div className="group-editor-toolbar">
              <span className="question-count">
                {selectedGroupCodes.length} {editingGroupId ? 'anggota dipilih' : 'butir dipilih'}
              </span>

              <div className="group-editor-filters">
                <select
                  className="group-editor-select"
                  aria-label="Filter bab"
                  value={groupModalSectionFilter}
                  onChange={(event) => setGroupModalSectionFilter(event.target.value)}
                >
                  <option value="">Semua bab</option>
                  {groupModalSectionOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>

                <div className="group-editor-range">
                  <input
                    className="criteria-search group-editor-range-field"
                    type="text"
                    value={groupModalRangeStart}
                    onChange={(event) => setGroupModalRangeStart(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter') {
                        event.preventDefault();
                        handleApplyRangeSelection();
                      }
                    }}
                    placeholder="Dari kode"
                    aria-label="Kode awal rentang"
                  />
                  <input
                    className="criteria-search group-editor-range-field"
                    type="text"
                    value={groupModalRangeEnd}
                    onChange={(event) => setGroupModalRangeEnd(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter') {
                        event.preventDefault();
                        handleApplyRangeSelection();
                      }
                    }}
                    placeholder="Sampai kode"
                    aria-label="Kode akhir rentang"
                  />
                  <button
                    type="button"
                    className="secondary-action group-editor-range-action"
                    onClick={handleApplyRangeSelection}
                  >
                    Pilih
                  </button>
                </div>
              </div>
            </div>

            <div className="group-modal-list">
              {groupModalItems.length === 0 ? (
                <div className="question-empty">
                  {groupModalSectionFilter ? 'Tidak ada pertanyaan pada bab yang dipilih.' : 'Tidak ada pertanyaan.'}
                </div>
              ) : editingGroupId ? (
                groupModalItems.map((item) => renderGroupModalSelectionRow(item))
              ) : (
                groupModalBlocks.map((block) => {
                  if (block.type === 'single') {
                    return renderGroupModalSelectionRow(block.item);
                  }

                  const isFocused = focusedModalGroupId === block.group.id;

                  return (
                    <div
                      key={`modal-group-${block.group.id}-${block.items[0]?.code ?? 'empty'}`}
                      className={`group-modal-card${isFocused ? ' is-focused' : ''}`}
                      onClick={() => setFocusedModalGroupId(block.group.id)}
                      role="button"
                      tabIndex={0}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter' || event.key === ' ') {
                          event.preventDefault();
                          setFocusedModalGroupId(block.group.id);
                        }
                      }}
                    >
                      <div className="group-modal-card-header">
                        <div className="group-modal-card-meta">
                          <span className="question-group-badge">{block.label}</span>
                          <span className="question-group-summary">
                            {block.items.length} butir • {block.group.uploadedFiles.length} file gabung
                          </span>
                        </div>

                        {isFocused && (
                          <div className="group-modal-card-actions">
                            <button
                              type="button"
                              className="group-manage-action warning"
                              onClick={(event) => {
                                event.stopPropagation();
                                startEditingGroup(block.group.id);
                              }}
                            >
                              Edit
                            </button>
                            <button
                              type="button"
                              className="group-manage-action danger"
                              disabled={removingGroupId === block.group.id}
                              onClick={(event) => {
                                event.stopPropagation();
                                void handleRemoveGroup(block.group.id);
                              }}
                            >
                              {removingGroupId === block.group.id ? 'Removing...' : 'Remove'}
                            </button>
                          </div>
                        )}
                      </div>

                      <div className="group-modal-card-items">
                        {block.items.map((item) =>
                          renderQuestionRow(item, {
                            isGroupedMember: true,
                            interactive: false,
                            metaLabel: item.sectionTitle || 'Tanpa bab',
                            showCategoryMeta: true,
                          })
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            <div className="modal-actions">
              <p className="detail-help">
                {editingGroupId
                  ? 'Simpan perubahan untuk menambah atau mengurangi anggota kelompok yang sedang dipilih.'
                  : 'Pilih minimal 2 butir yang belum punya kelompok untuk membuat kelompok baru, atau klik grup existing untuk mengelolanya.'}
              </p>

              <div className="modal-action-buttons">
                <button
                  type="button"
                  className="secondary-action"
                  onClick={editingGroupId ? cancelGroupEditing : closeGroupModal}
                >
                  {editingGroupId ? 'Batal Edit' : 'Batal'}
                </button>
                <button
                  type="button"
                  className="primary-action"
                  onClick={() => void handleSaveGroup()}
                  disabled={selectedGroupCodes.length < 2 || isSavingGroup}
                >
                  {isSavingGroup
                    ? 'Menyimpan...'
                    : editingGroupId
                      ? 'Simpan Perubahan'
                      : 'Simpan Kelompok'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
