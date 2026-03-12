import { useMemo, useState } from 'react';
import { Plus, Search, X, Pencil, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Modal } from '@/components/shared/Modal';
import { FormField } from '@/components/shared/Form';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useAppData } from '@/contexts/AppDataContext';
import { CertificateItem, CertificateStatus } from '@/types/kks';
import { formatDate } from '@/lib/date';
import { cn } from '@/lib/utils';
import { resolveApiUrl } from '@/lib/api';

const selectBaseClass =
  'flex h-10 w-full rounded-xl border border-input bg-white/80 px-3 text-sm shadow-sm transition-colors duration-200 focus-visible:outline-none focus-visible:border-blue-300 focus-visible:ring-2 focus-visible:ring-blue-200 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-700 dark:bg-slate-900/70 dark:text-slate-100 dark:focus-visible:border-blue-400 dark:focus-visible:ring-blue-900/50';

const statusStyles: Record<CertificateStatus, string> = {
  Berlaku: 'bg-emerald-50 text-emerald-700 ring-emerald-200 dark:bg-emerald-500/20 dark:text-emerald-300 dark:ring-emerald-700/50',
  'Tidak Berlaku': 'bg-red-50 text-red-700 ring-red-200 dark:bg-red-500/20 dark:text-red-300 dark:ring-red-700/50',
};

const emptyForm: Omit<CertificateItem, 'id'> = {
  name: '',
  type: '',
  number: '',
  validUntil: '',
  status: 'Berlaku',
};

const emptyFilters = {
  name: '',
  type: '',
  status: '',
};

export function InstansiSertifikat() {
  const {
    instansi,
    certificates,
    addCertificate,
    updateCertificate,
    removeCertificate,
    apiError,
    clearApiError,
  } = useAppData();
  const [filters, setFilters] = useState(emptyFilters);
  const [appliedFilters, setAppliedFilters] = useState(emptyFilters);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<Omit<CertificateItem, 'id'>>(emptyForm);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [existingFileName, setExistingFileName] = useState<string | null>(null);
  const [existingFileUrl, setExistingFileUrl] = useState<string | null>(null);

  const typeOptions = useMemo(() => {
    const unique = Array.from(new Set(certificates.map((item) => item.type)));
    return unique.length > 0 ? unique.sort() : ['Sertifikat 172'];
  }, [certificates]);

  const filteredCertificates = useMemo(() => {
    const nameQuery = appliedFilters.name.trim().toLowerCase();

    return certificates.filter((item) => {
      if (appliedFilters.type && item.type !== appliedFilters.type) {
        return false;
      }
      if (appliedFilters.status && item.status !== appliedFilters.status) {
        return false;
      }
      if (nameQuery && !item.name.toLowerCase().includes(nameQuery)) {
        return false;
      }
      return true;
    });
  }, [certificates, appliedFilters]);

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
    setSelectedFile(null);
    setExistingFileName(null);
    setExistingFileUrl(null);
    setErrors({});
    setIsModalOpen(true);
  };

  const openEdit = (item: CertificateItem) => {
    setEditingId(item.id);
    setForm({
      name: item.name,
      type: item.type,
      number: item.number,
      validUntil: item.validUntil,
      status: item.status,
    });
    setSelectedFile(null);
    setExistingFileName(item.fileName ?? null);
    setExistingFileUrl(item.fileUrl ?? null);
    setErrors({});
    setIsModalOpen(true);
  };

  const validate = () => {
    const nextErrors: Record<string, string> = {};
    if (!form.name.trim()) nextErrors.name = 'Nama sertifikat wajib diisi.';
    if (!form.type.trim()) nextErrors.type = 'Jenis sertifikat wajib diisi.';
    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const handleSave = () => {
    if (!validate()) return;
    if (editingId) {
      updateCertificate(editingId, { ...form, file: selectedFile });
    } else {
      addCertificate({ ...form, file: selectedFile });
    }
    setIsModalOpen(false);
  };

  const handleDelete = (id: string) => {
    if (window.confirm('Hapus data sertifikat ini?')) {
      removeCertificate(id);
    }
  };

  const instansiName = instansi.name || 'Perum LPPNPI Cabang Surabaya';
  const totalData = filteredCertificates.length;
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
          <div className="grid gap-3 lg:grid-cols-[minmax(220px,1fr)_minmax(220px,1fr)_minmax(220px,1fr)_auto]">
            <Input
              placeholder="Cari Nama Sertifikat"
              value={filters.name}
              onChange={(event) =>
                setFilters((prev) => ({ ...prev, name: event.target.value }))
              }
            />

            <select
              className={selectBaseClass}
              value={filters.type}
              onChange={(event) =>
                setFilters((prev) => ({ ...prev, type: event.target.value }))
              }
            >
              <option value="">Pilih Jenis Sertifikat</option>
              {typeOptions.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>

            <select
              className={selectBaseClass}
              value={filters.status}
              onChange={(event) =>
                setFilters((prev) => ({ ...prev, status: event.target.value }))
              }
            >
              <option value="">Pilih Status Sertifikat</option>
              <option value="Berlaku">Berlaku</option>
              <option value="Tidak Berlaku">Tidak Berlaku</option>
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
                  <TableHead className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400 dark:text-slate-300">
                    Nama Sertifikat
                  </TableHead>
                  <TableHead className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400 dark:text-slate-300">
                    Jenis Sertifikat
                  </TableHead>
                  <TableHead className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400 dark:text-slate-300">
                    Nomor Sertifikat
                  </TableHead>
                  <TableHead className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400 dark:text-slate-300">
                    Berlaku Sampai
                  </TableHead>
                  <TableHead className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400 dark:text-slate-300">
                    Status
                  </TableHead>
                  <TableHead className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400 dark:text-slate-300">
                    File Sertifikat
                  </TableHead>
                  <TableHead className="text-center text-xs font-semibold uppercase tracking-[0.2em] text-slate-400 dark:text-slate-300">
                    <span className="sr-only">Action</span>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredCertificates.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="p-6 text-center text-sm text-slate-500 dark:text-slate-300">
                      Data sertifikat belum tersedia.
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredCertificates.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell className="text-xs">{item.name}</TableCell>
                      <TableCell className="text-xs">{item.type || '-'}</TableCell>
                      <TableCell className="text-xs">{item.number || '-'}</TableCell>
                      <TableCell className="text-xs">{formatDate(item.validUntil)}</TableCell>
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
                      <TableCell className="text-xs">
                        {item.fileUrl ? (
                          <a
                            href={resolveApiUrl(item.fileUrl)}
                            target="_blank"
                            rel="noreferrer"
                            className="text-blue-600 underline dark:text-blue-300"
                          >
                            {item.fileName || 'Lihat file'}
                          </a>
                        ) : (
                          '-'
                        )}
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
        title={editingId ? 'Edit Sertifikat' : 'Tambah Sertifikat'}
      >
        <div className="grid gap-4">
          <FormField label="Nama Sertifikat" required error={errors.name}>
            <Input
              value={form.name}
              onChange={(event) =>
                setForm((prev) => ({ ...prev, name: event.target.value }))
              }
            />
          </FormField>

          <FormField label="Jenis Sertifikat" required error={errors.type}>
            <Input
              value={form.type}
              onChange={(event) =>
                setForm((prev) => ({ ...prev, type: event.target.value }))
              }
            />
          </FormField>

          <FormField label="Nomor Sertifikat">
            <Input
              value={form.number}
              onChange={(event) =>
                setForm((prev) => ({ ...prev, number: event.target.value }))
              }
            />
          </FormField>

          <FormField label="Berlaku Sampai">
            <Input
              type="date"
              value={form.validUntil}
              onChange={(event) =>
                setForm((prev) => ({ ...prev, validUntil: event.target.value }))
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
                  status: event.target.value as CertificateStatus,
                }))
              }
            >
              <option value="Berlaku">Berlaku</option>
              <option value="Tidak Berlaku">Tidak Berlaku</option>
            </select>
          </FormField>
          <FormField label="File Sertifikat (PDF/JPG/PNG)">
            <div className="space-y-2">
              <Input
                type="file"
                accept=".pdf,.png,.jpg,.jpeg"
                onChange={(event) => setSelectedFile(event.target.files?.[0] ?? null)}
              />
              {existingFileUrl && !selectedFile && (
                <a
                  href={resolveApiUrl(existingFileUrl)}
                  target="_blank"
                  rel="noreferrer"
                  className="text-xs text-blue-600 underline dark:text-blue-300"
                >
                  {existingFileName || 'Lihat file tersimpan'}
                </a>
              )}
              {selectedFile && (
                <div className="text-xs text-slate-500 dark:text-slate-300">
                  File dipilih: {selectedFile.name}
                </div>
              )}
            </div>
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
