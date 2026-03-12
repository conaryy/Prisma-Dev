import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ClipboardCheck,
  RefreshCw,
  Search,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { DataTable } from '@/components/shared/DataTable';
import { Modal } from '@/components/shared/Modal';
import { FormField, FormSection } from '@/components/shared/Form';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { useAppData } from '@/contexts/AppDataContext';
import { formatDate } from '@/lib/date';

const STATUS_OPTIONS = ['Direncanakan', 'Berjalan', 'Selesai'];

const MONTH_OPTIONS = [
  { value: '', label: 'SEMUA', shortLabel: 'Semua' },
  { value: '01', label: 'JANUARI', shortLabel: 'Jan' },
  { value: '02', label: 'FEBRUARI', shortLabel: 'Feb' },
  { value: '03', label: 'MARET', shortLabel: 'Mar' },
  { value: '04', label: 'APRIL', shortLabel: 'Apr' },
  { value: '05', label: 'MEI', shortLabel: 'Mei' },
  { value: '06', label: 'JUNI', shortLabel: 'Jun' },
  { value: '07', label: 'JULI', shortLabel: 'Jul' },
  { value: '08', label: 'AGUSTUS', shortLabel: 'Agu' },
  { value: '09', label: 'SEPTEMBER', shortLabel: 'Sep' },
  { value: '10', label: 'OKTOBER', shortLabel: 'Okt' },
  { value: '11', label: 'NOVEMBER', shortLabel: 'Nov' },
  { value: '12', label: 'DESEMBER', shortLabel: 'Des' },
];
const YEAR_OPTIONS = ['', '2026', '2025', '2024', '2023', '2022'];

const selectClassName =
  'h-11 w-full rounded-xl border border-input bg-white/80 px-4 text-sm text-slate-700 shadow-sm transition-colors placeholder:text-slate-400 focus:border-blue-300 focus:outline-none focus:ring-2 focus:ring-blue-200 dark:text-slate-100 sm:w-60';

export function AuditList() {
  const { audits, addAudit, updateAudit, removeAudit } = useAppData();
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(true);
  const [month, setMonth] = useState(MONTH_OPTIONS[0].value);
  const [year, setYear] = useState(YEAR_OPTIONS[0]);
  const [searchText, setSearchText] = useState('');
  const [activeSearch, setActiveSearch] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({
    number: '',
    date: '',
    location: '',
    status: STATUS_OPTIONS[0],
    focus: '',
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    const timer = setTimeout(() => setIsLoading(false), 400);
    return () => clearTimeout(timer);
  }, []);

  const filteredAudits = useMemo(() => {
    const search = activeSearch.trim().toLowerCase();
    return audits.filter((audit) => {
      if (month && audit.date.slice(5, 7) !== month) {
        return false;
      }
      if (year && audit.date.slice(0, 4) !== year) {
        return false;
      }
      if (search) {
        const haystack = [
          audit.number,
          audit.location,
          audit.focus,
          audit.status,
        ]
          .join(' ')
          .toLowerCase();
        if (!haystack.includes(search)) {
          return false;
        }
      }
      return true;
    });
  }, [activeSearch, audits, month, year]);

  const sortedAudits = useMemo(
    () => [...filteredAudits].sort((a, b) => b.date.localeCompare(a.date)),
    [filteredAudits]
  );

  const resetForm = () => {
    setForm({
      number: '',
      date: '',
      location: '',
      status: STATUS_OPTIONS[0],
      focus: '',
    });
    setErrors({});
    setEditingId(null);
  };

  const selectedMonth =
    MONTH_OPTIONS.find((option) => option.value === month) ?? MONTH_OPTIONS[0];
  const badgeLabel = month || year
    ? `${selectedMonth.shortLabel}${year ? ` ${year}` : ''}`
    : 'Semua Periode';

  const handleSearch = () => {
    setActiveSearch(searchText);
  };

  const resetFilters = () => {
    setMonth(MONTH_OPTIONS[0].value);
    setYear(YEAR_OPTIONS[0]);
    setSearchText('');
    setActiveSearch('');
  };

  const openAdd = () => {
    resetForm();
    setIsModalOpen(true);
  };

  const openEdit = (item: typeof audits[number]) => {
    setForm({
      number: item.number,
      date: item.date,
      location: item.location,
      status: item.status,
      focus: item.focus,
    });
    setEditingId(item.id);
    setErrors({});
    setIsModalOpen(true);
  };

  const validate = () => {
    const nextErrors: Record<string, string> = {};
    if (!form.number.trim()) nextErrors.number = 'Nomor audit wajib diisi.';
    if (!form.date) nextErrors.date = 'Tanggal wajib diisi.';
    if (!form.location.trim()) nextErrors.location = 'Lokasi wajib diisi.';
    if (!form.focus.trim()) nextErrors.focus = 'Fokus audit wajib diisi.';
    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const handleSave = () => {
    if (!validate()) return;
    if (editingId) {
      updateAudit(editingId, form);
    } else {
      addAudit(form);
    }
    setIsModalOpen(false);
    resetForm();
  };

  return (
    <div className="space-y-6">
      <section className="overflow-hidden rounded-[28px] border border-slate-200/80 bg-white shadow-[0_24px_60px_rgba(15,23,42,0.08)]">
        <header className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-100 px-6 py-5">
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl border border-blue-200 bg-blue-50 text-blue-600 shadow-sm">
                <ClipboardCheck className="h-5 w-5" />
              </span>
              <h1 className="text-lg font-semibold text-slate-800">Daftar Audit</h1>
            </div>
            <span className="hidden h-6 w-px bg-slate-200 sm:block" />
            <div className="flex items-center gap-2 text-sm text-slate-500">
              <span>Audit</span>
              <span>/</span>
              <span className="font-semibold text-blue-600">Daftar Audit</span>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <span className="rounded-xl bg-blue-500 px-4 py-2 text-sm font-semibold text-white shadow-sm">
              {badgeLabel}
            </span>
            <Button
              type="button"
              className="h-10 rounded-xl bg-blue-500 px-5 text-white shadow-sm hover:bg-blue-600"
              onClick={openAdd}
            >
              Tambah Audit
            </Button>
          </div>
        </header>

        <div className="space-y-5 px-6 py-6">
          <div className="flex flex-wrap items-center gap-4">
            <select
              className={selectClassName}
              value={month}
              onChange={(event) => setMonth(event.target.value)}
            >
              {MONTH_OPTIONS.map((option) => (
                <option key={option.value || 'all'} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            <select
              className="h-11 w-full rounded-xl border border-input bg-white/80 px-4 text-sm text-slate-700 shadow-sm transition-colors focus:border-blue-300 focus:outline-none focus:ring-2 focus:ring-blue-200 dark:text-slate-100 sm:w-32"
              value={year}
              onChange={(event) => setYear(event.target.value)}
            >
              {YEAR_OPTIONS.map((option) => (
                <option key={option || 'all'} value={option}>
                  {option || 'SEMUA'}
                </option>
              ))}
            </select>
            <div className="relative min-w-[220px] flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400 dark:text-blue-200/70" />
              <Input
                value={searchText}
                onChange={(event) => setSearchText(event.target.value)}
                className="h-11 rounded-xl border border-input bg-white/80 pl-9 text-slate-700 placeholder:text-slate-400 focus-visible:border-blue-300 focus-visible:ring-2 focus-visible:ring-blue-200 dark:text-slate-100"
                placeholder="Cari nomor, lokasi, atau fokus audit..."
              />
            </div>
            <Button
              type="button"
              className="h-11 rounded-xl bg-blue-500 px-5 text-white shadow-sm hover:bg-blue-600"
              onClick={handleSearch}
            >
              <Search className="mr-2 h-4 w-4" />
              Search
            </Button>
            <Button
              type="button"
              variant="outline"
              className="h-11 rounded-xl border-slate-200 px-4 text-slate-600 shadow-sm hover:border-blue-200 hover:bg-blue-50"
              onClick={resetFilters}
            >
              <RefreshCw className="mr-2 h-4 w-4" />
              Reset
            </Button>
          </div>

          <DataTable
            data={sortedAudits}
            isLoading={isLoading}
            onRowClick={(item) => navigate(`/audit/${item.id}`)}
            columns={[
              { header: 'Nomor', render: (item) => item.number },
              { header: 'Tanggal', render: (item) => formatDate(item.date) },
              { header: 'Lokasi', render: (item) => item.location },
              {
                header: 'Status',
                render: (item) => <StatusBadge status={item.status} />,
              },
              {
                header: 'Aksi',
                render: (item) => (
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={(event) => {
                        event.stopPropagation();
                        openEdit(item);
                      }}
                    >
                      Edit
                    </Button>
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={(event) => {
                        event.stopPropagation();
                        removeAudit(item.id);
                      }}
                    >
                      Hapus
                    </Button>
                  </div>
                ),
              },
            ]}
          />
        </div>
      </section>

      <Modal
        open={isModalOpen}
        onOpenChange={setIsModalOpen}
        title={editingId ? 'Edit Audit' : 'Tambah Audit'}
      >
        <FormSection>
          <div className="grid gap-4">
            <FormField label="Nomor Audit" required error={errors.number}>
              <Input
                value={form.number}
                onChange={(event) => setForm({ ...form, number: event.target.value })}
              />
            </FormField>
            <FormField label="Tanggal" required error={errors.date}>
              <Input
                type="date"
                value={form.date}
                onChange={(event) => setForm({ ...form, date: event.target.value })}
              />
            </FormField>
            <FormField label="Lokasi" required error={errors.location}>
              <Input
                value={form.location}
                onChange={(event) => setForm({ ...form, location: event.target.value })}
              />
            </FormField>
            <FormField label="Status">
              <select
                className="h-9 w-full rounded-md border border-slate-200 px-3 text-sm"
                value={form.status}
                onChange={(event) => setForm({ ...form, status: event.target.value })}
              >
                {STATUS_OPTIONS.map((status) => (
                  <option key={status} value={status}>
                    {status}
                  </option>
                ))}
              </select>
            </FormField>
            <FormField label="Fokus Audit" required error={errors.focus}>
              <Input
                value={form.focus}
                onChange={(event) => setForm({ ...form, focus: event.target.value })}
              />
            </FormField>
          </div>
          <div className="mt-4 flex justify-end gap-2">
            <Button variant="outline" onClick={() => setIsModalOpen(false)}>
              Batal
            </Button>
            <Button onClick={handleSave}>Simpan</Button>
          </div>
        </FormSection>
      </Modal>
    </div>
  );
}
