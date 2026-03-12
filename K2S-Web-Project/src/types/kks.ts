export type SourceType = 'Audit' | 'Inspeksi' | 'Monitoring';
export type Severity = 'Low' | 'Med' | 'High';
export type FindingStatus = 'Open' | 'In Progress' | 'Closed';
export type FollowUpStatus = 'Open' | 'In Progress' | 'Done';

export interface InstansiProfile {
  id?: string;
  facilityGroup: string;
  kobu: string;
  bandara: string;
  cabangAirnav: string;
  name: string;
  alias: string;
  address: string;
  contactName: string;
  contactEmail: string;
  contactPhone: string;
  fax: string;
  postalCode: string;
  longitude: string;
  latitude: string;
  serviceArea: string;
  operatingHours: string;
  trafficType: string;
  runwayCapacity: string;
  runwayCondition: string;
  location: string;
}

export type FacilityCondition = 'Normal' | 'Single' | 'Unserviceable';

export interface FacilityItem {
  id: string;
  group: string;
  name: string;
  merk: string;
  type: string;
  frequency: string;
  ident: string;
  condition: FacilityCondition;
}

export type OrganizationStatus = 'Aktif' | 'Nonaktif';

export interface OrganizationItem {
  id: string;
  unitName: string;
  positionName: string;
  level: string;
  status: OrganizationStatus;
}

export interface PersonilItem {
  id: string;
  name: string;
  position: string;
  level: string;
  field: string;
  tier: string;
}

export type CertificateStatus = 'Berlaku' | 'Tidak Berlaku';

export interface CertificateItem {
  id: string;
  name: string;
  type: string;
  number: string;
  validUntil: string;
  status: CertificateStatus;
  fileName?: string;
  fileUrl?: string;
}

export interface AgendaItem {
  id: string;
  date: string;
  activityType: string;
  location: string;
  status: string;
}

export interface AuditItem {
  id: string;
  number: string;
  date: string;
  location: string;
  status: string;
  focus: string;
}

export interface InspectionItem {
  id: string;
  number: string;
  date: string;
  location: string;
  status: string;
  unit: string;
}

export interface MonitoringItem {
  id: string;
  date: string;
  location: string;
  status: string;
  note: string;
}

export interface Finding {
  id: string;
  sumber: SourceType;
  sumberId: string;
  kategori: string;
  deskripsi: string;
  severity: Severity;
  status: FindingStatus;
  dueDate: string;
  createdAt: string;
  updatedAt: string;
}

export interface EvidenceFile {
  name: string;
  url: string;
}

export interface FollowUp {
  id: string;
  findingId: string;
  aksiPerbaikan: string;
  pic: string;
  targetDate: string;
  status: FollowUpStatus;
  evidenceFiles: EvidenceFile[];
  history: string[];
  createdAt: string;
  updatedAt: string;
}
