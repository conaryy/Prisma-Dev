import { useMemo, useState } from 'react';
import { Plus, Search, X, Pencil, Trash2, FolderOpen } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Modal } from '@/components/shared/Modal';
import { FormField } from '@/components/shared/Form';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useAppData } from '@/contexts/AppDataContext';
import { PersonilItem } from '@/types/kks';

const selectBaseClass =
  'flex h-10 w-full rounded-xl border border-input bg-white/80 px-3 text-sm shadow-sm transition-colors duration-200 focus-visible:outline-none focus-visible:border-blue-300 focus-visible:ring-2 focus-visible:ring-blue-200 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-700 dark:bg-slate-900/70 dark:text-slate-100 dark:focus-visible:border-blue-400 dark:focus-visible:ring-blue-900/50';

const emptyForm: Omit<PersonilItem, 'id'> = {
  name: '',
  position: '',
  level: '',
  field: '',
  tier: '',
};

const emptyFilters = {
  name: '',
  position: '',
  field: '',
  level: '',
  tier: '',
};

export function InstansiPersonil() {
  const {
    instansi,
    personil,
    addPersonil,
    updatePersonil,
    removePersonil,
    apiError,
    clearApiError,
  } = useAppData();
  const [filters, setFilters] = useState(emptyFilters);
  const [appliedFilters, setAppliedFilters] = useState(emptyFilters);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<Omit<PersonilItem, 'id'>>(emptyForm);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const positionOptions = useMemo(
    () => Array.from(new Set(personil.map((item) => item.position))).sort(),
    [personil]
  );
  const fieldOptions = useMemo(
    () => Array.from(new Set(personil.map((item) => item.field))).sort(),
    [personil]
  );
  const levelOptions = useMemo(
    () => Array.from(new Set(personil.map((item) => item.level))).sort(),
    [personil]
  );
  const tierOptions = useMemo(
    () => Array.from(new Set(personil.map((item) => item.tier))).sort(),
    [personil]
  );

  const filteredPersonil = useMemo(() => {
    const nameQuery = appliedFilters.name.trim().toLowerCase();

    return personil.filter((item) => {
      if (appliedFilters.position && item.position !== appliedFilters.position) {
        return false;
      }
      if (appliedFilters.field && item.field !== appliedFilters.field) {
        return false;
      }
      if (appliedFilters.level && item.level !== appliedFilters.level) {
        return false;
      }
      if (appliedFilters.tier && item.tier !== appliedFilters.tier) {
        return false;
      }
      if (nameQuery && !item.name.toLowerCase().includes(nameQuery)) {
        return false;
      }
      return true;
    });
  }, [personil, appliedFilters]);

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

  const openEdit = (item: PersonilItem) => {
    setEditingId(item.id);
    setForm({
      name: item.name,
      position: item.position,
      level: item.level,
      field: item.field,
      tier: item.tier,
    });
    setErrors({});
    setIsModalOpen(true);
  };

  const validate = () => {
    const nextErrors: Record<string, string> = {};
    if (!form.name.trim()) nextErrors.name = 'Nama personil wajib diisi.';
    if (!form.position.trim()) nextErrors.position = 'Jabatan wajib diisi.';
    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const handleSave = () => {
    if (!validate()) return;
    if (editingId) {
      updatePersonil(editingId, form);
    } else {
      addPersonil(form);
    }
    setIsModalOpen(false);
  };

  const handleDelete = (id: string) => {
    if (window.confirm('Hapus data personil ini?')) {
      removePersonil(id);
    }
  };

  const instansiName = instansi.name || 'Perum LPPNPI Cabang Surabaya';
  const totalData = filteredPersonil.length;
  const showingText =
    totalData === 0
      ? 'Menampilkan 0 - 0 dari total 0 data'
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
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            <Input
              placeholder="Cari Nama Personil"
              value={filters.name}
              onChange={(event) =>
                setFilters((prev) => ({ ...prev, name: event.target.value }))
              }
            />

            <select
              className={selectBaseClass}
              value={filters.position}
              onChange={(event) =>
                setFilters((prev) => ({ ...prev, position: event.target.value }))
              }
            >
              <option value="">Pilih Jabatan Personil</option>
              {positionOptions.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>

            <select
              className={selectBaseClass}
              value={filters.field}
              onChange={(event) =>
                setFilters((prev) => ({ ...prev, field: event.target.value }))
              }
            >
              <option value="">Pilih Bidang Personil</option>
              {fieldOptions.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </div>

          <div className="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-[minmax(220px,1fr)_minmax(220px,1fr)_auto]">
            <select
              className={selectBaseClass}
              value={filters.level}
              onChange={(event) =>
                setFilters((prev) => ({ ...prev, level: event.target.value }))
              }
            >
              <option value="">Pilih Level Jabatan</option>
              {levelOptions.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>

            <select
              className={selectBaseClass}
              value={filters.tier}
              onChange={(event) =>
                setFilters((prev) => ({ ...prev, tier: event.target.value }))
              }
            >
              <option value="">Pilih Jenjang Personil</option>
              {tierOptions.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>

            <div className="flex items-center gap-2 xl:justify-end">
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
                    Nama Personil
                  </TableHead>
                  <TableHead className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400 dark:text-slate-300">
                    Jabatan
                  </TableHead>
                  <TableHead className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400 dark:text-slate-300">
                    Level
                  </TableHead>
                  <TableHead className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400 dark:text-slate-300">
                    Bidang
                  </TableHead>
                  <TableHead className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400 dark:text-slate-300">
                    Jenjang
                  </TableHead>
                  <TableHead className="text-center text-xs font-semibold uppercase tracking-[0.2em] text-slate-400 dark:text-slate-300">
                    <span className="sr-only">Action</span>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredPersonil.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="py-10">
                      <div className="flex flex-col items-center gap-2 text-sm text-slate-400 dark:text-slate-300">
                        <FolderOpen className="h-10 w-10" />
                        Data tidak ditemukan
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredPersonil.map((item, index) => (
                    <TableRow key={item.id}>
                      <TableCell className="text-xs font-semibold text-slate-600 dark:text-slate-300">
                        {index + 1}
                      </TableCell>
                      <TableCell className="text-xs">{item.name}</TableCell>
                      <TableCell className="text-xs">{item.position || '-'}</TableCell>
                      <TableCell className="text-xs">{item.level || '-'}</TableCell>
                      <TableCell className="text-xs">{item.field || '-'}</TableCell>
                      <TableCell className="text-xs">{item.tier || '-'}</TableCell>
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
        title={editingId ? 'Edit Personil' : 'Tambah Personil'}
      >
        <div className="grid gap-4">
          <FormField label="Nama Personil" required error={errors.name}>
            <Input
              value={form.name}
              onChange={(event) =>
                setForm((prev) => ({ ...prev, name: event.target.value }))
              }
            />
          </FormField>

          <FormField label="Jabatan Personil" required error={errors.position}>
            <Input
              value={form.position}
              onChange={(event) =>
                setForm((prev) => ({ ...prev, position: event.target.value }))
              }
            />
          </FormField>

          <FormField label="Level Jabatan">
            <Input
              value={form.level}
              onChange={(event) =>
                setForm((prev) => ({ ...prev, level: event.target.value }))
              }
            />
          </FormField>

          <FormField label="Bidang Personil">
            <Input
              value={form.field}
              onChange={(event) =>
                setForm((prev) => ({ ...prev, field: event.target.value }))
              }
            />
          </FormField>

          <FormField label="Jenjang Personil">
            <Input
              value={form.tier}
              onChange={(event) =>
                setForm((prev) => ({ ...prev, tier: event.target.value }))
              }
            />
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
