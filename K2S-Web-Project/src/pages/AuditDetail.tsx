import { useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { DataTable } from '@/components/shared/DataTable';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { Modal } from '@/components/shared/Modal';
import { FormField, FormSection } from '@/components/shared/Form';
import { useAppData } from '@/contexts/AppDataContext';
import { formatDate } from '@/lib/date';
import { NotFound } from '@/pages/NotFound';
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

export function AuditDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const {
    audits,
    findings,
    followUps,
    addFinding,
    updateFinding,
    removeFinding,
    addFollowUp,
    updateFollowUp,
    removeFollowUp,
  } = useAppData();

  const audit = audits.find((item) => item.id === id);

  const auditFindings = useMemo(
    () =>
      findings.filter(
        (finding) => finding.sumber === 'Audit' && finding.sumberId === id
      ),
    [findings, id]
  );

  const auditFindingIds = useMemo(
    () => new Set(auditFindings.map((finding) => finding.id)),
    [auditFindings]
  );

  const auditFollowUps = useMemo(
    () => followUps.filter((cap) => auditFindingIds.has(cap.findingId)),
    [followUps, auditFindingIds]
  );

  const [findingModalOpen, setFindingModalOpen] = useState(false);
  const [editingFinding, setEditingFinding] = useState<Finding | null>(null);
  const [findingForm, setFindingForm] = useState<{
    kategori: string;
    deskripsi: string;
    severity: Severity;
    status: FindingStatus;
    dueDate: string;
  }>({
    kategori: '',
    deskripsi: '',
    severity: SEVERITY_OPTIONS[1],
    status: STATUS_OPTIONS[0],
    dueDate: '',
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

  if (!audit) {
    return <NotFound />;
  }

  const resetFindingForm = () => {
    setFindingForm({
      kategori: '',
      deskripsi: '',
      severity: SEVERITY_OPTIONS[1],
      status: STATUS_OPTIONS[0],
      dueDate: '',
    });
    setFindingErrors({});
    setEditingFinding(null);
  };

  const openAddFinding = () => {
    resetFindingForm();
    setFindingModalOpen(true);
  };

  const openEditFinding = (item: Finding) => {
    setFindingForm({
      kategori: item.kategori,
      deskripsi: item.deskripsi,
      severity: item.severity,
      status: item.status,
      dueDate: item.dueDate,
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
        sumber: 'Audit',
        sumberId: audit.id,
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

  const findingLabel = (findingId: string) => {
    const target = auditFindings.find((finding) => finding.id === findingId);
    return target ? `${target.kategori} (${target.severity})` : 'Temuan';
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <Button variant="outline" onClick={() => navigate('/audit')}>
            Kembali
          </Button>
          <h1 className="mt-3 text-2xl font-semibold text-slate-800">Detail Audit</h1>
          <p className="text-sm text-slate-500">Ringkasan audit dan temuan terkait.</p>
        </div>
        <Button onClick={openAddFinding}>Tambah Temuan</Button>
      </div>

      <div className="grid gap-4 rounded-lg border border-slate-200 bg-white p-4 md:grid-cols-2">
        <div>
          <div className="text-xs uppercase text-slate-400">Nomor Audit</div>
          <div className="text-lg font-semibold text-slate-800">{audit.number}</div>
        </div>
        <div>
          <div className="text-xs uppercase text-slate-400">Tanggal</div>
          <div className="text-lg font-semibold text-slate-800">{formatDate(audit.date)}</div>
        </div>
        <div>
          <div className="text-xs uppercase text-slate-400">Lokasi</div>
          <div className="text-sm font-semibold text-slate-800">{audit.location}</div>
        </div>
        <div>
          <div className="text-xs uppercase text-slate-400">Status</div>
          <StatusBadge status={audit.status} />
        </div>
        <div className="md:col-span-2">
          <div className="text-xs uppercase text-slate-400">Fokus</div>
          <div className="text-sm text-slate-700">{audit.focus}</div>
        </div>
      </div>

      <div className="space-y-3">
        <h2 className="text-lg font-semibold text-slate-800">Temuan Audit</h2>
        <DataTable
          data={auditFindings}
          emptyState="Belum ada temuan untuk audit ini."
          columns={[
            { header: 'Kategori', render: (item) => item.kategori },
            { header: 'Deskripsi', render: (item) => item.deskripsi },
            { header: 'Severity', render: (item) => <StatusBadge status={item.severity} /> },
            { header: 'Status', render: (item) => <StatusBadge status={item.status} /> },
            { header: 'Due Date', render: (item) => formatDate(item.dueDate) },
            {
              header: 'CAP',
              render: (item) =>
                auditFollowUps.filter((cap) => cap.findingId === item.id).length,
            },
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
          data={auditFollowUps}
          emptyState="Belum ada CAP untuk temuan audit ini."
          columns={[
            { header: 'Temuan', render: (cap) => findingLabel(cap.findingId) },
            { header: 'Aksi Perbaikan', render: (cap) => cap.aksiPerbaikan },
            { header: 'PIC', render: (cap) => cap.pic },
            { header: 'Target', render: (cap) => formatDate(cap.targetDate) },
            { header: 'Status', render: (cap) => <StatusBadge status={cap.status} /> },
            {
              header: 'Evidence',
              render: (cap) => `${cap.evidenceFiles.length} file`,
            },
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

      <Modal
        open={findingModalOpen}
        onOpenChange={setFindingModalOpen}
        title={editingFinding ? 'Edit Temuan' : 'Tambah Temuan'}
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
