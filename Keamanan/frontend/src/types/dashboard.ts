export type NavIcon = 'dashboard' | 'facility' | 'personnel' | 'license' | 'test' | 'document';
export type ActionVariant = 'primary' | 'secondary' | 'ghost';
export type AlertTone = 'calm' | 'warning';

export interface OrganizationProfile {
  name: string;
  branch: string;
  stage: string;
}

export interface NavigationItem {
  id: string;
  label: string;
  href?: string;
  icon: NavIcon;
  description?: string;
  children?: NavigationItem[];
}

export interface HeroContent {
  eyebrow: string;
  title: string;
  subtitle: string;
}

export interface QuickAction {
  label: string;
  variant: ActionVariant;
}

export interface MetricCard {
  label: string;
  value: string;
  delta: string;
  description: string;
}

export interface AlertPanel {
  title: string;
  message: string;
  hint: string;
  tone: AlertTone;
}

export interface ChartSeries {
  id: string;
  label: string;
  color: string;
  values: number[];
}

export interface ChartData {
  title: string;
  subtitle: string;
  labels: string[];
  series: ChartSeries[];
}

export interface FacilityItem {
  name: string;
  zone: string;
  status: 'Optimal' | 'Perlu Servis' | 'Terjadwal';
  coverage: string;
  updatedAt: string;
}

export interface LicenseItem {
  slug: string;
  name: string;
  location: string;
  documentPeriod: string;
  sourceDocument: string;
  licenseNumber: string;
  birthPlaceDate: string;
  address: string;
  maritalStatus: string;
  religion: string;
  status: 'Valid' | 'Perpanjangan' | 'Pelatihan';
  educationHistory: string[];
  workHistory: string[];
  trainingHistory: string[];
  refreshmentExisting: string;
  refreshmentPlan: string;
  recurrentExisting: string;
  recurrentPlan: string;
}

export interface TestItem {
  title: string;
  owner: string;
  date: string;
  score: string;
  status: 'Selesai' | 'Terjadwal' | 'Perlu Tindak Lanjut';
}

export interface DocumentItem {
  title: string;
  owner: string;
  version: string;
  updatedAt: string;
  status: 'Aktif' | 'Review' | 'Revisi';
}

export interface ActivityItem {
  title: string;
  detail: string;
  timestamp: string;
}

export interface SpotlightItem {
  label: string;
  value: string;
  note: string;
}

export interface DashboardData {
  generatedAt: string;
  organization: OrganizationProfile;
  navigation: NavigationItem[];
  hero: HeroContent;
  quickActions: QuickAction[];
  metrics: MetricCard[];
  alert: AlertPanel;
  chart: ChartData;
  facilities: FacilityItem[];
  licenses: LicenseItem[];
  tests: TestItem[];
  documents: DocumentItem[];
  activities: ActivityItem[];
  spotlight: SpotlightItem[];
}
