export type SelfAssessmentFilterOption = {
  value: string;
  label: string;
  shortLabel: string;
};

export const SELF_ASSESSMENT_MONTH_OPTIONS: SelfAssessmentFilterOption[] = [
  { value: 'ALL', label: 'Semua', shortLabel: 'All' },
  { value: 'JANUARI', label: 'JANUARI', shortLabel: 'Jan' },
  { value: 'FEBRUARI', label: 'FEBRUARI', shortLabel: 'Feb' },
  { value: 'MARET', label: 'MARET', shortLabel: 'Mar' },
  { value: 'APRIL', label: 'APRIL', shortLabel: 'Apr' },
  { value: 'MEI', label: 'MEI', shortLabel: 'Mei' },
  { value: 'JUNI', label: 'JUNI', shortLabel: 'Jun' },
  { value: 'JULI', label: 'JULI', shortLabel: 'Jul' },
  { value: 'AGUSTUS', label: 'AGUSTUS', shortLabel: 'Agu' },
  { value: 'SEPTEMBER', label: 'SEPTEMBER', shortLabel: 'Sep' },
  { value: 'OKTOBER', label: 'OKTOBER', shortLabel: 'Okt' },
  { value: 'NOVEMBER', label: 'NOVEMBER', shortLabel: 'Nov' },
  { value: 'DESEMBER', label: 'DESEMBER', shortLabel: 'Des' },
];

export const SELF_ASSESSMENT_YEAR_OPTIONS = ['2026', '2025', '2024', '2023', '2022'];

export const SELF_ASSESSMENT_YEAR_OPTIONS_WITH_ALL = [
  'ALL',
  ...SELF_ASSESSMENT_YEAR_OPTIONS,
];
