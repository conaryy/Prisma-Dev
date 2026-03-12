export type CaseStatus = 'Open' | 'In Progress' | 'Closed' | 'Overdue';
export type CaseSeverity = 'Low' | 'Medium' | 'High' | 'Critical';
export type CaseCategory =
  | 'Procedure'
  | 'Personnel'
  | 'Facility'
  | 'Incident'
  | 'Near Miss'
  | 'Runway Incursion'
  | 'Loss of Separation'
  | 'Bird Strike'
  | 'Weather'
  | 'Communication';
export type CaseType = 'Finding' | 'Occurrence' | 'Go Around';

export interface HSECase {
  id: string;
  caseNumber: string;
  title: string;
  description: string;
  category: CaseCategory;
  type: CaseType;
  status: CaseStatus;
  severity: CaseSeverity;
  location: string;
  branch: string;
  reportedBy: string;
  assignedTo: string;
  reportedDate: string;
  dueDate: string;
  closedDate?: string;
  findings?: string;
  correctiveActions?: string;
  preventiveActions?: string;
  attachments?: Attachment[];
  auditTrail?: AuditTrailEntry[];
}

export interface Attachment {
  id: string;
  name: string;
  type: string;
  size: number;
  url: string;
  uploadedBy: string;
  uploadedAt: string;
}

export interface AuditTrailEntry {
  id: string;
  action: string;
  performedBy: string;
  performedAt: string;
  details: string;
}

export interface Notification {
  id: string;
  type: 'New' | 'Due Soon' | 'Overdue' | 'High Severity';
  title: string;
  message: string;
  caseId: string;
  timestamp: string;
  read: boolean;
}

export interface FilterState {
  dateRange: { from: Date | undefined; to: Date | undefined };
  branches: string[];
  locations: string[];
  categories: CaseCategory[];
  statuses: CaseStatus[];
  pics: string[];
  search: string;
}

export interface KPIData {
  totalFindings: number;
  openCases: number;
  overdueCases: number;
  totalOccurrences: number;
  goAroundTotal: number;
  findingsTrend: number;
  openTrend: number;
  overdueTrend: number;
  occurrencesTrend: number;
  goAroundTrend: number;
}

export interface ChartData {
  name: string;
  value: number;
  color?: string;
}

export interface TrendData {
  date: string;
  value: number;
  label?: string;
}
