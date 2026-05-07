import { useEffect, useMemo, useState } from 'react';
import { Link, Navigate, useParams } from 'react-router-dom';
import {
  AlertTriangle,
  ExternalLink,
  FileText,
  LoaderCircle,
  Plus,
  Save,
  Trash2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { toast } from '@/hooks/use-toast';
import { apiFetch, getAuthUser, resolveApiUrl } from '@/lib/api';
import { generateCertificationNoteDocument } from '@/lib/certificationNoteDocuments';
import {
  CERTIFICATION_NOTE_LOCATIONS,
  CERTIFICATION_NOTE_MAX_FILE_SIZE_BYTES,
  CERTIFICATION_NOTE_MAX_FILE_SIZE_LABEL,
  CERTIFICATION_NOTE_PROGRESS_OPTIONS,
  findCertificationNoteLocationBySlug,
} from '@/lib/certificationNotes';
import { downloadApiFile } from '@/lib/download';
import { canAccessCertificationNoteLocation, getCertificationNoteLocationAccess } from '@/lib/permissions';

type CertificationNoteEvidenceFile = {
  name: string;
  signedUrl: string;
};

type CertificationNoteRowRecord = {
  id: string;
  note: string;
  actionOffice: string;
  progress: (typeof CERTIFICATION_NOTE_PROGRESS_OPTIONS)[number];
  evidenceFiles: CertificationNoteEvidenceFile[];
};

type EditableCertificationNoteRow = CertificationNoteRowRecord & {
  pendingFiles: File[];
  isDeleting: boolean;
  deletingEvidenceIndex: number | null;
};

type CertificationNoteTableRecord = {
  id: string;
  title: string;
  rows: EditableCertificationNoteRow[];
  isSavingTable: boolean;
  isGeneratingDocument: boolean;
  isCreatingRow: boolean;
  isDeleting: boolean;
};

type DeleteConfirmation =
  | {
      kind: 'table';
      tableId: string;
      title: string;
      description: string;
      confirmLabel: string;
    }
  | {
      kind: 'row';
      tableId: string;
      rowId: string;
      title: string;
      description: string;
      confirmLabel: string;
    }
  | {
      kind: 'evidence';
      tableId: string;
      rowId: string;
      fileIndex: number;
      fileName: string;
      title: string;
      description: string;
      confirmLabel: string;
    };

function mapEvidenceFile(data: Record<string, unknown>): CertificationNoteEvidenceFile {
  return {
    name: (data.name ?? data.file_name ?? 'Lihat File Evidence') as string,
    signedUrl: (data.signed_url ?? data.signedUrl ?? '') as string,
  };
}

function mapRow(data: Record<string, unknown>): EditableCertificationNoteRow {
  return {
    id: data.id as string,
    note: (data.note ?? '') as string,
    actionOffice: (data.action_office ?? data.actionOffice ?? '') as string,
    progress: Number(data.progress ?? 0) as (typeof CERTIFICATION_NOTE_PROGRESS_OPTIONS)[number],
    evidenceFiles: Array.isArray(data.evidence_files)
      ? data.evidence_files
          .filter(
            (file): file is Record<string, unknown> =>
              Boolean(file) && typeof file === 'object'
          )
          .map(mapEvidenceFile)
          .filter((file) => Boolean(file.signedUrl))
      : [],
    pendingFiles: [],
    isDeleting: false,
    deletingEvidenceIndex: null,
  };
}

function mapTable(data: Record<string, unknown>): CertificationNoteTableRecord {
  return {
    id: data.id as string,
    title: (data.title ?? 'Area') as string,
    rows: Array.isArray(data.rows)
      ? data.rows
          .filter(
            (row): row is Record<string, unknown> =>
              Boolean(row) && typeof row === 'object'
          )
          .map(mapRow)
      : [],
    isSavingTable: false,
    isGeneratingDocument: false,
    isCreatingRow: false,
    isDeleting: false,
  };
}

const documentBorder = 'border border-[#bcc6d4] dark:border-slate-600/70';
const documentHeadCell =
  'border border-[#bcc6d4] bg-[#e8ebf0] px-3 py-2 text-left font-serif text-[14px] font-semibold text-slate-900 dark:border-slate-600/70 dark:bg-slate-800/90 dark:text-slate-100';
const documentCell =
  'border border-[#c8d0dc] px-3 py-3 align-top text-[14px] text-slate-900 dark:border-slate-600/70 dark:text-slate-100';
const documentProgressCell =
  'border border-[#c8d0dc] px-2 py-3 align-middle text-[14px] text-slate-900 dark:border-slate-600/70 dark:text-slate-100';
const documentTextArea =
  'min-h-[96px] w-full resize-none border-0 bg-transparent p-0 font-serif text-[14px] leading-6 text-slate-900 outline-none placeholder:text-slate-400 focus:outline-none dark:!border-0 dark:!bg-transparent dark:text-slate-100 dark:placeholder:text-slate-500';
const documentAreaInput =
  'min-w-[240px] flex-1 border-b border-[#bcc6d4] bg-transparent px-0 py-1 font-serif text-[18px] font-bold leading-tight text-slate-900 outline-none placeholder:text-slate-400 focus:border-slate-500 dark:!border-slate-500 dark:!bg-transparent dark:text-slate-100 dark:placeholder:text-slate-500 dark:focus:border-blue-300';
const documentSelect =
  'mx-auto h-10 w-full max-w-[80px] min-w-0 rounded-lg border border-transparent bg-transparent px-2 text-center font-serif text-[14px] font-semibold text-slate-900 outline-none focus:border-[#94a3b8] dark:!border-slate-600/60 dark:!bg-slate-950/80 dark:text-slate-100 dark:focus:border-blue-300';
const toolbarButton =
  'h-9 rounded-xl border border-[#bcc6d4] bg-white px-3 text-[12px] font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-600/70 dark:bg-slate-800/80 dark:text-slate-100 dark:hover:bg-slate-700/80';

export function CatatanSertifikasi() {
  const { locationSlug } = useParams();
  const user = getAuthUser<{ role?: string; certification_note_location_access?: string[] }>();
  const allowedLocationSlugs = getCertificationNoteLocationAccess(user);
  const fallbackLocation =
    CERTIFICATION_NOTE_LOCATIONS.find((item) => allowedLocationSlugs.includes(item.slug))?.slug ??
    null;
  const selectedLocation = useMemo(
    () => findCertificationNoteLocationBySlug(locationSlug),
    [locationSlug]
  );
  const hasAccessToSelectedLocation = canAccessCertificationNoteLocation(
    user,
    selectedLocation.slug
  );

  if (!fallbackLocation) {
    return (
      <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
        Anda tidak memiliki akses ke Catatan Sertifikasi.
      </div>
    );
  }

  if (!hasAccessToSelectedLocation) {
    return <Navigate to={`/catatan-sertifikasi/${fallbackLocation}`} replace />;
  }
  const [tables, setTables] = useState<CertificationNoteTableRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isCreatingTable, setIsCreatingTable] = useState(false);
  const [pageError, setPageError] = useState<string | null>(null);
  const [deleteConfirmation, setDeleteConfirmation] =
    useState<DeleteConfirmation | null>(null);
  const [isDeleteConfirming, setIsDeleteConfirming] = useState(false);

  useEffect(() => {
    let ignore = false;
    setIsLoading(true);
    setPageError(null);

    apiFetch<{ data: { tables: Array<Record<string, unknown>> } }>(
      `/api/certification-notes/${selectedLocation.slug}`
    )
      .then((response) => {
        if (!ignore) {
          setTables((response.data.tables ?? []).map(mapTable));
        }
      })
      .catch((error) => {
        if (!ignore) {
          setPageError(
            error instanceof Error ? error.message : 'Gagal memuat catatan sertifikasi.'
          );
        }
      })
      .finally(() => {
        if (!ignore) {
          setIsLoading(false);
        }
      });

    return () => {
      ignore = true;
    };
  }, [selectedLocation.slug]);

  const replaceTable = (tableId: string, nextTable: CertificationNoteTableRecord) => {
    setTables((current) =>
      current.map((table) => (table.id === tableId ? nextTable : table))
    );
  };

  const replaceRow = (
    tableId: string,
    rowId: string,
    updater:
      | EditableCertificationNoteRow
      | ((row: EditableCertificationNoteRow) => EditableCertificationNoteRow)
  ) => {
    setTables((current) =>
      current.map((table) =>
        table.id !== tableId
          ? table
          : {
              ...table,
              rows: table.rows.map((row) =>
                row.id !== rowId
                  ? row
                  : typeof updater === 'function'
                    ? updater(row)
                    : updater
              ),
            }
      )
    );
  };

  const handleCreateTable = async () => {
    if (isCreatingTable) {
      return;
    }

    setIsCreatingTable(true);
    try {
      const response = await apiFetch<{ data: Record<string, unknown> }>(
        `/api/certification-notes/${selectedLocation.slug}/tables`,
        {
          method: 'POST',
        }
      );

      setTables((current) => [...current, mapTable(response.data)]);
      toast({
        title: 'Tabel ditambahkan',
        description: `Tabel baru untuk ${selectedLocation.label} sudah dibuat.`,
      });
    } catch (error) {
      toast({
        title: 'Gagal menambah tabel',
        description: error instanceof Error ? error.message : 'Terjadi kesalahan.',
      });
    } finally {
      setIsCreatingTable(false);
    }
  };

  const handleTitleChange = (tableId: string, title: string) => {
    setTables((current) =>
      current.map((table) =>
        table.id === tableId
          ? {
              ...table,
              title,
            }
          : table
      )
    );
  };

  const handleDeleteTable = (tableId: string) => {
    const currentTable = tables.find((table) => table.id === tableId);
    if (!currentTable || currentTable.isDeleting) {
      return;
    }

    setDeleteConfirmation({
      kind: 'table',
      tableId,
      title: 'Hapus area?',
      description: `Area ${currentTable.title} beserta seluruh barisnya akan dihapus.`,
      confirmLabel: 'Hapus Area',
    });
  };

  const performDeleteTable = async (
    confirmation: Extract<DeleteConfirmation, { kind: 'table' }>
  ) => {
    const currentTable = tables.find((table) => table.id === confirmation.tableId);
    if (!currentTable || currentTable.isDeleting) {
      return;
    }

    replaceTable(confirmation.tableId, { ...currentTable, isDeleting: true });

    try {
      await apiFetch(`/api/certification-note-tables/${confirmation.tableId}`, {
        method: 'DELETE',
      });
      setTables((current) =>
        current.filter((table) => table.id !== confirmation.tableId)
      );
      toast({
        title: 'Tabel dihapus',
        description: `${currentTable.title} berhasil dihapus.`,
      });
    } catch (error) {
      replaceTable(confirmation.tableId, { ...currentTable, isDeleting: false });
      toast({
        title: 'Gagal menghapus tabel',
        description: error instanceof Error ? error.message : 'Terjadi kesalahan.',
      });
    }
  };

  const handleAddRow = async (tableId: string) => {
    const currentTable = tables.find((table) => table.id === tableId);
    if (!currentTable || currentTable.isCreatingRow || currentTable.isSavingTable) {
      return;
    }

    replaceTable(tableId, { ...currentTable, isCreatingRow: true });

    try {
      const response = await apiFetch<{ data: Record<string, unknown> }>(
        `/api/certification-note-tables/${tableId}/rows`,
        {
          method: 'POST',
        }
      );

      replaceTable(tableId, {
        ...currentTable,
        isCreatingRow: false,
        rows: [...currentTable.rows, mapRow(response.data)],
      });
      toast({
        title: 'Baris ditambahkan',
        description: `${currentTable.title} memiliki baris baru.`,
      });
    } catch (error) {
      replaceTable(tableId, { ...currentTable, isCreatingRow: false });
      toast({
        title: 'Gagal menambah baris',
        description: error instanceof Error ? error.message : 'Terjadi kesalahan.',
      });
    }
  };

  const handleRowFieldChange = (
    tableId: string,
    rowId: string,
    field: 'note' | 'actionOffice' | 'progress',
    value: string | number
  ) => {
    replaceRow(tableId, rowId, (row) => ({
      ...row,
      [field]: value,
    }));
  };

  const handlePendingFilesChange = (tableId: string, rowId: string, files: File[]) => {
    const acceptedFiles = files.filter(
      (file) => file.size <= CERTIFICATION_NOTE_MAX_FILE_SIZE_BYTES
    );
    const rejectedFiles = files.filter(
      (file) => file.size > CERTIFICATION_NOTE_MAX_FILE_SIZE_BYTES
    );

    if (rejectedFiles.length > 0) {
      toast({
        title: 'Ukuran file terlalu besar',
        description: `Ukuran maksimal file evidence adalah ${CERTIFICATION_NOTE_MAX_FILE_SIZE_LABEL} per file. File yang melebihi batas tidak dimasukkan.`,
        variant: 'destructive',
      });
    }

    replaceRow(tableId, rowId, (row) => ({
      ...row,
      pendingFiles: acceptedFiles,
    }));
  };

  const persistTable = async (
    tableId: string,
    options?: { suppressSuccessToast?: boolean }
  ) => {
    const currentTable = tables.find((table) => table.id === tableId);
    if (!currentTable || currentTable.isSavingTable) {
      return null;
    }

    replaceTable(tableId, { ...currentTable, isSavingTable: true });

    const savedRows = new Map<string, EditableCertificationNoteRow>();
    let savedTitle = currentTable.title;

    try {
      const tableResponse = await apiFetch<{ data: Record<string, unknown> }>(
        `/api/certification-note-tables/${tableId}`,
        {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            title: currentTable.title,
          }),
        }
      );

      savedTitle = (tableResponse.data.title ?? currentTable.title) as string;

      for (const row of currentTable.rows) {
        const formData = new FormData();
        formData.append('_method', 'PATCH');
        formData.append('note', row.note);
        formData.append('actionOffice', row.actionOffice);
        formData.append('progress', String(row.progress));
        row.pendingFiles.forEach((file) => {
          formData.append('files[]', file);
        });

        const rowResponse = await apiFetch<{ data: Record<string, unknown> }>(
          `/api/certification-note-tables/${tableId}/rows/${row.id}`,
          {
            method: 'POST',
            body: formData,
          }
        );

        savedRows.set(row.id, mapRow(rowResponse.data));
      }

      const nextTable = {
        id: currentTable.id,
        title: savedTitle,
        rows: currentTable.rows.map((row) => savedRows.get(row.id) ?? row),
        isSavingTable: false,
        isGeneratingDocument: currentTable.isGeneratingDocument,
        isCreatingRow: false,
        isDeleting: false,
      };

      replaceTable(tableId, nextTable);

      if (!options?.suppressSuccessToast) {
        toast({
          title: 'Tabel disimpan',
          description: `Perubahan pada ${savedTitle} sudah tersimpan.`,
        });
      }

      return nextTable;
    } catch (error) {
      const fallbackTable = {
        ...currentTable,
        title: savedTitle,
        rows: currentTable.rows.map((row) => savedRows.get(row.id) ?? row),
        isSavingTable: false,
      };

      replaceTable(tableId, fallbackTable);

      throw error;
    }
  };

  const handleSaveTable = async (tableId: string) => {
    try {
      await persistTable(tableId);
    } catch (error) {
      toast({
        title: 'Gagal menyimpan tabel',
        description: error instanceof Error ? error.message : 'Terjadi kesalahan.',
      });
    }
  };

  const handleGenerateDocument = async (tableId: string) => {
    const currentTable = tables.find((table) => table.id === tableId);
    if (
      !currentTable
      || currentTable.isGeneratingDocument
      || currentTable.isDeleting
      || currentTable.isCreatingRow
    ) {
      return;
    }

    let persistedTable: CertificationNoteTableRecord | null = null;

    try {
      persistedTable = await persistTable(tableId, { suppressSuccessToast: true });
    } catch (error) {
      toast({
        title: 'Gagal menyimpan tabel',
        description: error instanceof Error ? error.message : 'Terjadi kesalahan.',
        variant: 'destructive',
      });
      return;
    }

    if (!persistedTable) {
      return;
    }

    replaceTable(tableId, {
      ...persistedTable,
      isGeneratingDocument: true,
    });

    try {
      const response = await generateCertificationNoteDocument(tableId);

      replaceTable(tableId, {
        ...persistedTable,
        isGeneratingDocument: false,
      });

      await downloadApiFile(response.downloadUrl, response.filename);
      toast({
        title: 'Dokumen berhasil digenerate',
        description: `${response.totalItems} baris masuk ke dokumen ${persistedTable.title}.`,
      });
    } catch (error) {
      replaceTable(tableId, {
        ...persistedTable,
        isGeneratingDocument: false,
      });
      toast({
        title: 'Generate gagal',
        description: error instanceof Error ? error.message : 'Terjadi kesalahan.',
        variant: 'destructive',
      });
    }
  };

  const handleDeleteEvidenceFile = (
    tableId: string,
    rowId: string,
    fileIndex: number,
    fileName: string
  ) => {
    const currentTable = tables.find((table) => table.id === tableId);
    const currentRow = currentTable?.rows.find((row) => row.id === rowId);
    if (
      !currentTable
      || !currentRow
      || currentRow.isDeleting
      || currentRow.deletingEvidenceIndex !== null
      || currentTable.isSavingTable
      || currentTable.isGeneratingDocument
    ) {
      return;
    }

    setDeleteConfirmation({
      kind: 'evidence',
      tableId,
      rowId,
      fileIndex,
      fileName,
      title: 'Hapus file evidence?',
      description: `${fileName} akan dihapus dari baris catatan ini.`,
      confirmLabel: 'Hapus File',
    });
  };

  const performDeleteEvidenceFile = async (
    confirmation: Extract<DeleteConfirmation, { kind: 'evidence' }>
  ) => {
    const currentTable = tables.find((table) => table.id === confirmation.tableId);
    const currentRow = currentTable?.rows.find(
      (row) => row.id === confirmation.rowId
    );
    if (
      !currentTable
      || !currentRow
      || currentRow.isDeleting
      || currentRow.deletingEvidenceIndex !== null
      || currentTable.isSavingTable
      || currentTable.isGeneratingDocument
    ) {
      return;
    }

    replaceRow(confirmation.tableId, confirmation.rowId, {
      ...currentRow,
      deletingEvidenceIndex: confirmation.fileIndex,
    });

    try {
      const response = await apiFetch<{ data: Record<string, unknown> }>(
        `/api/certification-note-tables/${confirmation.tableId}/rows/${confirmation.rowId}/evidence/${confirmation.fileIndex}`,
        {
          method: 'DELETE',
        }
      );
      const savedRow = mapRow(response.data);

      replaceRow(confirmation.tableId, confirmation.rowId, {
        ...currentRow,
        evidenceFiles: savedRow.evidenceFiles,
        deletingEvidenceIndex: null,
      });

      toast({
        title: 'File evidence dihapus',
        description: `${confirmation.fileName} berhasil dihapus.`,
      });
    } catch (error) {
      replaceRow(confirmation.tableId, confirmation.rowId, {
        ...currentRow,
        deletingEvidenceIndex: null,
      });
      toast({
        title: 'Gagal menghapus file',
        description: error instanceof Error ? error.message : 'Terjadi kesalahan.',
        variant: 'destructive',
      });
    }
  };

  const handleDeleteRow = (tableId: string, rowId: string) => {
    const currentTable = tables.find((table) => table.id === tableId);
    const currentRow = currentTable?.rows.find((row) => row.id === rowId);
    if (
      !currentTable
      || !currentRow
      || currentRow.isDeleting
      || currentRow.deletingEvidenceIndex !== null
      || currentTable.isSavingTable
      || currentTable.isGeneratingDocument
    ) {
      return;
    }

    const rowNumber =
      currentTable.rows.findIndex((row) => row.id === rowId) + 1;

    setDeleteConfirmation({
      kind: 'row',
      tableId,
      rowId,
      title: 'Hapus baris?',
      description: `Baris ${rowNumber || ''} pada ${currentTable.title} akan dihapus.`,
      confirmLabel: 'Hapus Baris',
    });
  };

  const performDeleteRow = async (
    confirmation: Extract<DeleteConfirmation, { kind: 'row' }>
  ) => {
    const currentTable = tables.find((table) => table.id === confirmation.tableId);
    const currentRow = currentTable?.rows.find(
      (row) => row.id === confirmation.rowId
    );
    if (
      !currentTable
      || !currentRow
      || currentRow.isDeleting
      || currentRow.deletingEvidenceIndex !== null
      || currentTable.isSavingTable
      || currentTable.isGeneratingDocument
    ) {
      return;
    }

    replaceRow(confirmation.tableId, confirmation.rowId, {
      ...currentRow,
      isDeleting: true,
    });

    try {
      await apiFetch(
        `/api/certification-note-tables/${confirmation.tableId}/rows/${confirmation.rowId}`,
        {
          method: 'DELETE',
        }
      );

      setTables((current) =>
        current.map((table) =>
          table.id !== confirmation.tableId
            ? table
            : {
                ...table,
                rows: table.rows.filter((row) => row.id !== confirmation.rowId),
              }
        )
      );

      toast({
        title: 'Baris dihapus',
        description: `Baris pada ${currentTable.title} berhasil dihapus.`,
      });
    } catch (error) {
      replaceRow(confirmation.tableId, confirmation.rowId, {
        ...currentRow,
        isDeleting: false,
      });
      toast({
        title: 'Gagal menghapus baris',
        description: error instanceof Error ? error.message : 'Terjadi kesalahan.',
      });
    }
  };

  const handleDeleteDialogOpenChange = (open: boolean) => {
    if (!open && !isDeleteConfirming) {
      setDeleteConfirmation(null);
    }
  };

  const handleConfirmDelete = async () => {
    if (!deleteConfirmation || isDeleteConfirming) {
      return;
    }

    setIsDeleteConfirming(true);
    try {
      if (deleteConfirmation.kind === 'table') {
        await performDeleteTable(deleteConfirmation);
      } else if (deleteConfirmation.kind === 'row') {
        await performDeleteRow(deleteConfirmation);
      } else {
        await performDeleteEvidenceFile(deleteConfirmation);
      }

      setDeleteConfirmation(null);
    } finally {
      setIsDeleteConfirming(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-end gap-2">
        <Button
          className="rounded-xl border border-[#2f67e5] bg-[#2f67e5] px-4 text-white hover:bg-[#2455c8]"
          onClick={handleCreateTable}
          disabled={isCreatingTable}
        >
          {isCreatingTable ? (
            <LoaderCircle className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Plus className="mr-2 h-4 w-4" />
          )}
          Tambah Tabel
        </Button>
        <Button
          variant="outline"
          className="rounded-xl border-[#bcc6d4] bg-white dark:border-slate-600/70 dark:bg-slate-800/80 dark:text-slate-100 dark:hover:bg-slate-700/80"
          asChild
        >
          <Link to="/informasi/instansi/sertifikat">
            <ExternalLink className="mr-2 h-4 w-4" />
            Data Sertifikat
          </Link>
        </Button>
      </div>

      <div className="rounded-[28px] bg-[linear-gradient(180deg,#eef3fb_0%,#f8fafc_100%)] p-5 shadow-[0_20px_60px_rgba(15,23,42,0.08)] dark:bg-none dark:bg-slate-900/70 dark:shadow-[0_24px_70px_rgba(2,6,23,0.42)]">
        <div className="mx-auto max-w-[1140px] rounded-3xl border border-[#d4dae3] bg-white px-8 py-10 shadow-[0_0_0_1px_rgba(15,23,42,0.02)] dark:border-slate-700 dark:bg-slate-900/95 dark:shadow-[0_18px_50px_rgba(2,6,23,0.36)]">
          <div className="text-center">
            <div className="font-serif text-[18px] font-bold text-slate-900 dark:text-slate-100">
              {selectedLocation.officeLabel}
            </div>
            <div className="mt-1 font-serif text-[17px] font-bold text-slate-900 dark:text-slate-100">
              Catatan Sertifikasi
            </div>
          </div>

          {pageError ? (
            <div className="mt-8 border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-500/40 dark:bg-red-500/10 dark:text-red-200">
              {pageError}
            </div>
          ) : null}

          {isLoading ? (
            <div className="mt-8 border border-[#c8d0dc] px-4 py-10 text-center text-slate-500 dark:border-slate-600/70 dark:text-slate-300">
              Memuat catatan sertifikasi {selectedLocation.label}...
            </div>
          ) : null}

          {!isLoading && tables.length === 0 ? (
            <div className="mt-8 border border-[#c8d0dc] px-4 py-10 text-center text-slate-500 dark:border-slate-600/70 dark:text-slate-300">
              Belum ada tabel catatan sertifikasi untuk {selectedLocation.label}. Gunakan tombol{' '}
              <span className="font-semibold">Tambah Tabel</span> untuk mulai mengisi.
            </div>
          ) : null}

          <div className="mt-6 space-y-8">
            {tables.map((table) => (
              <section key={table.id} className="space-y-3">
                <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
                  <div className="flex min-w-0 flex-1 items-end gap-3">
                    <div className="whitespace-nowrap font-serif text-[18px] font-bold text-slate-900 dark:text-slate-100">
                      Area :
                    </div>
                    <input
                      value={table.title}
                      onChange={(event) => handleTitleChange(table.id, event.target.value)}
                      disabled={table.isSavingTable || table.isGeneratingDocument}
                      className={documentAreaInput}
                      placeholder="Nama area"
                    />
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <Button
                      type="button"
                      className="h-11 rounded-xl bg-blue-500 px-5 text-white shadow-sm hover:bg-blue-600"
                      onClick={() => handleGenerateDocument(table.id)}
                      disabled={
                        table.isGeneratingDocument
                        || table.isSavingTable
                        || table.isCreatingRow
                        || table.isDeleting
                      }
                    >
                      {table.isGeneratingDocument ? (
                        <LoaderCircle className="mr-2 h-4 w-4 animate-spin" />
                      ) : (
                        <FileText className="mr-2 h-4 w-4" />
                      )}
                      Generate Document
                    </Button>
                    <Button
                      variant="outline"
                      className={toolbarButton}
                      onClick={() => handleSaveTable(table.id)}
                      disabled={table.isSavingTable || table.isGeneratingDocument}
                    >
                      {table.isSavingTable ? (
                        <LoaderCircle className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <Save className="mr-1.5 h-3.5 w-3.5" />
                      )}
                      Simpan Tabel
                    </Button>
                    <Button
                      variant="outline"
                      className={toolbarButton}
                      onClick={() => handleAddRow(table.id)}
                      disabled={
                        table.isCreatingRow
                        || table.isSavingTable
                        || table.isGeneratingDocument
                      }
                    >
                      {table.isCreatingRow ? (
                        <LoaderCircle className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <Plus className="mr-1.5 h-3.5 w-3.5" />
                      )}
                      Tambah Baris
                    </Button>
                    <Button
                      variant="outline"
                      className={`${toolbarButton} border-red-300 text-red-600 hover:bg-red-50 dark:border-red-500/50 dark:text-red-200 dark:hover:bg-red-500/10`}
                      onClick={() => handleDeleteTable(table.id)}
                      disabled={
                        table.isDeleting
                        || table.isSavingTable
                        || table.isGeneratingDocument
                      }
                    >
                      {table.isDeleting ? (
                        <LoaderCircle className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <Trash2 className="mr-1.5 h-3.5 w-3.5" />
                      )}
                      Hapus Area
                    </Button>
                  </div>
                </div>

                <div className="overflow-x-auto">
                  <table className={`w-full table-fixed border-collapse ${documentBorder}`}>
                    <colgroup>
                      <col style={{ width: '56px' }} />
                      <col style={{ width: '37%' }} />
                      <col style={{ width: '29%' }} />
                      <col style={{ width: '18%' }} />
                      <col style={{ width: '104px' }} />
                      <col style={{ width: '76px' }} />
                    </colgroup>
                    <thead>
                      <tr>
                        <th className={`${documentHeadCell} text-center`}>No.</th>
                        <th className={documentHeadCell}>Catatan</th>
                        <th className={documentHeadCell}>Action Office</th>
                        <th className={documentHeadCell}>File Evidence</th>
                        <th className={`${documentHeadCell} text-center`}>Progress</th>
                        <th className={`${documentHeadCell} text-center`}>Aksi</th>
                      </tr>
                    </thead>
                    <tbody>
                      {table.rows.length === 0 ? (
                        <tr>
                          <td
                            colSpan={6}
                            className={`${documentCell} py-6 text-center text-slate-500`}
                          >
                            Area ini belum memiliki baris catatan.
                          </td>
                        </tr>
                      ) : null}

                      {table.rows.map((row, rowIndex) => (
                        <tr key={row.id}>
                          <td
                            className={`${documentCell} text-center font-serif text-[18px] align-middle`}
                          >
                            {rowIndex + 1}
                          </td>
                          <td className={documentCell}>
                            <textarea
                              value={row.note}
                              onChange={(event) =>
                                handleRowFieldChange(table.id, row.id, 'note', event.target.value)
                              }
                              disabled={table.isSavingTable || table.isGeneratingDocument}
                              rows={4}
                              className={documentTextArea}
                              placeholder="Isi catatan"
                            />
                          </td>
                          <td className={documentCell}>
                            <textarea
                              value={row.actionOffice}
                              onChange={(event) =>
                                handleRowFieldChange(
                                  table.id,
                                  row.id,
                                  'actionOffice',
                                  event.target.value
                                )
                              }
                              disabled={table.isSavingTable || table.isGeneratingDocument}
                              rows={4}
                              className={documentTextArea}
                              placeholder="Isi action office"
                            />
                          </td>
                          <td className={documentCell}>
                            <div className="space-y-3">
                              {row.evidenceFiles.length > 0 ? (
                                <div className="space-y-2">
                                  {row.evidenceFiles.map((file, index) => (
                                    <div
                                      key={`${file.name}-${index}`}
                                      className="flex items-start gap-2"
                                    >
                                      <a
                                        href={resolveApiUrl(file.signedUrl)}
                                        target="_blank"
                                        rel="noreferrer"
                                        className="min-w-0 flex-1 break-all font-serif text-[13px] leading-5 text-slate-900 underline underline-offset-2 dark:text-blue-200"
                                      >
                                        {file.name}
                                      </a>
                                      <button
                                        type="button"
                                        onClick={() =>
                                          handleDeleteEvidenceFile(
                                            table.id,
                                            row.id,
                                            index,
                                            file.name
                                          )
                                        }
                                        disabled={
                                          row.deletingEvidenceIndex !== null
                                          || row.isDeleting
                                          || table.isSavingTable
                                          || table.isGeneratingDocument
                                        }
                                        aria-label={`Hapus file evidence ${file.name}`}
                                        className="mt-0.5 inline-flex h-6 w-6 shrink-0 items-center justify-center border border-red-200 text-red-600 transition hover:bg-red-50 hover:text-red-700 disabled:cursor-not-allowed disabled:opacity-60 dark:border-red-500/40 dark:text-red-300 dark:hover:bg-red-500/10 dark:hover:text-red-200"
                                      >
                                        {row.deletingEvidenceIndex === index ? (
                                          <LoaderCircle className="h-3.5 w-3.5 animate-spin" />
                                        ) : (
                                          <Trash2 className="h-3.5 w-3.5" />
                                        )}
                                      </button>
                                    </div>
                                  ))}
                                </div>
                              ) : (
                                <div className="font-serif text-[13px] italic text-slate-500">
                                  Belum ada file evidence.
                                </div>
                              )}

                              {row.pendingFiles.length > 0 ? (
                                <div className="border-t border-[#d7dde8] pt-2 dark:border-slate-600/60">
                                  <div className="font-serif text-[12px] font-semibold text-slate-700 dark:text-slate-200">
                                    File siap upload:
                                  </div>
                                  <div className="mt-1 space-y-1">
                                    {row.pendingFiles.map((file) => (
                                      <div
                                        key={`${file.name}-${file.lastModified}-${file.size}`}
                                        className="break-all font-serif text-[12px] text-slate-700 dark:text-slate-300"
                                      >
                                        {file.name}
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              ) : null}

                              <div className="border-t border-[#d7dde8] pt-2 dark:border-slate-600/60">
                                <input
                                  type="file"
                                  multiple
                                  accept=".pdf,.png,.jpg,.jpeg,.doc,.docx,.xls,.xlsx"
                                  onChange={(event) =>
                                    handlePendingFilesChange(
                                      table.id,
                                      row.id,
                                      Array.from(event.target.files ?? [])
                                    )
                                  }
                                  disabled={table.isSavingTable || table.isGeneratingDocument}
                                  className="block w-full text-[12px] text-slate-700 file:mr-3 file:border file:border-[#bcc6d4] file:bg-white file:px-2 file:py-1.5 file:text-[11px] file:font-semibold file:text-slate-700 hover:file:bg-slate-50 dark:!bg-transparent dark:text-slate-300 dark:file:border-slate-600/70 dark:file:bg-slate-800 dark:file:text-slate-100 dark:hover:file:bg-slate-700"
                                />
                              </div>
                            </div>
                          </td>
                          <td className={documentProgressCell}>
                            <select
                              value={row.progress}
                              onChange={(event) =>
                                handleRowFieldChange(
                                  table.id,
                                  row.id,
                                  'progress',
                                  Number(event.target.value)
                                )
                              }
                              disabled={table.isSavingTable || table.isGeneratingDocument}
                              className={documentSelect}
                            >
                              {CERTIFICATION_NOTE_PROGRESS_OPTIONS.map((option) => (
                                <option key={option} value={option}>
                                  {option}%
                                </option>
                              ))}
                            </select>
                          </td>
                          <td className={`${documentCell} text-center align-middle`}>
                            <button
                              type="button"
                              onClick={() => handleDeleteRow(table.id, row.id)}
                              disabled={
                                row.isDeleting
                                || row.deletingEvidenceIndex !== null
                                || table.isSavingTable
                                || table.isGeneratingDocument
                              }
                              aria-label="Hapus baris"
                              className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-red-200 text-red-600 transition hover:bg-red-50 hover:text-red-700 disabled:cursor-not-allowed disabled:opacity-60 dark:border-red-500/40 dark:text-red-300 dark:hover:bg-red-500/10 dark:hover:text-red-200"
                            >
                              {row.isDeleting ? (
                                <LoaderCircle className="h-3.5 w-3.5 animate-spin" />
                              ) : (
                                <Trash2 className="h-3.5 w-3.5" />
                              )}
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
            ))}
          </div>
        </div>
      </div>

      <AlertDialog
        open={Boolean(deleteConfirmation)}
        onOpenChange={handleDeleteDialogOpenChange}
      >
        <AlertDialogContent className="max-w-[460px] rounded-3xl border border-red-100 bg-white p-0 shadow-[0_24px_80px_rgba(15,23,42,0.28)] dark:border-red-500/30 dark:bg-slate-900 dark:shadow-[0_24px_80px_rgba(2,6,23,0.6)]">
          <div className="p-6">
            <AlertDialogHeader className="space-y-3 text-left">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-red-50 text-red-600 dark:bg-red-500/10 dark:text-red-300">
                <AlertTriangle className="h-5 w-5" />
              </div>
              <AlertDialogTitle className="text-xl font-semibold text-slate-900 dark:text-slate-100">
                {deleteConfirmation?.title ?? 'Konfirmasi hapus'}
              </AlertDialogTitle>
              <AlertDialogDescription className="text-sm leading-6 text-slate-600 dark:text-slate-300">
                {deleteConfirmation?.description}
              </AlertDialogDescription>
            </AlertDialogHeader>

            <AlertDialogFooter className="mt-6 gap-2 sm:space-x-0">
              <Button
                type="button"
                variant="outline"
                className="rounded-xl border-slate-200 px-5 dark:border-slate-600/70 dark:bg-slate-800 dark:text-slate-100 dark:hover:bg-slate-700"
                onClick={() => setDeleteConfirmation(null)}
                disabled={isDeleteConfirming}
              >
                Batal
              </Button>
              <Button
                type="button"
                className="rounded-xl bg-red-600 px-5 text-white hover:bg-red-700 dark:bg-red-600 dark:text-white dark:hover:bg-red-500"
                onClick={handleConfirmDelete}
                disabled={isDeleteConfirming}
              >
                {isDeleteConfirming ? (
                  <LoaderCircle className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Trash2 className="mr-2 h-4 w-4" />
                )}
                {isDeleteConfirming
                  ? 'Menghapus...'
                  : deleteConfirmation?.confirmLabel ?? 'Hapus'}
              </Button>
            </AlertDialogFooter>
          </div>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
