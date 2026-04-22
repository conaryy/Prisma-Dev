import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Award, CalendarDays, ExternalLink, FileCheck2, Plus, Trash2, Upload } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useAppData } from '@/contexts/AppDataContext';
import { formatDate } from '@/lib/date';
import { apiFetch, resolveApiUrl } from '@/lib/api';
import { cn } from '@/lib/utils';

const statusStyles = {
  Berlaku: 'bg-emerald-50 text-emerald-700 ring-emerald-200 dark:bg-emerald-500/20 dark:text-emerald-300 dark:ring-emerald-700/50',
  'Tidak Berlaku': 'bg-red-50 text-red-700 ring-red-200 dark:bg-red-500/20 dark:text-red-300 dark:ring-red-700/50',
};

const percentageOptions = [0, 25, 50, 75, 100] as const;
type FulfillmentPercentage = (typeof percentageOptions)[number];

type CertificateEvidenceFile = {
  name: string;
  signedUrl: string;
};

type CertificateFulfillmentNote = {
  id: string;
  note: string;
  comment: string;
  fulfillmentPercentage: FulfillmentPercentage;
  evidenceFiles: CertificateEvidenceFile[];
  createdAt: string;
};

function mapEvidenceFiles(data: Record<string, unknown>): CertificateEvidenceFile[] {
  const rawFiles = Array.isArray(data.evidence_files)
    ? data.evidence_files
    : Array.isArray(data.evidenceFiles)
      ? data.evidenceFiles
      : [];

  const files = rawFiles
    .filter((file): file is Record<string, unknown> => Boolean(file) && typeof file === 'object')
    .map((file) => ({
      name: (file.name ?? file.file_name ?? 'Lihat File Evidence') as string,
      signedUrl: (file.signed_url ?? file.signedUrl ?? '') as string,
    }))
    .filter((file) => file.signedUrl);

  const legacySignedUrl = (data.evidence_signed_url ?? data.evidenceSignedUrl ?? '') as string;
  if (files.length === 0 && legacySignedUrl) {
    files.push({
      name: (data.evidence_file_name ?? data.evidenceFileName ?? 'Lihat File Evidence') as string,
      signedUrl: legacySignedUrl,
    });
  }

  return files;
}

function mapFulfillmentNote(data: Record<string, unknown>): CertificateFulfillmentNote {
  return {
    id: data.id as string,
    note: (data.note ?? '') as string,
    comment: (data.comment ?? '') as string,
    fulfillmentPercentage: Number(
      data.fulfillment_percentage ?? data.fulfillmentPercentage ?? 0
    ) as FulfillmentPercentage,
    evidenceFiles: mapEvidenceFiles(data),
    createdAt: (data.created_at ?? data.createdAt ?? '') as string,
  };
}

function getExpiryText(validUntil: string) {
  if (!validUntil) {
    return '-';
  }

  const target = new Date(validUntil);
  if (Number.isNaN(target.getTime())) {
    return '-';
  }

  const today = new Date();
  const diff = target.setHours(0, 0, 0, 0) - today.setHours(0, 0, 0, 0);
  const days = Math.ceil(diff / (1000 * 60 * 60 * 24));

  if (days < 0) {
    return `Lewat ${Math.abs(days)} hari`;
  }
  if (days === 0) {
    return 'Berakhir hari ini';
  }
  return `${days} hari lagi`;
}

export function PemenuhanSertifikat() {
  const { certificateId } = useParams();
  const navigate = useNavigate();
  const { certificates } = useAppData();
  const certificateFulfillmentBasePath = '/informasi/instansi/sertifikat/pemenuhan';

  const evidenceCertificates = useMemo(
    () =>
      certificates.filter(
        (item) => (item.evidenceType ?? 'Sertifikat Non Evidence') === 'Sertifikat Evidence'
      ),
    [certificates]
  );

  const selectedCertificate =
    evidenceCertificates.find((item) => item.id === certificateId) ?? evidenceCertificates[0] ?? null;

  const selectedStatus = selectedCertificate?.status ?? 'Berlaku';
  const [notes, setNotes] = useState<CertificateFulfillmentNote[]>([]);
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const [noteText, setNoteText] = useState('');
  const [comment, setComment] = useState('');
  const [fulfillmentPercentage, setFulfillmentPercentage] = useState<FulfillmentPercentage>(0);
  const [evidenceFiles, setEvidenceFiles] = useState<File[]>([]);
  const [fileInputVersion, setFileInputVersion] = useState(0);
  const [notesError, setNotesError] = useState<string | null>(null);
  const [isNotesLoading, setIsNotesLoading] = useState(false);
  const [isSavingNote, setIsSavingNote] = useState(false);

  useEffect(() => {
    if (!selectedCertificate?.id) {
      setNotes([]);
      return;
    }

    let ignore = false;
    setIsNotesLoading(true);
    setNotesError(null);

    apiFetch<{ data: Array<Record<string, unknown>> }>(
      `/api/certificates/${selectedCertificate.id}/fulfillment-notes`
    )
      .then((response) => {
        if (!ignore) {
          setNotes(response.data.map(mapFulfillmentNote));
          setEditingNoteId(null);
          setNoteText('');
          setComment('');
          setFulfillmentPercentage(0);
          setEvidenceFiles([]);
          setFileInputVersion((current) => current + 1);
        }
      })
      .catch((error) => {
        if (!ignore) {
          setNotes([]);
          setNotesError(error instanceof Error ? error.message : 'Gagal memuat catatan.');
        }
      })
      .finally(() => {
        if (!ignore) {
          setIsNotesLoading(false);
        }
      });

    return () => {
      ignore = true;
    };
  }, [selectedCertificate?.id]);

  const resetNoteForm = () => {
    setEditingNoteId(null);
    setNoteText('');
    setComment('');
    setFulfillmentPercentage(0);
    setEvidenceFiles([]);
    setFileInputVersion((current) => current + 1);
  };

  const handleEditNote = (note: CertificateFulfillmentNote) => {
    setEditingNoteId(note.id);
    setNoteText(note.note);
    setComment(note.comment);
    setFulfillmentPercentage(note.fulfillmentPercentage);
    setEvidenceFiles([]);
    setFileInputVersion((current) => current + 1);
    setNotesError(null);
  };

  const handleSaveNote = async () => {
    if (!selectedCertificate?.id || isSavingNote) {
      return;
    }

    if (!comment.trim()) {
      setNotesError('Comment wajib diisi.');
      return;
    }

    setIsSavingNote(true);
    setNotesError(null);

    try {
      const formData = new FormData();
      const isEditing = Boolean(editingNoteId);
      if (isEditing) {
        formData.append('_method', 'PATCH');
      }
      formData.append('note', noteText.trim());
      formData.append('comment', comment.trim());
      formData.append('fulfillmentPercentage', String(fulfillmentPercentage));
      evidenceFiles.forEach((file) => {
        formData.append('files[]', file);
      });

      const response = await apiFetch<{ data: Record<string, unknown> }>(
        isEditing
          ? `/api/certificates/${selectedCertificate.id}/fulfillment-notes/${editingNoteId}`
          : `/api/certificates/${selectedCertificate.id}/fulfillment-notes`,
        {
          method: 'POST',
          body: formData,
        }
      );

      const savedNote = mapFulfillmentNote(response.data);
      setNotes((current) =>
        isEditing
          ? current.map((note) => (note.id === savedNote.id ? savedNote : note))
          : [savedNote, ...current]
      );
      resetNoteForm();
    } catch (error) {
      setNotesError(error instanceof Error ? error.message : 'Gagal menyimpan catatan.');
    } finally {
      setIsSavingNote(false);
    }
  };

  const handleDeleteNote = async (noteId: string) => {
    if (!selectedCertificate?.id || !window.confirm('Hapus catatan pemenuhan ini?')) {
      return;
    }

    try {
      await apiFetch(`/api/certificates/${selectedCertificate.id}/fulfillment-notes/${noteId}`, {
        method: 'DELETE',
      });
      setNotes((current) => current.filter((note) => note.id !== noteId));
      if (editingNoteId === noteId) {
        resetNoteForm();
      }
    } catch (error) {
      setNotesError(error instanceof Error ? error.message : 'Gagal menghapus catatan.');
    }
  };

  return (
    <div className="space-y-6">
      <div className="overflow-hidden rounded-2xl shadow-sm">
        <div className="glass-top flex flex-wrap items-center justify-between gap-3 border-b border-white/70 px-4 py-4 dark:border-slate-700/70">
          <div>
            <div className="text-sm font-semibold text-slate-800 dark:text-slate-100">
              Pemenuhan Sertifikat
            </div>
            <div className="mt-1 text-xs text-slate-500 dark:text-slate-300">
              {evidenceCertificates.length} sertifikat evidence
            </div>
          </div>
          <Button
            variant="outline"
            className="border-slate-200 bg-white/80 text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900/70 dark:text-slate-100"
            onClick={() => navigate('/informasi/instansi/sertifikat')}
          >
            <Award className="mr-2 h-4 w-4" />
            Data Sertifikat
          </Button>
        </div>

        <div className="grid gap-4 bg-white p-4 dark:bg-[#0b1736] xl:grid-cols-[minmax(0,1.45fr)_minmax(320px,0.8fr)]">
          <div className="overflow-hidden rounded-xl border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900/60">
            <Table>
              <TableHeader>
                <TableRow className="bg-slate-50/80 dark:bg-slate-800/70">
                  <TableHead className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400 dark:text-slate-300">
                    Nama Sertifikat
                  </TableHead>
                  <TableHead className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400 dark:text-slate-300">
                    Nomor
                  </TableHead>
                  <TableHead className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400 dark:text-slate-300">
                    Berlaku Sampai
                  </TableHead>
                  <TableHead className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400 dark:text-slate-300">
                    Status
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {evidenceCertificates.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} className="p-6 text-center text-sm text-slate-500 dark:text-slate-300">
                      Data sertifikat evidence belum tersedia.
                    </TableCell>
                  </TableRow>
                ) : (
                  evidenceCertificates.map((item) => {
                    const isSelected = item.id === selectedCertificate?.id;

                    return (
                      <TableRow
                        key={item.id}
                        className={cn(
                          'transition-colors',
                          isSelected && 'bg-blue-50/80 dark:bg-slate-800'
                        )}
                      >
                        <TableCell className="text-xs font-medium text-slate-700 dark:text-slate-100">
                          <button
                            type="button"
                            onClick={() =>
                              navigate(`${certificateFulfillmentBasePath}/${item.id}`)
                            }
                            className="text-left font-semibold text-slate-700 underline-offset-4 hover:text-blue-600 hover:underline dark:text-slate-100 dark:hover:text-blue-300"
                          >
                            {item.name}
                          </button>
                        </TableCell>
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
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>

          <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-4 dark:border-slate-700 dark:bg-slate-900/60">
            {selectedCertificate ? (
              <div className="space-y-4">
                <div className="flex items-start gap-3">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-blue-500/10 text-blue-600 dark:bg-blue-400/10 dark:text-blue-300">
                    <FileCheck2 className="h-5 w-5" />
                  </div>
                  <div className="min-w-0">
                    <div className="text-sm font-semibold text-slate-800 dark:text-slate-100">
                      {selectedCertificate.name}
                    </div>
                    <div className="mt-1 text-xs text-slate-500 dark:text-slate-300">
                      {selectedCertificate.type || '-'} · {selectedCertificate.number || '-'}
                    </div>
                  </div>
                </div>

                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
                  <div className="rounded-xl border border-slate-200 bg-white p-3 dark:border-slate-700 dark:bg-slate-950/40">
                    <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
                      <CalendarDays className="h-4 w-4" />
                      Masa Berlaku
                    </div>
                    <div className="mt-2 text-sm font-semibold text-slate-800 dark:text-slate-100">
                      {formatDate(selectedCertificate.validUntil)}
                    </div>
                    <div className="mt-1 text-xs text-slate-500 dark:text-slate-300">
                      {getExpiryText(selectedCertificate.validUntil)}
                    </div>
                  </div>

                  <div className="rounded-xl border border-slate-200 bg-white p-3 dark:border-slate-700 dark:bg-slate-950/40">
                    <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
                      Status
                    </div>
                    <div className="mt-2">
                      <span
                        className={cn(
                          'inline-flex items-center rounded-full px-2 py-1 text-[11px] font-semibold ring-1',
                          statusStyles[selectedStatus]
                        )}
                      >
                        {selectedStatus}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex min-h-[18rem] items-center justify-center rounded-xl border border-dashed border-slate-300 bg-white p-6 text-center text-sm text-slate-500 dark:border-slate-700 dark:bg-slate-950/30 dark:text-slate-300">
                Belum ada sertifikat evidence yang dipilih.
              </div>
            )}
          </div>

          {selectedCertificate ? (
            <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-950/40 xl:col-span-2">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <div className="text-sm font-semibold text-slate-800 dark:text-slate-100">
                        {editingNoteId ? 'Edit Catatan Pemenuhan' : 'Catatan Pemenuhan'}
                      </div>
                      <div className="mt-1 text-xs text-slate-500 dark:text-slate-300">
                        {notes.length} catatan
                      </div>
                    </div>
                  </div>

                  <div className="mt-4 space-y-3">
                    <label className="block">
                      <span className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">
                        Catatan
                      </span>
                      <textarea
                        value={noteText}
                        onChange={(event) => setNoteText(event.target.value)}
                        rows={3}
                        className="mt-2 w-full resize-none rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 shadow-sm outline-none transition focus:border-blue-300 focus:ring-2 focus:ring-blue-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:focus:border-blue-400 dark:focus:ring-blue-900/40"
                        placeholder="Isi catatan pemenuhan"
                      />
                    </label>

                    <label className="block">
                      <span className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">
                        Comment
                      </span>
                      <textarea
                        value={comment}
                        onChange={(event) => setComment(event.target.value)}
                        rows={3}
                        className="mt-2 w-full resize-none rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 shadow-sm outline-none transition focus:border-blue-300 focus:ring-2 focus:ring-blue-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:focus:border-blue-400 dark:focus:ring-blue-900/40"
                        placeholder="Isi comment pemenuhan sertifikat"
                      />
                    </label>

                    <div className="grid gap-3 lg:grid-cols-[minmax(220px,0.35fr)_minmax(0,1fr)]">
                      <label className="block">
                        <span className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">
                          Persentase Pemenuhan
                        </span>
                        <select
                          value={fulfillmentPercentage}
                          onChange={(event) =>
                            setFulfillmentPercentage(Number(event.target.value) as FulfillmentPercentage)
                          }
                          className="mt-2 h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-700 shadow-sm outline-none transition focus:border-blue-300 focus:ring-2 focus:ring-blue-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:focus:border-blue-400 dark:focus:ring-blue-900/40"
                        >
                          {percentageOptions.map((option) => (
                            <option key={option} value={option}>
                              {option}%
                            </option>
                          ))}
                        </select>
                      </label>

                      <label className="block">
                        <span className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">
                          File Evidence
                        </span>
                        <div className="mt-2 flex min-h-10 items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-600 shadow-sm dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300">
                          <Upload className="h-4 w-4 shrink-0 text-slate-400" />
                          <input
                            key={fileInputVersion}
                            type="file"
                            multiple
                            accept=".pdf,.png,.jpg,.jpeg,.doc,.docx,.xls,.xlsx"
                            onChange={(event) => setEvidenceFiles(Array.from(event.target.files ?? []))}
                            className="min-w-0 flex-1 text-xs file:mr-3 file:rounded-lg file:border-0 file:bg-blue-50 file:px-3 file:py-1.5 file:text-xs file:font-semibold file:text-blue-700 hover:file:bg-blue-100 dark:file:bg-blue-500/15 dark:file:text-blue-200"
                          />
                        </div>
                        {evidenceFiles.length > 0 ? (
                          <div className="mt-2 rounded-xl border border-blue-100 bg-blue-50/70 px-3 py-2 text-xs text-blue-700 dark:border-blue-900/60 dark:bg-blue-950/30 dark:text-blue-200">
                            <div className="font-semibold">
                              {evidenceFiles.length} file dipilih
                            </div>
                            <div className="mt-1 space-y-1">
                              {evidenceFiles.map((file) => (
                                <div key={`${file.name}-${file.size}-${file.lastModified}`} className="break-words">
                                  {file.name}
                                </div>
                              ))}
                            </div>
                          </div>
                        ) : null}
                      </label>
                    </div>

                    {notesError ? (
                      <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700 dark:border-red-900/60 dark:bg-red-950/30 dark:text-red-300">
                        {notesError}
                      </div>
                    ) : null}

                    <div className="flex flex-wrap gap-2">
                      <Button
                        className="bg-emerald-600 text-white hover:bg-emerald-700"
                        onClick={handleSaveNote}
                        disabled={isSavingNote}
                      >
                        <Plus className="mr-2 h-4 w-4" />
                        {isSavingNote
                          ? 'Menyimpan...'
                          : editingNoteId
                            ? 'Simpan Perubahan'
                            : 'Tambah Catatan'}
                      </Button>
                      {editingNoteId ? (
                        <Button
                          variant="outline"
                          onClick={resetNoteForm}
                          disabled={isSavingNote}
                        >
                          Batal Edit
                        </Button>
                      ) : null}
                    </div>
                  </div>

                  <div className="mt-5 space-y-3">
                    {isNotesLoading ? (
                      <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-500 dark:border-slate-700 dark:bg-slate-900/60 dark:text-slate-300">
                        Memuat catatan...
                      </div>
                    ) : notes.length === 0 ? (
                      <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-4 text-sm text-slate-500 dark:border-slate-700 dark:bg-slate-900/60 dark:text-slate-300">
                        Catatan pemenuhan belum tersedia.
                      </div>
                    ) : (
                      notes.map((note, index) => (
                        <div
                          key={note.id}
                          role="button"
                          tabIndex={0}
                          className={cn(
                            'w-full rounded-xl border bg-slate-50/80 p-3 text-left transition hover:border-blue-300 hover:bg-blue-50/70 focus:outline-none focus:ring-2 focus:ring-blue-100 dark:bg-slate-900/60 dark:hover:border-blue-500/60 dark:hover:bg-slate-800/80 dark:focus:ring-blue-900/40',
                            editingNoteId === note.id
                              ? 'border-blue-300 ring-2 ring-blue-100 dark:border-blue-500 dark:ring-blue-900/40'
                              : 'border-slate-200 dark:border-slate-700'
                          )}
                          onClick={() => handleEditNote(note)}
                          onKeyDown={(event) => {
                            if (event.key === 'Enter' || event.key === ' ') {
                              event.preventDefault();
                              handleEditNote(note);
                            }
                          }}
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">
                                Catatan {notes.length - index}
                              </div>
                              <p className="mt-2 break-words text-sm font-semibold text-slate-800 dark:text-slate-100">
                                {note.note || '-'}
                              </p>
                              <p className="mt-2 break-words text-sm text-slate-600 dark:text-slate-300">
                                {note.comment}
                              </p>
                            </div>
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-8 w-8 shrink-0 rounded-lg bg-red-500/10 text-red-600 hover:bg-red-500 hover:text-white"
                              onClick={(event) => {
                                event.stopPropagation();
                                handleDeleteNote(note.id);
                              }}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>

                          <div className="mt-3">
                            <div className="flex items-center justify-between text-xs font-semibold text-slate-500 dark:text-slate-300">
                              <span>Persentase Pemenuhan</span>
                              <span>{note.fulfillmentPercentage}%</span>
                            </div>
                            <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700">
                              <div
                                className="h-full rounded-full bg-blue-600 transition-all"
                                style={{ width: `${note.fulfillmentPercentage}%` }}
                              />
                            </div>
                          </div>

                          {note.evidenceFiles.length > 0 ? (
                            <div className="mt-3 flex flex-wrap gap-2">
                              {note.evidenceFiles.map((file, fileIndex) => (
                                <a
                                  key={`${file.signedUrl}-${fileIndex}`}
                                  href={resolveApiUrl(file.signedUrl)}
                                  target="_blank"
                                  rel="noreferrer"
                                  onClick={(event) => event.stopPropagation()}
                                  className="inline-flex max-w-full items-center gap-2 rounded-lg bg-blue-50 px-2.5 py-1.5 text-xs font-semibold text-blue-600 hover:bg-blue-100 dark:bg-blue-500/10 dark:text-blue-300 dark:hover:bg-blue-500/20"
                                >
                                  <ExternalLink className="h-3.5 w-3.5 shrink-0" />
                                  <span className="truncate">
                                    {file.name || `File Evidence ${fileIndex + 1}`}
                                  </span>
                                </a>
                              ))}
                            </div>
                          ) : (
                            <div className="mt-3 text-xs text-slate-500 dark:text-slate-400">
                              File evidence belum dilampirkan.
                            </div>
                          )}
                        </div>
                      ))
                    )}
                  </div>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
