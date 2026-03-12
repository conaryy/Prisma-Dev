import { useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { SendHorizontal } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Textarea } from '@/components/ui/textarea';
import { Modal } from '@/components/shared/Modal';
import { FormField, FormSection } from '@/components/shared/Form';
import { useAppData } from '@/contexts/AppDataContext';
import { NotFound } from '@/pages/NotFound';

const QUESTIONS = [
  {
    id: 'B.12',
    text: 'Apakah SOP Pelaporan telah diketahui dan diimplementasikan oleh teknisi?',
  },
  {
    id: 'B.15',
    text: 'Apakah SOP gangguan pelayanan telekomunikasi penerbangan telah diketahui dan diimplementasikan oleh teknisi?',
  },
  {
    id: 'B.17',
    text: 'Apakah SOP koordinasi penyelenggara pelayanan telah diketahui dan diimplementasikan oleh teknisi?',
  },
];

export function InspeksiPQ() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { inspections } = useAppData();
  const inspection = inspections.find((item) => item.id === id);

  const [search, setSearch] = useState('');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [files, setFiles] = useState<File[]>([]);
  const [assessment, setAssessment] = useState({
    status: 'Satisfactory',
    notes: '',
    recommendation: '',
  });
  const [historyOpen, setHistoryOpen] = useState(false);

  const filteredQuestions = useMemo(() => {
    const term = search.toLowerCase();
    return QUESTIONS.filter((question) =>
      `${question.id} ${question.text}`.toLowerCase().includes(term)
    );
  }, [search]);

  if (!inspection) {
    return <NotFound />;
  }

  return (
    <div className="space-y-6">
      <div className="space-y-1 text-sm text-slate-500">
        <span className="text-slate-600">Inspeksi</span> / Protocol Question (PQ)
      </div>

      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-slate-800">
            Perum LPPNPI Cabang Surabaya - {inspection.number} - CNS
          </h1>
        </div>
        <Button variant="outline" onClick={() => navigate('/inspeksi')}>
          Kembali
        </Button>
      </div>

      <div className="flex flex-wrap items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-3">
        <span className="text-xs font-semibold text-slate-500">Ket:</span>
        <span className="rounded-full bg-blue-100 px-3 py-1 text-xs font-semibold text-blue-700">
          Satisfactory
        </span>
        <span className="rounded-full bg-red-100 px-3 py-1 text-xs font-semibold text-red-700">
          Not Satisfactory
        </span>
        <span className="rounded-full bg-pink-100 px-3 py-1 text-xs font-semibold text-pink-700">
          Not Aplicable
        </span>
        <div className="flex flex-wrap gap-2 md:ml-auto">
          <Button variant="outline" size="sm">Draft</Button>
          <Button variant="outline" size="sm">Dikirim</Button>
          <Button variant="outline" size="sm">Allow Reply</Button>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.1fr_1fr]">
        <div className="space-y-4 rounded-lg border border-slate-200 bg-white p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-sm font-semibold text-slate-700">LIST PROTOCOL QUESTION</h2>
            <Button variant="outline" size="sm">Kirim Semua</Button>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-500">Search:</span>
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              className="max-w-xs"
            />
          </div>

          <div className="overflow-hidden rounded-md border border-slate-200">
            <div className="border-b border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-600">
              171 - AERONAUTICAL TELECOMMUNICATION SERVICES (CNS)
            </div>
            <div className="border-b border-slate-200 bg-slate-100 px-3 py-2 text-xs font-semibold text-slate-600">
              B - PROSEDUR
            </div>
            <div className="divide-y">
              {filteredQuestions.map((question) => {
                const isSelected = selectedIds.includes(question.id);
                return (
                  <label
                    key={question.id}
                    className={`flex items-start gap-3 px-3 py-3 text-sm transition ${
                      isSelected
                        ? 'bg-blue-100 text-slate-900'
                        : 'text-slate-700 hover:bg-amber-300'
                    }`}
                  >
                    <Checkbox
                      checked={isSelected}
                      onCheckedChange={(checked) => {
                        const isChecked = checked === true;
                        setSelectedIds((prev) =>
                          isChecked
                            ? [...prev, question.id]
                            : prev.filter((item) => item !== question.id)
                        );
                      }}
                    />
                    <div className="flex-1">
                      <span className="font-semibold">{question.id}</span> - {question.text}
                    </div>
                    <SendHorizontal className="mt-1 h-4 w-4 text-slate-400" />
                  </label>
                );
              })}
              {filteredQuestions.length === 0 && (
                <div className="px-3 py-4 text-sm text-slate-500">
                  Tidak ada pertanyaan yang cocok.
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="space-y-4 rounded-lg border border-slate-200 bg-white p-4">
          <div>
            <h2 className="text-sm font-semibold text-slate-700">
              Upload file evidence{' '}
              <span className="text-red-500">*</span>
            </h2>
            <p className="mt-1 text-xs text-slate-500">
              Your file will be uploaded to server
            </p>
          </div>
          <div className="relative flex min-h-[140px] items-center justify-center rounded-lg border-2 border-dashed border-slate-200 bg-slate-50 text-center">
            <div className="text-sm text-slate-500">
              Drop files here or click to upload.
            </div>
            <input
              type="file"
              multiple
              className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
              onChange={(event) => setFiles(Array.from(event.target.files ?? []))}
            />
          </div>
          {files.length > 0 && (
            <div className="text-xs text-slate-500">
              {files.map((file) => (
                <div key={file.name}>{file.name}</div>
              ))}
            </div>
          )}
          <div className="text-xs text-slate-500">
            *File yang diperbolehkan: JPG, JPEG, PDF, DOCX, PNG, MP3, MP4, XLSX
            <br />
            *Max size : 20MB
          </div>

          <FormSection title="Data Assessment">
            <div className="grid gap-4">
              <FormField label="Status">
                <select
                  className="h-9 w-full rounded-md border border-slate-200 px-3 text-sm"
                  value={assessment.status}
                  onChange={(event) =>
                    setAssessment({ ...assessment, status: event.target.value })
                  }
                >
                  <option value="Satisfactory">Satisfactory</option>
                  <option value="Not Satisfactory">Not Satisfactory</option>
                  <option value="Not Aplicable">Not Aplicable</option>
                </select>
              </FormField>
              <FormField label="Catatan Assessor">
                <Textarea
                  rows={3}
                  value={assessment.notes}
                  onChange={(event) =>
                    setAssessment({ ...assessment, notes: event.target.value })
                  }
                />
              </FormField>
              <FormField label="Rekomendasi / Tindak Lanjut Awal">
                <Textarea
                  rows={3}
                  value={assessment.recommendation}
                  onChange={(event) =>
                    setAssessment({ ...assessment, recommendation: event.target.value })
                  }
                />
              </FormField>
              <div className="flex flex-wrap items-center gap-2">
                <Button>Simpan</Button>
                <Button variant="outline" onClick={() => setHistoryOpen(true)}>
                  History Self Assessment
                </Button>
              </div>
            </div>
          </FormSection>
        </div>
      </div>

      <Modal
        open={historyOpen}
        onOpenChange={setHistoryOpen}
        title="History Self Assessment"
        description="Riwayat self assessment (dummy)."
      >
        <div className="space-y-2 text-sm text-slate-600">
          <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2">
            2026-01-12 09:30 - Draft dibuat.
          </div>
          <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2">
            2026-01-12 10:10 - Perbaikan catatan assessor.
          </div>
        </div>
      </Modal>
    </div>
  );
}
