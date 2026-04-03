import type { AuditAnalysis, ChecklistItem, QuestionGroup, UploadedQuestionFile } from '@/types';

const STATUS_EVIDENCE_MARKERS = new Set(['V', 'v', 'M', 'm', 'X', 'x']);

export type EvidenceMonitoringEntry = {
  id: string;
  label: string;
  title: string;
  sectionLabel: string;
  description: string;
  evidence: string[];
  uploadedFiles: UploadedQuestionFile[];
  pendingDriveFiles: UploadedQuestionFile[];
  questionCodes: string[];
  questionCount: number;
  isGroup: boolean;
};

export type EvidenceMonitoringSummary = {
  entries: EvidenceMonitoringEntry[];
  missingFileEntries: EvidenceMonitoringEntry[];
  pendingDriveEntries: EvidenceMonitoringEntry[];
  totals: {
    evidenceTargets: number;
    withFiles: number;
    withoutFiles: number;
    pendingDriveEntries: number;
    pendingDriveFiles: number;
    uploadedFiles: number;
    syncedDriveFiles: number;
    actionRequired: number;
  };
};

export function getDisplayEvidence(entries: string[]) {
  return entries.filter((entry) => {
    const normalizedEntry = entry.trim();
    return normalizedEntry.length > 0 && !STATUS_EVIDENCE_MARKERS.has(normalizedEntry);
  });
}

function isDriveSyncPending(file: UploadedQuestionFile) {
  return file.storageProvider !== 'google-drive' && file.driveSyncStatus !== 'synced';
}

function formatQuestionCodeRange(questionCodes: string[]) {
  const uniqueCodes = Array.from(new Set(questionCodes.filter(Boolean)));
  if (uniqueCodes.length === 0) return '-';
  if (uniqueCodes.length === 1) return uniqueCodes[0];
  return `${uniqueCodes[0]} - ${uniqueCodes[uniqueCodes.length - 1]}`;
}

function buildSectionLabel(items: ChecklistItem[]) {
  const sectionCodes = Array.from(
    new Set(items.map((item) => item.sectionCode?.trim()).filter((value): value is string => Boolean(value)))
  );

  if (sectionCodes.length === 0) {
    return 'Tanpa bab';
  }

  if (sectionCodes.length === 1) {
    return `Bab ${sectionCodes[0]}`;
  }

  return `Lintas bab ${sectionCodes.join(', ')}`;
}

function buildGroupEntry(group: QuestionGroup, items: ChecklistItem[]): EvidenceMonitoringEntry {
  const evidence = Array.from(new Set(items.flatMap((item) => getDisplayEvidence(item.evidence))));

  return {
    id: group.id,
    label: formatQuestionCodeRange(items.map((item) => item.code)),
    title: group.name,
    sectionLabel: buildSectionLabel(items),
    description: `${items.length} butir tergabung dalam satu evidence.`,
    evidence,
    uploadedFiles: group.uploadedFiles,
    pendingDriveFiles: group.uploadedFiles.filter(isDriveSyncPending),
    questionCodes: items.map((item) => item.code),
    questionCount: items.length,
    isGroup: true,
  };
}

function buildSingleEntry(item: ChecklistItem): EvidenceMonitoringEntry {
  return {
    id: item.code,
    label: item.code,
    title: item.categoryTitle || item.sectionTitle || 'Checklist SMK3',
    sectionLabel: item.sectionCode ? `Bab ${item.sectionCode}` : 'Tanpa bab',
    description: item.description,
    evidence: getDisplayEvidence(item.evidence),
    uploadedFiles: item.uploadedFiles,
    pendingDriveFiles: item.uploadedFiles.filter(isDriveSyncPending),
    questionCodes: [item.code],
    questionCount: 1,
    isGroup: false,
  };
}

export function buildEvidenceMonitoringSummary(analysis: AuditAnalysis): EvidenceMonitoringSummary {
  const groupLookup = new Map(analysis.groups.map((group) => [group.id, group]));
  const groupedItemsLookup = new Map<string, ChecklistItem[]>();
  const entries: EvidenceMonitoringEntry[] = [];
  const renderedGroupIds = new Set<string>();

  analysis.items.forEach((item) => {
    if (!item.groupId) {
      return;
    }

    const nextItems = groupedItemsLookup.get(item.groupId) ?? [];
    nextItems.push(item);
    groupedItemsLookup.set(item.groupId, nextItems);
  });

  for (const item of analysis.items) {
    if (!item.groupId) {
      entries.push(buildSingleEntry(item));
      continue;
    }

    if (renderedGroupIds.has(item.groupId)) {
      continue;
    }

    const group = groupLookup.get(item.groupId);
    const groupedItems = groupedItemsLookup.get(item.groupId) ?? [item];

    if (!group) {
      entries.push(buildSingleEntry(item));
      continue;
    }

    entries.push(buildGroupEntry(group, groupedItems));
    renderedGroupIds.add(group.id);
  }

  const evidenceTargetEntries = entries.filter((entry) => entry.evidence.length > 0);
  const missingFileEntries = evidenceTargetEntries.filter((entry) => entry.uploadedFiles.length === 0);
  const pendingDriveEntries = entries.filter((entry) => entry.pendingDriveFiles.length > 0);
  const uploadedFiles = entries.reduce((total, entry) => total + entry.uploadedFiles.length, 0);
  const pendingDriveFiles = entries.reduce((total, entry) => total + entry.pendingDriveFiles.length, 0);
  const syncedDriveFiles = uploadedFiles - pendingDriveFiles;
  const actionRequired = new Set([
    ...missingFileEntries.map((entry) => entry.id),
    ...pendingDriveEntries.map((entry) => entry.id),
  ]).size;

  return {
    entries,
    missingFileEntries,
    pendingDriveEntries,
    totals: {
      evidenceTargets: evidenceTargetEntries.length,
      withFiles: evidenceTargetEntries.length - missingFileEntries.length,
      withoutFiles: missingFileEntries.length,
      pendingDriveEntries: pendingDriveEntries.length,
      pendingDriveFiles,
      uploadedFiles,
      syncedDriveFiles,
      actionRequired,
    },
  };
}
