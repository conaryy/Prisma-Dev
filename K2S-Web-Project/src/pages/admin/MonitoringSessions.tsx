import { useEffect, useMemo, useState } from 'react';
import { CalendarDays, Pencil, Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { apiFetch, resolveApiUrl } from '@/lib/api';

type MonitoringSessionItem = {
  id: string;
  title: string | null;
  start_date: string;
  end_date: string;
  is_published: boolean;
  target_session_area_ids?: string[] | null;
  target_agenda_ids?: string[] | null;
  users?: Array<{ id: string; name: string; email?: string }>;
};

type UserItem = {
  id: string;
  name: string;
  email: string | null;
  role: string;
};

type MonitoringCapTarget = {
  sessionAreaId: string;
  user: { id: string; name: string; email?: string } | null;
  area: string;
  scope: string;
  schedule: string | null;
  capCount: number;
  openCapCount?: number;
  completedCapCount?: number;
  isMissing?: boolean;
  title?: string;
};

const formatDateLabel = (value: string) => {
  if (!value) return '';
  const trimmed = value.trim();
  const datePart = trimmed.split('T')[0] ?? trimmed;
  return datePart.length > 10 ? datePart.slice(0, 10) : datePart;
};

const ALLOWED_CAP_SCOPES = new Set(['audit', 'inspeksi', 'surveillance']);

const formatScopeLabel = (scope: string | null | undefined) => {
  const normalized = (scope ?? '').toLowerCase();
  if (normalized === 'audit') return 'Audit';
  if (normalized === 'inspeksi') return 'Inspeksi';
  if (normalized === 'surveillance') return 'Surveillance';
  return '-';
};

export function MonitoringSessions() {
  const [sessions, setSessions] = useState<MonitoringSessionItem[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [users, setUsers] = useState<UserItem[]>([]);
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);
  const [capTargets, setCapTargets] = useState<MonitoringCapTarget[]>([]);
  const [selectedCapTargetIds, setSelectedCapTargetIds] = useState<string[]>([]);
  const [selectedTargetIds, setSelectedTargetIds] = useState<string[]>([]);
  const [isLoadingCapTargets, setIsLoadingCapTargets] = useState(false);
  const [monitoringFile, setMonitoringFile] = useState<File | null>(null);
  const [existingFileName, setExistingFileName] = useState<string | null>(null);
  const [existingFileUrl, setExistingFileUrl] = useState<string | null>(null);
  const [form, setForm] = useState({
    title: '',
    startDate: '',
    endDate: '',
    isPublished: true,
  });

  const loadSessions = () => {
    apiFetch<{ data: MonitoringSessionItem[] }>(
      '/api/admin/self-assessment/sessions?scope=monitoring'
    )
      .then((response) => setSessions(response.data ?? []))
      .catch((error: Error) =>
        setErrorMessage(error.message || 'Gagal memuat sesi monitoring.')
      );
  };

  useEffect(() => {
    loadSessions();
  }, []);

  const loadUsers = () => {
    apiFetch<{ data: UserItem[] }>('/api/users?limit=200')
      .then((response) => {
        setUsers(response.data ?? []);
      })
      .catch((error: Error) =>
        setErrorMessage(error.message || 'Gagal memuat user.')
      );
  };

  const loadCapTargets = () => {
    setIsLoadingCapTargets(true);
    apiFetch<{ data: MonitoringCapTarget[] }>(
      '/api/admin/self-assessment/cap/sessions'
    )
      .then((response) => setCapTargets(response.data ?? []))
      .catch((error: Error) =>
        setErrorMessage(error.message || 'Gagal memuat target CAP monitoring.')
      )
      .finally(() => setIsLoadingCapTargets(false));
  };

  useEffect(() => {
    loadUsers();
    loadCapTargets();
  }, []);

  const filteredUsers = useMemo(() => users, [users]);
  const filteredCapTargets = useMemo(() => {
    if (selectedUserIds.length === 0) {
      return [] as MonitoringCapTarget[];
    }
    const selectedUserIdSet = new Set(selectedUserIds);
    return capTargets.filter((item) => {
      const userId = item.user?.id;
      const scope = (item.scope ?? '').toLowerCase();
      return Boolean(
        userId && selectedUserIdSet.has(userId) && ALLOWED_CAP_SCOPES.has(scope)
      );
    });
  }, [capTargets, selectedUserIds]);

  const displayedCapTargets = useMemo(() => {
    if (selectedCapTargetIds.length === 0) {
      return filteredCapTargets;
    }
    const targetIds = new Set(filteredCapTargets.map((target) => target.sessionAreaId));
    const missingTargets = selectedCapTargetIds
      .filter((id) => !targetIds.has(id))
      .map((id) => ({
        sessionAreaId: id,
        user: null,
        area: 'Target arsip',
        scope: '-',
        schedule: null,
        capCount: 0,
        openCapCount: 0,
        completedCapCount: 0,
        isMissing: true,
        title: `Target arsip (${id.slice(0, 8)})`,
      }));
    return [...filteredCapTargets, ...missingTargets];
  }, [filteredCapTargets, selectedCapTargetIds]);

  useEffect(() => {
    if (selectedUserIds.length === 0) {
      return;
    }
    const selectedUserIdSet = new Set(selectedUserIds);
    setSelectedCapTargetIds((prev) =>
      prev.filter((sessionAreaId) => {
        const found = capTargets.find((item) => item.sessionAreaId === sessionAreaId);
        if (!found?.user?.id) return true;
        return selectedUserIdSet.has(found.user.id);
      })
    );
  }, [capTargets, selectedUserIds]);

  const resetForm = () => {
    setForm({
      title: '',
      startDate: '',
      endDate: '',
      isPublished: true,
    });
    setSelectedUserIds([]);
    setSelectedCapTargetIds([]);
    setSelectedTargetIds([]);
    setMonitoringFile(null);
    setExistingFileName(null);
    setExistingFileUrl(null);
    setEditingId(null);
  };

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setErrorMessage(null);
    if (!form.startDate || !form.endDate) {
      setErrorMessage('Tanggal mulai dan akhir wajib diisi.');
      return;
    }
    if (selectedUserIds.length === 0) {
      setErrorMessage('Pilih minimal 1 user terlebih dahulu.');
      return;
    }
    if (selectedCapTargetIds.length === 0) {
      setErrorMessage('Pilih minimal 1 target CAP terlebih dahulu.');
      return;
    }
    setIsSubmitting(true);
    const uniqueUserIds = Array.from(new Set(selectedUserIds));
    const uniqueCapTargetIds = Array.from(new Set(selectedCapTargetIds));
    const uniqueTargetIds = Array.from(new Set(selectedTargetIds));
    const payload = {
      scope: 'monitoring',
      title: form.title || null,
      startDate: form.startDate,
      endDate: form.endDate,
      isPublished: form.isPublished,
      userIds: uniqueUserIds,
      targetSessionAreaIds: uniqueCapTargetIds,
      targetAgendaIds: uniqueTargetIds,
    };
    const request = editingId
      ? apiFetch(`/api/admin/self-assessment/sessions/${editingId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        })
      : apiFetch('/api/admin/self-assessment/sessions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });

    request
      .then(async (response) => {
        const sessionId =
          (response as { data?: { id?: string } })?.data?.id ?? editingId;
        if (sessionId && monitoringFile) {
          const formData = new FormData();
          formData.append('file', monitoringFile);
          await apiFetch(`/api/admin/self-assessment/sessions/${sessionId}/file`, {
            method: 'POST',
            body: formData,
          });
        }
        resetForm();
        loadSessions();
        loadCapTargets();
      })
      .catch((error: Error) =>
        setErrorMessage(error.message || 'Gagal menyimpan sesi monitoring.')
      )
      .finally(() => setIsSubmitting(false));
  };

  const handleEdit = (id: string) => {
    setErrorMessage(null);
    apiFetch<{
      data: {
        id: string;
        title: string | null;
        startDate: string;
        endDate: string;
        isPublished: boolean;
        userIds?: string[];
        targetSessionAreaIds?: string[];
        targetAgendaIds?: string[];
        file?: { name?: string | null; url?: string | null } | null;
      };
    }>(`/api/admin/self-assessment/sessions/${id}`)
      .then((response) => {
        const data = response.data;
        setEditingId(data.id);
        setForm({
          title: data.title ?? '',
          startDate: formatDateLabel(data.startDate ?? ''),
          endDate: formatDateLabel(data.endDate ?? ''),
          isPublished: data.isPublished ?? true,
        });
        setSelectedUserIds(data.userIds ?? []);
        setSelectedCapTargetIds(data.targetSessionAreaIds ?? []);
        setSelectedTargetIds(data.targetAgendaIds ?? []);
        setMonitoringFile(null);
        setExistingFileName(data.file?.name ?? null);
        setExistingFileUrl(data.file?.url ?? null);
      })
      .catch((error: Error) =>
        setErrorMessage(error.message || 'Gagal memuat sesi monitoring.')
      );
  };

  const handleDelete = (id: string) => {
    setErrorMessage(null);
    apiFetch(`/api/admin/self-assessment/sessions/${id}`, { method: 'DELETE' })
      .then(() => loadSessions())
      .catch((error: Error) =>
        setErrorMessage(error.message || 'Gagal menghapus sesi monitoring.')
      );
  };

  const canSubmitMonitoring =
    !isSubmitting && selectedUserIds.length > 0 && selectedCapTargetIds.length > 0;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <span className="flex h-10 w-10 items-center justify-center rounded-xl border border-blue-200 bg-blue-50 text-blue-600 shadow-sm">
          <CalendarDays className="h-5 w-5" />
        </span>
        <div>
          <h1 className="text-xl font-semibold text-slate-800">Buka Monitoring</h1>
          <p className="text-sm text-slate-500">
            Buka periode monitoring berdasarkan pemenuhan CAP.
          </p>
        </div>
      </div>

      <form
        className="space-y-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"
        onSubmit={handleSubmit}
      >
        <div className="flex items-center justify-between">
          <div className="text-sm font-semibold text-slate-700">
            {editingId ? 'Edit Monitoring' : 'Buka Monitoring'}
          </div>
          {editingId && (
            <Button variant="ghost" type="button" onClick={resetForm}>
              Batal
            </Button>
          )}
        </div>
        <Input
          value={form.title}
          onChange={(event) =>
            setForm((prev) => ({ ...prev, title: event.target.value }))
          }
          placeholder="Judul Kegiatan (opsional)"
        />
        <div className="grid gap-3 sm:grid-cols-2">
          <Input
            type="date"
            value={form.startDate}
            onChange={(event) =>
              setForm((prev) => ({ ...prev, startDate: event.target.value }))
            }
          />
          <Input
            type="date"
            value={form.endDate}
            onChange={(event) =>
              setForm((prev) => ({ ...prev, endDate: event.target.value }))
            }
          />
        </div>
        <div className="grid gap-2">
          <Input
            type="file"
            accept=".pdf,.png,.jpg,.jpeg"
            onChange={(event) => setMonitoringFile(event.target.files?.[0] ?? null)}
          />
          {existingFileUrl && !monitoringFile && (
            <a
              href={resolveApiUrl(existingFileUrl)}
              target="_blank"
              rel="noreferrer"
              className="text-xs text-blue-600 underline"
            >
              {existingFileName || 'Lihat file tersimpan'}
            </a>
          )}
          {monitoringFile && (
            <div className="text-xs text-slate-500">File dipilih: {monitoringFile.name}</div>
          )}
        </div>
        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="text-sm font-semibold text-slate-700">
              User yang boleh dibuka
            </div>
            <div className="text-xs text-slate-500">
              {selectedUserIds.length} dipilih
            </div>
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-slate-500">
            <span>Pilih user yang boleh akses monitoring.</span>
            <span className="font-semibold">
              {selectedUserIds.length} / {users.length} user
            </span>
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setSelectedUserIds(users.map((user) => user.id))}
              disabled={users.length === 0}
            >
              Pilih semua user
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setSelectedUserIds([])}
              disabled={selectedUserIds.length === 0}
            >
              Bersihkan
            </Button>
          </div>
          <ScrollArea className="mt-3 h-48 rounded-xl border border-slate-200 bg-white">
            <div className="space-y-2 p-3">
              {filteredUsers.length === 0 ? (
                <div className="text-xs text-slate-500">Tidak ada user.</div>
              ) : (
                filteredUsers.map((user) => (
                  <label
                    key={user.id}
                    className="flex cursor-pointer items-start gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm"
                  >
                    <Checkbox
                      checked={selectedUserIds.includes(user.id)}
                      onCheckedChange={(checked) => {
                        setSelectedUserIds((prev) => {
                          if (checked) {
                            return prev.includes(user.id) ? prev : [...prev, user.id];
                          }
                          return prev.filter((id) => id !== user.id);
                        });
                      }}
                    />
                    <div className="flex flex-col">
                      <span className="font-semibold text-slate-700">{user.name}</span>
                      <span className="text-xs text-slate-500">
                        {user.email ?? '-'}
                      </span>
                    </div>
                  </label>
                ))
              )}
            </div>
          </ScrollArea>
          <div className="mt-2 text-xs text-slate-500">
            Kosongkan pilihan user untuk membuka ke semua user (termasuk admin).
          </div>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="text-sm font-semibold text-slate-700">
              Target CAP (Audit/Inspeksi/Surveillance)
            </div>
            <div className="text-xs text-slate-500">
              {selectedCapTargetIds.length} dipilih
            </div>
          </div>
          {selectedUserIds.length === 0 ? (
            <div className="mt-2 text-xs text-slate-500">
              Pilih user terlebih dahulu. Daftar target CAP akan muncul di bawah.
            </div>
          ) : (
            <>
              <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-slate-500">
                <span>
                  Pilih target CAP user pada scope Audit, Inspeksi, dan Surveillance.
                </span>
                <span className="font-semibold">
                  {selectedCapTargetIds.length} / {displayedCapTargets.length} target
                </span>
              </div>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    setSelectedCapTargetIds(
                      filteredCapTargets.map((item) => item.sessionAreaId)
                    )
                  }
                  disabled={filteredCapTargets.length === 0}
                >
                  Pilih semua target
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setSelectedCapTargetIds([])}
                  disabled={selectedCapTargetIds.length === 0}
                >
                  Bersihkan
                </Button>
              </div>
              <ScrollArea className="mt-3 h-48 rounded-xl border border-slate-200 bg-white">
                <div className="space-y-2 p-3">
                  {isLoadingCapTargets ? (
                    <div className="text-xs text-slate-500">Memuat target CAP...</div>
                  ) : displayedCapTargets.length === 0 ? (
                    <div className="text-xs text-slate-500">
                      Tidak ada CAP pada scope Audit/Inspeksi/Surveillance untuk user terpilih.
                    </div>
                  ) : (
                    displayedCapTargets.map((target) => (
                      <label
                        key={target.sessionAreaId}
                        className="flex cursor-pointer items-start gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm"
                      >
                        <Checkbox
                          checked={selectedCapTargetIds.includes(target.sessionAreaId)}
                          onCheckedChange={(checked) => {
                            setSelectedCapTargetIds((prev) => {
                              if (checked) {
                                return prev.includes(target.sessionAreaId)
                                  ? prev
                                  : [...prev, target.sessionAreaId];
                              }
                              return prev.filter((id) => id !== target.sessionAreaId);
                            });
                          }}
                        />
                        <div className="flex flex-col">
                          <span className="font-semibold text-slate-700">
                            {target.title ?? target.area}
                          </span>
                          <span className="text-xs text-slate-500">
                            {target.isMissing
                              ? 'Target ini sudah tidak aktif, tetapi masih tersimpan di sesi.'
                              : `${target.user?.name ?? 'User'} • ${(target.capCount ?? 0)} CAP • ${formatScopeLabel(target.scope)} • ${target.schedule ?? 'Tanpa jadwal'}`}
                          </span>
                        </div>
                      </label>
                    ))
                  )}
                </div>
              </ScrollArea>
              <div className="mt-2 text-xs text-slate-500">
                Pilih minimal 1 target CAP untuk bisa membuka monitoring.
              </div>
            </>
          )}
        </div>
        <label className="flex items-center gap-2 text-sm text-slate-600">
          <Checkbox
            checked={form.isPublished}
            onCheckedChange={(checked) =>
              setForm((prev) => ({ ...prev, isPublished: checked === true }))
            }
          />
          Publish monitoring
        </label>
        {errorMessage && <div className="text-sm text-red-500">{errorMessage}</div>}
        <div className="flex justify-end">
          <Button type="submit" disabled={!canSubmitMonitoring}>
            <Plus className="mr-2 h-4 w-4" />
            {editingId ? 'Perbarui' : 'Buka'}
          </Button>
        </div>
      </form>

      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <Table>
          <TableHeader className="bg-slate-50/80">
            <TableRow>
              <TableHead className="text-center text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500">
                Periode
              </TableHead>
              <TableHead className="text-center text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500">
                Judul
              </TableHead>
              <TableHead className="text-center text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500">
                Publish
              </TableHead>
              <TableHead className="text-center text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500">
                Aksi
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sessions.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} className="py-10 text-center text-sm text-slate-500">
                  Belum ada monitoring dibuka.
                </TableCell>
              </TableRow>
            ) : (
              sessions.map((session) => (
                <TableRow key={session.id}>
                  <TableCell className="text-center text-sm">
                    {formatDateLabel(session.start_date)} - {formatDateLabel(session.end_date)}
                  </TableCell>
                  <TableCell className="text-center text-sm">
                    {session.title ?? '-'}
                  </TableCell>
                  <TableCell className="text-center text-sm">
                    {session.is_published ? 'Ya' : 'Tidak'}
                  </TableCell>
                  <TableCell className="text-center text-sm">
                    <div className="flex items-center justify-center gap-2">
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => handleEdit(session.id)}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => handleDelete(session.id)}
                      >
                        <Trash2 className="h-4 w-4 text-red-500" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </section>
    </div>
  );
}
