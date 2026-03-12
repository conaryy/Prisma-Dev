import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { DataTable } from '@/components/shared/DataTable';
import { Modal } from '@/components/shared/Modal';
import { FormField, FormSection } from '@/components/shared/Form';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { useAppData } from '@/contexts/AppDataContext';
import { formatDate } from '@/lib/date';

const STATUS_OPTIONS = ['Direncanakan', 'Berjalan', 'Selesai'];

export function InspeksiList() {
  const { inspections, addInspection, updateInspection, removeInspection } = useAppData();
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({
    number: '',
    date: '',
    location: '',
    status: STATUS_OPTIONS[0],
    unit: '',
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    const timer = setTimeout(() => setIsLoading(false), 400);
    return () => clearTimeout(timer);
  }, []);

  const sortedInspections = useMemo(
    () => [...inspections].sort((a, b) => b.date.localeCompare(a.date)),
    [inspections]
  );

  const resetForm = () => {
    setForm({
      number: '',
      date: '',
      location: '',
      status: STATUS_OPTIONS[0],
      unit: '',
    });
    setErrors({});
    setEditingId(null);
  };

  const openAdd = () => {
    resetForm();
    setIsModalOpen(true);
  };

  const openEdit = (item: typeof inspections[number]) => {
    setForm({
      number: item.number,
      date: item.date,
      location: item.location,
      status: item.status,
      unit: item.unit,
    });
    setEditingId(item.id);
    setErrors({});
    setIsModalOpen(true);
  };

  const validate = () => {
    const nextErrors: Record<string, string> = {};
    if (!form.number.trim()) nextErrors.number = 'Nomor inspeksi wajib diisi.';
    if (!form.date) nextErrors.date = 'Tanggal wajib diisi.';
    if (!form.location.trim()) nextErrors.location = 'Lokasi wajib diisi.';
    if (!form.unit.trim()) nextErrors.unit = 'Unit wajib diisi.';
    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const handleSave = () => {
    if (!validate()) return;
    if (editingId) {
      updateInspection(editingId, form);
    } else {
      addInspection(form);
    }
    setIsModalOpen(false);
    resetForm();
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-slate-800">Inspeksi</h1>
          <p className="text-sm text-slate-500">Daftar inspeksi pengawasan.</p>
        </div>
        <Button onClick={openAdd}>Buat Inspeksi</Button>
      </div>

      <DataTable
        data={sortedInspections}
        isLoading={isLoading}
        onRowClick={(item) => navigate(`/inspeksi/${item.id}/pq`)}
        columns={[
          { header: 'Nomor', render: (item) => item.number },
          { header: 'Tanggal', render: (item) => formatDate(item.date) },
          { header: 'Lokasi', render: (item) => item.location },
          { header: 'Unit', render: (item) => item.unit },
          { header: 'Status', render: (item) => <StatusBadge status={item.status} /> },
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
                    removeInspection(item.id);
                  }}
                >
                  Hapus
                </Button>
              </div>
            ),
          },
        ]}
      />

      <Modal
        open={isModalOpen}
        onOpenChange={setIsModalOpen}
        title={editingId ? 'Edit Inspeksi' : 'Buat Inspeksi'}
      >
        <FormSection>
          <div className="grid gap-4">
            <FormField label="Nomor Inspeksi" required error={errors.number}>
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
            <FormField label="Unit" required error={errors.unit}>
              <Input
                value={form.unit}
                onChange={(event) => setForm({ ...form, unit: event.target.value })}
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
