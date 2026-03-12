export type AuditStatus = 'V' | 'M' | 'm' | 'X' | 'unknown';

export type UploadedQuestionFile = {
  id: string;
  name: string;
  url: string;
  size: number;
  uploadedAt: string;
  storageName: string;
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
