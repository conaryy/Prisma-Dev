import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ClipboardList, Download, Pencil, Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { apiFetch } from '@/lib/api';
import { downloadFromSignedUrl } from '@/lib/download';
import { toast } from '@/hooks/use-toast';
import { Modal } from '@/components/shared/Modal';

type QuestionCategory = {
  id: string;
  scope: string;
  name: string;
  prefix: string;
  is_active: boolean;
  sort_order: number;
};

type AreaCategory = {
  id: string;
  scope: string;
  name: string;
};

type QuestionItem = {
  id: string;
  scope: string;
  category: string | null;
  question_category: string | null;
  question_category_prefix: string | null;
  code: string;
  text: string;
  reference: string | null;
  is_active: boolean;
  sort_order: number;
};

const SCOPE_OPTIONS = [
  { value: 'audit', label: 'Audit' },
  { value: 'inspeksi', label: 'Inspeksi' },
  { value: 'surveillance', label: 'Surveillance' },
];

export function SelfAssessmentQuestions() {
  const [questions, setQuestions] = useState<QuestionItem[]>([]);
  const [questionCategories, setQuestionCategories] = useState<QuestionCategory[]>([]);
  const [areaCategories, setAreaCategories] = useState<AreaCategory[]>([]);
  const [selection, setSelection] = useState({ scope: 'audit', category: '' });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSavingCategory, setIsSavingCategory] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [importMessage, setImportMessage] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [filters, setFilters] = useState({ scope: 'audit', category: '' });
  const [showCategoryForm, setShowCategoryForm] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [importFile, setImportFile] = useState<File | null>(null);
  const [isDeleteAllOpen, setIsDeleteAllOpen] = useState(false);
  const [isDeletingAll, setIsDeletingAll] = useState(false);
  const [isDownloadingTemplate, setIsDownloadingTemplate] = useState(false);
  const importInputRef = useRef<HTMLInputElement | null>(null);
  const [questionCategoryForm, setQuestionCategoryForm] = useState({
    name: '',
    prefix: '',
  });
  const [form, setForm] = useState({
    code: '',
    text: '',
    reference: '',
    isActive: true,
    questionCategoryId: '',
  });

  const loadQuestionCategories = useCallback(() => {
    apiFetch<{ data: QuestionCategory[] }>(
      `/api/admin/self-assessment/question-categories?scope=${filters.scope}`
    )
      .then((response) => setQuestionCategories(response.data))
      .catch((error: Error) =>
        setErrorMessage(error.message || 'Gagal memuat kategori pertanyaan.')
      );
  }, [filters.scope]);

  const loadQuestions = useCallback(() => {
    if (!filters.category) {
      setQuestions([]);
      return;
    }
    const params = new URLSearchParams();
    if (filters.scope) params.set('scope', filters.scope);
    if (filters.category) params.set('category', filters.category);
    apiFetch<{ data: QuestionItem[] }>(
      `/api/admin/self-assessment/questions?${params.toString()}`
    )
      .then((response) => setQuestions(response.data))
      .catch((error: Error) =>
        setErrorMessage(error.message || 'Gagal memuat pertanyaan.')
      );
  }, [filters.scope, filters.category]);

  const loadAreaCategories = useCallback((scope: string) => {
    apiFetch<{ data: AreaCategory[] }>(
      `/api/admin/self-assessment/categories?scope=${scope}`
    )
      .then((response) => setAreaCategories(response.data))
      .catch((error: Error) =>
        setErrorMessage(error.message || 'Gagal memuat kategori area.')
      );
  }, []);


  useEffect(() => {
    loadQuestions();
    loadQuestionCategories();
  }, [loadQuestionCategories, loadQuestions]);

  useEffect(() => {
    loadAreaCategories(selection.scope);
  }, [loadAreaCategories, selection.scope]);

  const resetForm = () => {
    setForm({
      code: '',
      text: '',
      reference: '',
      isActive: true,
      questionCategoryId: '',
    });
    setEditingId(null);
  };

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setErrorMessage(null);
    if (!filters.scope || !filters.category) {
      setErrorMessage('Pilih scope dan kategori terlebih dahulu.');
      return;
    }
    setIsSubmitting(true);
    const payload = {
      scope: filters.scope,
      category: filters.category || null,
      code: form.code,
      text: form.text,
      reference: form.reference || null,
      isActive: form.isActive,
      questionCategoryId: form.questionCategoryId,
    };
    const request = editingId
      ? apiFetch(`/api/admin/self-assessment/questions/${editingId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        })
      : apiFetch('/api/admin/self-assessment/questions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });

    request
      .then(() => {
        resetForm();
        loadQuestions();
      })
      .catch((error: Error) => {
        setErrorMessage(error.message || 'Gagal menyimpan pertanyaan.');
      })
      .finally(() => setIsSubmitting(false));
  };

  const handleEdit = (question: QuestionItem) => {
    setEditingId(question.id);
    if (
      question.scope !== filters.scope ||
      (question.category ?? '') !== filters.category
    ) {
      const nextCategory = question.category ?? '';
      setSelection({ scope: question.scope, category: nextCategory });
      setFilters({ scope: question.scope, category: nextCategory });
    }
    setForm({
      code: question.code,
      text: question.text,
      reference: question.reference ?? '',
      isActive: question.is_active,
      questionCategoryId: question.question_category_prefix
        ? questionCategories.find(
            (item) =>
              item.prefix === question.question_category_prefix &&
              item.name === question.question_category
          )?.id ?? ''
        : '',
    });
  };

  const handleApplySelection = () => {
    setFilters({ scope: selection.scope, category: selection.category });
    resetForm();
  };

  const handleCategorySubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!selection.scope || !newCategoryName.trim()) {
      setErrorMessage('Isi nama kategori terlebih dahulu.');
      return;
    }
    setErrorMessage(null);
    setIsSavingCategory(true);
    apiFetch('/api/admin/self-assessment/categories', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        scope: selection.scope,
        name: newCategoryName.trim(),
        isActive: true,
      }),
    })
      .then(() => {
        setNewCategoryName('');
        setShowCategoryForm(false);
        loadAreaCategories(selection.scope);
      })
      .catch((error: Error) => {
        setErrorMessage(error.message || 'Gagal menambah kategori area.');
      })
      .finally(() => setIsSavingCategory(false));
  };

  const handleQuestionCategorySubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setErrorMessage(null);
    apiFetch('/api/admin/self-assessment/question-categories', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        scope: filters.scope,
        name: questionCategoryForm.name,
        prefix: questionCategoryForm.prefix,
      }),
    })
      .then(() => {
        setQuestionCategoryForm({ name: '', prefix: '' });
        loadQuestionCategories();
      })
      .catch((error: Error) => {
        setErrorMessage(error.message || 'Gagal menambah kategori pertanyaan.');
      });
  };

  const handleImport = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setErrorMessage(null);
    setImportMessage(null);
    if (!filters.scope || !filters.category) {
      setErrorMessage('Pilih scope dan kategori terlebih dahulu.');
      return;
    }
    if (!importFile) {
      setErrorMessage('Pilih file CSV terlebih dahulu.');
      return;
    }
    if (importFile.size > 10 * 1024 * 1024) {
      setErrorMessage('Ukuran file maksimal 10MB.');
      return;
    }
    const formData = new FormData();
    formData.append('scope', filters.scope);
    formData.append('category', filters.category);
    formData.append('file', importFile);

    setIsImporting(true);
    apiFetch<{ data: { created: number; errors: Array<{ row: number; message: string }> } }>(
      '/api/admin/self-assessment/questions/import',
      {
        method: 'POST',
        body: formData,
      }
    )
      .then((response) => {
        const created = response.data.created ?? 0;
        const errors = response.data.errors ?? [];
        if (errors.length > 0) {
          setErrorMessage(
            `Sebagian data gagal diimport (${errors.length} baris). Contoh: Baris ${errors[0].row} - ${errors[0].message}`
          );
        }
        setImportMessage(`Berhasil import ${created} pertanyaan.`);
        setImportFile(null);
        if (importInputRef.current) {
          importInputRef.current.value = '';
        }
        loadQuestionCategories();
        loadQuestions();
      })
      .catch((error: Error) => {
        setErrorMessage(error.message || 'Gagal import CSV.');
      })
      .finally(() => setIsImporting(false));
  };

  const handleQuestionCategoryDelete = (id: string) => {
    setErrorMessage(null);
    apiFetch(`/api/admin/self-assessment/question-categories/${id}`, {
      method: 'DELETE',
    })
      .then(() => loadQuestionCategories())
      .catch((error: Error) => {
        setErrorMessage(error.message || 'Gagal menghapus kategori pertanyaan.');
      });
  };

  const handleDelete = (id: string) => {
    setErrorMessage(null);
    apiFetch(`/api/admin/self-assessment/questions/${id}`, { method: 'DELETE' })
      .then(() => loadQuestions())
      .catch((error: Error) =>
        setErrorMessage(error.message || 'Gagal menghapus pertanyaan.')
      );
  };

  const openDeleteAll = () => {
    if (!filters.scope || !filters.category) {
      setErrorMessage('Pilih scope dan kategori terlebih dahulu.');
      return;
    }
    setIsDeleteAllOpen(true);
  };

  const handleDeleteAll = () => {
    setErrorMessage(null);
    setIsDeletingAll(true);
    const params = new URLSearchParams({
      scope: filters.scope,
      category: filters.category,
    });
    apiFetch(`/api/admin/self-assessment/questions?${params.toString()}`, {
      method: 'DELETE',
    })
      .then(() => {
        resetForm();
        loadQuestions();
        setImportFile(null);
        if (importInputRef.current) {
          importInputRef.current.value = '';
        }
        setIsDeleteAllOpen(false);
        toast({
          title: 'Berhasil dihapus',
          description: 'Semua pertanyaan pada kategori ini sudah dihapus.',
        });
      })
      .catch((error: Error) => {
        setErrorMessage(error.message || 'Gagal menghapus pertanyaan.');
      })
      .finally(() => setIsDeletingAll(false));
  };

  const scopeLabel = useMemo(() => {
    return SCOPE_OPTIONS.find((item) => item.value === filters.scope)?.label ?? '';
  }, [filters.scope]);
  const mappedQuestionCategories = useMemo(() => {
    return questionCategories;
  }, [questionCategories]);
  const canManageQuestions = Boolean(filters.scope && filters.category);
  const handleDownloadTemplate = async () => {
    setIsDownloadingTemplate(true);
    try {
      const response = await apiFetch<{ data: { url: string } }>(
        '/api/guide/template/question-url'
      );
      await downloadFromSignedUrl(response.data.url, 'template.csv');
    } catch (error) {
      setErrorMessage(
        error instanceof Error && error.message
          ? error.message
          : 'Gagal mengunduh template.'
      );
    } finally {
      setIsDownloadingTemplate(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <span className="flex h-10 w-10 items-center justify-center rounded-xl border border-blue-200 bg-blue-50 text-blue-600 shadow-sm">
          <ClipboardList className="h-5 w-5" />
        </span>
        <div>
          <h1 className="text-xl font-semibold text-slate-800">
            Pertanyaan Self Assessment
          </h1>
          <p className="text-sm text-slate-500">
            Atur daftar pertanyaan untuk setiap scope dan kategori.
          </p>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <Select
          value={selection.scope}
          onValueChange={(value) =>
            setSelection((prev) => ({ ...prev, scope: value, category: '' }))
          }
        >
          <SelectTrigger className="w-48">
            <SelectValue placeholder="Pilih scope" />
          </SelectTrigger>
          <SelectContent>
            {SCOPE_OPTIONS.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select
          value={selection.category}
          onValueChange={(value) => {
            if (value === '__add_category__') {
              setShowCategoryForm(true);
              return;
            }
            setShowCategoryForm(false);
            setSelection((prev) => ({ ...prev, category: value }));
          }}
        >
          <SelectTrigger className="w-56">
            <SelectValue placeholder="Pilih area" />
          </SelectTrigger>
          <SelectContent>
            {areaCategories.map((item) => (
              <SelectItem key={item.id} value={item.name}>
                {item.name}
              </SelectItem>
            ))}
            <SelectItem
              value="__add_category__"
              className="font-semibold text-blue-600"
            >
              Tambah kategori
            </SelectItem>
          </SelectContent>
        </Select>
        <Button type="button" className="gap-2" onClick={handleApplySelection}>
          Pilih
        </Button>
        <span className="text-xs font-semibold text-slate-500">
          Scope aktif: {scopeLabel}
          {filters.category ? ` · ${filters.category}` : ''}
        </span>
      </div>

      {showCategoryForm && (
        <form
          className="flex flex-wrap items-center gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"
          onSubmit={handleCategorySubmit}
        >
          <Input
            className="w-64"
            value={newCategoryName}
            onChange={(event) => setNewCategoryName(event.target.value)}
            placeholder="Nama kategori baru (mis. CNS/ATS)"
            required
          />
          <Button type="submit" disabled={isSavingCategory}>
            {isSavingCategory ? 'Menyimpan...' : 'Simpan'}
          </Button>
          <Button
            type="button"
            variant="ghost"
            onClick={() => setShowCategoryForm(false)}
          >
            Batal
          </Button>
        </form>
      )}

      <form
        className="space-y-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"
        onSubmit={handleImport}
      >
        <div className="text-sm font-semibold text-slate-700">
          Upload Pertanyaan (CSV)
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Input
            type="file"
            accept=".csv"
            ref={importInputRef}
            onClick={(event) => {
              const target = event.currentTarget;
              target.value = '';
            }}
            onChange={(event) => {
              setErrorMessage(null);
              setImportMessage(null);
              setImportFile(event.target.files?.[0] ?? null);
            }}
            disabled={!canManageQuestions || isImporting}
            className="max-w-sm"
          />
          <Button type="submit" disabled={!canManageQuestions || isImporting}>
            {isImporting ? 'Mengunggah...' : 'Import CSV'}
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() => void handleDownloadTemplate()}
            disabled={isDownloadingTemplate}
          >
            <Download className="mr-2 h-4 w-4" />
            {isDownloadingTemplate ? 'Mengunduh...' : 'Download Template'}
          </Button>
        </div>
        <div className="text-xs text-slate-500">
          Kolom CSV: <span className="font-semibold">kategori</span>,{' '}
          <span className="font-semibold">prefix</span>,{' '}
          <span className="font-semibold">pertanyaan</span>,{' '}
          <span className="font-semibold">deskripsi</span> (opsional). Maks 10MB.
        </div>
        {importMessage && (
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
            {importMessage}
          </div>
        )}
      </form>

      <form
        className="space-y-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"
        onSubmit={handleQuestionCategorySubmit}
      >
        <div className="text-sm font-semibold text-slate-700">
          Kategori Pertanyaan
        </div>
        <div className="grid gap-3 sm:grid-cols-[1fr_140px_auto]">
          <Input
            value={questionCategoryForm.name}
            onChange={(event) =>
              setQuestionCategoryForm((prev) => ({
                ...prev,
                name: event.target.value,
              }))
            }
            placeholder="Nama kategori (B - PROSEDUR)"
            required
          />
          <Input
            value={questionCategoryForm.prefix}
            onChange={(event) =>
              setQuestionCategoryForm((prev) => ({
                ...prev,
                prefix: event.target.value,
              }))
            }
            placeholder="Prefix (B)"
            required
          />
          <Button type="submit" className="gap-2">
            <Plus className="h-4 w-4" />
            Tambah
          </Button>
        </div>
        <div className="flex flex-wrap gap-2 text-sm text-slate-600">
          {questionCategories.length === 0 ? (
            <span className="text-slate-500">Belum ada kategori.</span>
          ) : (
            questionCategories.map((item) => (
              <span
                key={item.id}
                className="inline-flex items-center gap-2 rounded-full border border-slate-200 px-3 py-1"
              >
                <button
                  type="button"
                  className="text-slate-700"
                  onClick={() =>
                    setQuestionCategoryForm({
                      name: item.name,
                      prefix: item.prefix,
                    })
                  }
                >
                  {item.prefix} - {item.name}
                </button>
                <button
                  type="button"
                  className="text-red-500"
                  onClick={() => handleQuestionCategoryDelete(item.id)}
                >
                  ×
                </button>
              </span>
            ))
          )}
        </div>
      </form>

      <form
        className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
        onSubmit={handleSubmit}
      >
        {!canManageQuestions && (
          <div className="rounded-xl border border-blue-100 bg-blue-50 px-4 py-3 text-sm text-blue-700">
            Pilih scope dan kategori terlebih dahulu untuk mengelola pertanyaan.
          </div>
        )}
        <div className="grid gap-4 md:grid-cols-2">
          <Input value={scopeLabel} placeholder="Scope" readOnly />
          <Input value={filters.category || ''} placeholder="Kategori" readOnly />
          <Input
            value={form.code}
            onChange={(event) => setForm((prev) => ({ ...prev, code: event.target.value }))}
            placeholder="Kode Pertanyaan"
            required
            disabled={!canManageQuestions}
          />
          <Select
            value={form.questionCategoryId}
            onValueChange={(value) =>
              setForm((prev) => ({ ...prev, questionCategoryId: value }))
            }
            disabled={!canManageQuestions}
          >
            <SelectTrigger>
              <SelectValue placeholder="Kategori Pertanyaan" />
            </SelectTrigger>
          <SelectContent>
              {mappedQuestionCategories.map((item) => (
                <SelectItem key={item.id} value={item.id}>
                  {item.prefix} - {item.name}
                </SelectItem>
              ))}
          </SelectContent>
        </Select>
          <Input
            value={form.reference}
            onChange={(event) => setForm((prev) => ({ ...prev, reference: event.target.value }))}
            placeholder="Referensi/Section (opsional)"
          />
        </div>
        <Input
          value={form.text}
          onChange={(event) => setForm((prev) => ({ ...prev, text: event.target.value }))}
          placeholder="Pertanyaan"
          required
          disabled={!canManageQuestions}
        />
        <div className="flex flex-wrap items-center gap-4">
          <label className="flex items-center gap-2 text-sm text-slate-600">
            <Checkbox
              checked={form.isActive}
              onCheckedChange={(checked) =>
                setForm((prev) => ({ ...prev, isActive: checked === true }))
              }
              disabled={!canManageQuestions}
            />
            Aktif
          </label>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button type="submit" disabled={isSubmitting || !canManageQuestions} className="gap-2">
            {editingId ? <Pencil className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
            {isSubmitting ? 'Menyimpan...' : editingId ? 'Perbarui' : 'Tambah'}
          </Button>
          {editingId && (
            <Button type="button" variant="outline" onClick={resetForm}>
              Batal
            </Button>
          )}
        </div>

        {errorMessage && (
          <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {errorMessage}
          </div>
        )}
      </form>

      <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-4 py-3">
          <div className="text-sm font-semibold text-slate-700">
            Daftar Pertanyaan
          </div>
          <div className="flex items-center gap-2 text-xs text-slate-500">
            <span>Total: {questions.length}</span>
            <Button
              type="button"
              variant="outline"
              onClick={openDeleteAll}
              disabled={!canManageQuestions || questions.length === 0}
              className="border-red-200 text-red-600 hover:bg-red-50 hover:text-red-700"
            >
              Hapus Semua
            </Button>
          </div>
        </div>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Kode</TableHead>
              <TableHead>Kategori Pertanyaan</TableHead>
              <TableHead>Pertanyaan</TableHead>
              <TableHead>Scope</TableHead>
              <TableHead>Kategori Area</TableHead>
              <TableHead>Aktif</TableHead>
              <TableHead className="text-right">Aksi</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {questions.length === 0 ? (
              <TableRow>
              <TableCell colSpan={7} className="text-center text-sm text-slate-500">
                Belum ada pertanyaan.
              </TableCell>
              </TableRow>
            ) : (
              questions.map((question) => (
                <TableRow key={question.id}>
                  <TableCell>{question.code}</TableCell>
                  <TableCell>
                    {question.question_category_prefix ?? ''} -{' '}
                    {question.question_category ?? '-'}
                  </TableCell>
                  <TableCell className="max-w-lg text-sm text-slate-600">
                    {question.text}
                  </TableCell>
                  <TableCell>{question.scope}</TableCell>
                  <TableCell>{question.category ?? '-'}</TableCell>
                  <TableCell>{question.is_active ? 'Ya' : 'Tidak'}</TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleEdit(question)}
                        aria-label="Edit pertanyaan"
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleDelete(question.id)}
                        aria-label="Hapus pertanyaan"
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
      </div>

      <Modal
        open={isDeleteAllOpen}
        onOpenChange={(open) => {
          if (!isDeletingAll) {
            setIsDeleteAllOpen(open);
          }
        }}
        modal={false}
        title="Hapus semua pertanyaan?"
        description={`Semua pertanyaan untuk ${scopeLabel}${filters.category ? ` · ${filters.category}` : ''} akan dihapus permanen.`}
      >
        <div className="flex flex-wrap justify-end gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => setIsDeleteAllOpen(false)}
            disabled={isDeletingAll}
          >
            Batal
          </Button>
          <Button
            type="button"
            className="bg-red-500 text-white hover:bg-red-600"
            onClick={handleDeleteAll}
            disabled={isDeletingAll}
          >
            {isDeletingAll ? 'Menghapus...' : 'Hapus Semua'}
          </Button>
        </div>
      </Modal>
    </div>
  );
}
