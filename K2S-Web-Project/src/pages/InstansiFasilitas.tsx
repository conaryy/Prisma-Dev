import { useMemo, useState } from 'react';
import { Plus, Search, X, Pencil, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Modal } from '@/components/shared/Modal';
import { FormField } from '@/components/shared/Form';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useAppData } from '@/contexts/AppDataContext';
import { FacilityCondition, FacilityItem } from '@/types/kks';
import { cn } from '@/lib/utils';

const selectBaseClass =
  'flex h-10 w-full rounded-xl border border-input bg-white/80 px-3 text-sm shadow-sm transition-colors duration-200 focus-visible:outline-none focus-visible:border-blue-300 focus-visible:ring-2 focus-visible:ring-blue-200 disabled:cursor-not-allowed disabled:opacity-50';

const conditionStyles: Record<FacilityCondition, string> = {
  Normal: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
  Single: 'bg-amber-50 text-amber-700 ring-amber-200',
  Unserviceable: 'bg-red-50 text-red-700 ring-red-200',
};

const emptyForm: Omit<FacilityItem, 'id'> = {
  group: '',
  name: '',
  merk: '',
  type: '',
  frequency: '',
  ident: '',
  condition: 'Normal',
};

const emptyFilters = {
  group: '',
  name: '',
  merk: '',
  type: '',
  condition: '',
};

export function InstansiFasilitas() {
  const {
    instansi,
    facilities,
    addFacility,
    updateFacility,
    removeFacility,
    apiError,
    clearApiError,
  } = useAppData();
  const [filters, setFilters] = useState(emptyFilters);
  const [appliedFilters, setAppliedFilters] = useState(emptyFilters);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<Omit<FacilityItem, 'id'>>(emptyForm);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const groupOptions = useMemo(() => {
    const unique = Array.from(new Set(facilities.map((item) => item.group)));
    return unique.length > 0 ? unique.sort() : ['COMMUNICATION'];
  }, [facilities]);

  const filteredFacilities = useMemo(() => {
    const nameQuery = appliedFilters.name.trim().toLowerCase();
    const merkQuery = appliedFilters.merk.trim().toLowerCase();
    const typeQuery = appliedFilters.type.trim().toLowerCase();

    return facilities.filter((item) => {
      if (appliedFilters.group && item.group !== appliedFilters.group) {
        return false;
      }
      if (appliedFilters.condition && item.condition !== appliedFilters.condition) {
        return false;
      }
      if (nameQuery && !item.name.toLowerCase().includes(nameQuery)) {
        return false;
      }
      if (merkQuery && !item.merk.toLowerCase().includes(merkQuery)) {
        return false;
      }
      if (typeQuery && !item.type.toLowerCase().includes(typeQuery)) {
        return false;
      }
      return true;
    });
  }, [facilities, appliedFilters]);

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

  const openEdit = (item: FacilityItem) => {
    setEditingId(item.id);
    setForm({
      group: item.group,
      name: item.name,
      merk: item.merk,
      type: item.type,
      frequency: item.frequency,
      ident: item.ident,
      condition: item.condition,
    });
    setErrors({});
    setIsModalOpen(true);
  };

  const validate = () => {
    const nextErrors: Record<string, string> = {};
    if (!form.group.trim()) nextErrors.group = 'Kelompok fasilitas wajib diisi.';
    if (!form.name.trim()) nextErrors.name = 'Nama fasilitas wajib diisi.';
    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const handleSave = () => {
    if (!validate()) return;
    if (editingId) {
      updateFacility(editingId, form);
    } else {
      addFacility(form);
    }
    setIsModalOpen(false);
  };

  const handleDelete = (id: string) => {
    if (window.confirm('Hapus data fasilitas ini?')) {
      removeFacility(id);
    }
  };

  const instansiName = instansi.name || 'Perum LPPNPI Cabang Surabaya';

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
        <div className="glass-top flex flex-wrap items-center justify-between gap-3 border-b border-white/70 px-4 py-4">
          <div className="text-sm font-semibold text-slate-800">{instansiName}</div>
          <Button
            className="border border-emerald-200 bg-emerald-500 text-white hover:bg-emerald-600"
            onClick={openAdd}
          >
            <Plus className="mr-2 h-4 w-4" />
            Tambah Data
          </Button>
        </div>

        <div className="bg-white p-4">
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            <select
              className={selectBaseClass}
              value={filters.group}
              onChange={(event) =>
                setFilters((prev) => ({ ...prev, group: event.target.value }))
              }
            >
              <option value="">Pilih Kelompok Fasilitas</option>
              {groupOptions.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>

            <Input
              placeholder="Cari Nama Fasilitas"
              value={filters.name}
              onChange={(event) =>
                setFilters((prev) => ({ ...prev, name: event.target.value }))
              }
            />

            <Input
              placeholder="Cari Merk"
              value={filters.merk}
              onChange={(event) =>
                setFilters((prev) => ({ ...prev, merk: event.target.value }))
              }
            />

            <Input
              placeholder="Cari Jenis"
              value={filters.type}
              onChange={(event) =>
                setFilters((prev) => ({ ...prev, type: event.target.value }))
              }
            />

            <div className="flex items-center gap-2 md:col-span-2 xl:col-span-2">
              <select
                className={selectBaseClass}
                value={filters.condition}
                onChange={(event) =>
                  setFilters((prev) => ({ ...prev, condition: event.target.value }))
                }
              >
                <option value="">Kondisi Fasilitas</option>
                <option value="Normal">Normal</option>
                <option value="Single">Single</option>
                <option value="Unserviceable">Unserviceable</option>
              </select>
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
                className="h-10 w-10 rounded-xl border-slate-200 text-slate-500 hover:border-slate-300 hover:bg-slate-50"
                onClick={handleClear}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>

          <div className="mt-4 overflow-hidden rounded-xl border border-slate-200 bg-white">
            <Table>
              <TableHeader>
                <TableRow className="bg-slate-50/80">
                  <TableHead className="w-12 text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
                    No
                  </TableHead>
                  <TableHead className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
                    Kelompok Fasilitas
                  </TableHead>
                  <TableHead className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
                    Nama Fasilitas
                  </TableHead>
                  <TableHead className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
                    Merk
                  </TableHead>
                  <TableHead className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
                    Jenis
                  </TableHead>
                  <TableHead className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
                    Frek
                  </TableHead>
                  <TableHead className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
                    Ident
                  </TableHead>
                  <TableHead className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
                    Kondisi
                  </TableHead>
                  <TableHead className="text-center text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
                    Action
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredFacilities.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={9} className="p-6 text-center text-sm text-slate-500">
                      Data fasilitas belum tersedia.
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredFacilities.map((item, index) => (
                    <TableRow key={item.id}>
                      <TableCell className="text-xs font-semibold text-slate-600">
                        {index + 1}
                      </TableCell>
                      <TableCell className="text-xs">{item.group}</TableCell>
                      <TableCell className="text-xs">{item.name}</TableCell>
                      <TableCell className="text-xs">{item.merk || '-'}</TableCell>
                      <TableCell className="text-xs">{item.type || '-'}</TableCell>
                      <TableCell className="text-xs">{item.frequency || '-'}</TableCell>
                      <TableCell className="text-xs">{item.ident || '-'}</TableCell>
                      <TableCell className="text-xs">
                        <span
                          className={cn(
                            'inline-flex items-center rounded-full px-2 py-1 text-[11px] font-semibold ring-1',
                            conditionStyles[item.condition]
                          )}
                        >
                          {item.condition}
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
        </div>
      </div>

      <Modal
        open={isModalOpen}
        onOpenChange={setIsModalOpen}
        title={editingId ? 'Edit Fasilitas' : 'Tambah Fasilitas'}
      >
        <div className="grid gap-4">
          <FormField label="Kelompok Fasilitas" required error={errors.group}>
            <select
              className={selectBaseClass}
              value={form.group}
              onChange={(event) =>
                setForm((prev) => ({ ...prev, group: event.target.value }))
              }
            >
              <option value="">Pilih Kelompok Fasilitas</option>
              {groupOptions.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </FormField>

          <FormField label="Nama Fasilitas" required error={errors.name}>
            <Input
              value={form.name}
              onChange={(event) =>
                setForm((prev) => ({ ...prev, name: event.target.value }))
              }
            />
          </FormField>

          <FormField label="Merk">
            <Input
              value={form.merk}
              onChange={(event) =>
                setForm((prev) => ({ ...prev, merk: event.target.value }))
              }
            />
          </FormField>

          <FormField label="Jenis">
            <Input
              value={form.type}
              onChange={(event) =>
                setForm((prev) => ({ ...prev, type: event.target.value }))
              }
            />
          </FormField>

          <FormField label="Frek">
            <Input
              value={form.frequency}
              onChange={(event) =>
                setForm((prev) => ({ ...prev, frequency: event.target.value }))
              }
            />
          </FormField>

          <FormField label="Ident">
            <Input
              value={form.ident}
              onChange={(event) =>
                setForm((prev) => ({ ...prev, ident: event.target.value }))
              }
            />
          </FormField>

          <FormField label="Kondisi">
            <select
              className={selectBaseClass}
              value={form.condition}
              onChange={(event) =>
                setForm((prev) => ({
                  ...prev,
                  condition: event.target.value as FacilityCondition,
                }))
              }
            >
              <option value="Normal">Normal</option>
              <option value="Single">Single</option>
              <option value="Unserviceable">Unserviceable</option>
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
