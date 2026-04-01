export type AuditStatus = 'V' | 'M' | 'm' | 'X' | 'unknown';

export type GoogleDriveStatus = {
  oauthReady: boolean;
  connected: boolean;
  uploadReady: boolean;
  redirectUri: string | null;
  rootFolderId: string | null;
  rootFolderName: string | null;
  scopes: string[];
  accountEmail: string | null;
  accountName: string | null;
  missingOauthConfig: string[];
};

export type GoogleDriveFolder = {
  id: string;
  name: string;
};

export type GoogleDriveFolderListing = {
  currentFolder: GoogleDriveFolder;
  children: GoogleDriveFolder[];
};

export type SessionUser = {
  sub: string;
  email?: string;
  username?: string;
  name?: string;
  roles: string[];
};

export type ChecklistDocumentSummary = {
  id: string;
  fileName: string;
  documentUrl: string;
  analyzedAt: string;
  branch: string | null;
  documentNumber: string | null;
  auditDate: string | null;
  expectedCriteria: number | null;
  detectedCriteria: number;
  compliancePercentage: number;
  completionPercentage: number;
  groupCount: number;
};

export type UploadedQuestionFile = {
  id: string;
  name: string;
  url: string;
  size: number;
  uploadedAt: string;
  storageName: string;
  storageProvider?: 'local' | 'google-drive';
  driveSyncStatus?: 'pending' | 'synced';
  driveFileId?: string | null;
  driveFolderId?: string | null;
  driveUrl?: string | null;
  driveOwnerSub?: string | null;
  driveOwnerEmail?: string | null;
};

export type ChecklistItem = {
  code: string;
  sectionCode: string | null;
  sectionTitle: string | null;
  categoryCode: string | null;
  categoryTitle: string | null;
  description: string;
  evidence: string[];
  status: AuditStatus;
  uploadedFiles: UploadedQuestionFile[];
  groupId: string | null;
};

export type QuestionGroup = {
  id: string;
  name: string;
  questionCodes: string[];
  uploadedFiles: UploadedQuestionFile[];
};

export type SectionSummary = {
  sectionCode: string;
  sectionTitle: string;
  total: number;
  sesuai: number;
  major: number;
  minor: number;
  tidakBerlaku: number;
  percentage: number;
};

export type AuditAnalysis = {
  documentId?: string;
  fileName: string;
  analyzedAt: string;
  metadata: {
    branch: string | null;
    documentNumber: string | null;
    auditDate: string | null;
    expectedCriteria: number | null;
  };
  totals: {
    totalCriteria: number;
    expectedCriteria: number;
    detectedCriteria: number;
    sesuai: number;
    major: number;
    minor: number;
    tidakBerlaku: number;
    unknown: number;
    applicableCriteria: number;
    compliancePercentage: number;
    completionPercentage: number;
  };
  sectionSummary: SectionSummary[];
  items: ChecklistItem[];
  groups: QuestionGroup[];
};
