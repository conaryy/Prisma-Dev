import { useEffect, useMemo, useState } from 'react';
import { Download, FileText, Loader2, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { toast } from '@/hooks/use-toast';
import { downloadApiFile } from '@/lib/download';
import {
  fetchExternalDnpExportDocumentItems,
  generateExternalDnpExportDocument,
  type ExternalDnpExportDocumentItem,
} from '@/lib/externalDnp';
import type { SelfAssessmentScope } from '@/types/selfAssessment';

const SCOPE_OPTIONS: Array<{ value: SelfAssessmentScope; label: string }> = [
  { value: 'audit', label: 'Audit' },
  { value: 'inspeksi', label: 'Inspeksi' },
  { value: 'surveillance', label: 'Surveillance' },
];

const selectClassName =
  'h-11 w-full rounded-xl border border-input bg-white/80 px-4 text-sm text-slate-700 shadow-sm transition-colors focus:border-blue-300 focus:outline-none focus:ring-2 focus:ring-blue-200 dark:bg-slate-950 dark:text-slate-100 sm:w-56';

export function ExternalDnpExportDocument() {
  const [scope, setScope] = useState<SelfAssessmentScope>('audit');
  const [items, setItems] = useState<ExternalDnpExportDocumentItem[]>([]);
  const [selectedGroupIds, setSelectedGroupIds] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isGenerating, setIsGenerating] = useState(false);
  const [downloadUrl, setDownloadUrl] = useState('');
  const [downloadFilename, setDownloadFilename] = useState('external-dnp-export.doc');

  const loadItems = async (nextScope: SelfAssessmentScope) => {
    setIsLoading(true);
    setSelectedGroupIds([]);
    try {
      const response = await fetchExternalDnpExportDocumentItems(nextScope);
      setItems(response);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Gagal memuat daftar dokumen.';
      toast({
        title: 'Gagal memuat data',
        description: message,
        variant: 'destructive',
      });
      setItems([]);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void loadItems(scope);
  }, [scope]);

  const groupedItems = useMemo(() => {
    const groups = new Map<
      string,
      {
        id: string;
        instansiName: string;
        area: string;
        leader: string;
        members: string[];
        audity: string[];
        schedule: string;
        itemIds: string[];
      }
    >();

    items.forEach((item) => {
      const key = item.sessionAreaId || [item.instansiName, item.area, item.schedule, item.leader].join('::');
      const existing = groups.get(key);
      if (existing) {
        existing.itemIds.push(item.id);
        return;
      }

      groups.set(key, {
        id: key,
        instansiName: item.instansiName || '-',
        area: item.area || '-',
        leader: item.leader || '-',
        members: item.members || [],
        audity: item.audity || [],
        schedule: item.schedule || '-',
        itemIds: [item.id],
      });
    });

    return Array.from(groups.values());
  }, [items]);

  const allSelected = useMemo(
    () => groupedItems.length > 0 && selectedGroupIds.length === groupedItems.length,
    [groupedItems.length, selectedGroupIds.length]
  );

  const toggleSelectAll = (checked: boolean) => {
    setSelectedGroupIds(checked ? groupedItems.map((group) => group.id) : []);
  };

  const toggleSelectGroup = (groupId: string, checked: boolean) => {
    setSelectedGroupIds((current) =>
      checked ? Array.from(new Set([...current, groupId])) : current.filter((id) => id !== groupId)
    );
  };

  const handleGenerate = async () => {
    if (selectedGroupIds.length === 0) {
      toast({
        title: 'Belum ada data dipilih',
        description: 'Pilih minimal satu pemenuhan CAP untuk digenerate.',
        variant: 'destructive',
      });
      return;
    }

    setIsGenerating(true);
    try {
      const response = await generateExternalDnpExportDocument({
        scope,
        itemIds: selectedGroupIds,
      });
      setDownloadUrl(response.downloadUrl);
      setDownloadFilename(response.filename);
      await downloadApiFile(response.downloadUrl, response.filename);
      toast({
        title: 'Dokumen berhasil digenerate',
        description: `${response.totalItems} data masuk ke dokumen ${scope}.`,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Gagal generate dokumen.';
      toast({
        title: 'Generate gagal',
        description: message,
        variant: 'destructive',
      });
    } finally {
      setIsGenerating(false);
    }
  };

  const handleDownloadLatest = async () => {
    if (!downloadUrl) {
      toast({
        title: 'Belum ada dokumen',
        description: 'Generate dokumen terlebih dahulu untuk scope ini.',
        variant: 'destructive',
      });
      return;
    }

    try {
      await downloadApiFile(downloadUrl, downloadFilename);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Gagal mengunduh dokumen.';
      toast({
        title: 'Download gagal',
        description: message,
        variant: 'destructive',
      });
    }
  };

  return (
    <div className="space-y-6">
      <section className="overflow-hidden rounded-[28px] border border-slate-200/80 bg-white shadow-[0_24px_60px_rgba(15,23,42,0.08)]">
        <header className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-100 px-6 py-5">
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl border border-blue-200 bg-blue-50 text-blue-600 shadow-sm">
                <FileText className="h-5 w-5" />
              </span>
              <div>
                <h1 className="text-lg font-semibold text-slate-800">Export Document External DNP</h1>
                <p className="text-sm text-slate-500">
                  Pilih scope terlebih dahulu, centang daftar pemenuhan CAP, lalu generate dokumen Word.
                </p>
              </div>
            </div>
          </div>
          <div className="flex flex-col items-end gap-2">
            <div className="flex flex-wrap items-center gap-2">
              <Button
                type="button"
                variant="outline"
                className="h-11 rounded-xl border-slate-200 px-4 text-slate-600 shadow-sm hover:border-blue-200 hover:bg-blue-50"
                onClick={() => void loadItems(scope)}
                disabled={isLoading}
              >
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Memuat
                  </>
                ) : (
                  <>
                    <RefreshCw className="mr-2 h-4 w-4" />
                    Refresh
                  </>
                )}
              </Button>
              <span className="rounded-xl bg-blue-500 px-4 py-2 text-sm font-semibold text-white shadow-sm">
                {SCOPE_OPTIONS.find((option) => option.value === scope)?.label ?? scope}
              </span>
            </div>
          </div>
        </header>

        <div className="space-y-5 px-6 py-6">
          <div className="flex flex-wrap items-center gap-4">
            <select
              value={scope}
              onChange={(event) => setScope(event.target.value as SelfAssessmentScope)}
              className={selectClassName}
            >
              {SCOPE_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            <Button
              type="button"
              className="h-11 rounded-xl bg-blue-500 px-5 text-white shadow-sm hover:bg-blue-600"
              onClick={handleGenerate}
              disabled={isGenerating || selectedGroupIds.length === 0}
            >
              {isGenerating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <FileText className="mr-2 h-4 w-4" />}
              Generate Document
            </Button>
            <Button
              type="button"
              variant="outline"
              className="h-11 rounded-xl border-slate-200 px-4 text-slate-600 shadow-sm hover:border-blue-200 hover:bg-blue-50"
              onClick={handleDownloadLatest}
              disabled={!downloadUrl}
            >
              <Download className="mr-2 h-4 w-4" />
              Download Latest
            </Button>
            <div className="text-sm text-slate-500 dark:text-slate-400">
              {selectedGroupIds.length} dari {groupedItems.length} data dipilih
            </div>
          </div>

          <div className="overflow-hidden rounded-[28px] border border-slate-200 bg-slate-950">
            <Table>
              <TableHeader className="bg-slate-800/80">
                <TableRow>
                  <TableHead className="w-14 border-slate-700 text-center text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-300">
                    <Checkbox
                      checked={allSelected}
                      onCheckedChange={(checked) => toggleSelectAll(checked === true)}
                      aria-label="Pilih semua"
                    />
                  </TableHead>
                  <TableHead className="w-16 border-slate-700 text-center text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-300">No</TableHead>
                  <TableHead className="border-slate-700 text-center text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-300">Instansi</TableHead>
                  <TableHead className="border-slate-700 text-center text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-300">Area</TableHead>
                  <TableHead className="border-slate-700 text-center text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-300">Ketua Tim</TableHead>
                  <TableHead className="border-slate-700 text-center text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-300">Anggota</TableHead>
                  <TableHead className="border-slate-700 text-center text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-300">Audity</TableHead>
                  <TableHead className="border-slate-700 text-center text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-300">Tanggal Pelaksanaan</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={8} className="py-10 text-center text-slate-300">
                      <div className="flex items-center justify-center gap-2">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Memuat daftar pemenuhan CAP...
                      </div>
                    </TableCell>
                  </TableRow>
                ) : items.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="py-10 text-center text-slate-300">
                      Belum ada data pemenuhan CAP yang bisa dijadikan dokumen untuk scope ini.
                    </TableCell>
                  </TableRow>
                ) : (
                  groupedItems.map((group, index) => (
                    <TableRow key={group.id} className="border-slate-800 bg-slate-900/90 text-slate-100">
                      <TableCell className="align-top text-center">
                        <Checkbox
                          checked={selectedGroupIds.includes(group.id)}
                          onCheckedChange={(checked) => toggleSelectGroup(group.id, checked === true)}
                          aria-label={`Pilih ${group.instansiName}`}
                        />
                      </TableCell>
                      <TableCell className="align-top text-center text-slate-200">{index + 1}</TableCell>
                      <TableCell className="align-top font-medium text-slate-100">{group.instansiName}</TableCell>
                      <TableCell className="align-top">
                        <div className="inline-flex rounded-full border border-blue-500/40 bg-blue-500/15 px-3 py-1 text-sm font-semibold text-blue-200">
                          {group.area}
                        </div>
                      </TableCell>
                      <TableCell className="align-top text-slate-200">{group.leader}</TableCell>
                      <TableCell className="align-top text-slate-200">
                        {group.members.length > 0 ? (
                          <ol className="list-decimal space-y-1 pl-5">
                            {group.members.map((member) => (
                              <li key={member}>{member}</li>
                            ))}
                          </ol>
                        ) : (
                          '-'
                        )}
                      </TableCell>
                      <TableCell className="align-top text-slate-200">
                        {group.audity.length > 0 ? (
                          <ol className="list-decimal space-y-1 pl-5">
                            {group.audity.map((member) => (
                              <li key={member}>{member}</li>
                            ))}
                          </ol>
                        ) : (
                          '-'
                        )}
                      </TableCell>
                      <TableCell className="align-top text-slate-200">{group.schedule}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </div>
      </section>
    </div>
  );
}
