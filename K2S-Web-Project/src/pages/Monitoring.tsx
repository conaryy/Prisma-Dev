import { useMemo, useState } from 'react';
import { Activity } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { DataTable } from '@/components/shared/DataTable';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { Modal } from '@/components/shared/Modal';
import { FormField, FormSection } from '@/components/shared/Form';
import { useAppData } from '@/contexts/AppDataContext';
import { formatDate } from '@/lib/date';
import {
  EvidenceFile,
  Finding,
  FindingStatus,
  FollowUp,
  FollowUpStatus,
  Severity,
} from '@/types/kks';

const STATUS_OPTIONS: FindingStatus[] = ['Open', 'In Progress', 'Closed'];
const SEVERITY_OPTIONS: Severity[] = ['Low', 'Med', 'High'];
const CAP_STATUS_OPTIONS: FollowUpStatus[] = ['Open', 'In Progress', 'Done'];

const buildEvidence = (file: File) =>
  new Promise<EvidenceFile>((resolve) => {
    const reader = new FileReader();
    reader.onload = () =>
      resolve({ name: file.name, url: reader.result as string });
    reader.onerror = () => resolve({ name: file.name, url: '' });
    reader.readAsDataURL(file);
  });

export function Monitoring() {
  const {
    monitoring,
    findings,
    followUps,
    addFinding,
    updateFinding,
    removeFinding,
    addFollowUp,
    updateFollowUp,
    removeFollowUp,
  } = useAppData();

  const [filterFrom, setFilterFrom] = useState('');
  const [filterTo, setFilterTo] = useState('');

  const [findingModalOpen, setFindingModalOpen] = useState(false);
  const [editingFinding, setEditingFinding] = useState<Finding | null>(null);
  const [findingForm, setFindingForm] = useState<{
    kategori: string;
    deskripsi: string;
    severity: Severity;
    status: FindingStatus;
    dueDate: string;
    sourceId: string;
  }>({
    kategori: '',
    deskripsi: '',
    severity: SEVERITY_OPTIONS[1],
    status: STATUS_OPTIONS[0],
    dueDate: '',
    sourceId: '',
  });
  const [findingErrors, setFindingErrors] = useState<Record<string, string>>({});

  const [followUpModalOpen, setFollowUpModalOpen] = useState(false);
  const [editingFollowUp, setEditingFollowUp] = useState<FollowUp | null>(null);
  const [followUpForm, setFollowUpForm] = useState<{
    findingId: string;
    aksiPerbaikan: string;
    pic: string;
    targetDate: string;
    status: FollowUpStatus;
    evidenceFiles: EvidenceFile[];
    comment: string;
  }>({
    findingId: '',
    aksiPerbaikan: '',
    pic: '',
    targetDate: '',
    status: CAP_STATUS_OPTIONS[0],
    evidenceFiles: [] as EvidenceFile[],
    comment: '',
  });
  const [followUpErrors, setFollowUpErrors] = useState<Record<string, string>>({});
  const [historyModalOpen, setHistoryModalOpen] = useState(false);
  const [historyTarget, setHistoryTarget] = useState<FollowUp | null>(null);

  const periodLabel = useMemo(() => {
    if (!filterFrom && !filterTo) {
      return 'Semua Periode';
    }
    if (filterFrom && filterTo) {
      return `${formatDate(filterFrom)} - ${formatDate(filterTo)}`;
    }
    if (filterFrom) {
      return `Mulai ${formatDate(filterFrom)}`;
    }
    return `Sampai ${formatDate(filterTo)}`;
  }, [filterFrom, filterTo]);

  const filteredMonitoring = useMemo(() => {
    return monitoring.filter((item) => {
      if (filterFrom && item.date < filterFrom) return false;
      if (filterTo && item.date > filterTo) return false;
      return true;
    });
  }, [monitoring, filterFrom, filterTo]);

  const monitoringFindings = useMemo(
    () => findings.filter((finding) => finding.sumber === 'Monitoring'),
    [findings]
  );

  const monitoringFindingIds = useMemo(
    () => new Set(monitoringFindings.map((finding) => finding.id)),
    [monitoringFindings]
  );

  const monitoringFollowUps = useMemo(
    () => followUps.filter((cap) => monitoringFindingIds.has(cap.findingId)),
    [followUps, monitoringFindingIds]
  );

  const resetFindingForm = () => {
    setFindingForm({
      kategori: '',
      deskripsi: '',
      severity: SEVERITY_OPTIONS[1],
      status: STATUS_OPTIONS[0],
      dueDate: '',
      sourceId: '',
    });
    setFindingErrors({});
    setEditingFinding(null);
  };

  const openAddFinding = (sourceId: string) => {
    resetFindingForm();
    setFindingForm((prev) => ({ ...prev, sourceId }));
    setFindingModalOpen(true);
  };

  const openEditFinding = (item: Finding) => {
    setFindingForm({
      kategori: item.kategori,
      deskripsi: item.deskripsi,
      severity: item.severity,
      status: item.status,
      dueDate: item.dueDate,
      sourceId: item.sumberId,
    });
    setEditingFinding(item);
    setFindingErrors({});
    setFindingModalOpen(true);
  };

  const validateFinding = () => {
    const nextErrors: Record<string, string> = {};
    if (!findingForm.kategori.trim()) nextErrors.kategori = 'Kategori wajib diisi.';
    if (!findingForm.deskripsi.trim()) nextErrors.deskripsi = 'Deskripsi wajib diisi.';
    if (!findingForm.dueDate) nextErrors.dueDate = 'Due date wajib diisi.';
    setFindingErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const handleSaveFinding = () => {
    if (!validateFinding()) return;
    if (editingFinding) {
      updateFinding(editingFinding.id, {
        kategori: findingForm.kategori,
        deskripsi: findingForm.deskripsi,
        severity: findingForm.severity,
        status: findingForm.status,
        dueDate: findingForm.dueDate,
      });
    } else {
      addFinding({
        sumber: 'Monitoring',
        sumberId: findingForm.sourceId,
        kategori: findingForm.kategori,
        deskripsi: findingForm.deskripsi,
        severity: findingForm.severity,
        status: findingForm.status,
        dueDate: findingForm.dueDate,
      });
    }
    setFindingModalOpen(false);
    resetFindingForm();
  };

  const resetFollowUpForm = () => {
    setFollowUpForm({
      findingId: '',
      aksiPerbaikan: '',
      pic: '',
      targetDate: '',
      status: CAP_STATUS_OPTIONS[0],
      evidenceFiles: [],
      comment: '',
    });
    setFollowUpErrors({});
    setEditingFollowUp(null);
  };

  const openAddFollowUp = (findingId: string) => {
    resetFollowUpForm();
    setFollowUpForm((prev) => ({ ...prev, findingId }));
    setFollowUpModalOpen(true);
  };

  const openEditFollowUp = (cap: FollowUp) => {
    setFollowUpForm({
      findingId: cap.findingId,
      aksiPerbaikan: cap.aksiPerbaikan,
      pic: cap.pic,
      targetDate: cap.targetDate,
      status: cap.status,
      evidenceFiles: cap.evidenceFiles,
      comment: '',
    });
    setEditingFollowUp(cap);
    setFollowUpErrors({});
    setFollowUpModalOpen(true);
  };

  const validateFollowUp = () => {
    const nextErrors: Record<string, string> = {};
    if (!followUpForm.aksiPerbaikan.trim())
      nextErrors.aksiPerbaikan = 'Aksi perbaikan wajib diisi.';
    if (!followUpForm.pic.trim()) nextErrors.pic = 'PIC wajib diisi.';
    if (!followUpForm.targetDate) nextErrors.targetDate = 'Target wajib diisi.';
    setFollowUpErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const handleSaveFollowUp = () => {
    if (!validateFollowUp()) return;
    if (editingFollowUp) {
      updateFollowUp(
        editingFollowUp.id,
        {
          aksiPerbaikan: followUpForm.aksiPerbaikan,
          pic: followUpForm.pic,
          targetDate: followUpForm.targetDate,
          status: followUpForm.status,
          evidenceFiles: followUpForm.evidenceFiles,
        }
      );
    } else {
      addFollowUp({
        findingId: followUpForm.findingId,
        aksiPerbaikan: followUpForm.aksiPerbaikan,
        pic: followUpForm.pic,
        targetDate: followUpForm.targetDate,
        status: followUpForm.status,
        evidenceFiles: followUpForm.evidenceFiles,
        note: followUpForm.comment.trim() || undefined,
      });
    }
    setFollowUpModalOpen(false);
    resetFollowUpForm();
  };

  const handleEvidenceChange = async (files: FileList | null) => {
    if (!files) return;
    const uploads = await Promise.all(Array.from(files).map(buildEvidence));
    setFollowUpForm((prev) => ({
      ...prev,
      evidenceFiles: [...prev.evidenceFiles, ...uploads],
    }));
  };

  const removeEvidence = (index: number) => {
    setFollowUpForm((prev) => ({
      ...prev,
      evidenceFiles: prev.evidenceFiles.filter((_, idx) => idx !== index),
    }));
  };

  const findMonitoringLabel = (sourceId: string) => {
    const entry = monitoring.find((item) => item.id === sourceId);
    return entry ? `${entry.location} (${formatDate(entry.date)})` : 'Monitoring';
  };

  const findingLabel = (findingId: string) => {
    const target = monitoringFindings.find((finding) => finding.id === findingId);
    return target ? `${target.kategori} (${target.severity})` : 'Temuan';
  };

  return (
    <div className="space-y-6">
      <section className="overflow-hidden rounded-[28px] border border-slate-200/80 bg-white shadow-[0_24px_60px_rgba(15,23,42,0.08)]">
        <header className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-100 px-6 py-5">
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl border border-blue-200 bg-blue-50 text-blue-600 shadow-sm">
                <Activity className="h-5 w-5" />
              </span>
              <h1 className="text-lg font-semibold text-slate-800">Daftar Monitoring</h1>
            </div>
            <span className="hidden h-6 w-px bg-slate-200 sm:block" />
            <div className="flex items-center gap-2 text-sm text-slate-500">
              <span>Monitoring</span>
              <span>/</span>
              <span className="font-semibold text-blue-600">Daftar Monitoring</span>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <span className="rounded-xl bg-blue-500 px-4 py-2 text-sm font-semibold text-white shadow-sm">
              {periodLabel}
            </span>
            <Button
              type="button"
              className="h-10 rounded-xl bg-blue-500 px-5 text-white shadow-sm hover:bg-blue-600"
            >
              Export
            </Button>
          </div>
        </header>

        <div className="space-y-6 px-6 py-6">
          <div className="flex flex-wrap items-end gap-3">
            <div>
              <div className="text-xs font-semibold text-slate-500">Dari</div>
              <Input
                type="date"
                value={filterFrom}
                onChange={(event) => setFilterFrom(event.target.value)}
              />
            </div>
            <div>
              <div className="text-xs font-semibold text-slate-500">Sampai</div>
              <Input
                type="date"
                value={filterTo}
                onChange={(event) => setFilterTo(event.target.value)}
              />
            </div>
            <Button
              variant="outline"
              onClick={() => {
                setFilterFrom('');
                setFilterTo('');
              }}
            >
              Reset Filter
            </Button>
          </div>

          <DataTable
            data={filteredMonitoring}
            emptyState="Belum ada data monitoring."
            columns={[
              { header: 'Tanggal', render: (item) => formatDate(item.date) },
              { header: 'Lokasi', render: (item) => item.location },
              { header: 'Status', render: (item) => <StatusBadge status={item.status} /> },
              { header: 'Catatan', render: (item) => item.note },
              {
                header: 'Aksi',
                render: (item) => (
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => openAddFinding(item.id)}
                  >
                    Buat Temuan
                  </Button>
                ),
              },
            ]}
          />

          <div className="space-y-3">
            <h2 className="text-lg font-semibold text-slate-800">Temuan Monitoring</h2>
            <DataTable
              data={monitoringFindings}
              emptyState="Belum ada temuan monitoring."
              columns={[
                {
                  header: 'Sumber',
                  render: (item) => findMonitoringLabel(item.sumberId),
                },
                { header: 'Kategori', render: (item) => item.kategori },
                { header: 'Deskripsi', render: (item) => item.deskripsi },
                {
                  header: 'Severity',
                  render: (item) => <StatusBadge status={item.severity} />,
                },
                { header: 'Status', render: (item) => <StatusBadge status={item.status} /> },
                { header: 'Due Date', render: (item) => formatDate(item.dueDate) },
                {
                  header: 'Aksi',
                  render: (item) => (
                    <div className="flex flex-wrap gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={(event) => {
                          event.stopPropagation();
                          openEditFinding(item);
                        }}
                      >
                        Edit
                      </Button>
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={(event) => {
                          event.stopPropagation();
                          openAddFollowUp(item.id);
                        }}
                      >
                        Tambah CAP
                      </Button>
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={(event) => {
                          event.stopPropagation();
                          removeFinding(item.id);
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

          <div className="space-y-3">
            <h2 className="text-lg font-semibold text-slate-800">Tindak Lanjut (CAP)</h2>
            <DataTable
              data={monitoringFollowUps}
              emptyState="Belum ada CAP dari monitoring."
              columns={[
                { header: 'Temuan', render: (cap) => findingLabel(cap.findingId) },
                { header: 'Aksi Perbaikan', render: (cap) => cap.aksiPerbaikan },
                { header: 'PIC', render: (cap) => cap.pic },
                { header: 'Target', render: (cap) => formatDate(cap.targetDate) },
                { header: 'Status', render: (cap) => <StatusBadge status={cap.status} /> },
                {
                  header: 'Aksi',
                  render: (cap) => (
                    <div className="flex flex-wrap gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={(event) => {
                          event.stopPropagation();
                          setHistoryTarget(cap);
                          setHistoryModalOpen(true);
                        }}
                      >
                        History
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={(event) => {
                          event.stopPropagation();
                          openEditFollowUp(cap);
                        }}
                      >
                        Edit
                      </Button>
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={(event) => {
                          event.stopPropagation();
                          removeFollowUp(cap.id);
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
        </div>
      </section>

      <Modal
        open={findingModalOpen}
        onOpenChange={setFindingModalOpen}
        title={editingFinding ? 'Edit Temuan Monitoring' : 'Tambah Temuan Monitoring'}
      >
        <FormSection>
          <div className="grid gap-4">
            <FormField label="Kategori" required error={findingErrors.kategori}>
              <Input
                value={findingForm.kategori}
                onChange={(event) =>
                  setFindingForm({ ...findingForm, kategori: event.target.value })
                }
              />
            </FormField>
            <FormField label="Deskripsi" required error={findingErrors.deskripsi}>
              <Textarea
                rows={3}
                value={findingForm.deskripsi}
                onChange={(event) =>
                  setFindingForm({ ...findingForm, deskripsi: event.target.value })
                }
              />
            </FormField>
            <div className="grid gap-4 md:grid-cols-2">
              <FormField label="Severity">
                <select
                  className="h-9 w-full rounded-md border border-slate-200 px-3 text-sm"
                  value={findingForm.severity}
                  onChange={(event) =>
                    setFindingForm({
                      ...findingForm,
                      severity: event.target.value as Severity,
                    })
                  }
                >
                  {SEVERITY_OPTIONS.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              </FormField>
              <FormField label="Status">
                <select
                  className="h-9 w-full rounded-md border border-slate-200 px-3 text-sm"
                  value={findingForm.status}
                  onChange={(event) =>
                    setFindingForm({
                      ...findingForm,
                      status: event.target.value as FindingStatus,
                    })
                  }
                >
                  {STATUS_OPTIONS.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              </FormField>
            </div>
            <FormField label="Due Date" required error={findingErrors.dueDate}>
              <Input
                type="date"
                value={findingForm.dueDate}
                onChange={(event) =>
                  setFindingForm({ ...findingForm, dueDate: event.target.value })
                }
              />
            </FormField>
          </div>
          <div className="mt-4 flex justify-end gap-2">
            <Button variant="outline" onClick={() => setFindingModalOpen(false)}>
              Batal
            </Button>
            <Button onClick={handleSaveFinding}>Simpan</Button>
          </div>
        </FormSection>
      </Modal>

      <Modal
        open={followUpModalOpen}
        onOpenChange={setFollowUpModalOpen}
        title={editingFollowUp ? 'Edit CAP' : 'Tambah CAP'}
      >
        <FormSection>
          <div className="grid gap-4">
            <FormField label="Aksi Perbaikan" required error={followUpErrors.aksiPerbaikan}>
              <Textarea
                rows={3}
                value={followUpForm.aksiPerbaikan}
                onChange={(event) =>
                  setFollowUpForm({ ...followUpForm, aksiPerbaikan: event.target.value })
                }
              />
            </FormField>
            <div className="grid gap-4 md:grid-cols-2">
              <FormField label="PIC" required error={followUpErrors.pic}>
                <Input
                  value={followUpForm.pic}
                  onChange={(event) =>
                    setFollowUpForm({ ...followUpForm, pic: event.target.value })
                  }
                />
              </FormField>
              <FormField label="Target" required error={followUpErrors.targetDate}>
                <Input
                  type="date"
                  value={followUpForm.targetDate}
                  onChange={(event) =>
                    setFollowUpForm({ ...followUpForm, targetDate: event.target.value })
                  }
                />
              </FormField>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <FormField label="Status">
                <select
                  className="h-9 w-full rounded-md border border-slate-200 px-3 text-sm"
                  value={followUpForm.status}
                  onChange={(event) =>
                    setFollowUpForm({
                      ...followUpForm,
                      status: event.target.value as FollowUpStatus,
                    })
                  }
                >
                  {CAP_STATUS_OPTIONS.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              </FormField>
              <FormField label="Evidence Files">
                <Input
                  type="file"
                  multiple
                  onChange={(event) => handleEvidenceChange(event.target.files)}
                />
                {followUpForm.evidenceFiles.length > 0 && (
                  <div className="mt-2 space-y-1 text-xs text-slate-500">
                    {followUpForm.evidenceFiles.map((file, index) => (
                      <div key={`${file.name}-${index}`} className="flex items-center justify-between">
                        <span>{file.name}</span>
                        <button
                          type="button"
                          className="text-red-500"
                          onClick={() => removeEvidence(index)}
                        >
                          Hapus
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </FormField>
            </div>
            <FormField label="Komentar / Riwayat">
              <Textarea
                rows={2}
                value={followUpForm.comment}
                onChange={(event) =>
                  setFollowUpForm({ ...followUpForm, comment: event.target.value })
                }
                placeholder="Tambahkan komentar untuk riwayat perubahan"
              />
            </FormField>
          </div>
          <div className="mt-4 flex justify-end gap-2">
            <Button variant="outline" onClick={() => setFollowUpModalOpen(false)}>
              Batal
            </Button>
            <Button onClick={handleSaveFollowUp}>Simpan</Button>
          </div>
        </FormSection>
      </Modal>

      <Modal
        open={historyModalOpen}
        onOpenChange={setHistoryModalOpen}
        title="History CAP"
      >
        <div className="space-y-3 text-sm">
          {historyTarget?.history.length ? (
            historyTarget.history.map((item, index) => (
              <div key={`${item}-${index}`} className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2">
                {item}
              </div>
            ))
          ) : (
            <div className="text-slate-500">Belum ada riwayat.</div>
          )}
        </div>
      </Modal>
    </div>
  );
}
