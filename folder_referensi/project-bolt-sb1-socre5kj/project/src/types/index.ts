export interface MenuItem {
  id: string;
  label: string;
  icon?: string;
  submenu?: SubMenuItem[];
}

export interface SubMenuItem {
  id: string;
  label: string;
  path: string;
}

export interface LogbookEntry {
  id: string;
  date: string;
  time: string;
  activity: string;
  category: string;
  status: string;
  notes?: string;
}

export interface RekapData {
  category: string;
  total: number;
  completed: number;
  pending: number;
}
