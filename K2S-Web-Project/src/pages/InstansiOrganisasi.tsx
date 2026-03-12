import { useMemo, useState } from 'react';
import { Plus, Search, X, Pencil, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Modal } from '@/components/shared/Modal';
import { FormField } from '@/components/shared/Form';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useAppData } from '@/contexts/AppDataContext';
import { OrganizationItem, OrganizationStatus } from '@/types/kks';
import { cn } from '@/lib/utils';

const selectBaseClass =
  'flex h-10 w-full rounded-xl border border-input bg-white/80 px-3 text-sm shadow-sm transition-colors duration-200 focus-visible:outline-none focus-visible:border-blue-300 focus-visible:ring-2 focus-visible:ring-blue-200 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-700 dark:bg-slate-900/70 dark:text-slate-100 dark:focus-visible:border-blue-400 dark:focus-visible:ring-blue-900/50';

const statusStyles: Record<OrganizationStatus, string> = {
  Aktif: 'bg-emerald-50 text-emerald-700 ring-emerald-200 dark:bg-emerald-500/20 dark:text-emerald-300 dark:ring-emerald-700/50',
  Nonaktif: 'bg-slate-100 text-slate-600 ring-slate-200 dark:bg-slate-700/40 dark:text-slate-200 dark:ring-slate-600',
};

const emptyForm: Omit<OrganizationItem, 'id'> = {
  unitName: '',
  positionName: '',
  level: '',
  status: 'Aktif',
};

const emptyFilters = {
  unit: '',
  position: '',
  status: '',
};

export function InstansiOrganisasi() {
  const {
    instansi,
    organizations,
    addOrganization,
    updateOrganization,
    removeOrganization,
    apiError,
    clearApiError,
  } = useAppData();
  const [filters, setFilters] = useState(emptyFilters);
  const [appliedFilters, setAppliedFilters] = useState(emptyFilters);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<Omit<OrganizationItem, 'id'>>(emptyForm);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const unitOptions = useMemo(() => {
    const unique = Array.from(new Set(organizations.map((item) => item.unitName)));
    return unique.length > 0 ? unique.sort() : ['-'];
  }, [organizations]);

  const filteredOrganizations = useMemo(() => {
    const positionQuery = appliedFilters.position.trim().toLowerCase();

    return organizations.filter((item) => {
      if (appliedFilters.unit && item.unitName !== appliedFilters.unit) {
        return false;
      }
      if (appliedFilters.status && item.status !== appliedFilters.status) {
        return false;
      }
      if (positionQuery && !item.positionName.toLowerCase().includes(positionQuery)) {
        return false;
      }
      return true;
    });
  }, [organizations, appliedFilters]);

  const handleApply = () => {
    setAppliedFilters(filters);
  };

  const handleClear = () => {
    setFilters(emptyFilters);
    setAppliedFilters(emptyFilters);
  };

  const openAdd = () => {
    setEditingId(null);
    setForm(emptyForm);
    setErrors({});
    setIsModalOpen(true);
  };

  const openEdit = (item: OrganizationItem) => {
    setEditingId(item.id);
    setForm({
      unitName: item.unitName,
      positionName: item.positionName,
      level: item.level,
      status: item.status,
    });
    setErrors({});
    setIsModalOpen(true);
  };

  const validate = () => {
    const nextErrors: Record<string, string> = {};
    if (!form.positionName.trim()) {
      nextErrors.positionName = 'Nama jabatan wajib diisi.';
    }
    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const handleSave = () => {
    if (!validate()) return;
    if (editingId) {
      updateOrganization(editingId, form);
    } else {
      addOrganization(form);
    }
    setIsModalOpen(false);
  };

  const handleDelete = (id: string) => {
    if (window.confirm('Hapus data organisasi ini?')) {
      removeOrganization(id);
    }
  };

  const instansiName = instansi.name || 'Perum LPPNPI Cabang Surabaya';
  const totalData = filteredOrganizations.length;
  const showingText =
    totalData === 0
      ? 'Menampilkan 0 data'
      : `Menampilkan 1 - ${totalData} dari total ${totalData} data`;

  return (
    <div className="space-y-6">
      {apiError && (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-xs text-red-700">
          <span>{apiError}</span>
          <Button variant="outline" size="sm" onClick={clearApiError}>
            Tutup
          </Button>
        </div>
      )}
      <div className="overflow-hidden rounded-2xl shadow-sm">
        <div className="glass-top flex flex-wrap items-center justify-between gap-3 border-b border-white/70 px-4 py-4 dark:border-slate-700/70">
          <div className="text-sm font-semibold text-slate-800 dark:text-slate-100">{instansiName}</div>
          <Button
            className="border border-emerald-200 bg-emerald-500 text-white hover:bg-emerald-600"
            onClick={openAdd}
          >
            <Plus className="mr-2 h-4 w-4" />
            Tambah Data
          </Button>
        </div>

        <div className="bg-white p-4 dark:bg-[#0b1736]">
          <div className="grid gap-3 lg:grid-cols-[minmax(240px,1.2fr)_minmax(220px,1fr)_minmax(220px,1fr)_auto]">
            <select
              className={selectBaseClass}
              value={filters.unit}
              onChange={(event) =>
                setFilters((prev) => ({ ...prev, unit: event.target.value }))
              }
            >
              <option value="">Pilih Nama Unit</option>
              {unitOptions.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>

            <Input
              placeholder="Cari Nama Jabatan"
              value={filters.position}
              onChange={(event) =>
                setFilters((prev) => ({ ...prev, position: event.target.value }))
              }
            />

            <select
              className={selectBaseClass}
              value={filters.status}
              onChange={(event) =>
                setFilters((prev) => ({ ...prev, status: event.target.value }))
              }
            >
              <option value="">Pilih Status Organisasi</option>
              <option value="Aktif">Aktif</option>
              <option value="Nonaktif">Nonaktif</option>
            </select>

            <div className="flex items-center gap-2 lg:justify-end">
              <Button
                size="icon"
                className="h-10 w-10 rounded-xl bg-sky-500 text-white hover:bg-sky-600"
                onClick={handleApply}
              >
                <Search className="h-4 w-4" />
              </Button>
              <Button
                size="icon"
                variant="outline"
                className="h-10 w-10 rounded-xl border-slate-200 text-slate-500 hover:border-slate-300 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:border-slate-500 dark:hover:bg-slate-800/70"
                onClick={handleClear}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>

          <div className="mt-4 overflow-hidden rounded-xl border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900/60">
            <Table>
              <TableHeader>
                <TableRow className="bg-slate-50/80 dark:bg-slate-800/70">
                  <TableHead className="w-12 text-xs font-semibold uppercase tracking-[0.2em] text-slate-400 dark:text-slate-300">
                    No
                  </TableHead>
                  <TableHead className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400 dark:text-slate-300">
                    Nama Unit
                  </TableHead>
                  <TableHead className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400 dark:text-slate-300">
                    Nama Jabatan
                  </TableHead>
                  <TableHead className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400 dark:text-slate-300">
                    Level
                  </TableHead>
                  <TableHead className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400 dark:text-slate-300">
                    Status
                  </TableHead>
                  <TableHead className="text-center text-xs font-semibold uppercase tracking-[0.2em] text-slate-400 dark:text-slate-300">
                    Action
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredOrganizations.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="p-6 text-center text-sm text-slate-500 dark:text-slate-300">
                      Data organisasi belum tersedia.
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredOrganizations.map((item, index) => (
                    <TableRow key={item.id}>
                      <TableCell className="text-xs font-semibold text-slate-600 dark:text-slate-300">
                        {index + 1}
                      </TableCell>
                      <TableCell className="text-xs">{item.unitName || '-'}</TableCell>
                      <TableCell className="text-xs">{item.positionName}</TableCell>
                      <TableCell className="text-xs">{item.level || '-'}</TableCell>
                      <TableCell className="text-xs">
                        <span
                          className={cn(
                            'inline-flex items-center rounded-full px-2 py-1 text-[11px] font-semibold ring-1',
                            statusStyles[item.status]
                          )}
                        >
                          {item.status}
                        </span>
                      </TableCell>
                      <TableCell>
                        <div className="flex justify-center gap-2">
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-8 w-8 rounded-lg bg-sky-500/10 text-sky-600 hover:bg-sky-500 hover:text-white"
                            onClick={() => openEdit(item)}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-8 w-8 rounded-lg bg-red-500/10 text-red-600 hover:bg-red-500 hover:text-white"
                            onClick={() => handleDelete(item.id)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>

          <div className="mt-3 text-xs text-slate-500 dark:text-slate-300">{showingText}</div>
        </div>
      </div>

      <Modal
        open={isModalOpen}
        onOpenChange={setIsModalOpen}
        title={editingId ? 'Edit Organisasi' : 'Tambah Organisasi'}
      >
        <div className="grid gap-4">
          <FormField label="Nama Unit">
            <Input
              value={form.unitName}
              onChange={(event) =>
                setForm((prev) => ({ ...prev, unitName: event.target.value }))
              }
            />
          </FormField>

          <FormField label="Nama Jabatan" required error={errors.positionName}>
            <Input
              value={form.positionName}
              onChange={(event) =>
                setForm((prev) => ({ ...prev, positionName: event.target.value }))
              }
            />
          </FormField>

          <FormField label="Level">
            <Input
              value={form.level}
              onChange={(event) =>
                setForm((prev) => ({ ...prev, level: event.target.value }))
              }
            />
          </FormField>

          <FormField label="Status">
            <select
              className={selectBaseClass}
              value={form.status}
              onChange={(event) =>
                setForm((prev) => ({
                  ...prev,
                  status: event.target.value as OrganizationStatus,
                }))
              }
            >
              <option value="Aktif">Aktif</option>
              <option value="Nonaktif">Nonaktif</option>
            </select>
          </FormField>
        </div>

        <div className="mt-4 flex justify-end gap-2">
          <Button variant="outline" onClick={() => setIsModalOpen(false)}>
            Batal
          </Button>
          <Button onClick={handleSave}>Simpan</Button>
        </div>
      </Modal>
    </div>
  );
}
