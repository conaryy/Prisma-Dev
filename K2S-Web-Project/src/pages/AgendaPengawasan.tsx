import { useEffect, useMemo, useState } from 'react';
import { FileText, Search, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { formatDate } from '@/lib/date';
import { apiFetch, resolveApiUrl } from '@/lib/api';

export function AgendaPengawasan() {
  const [items, setItems] = useState<Array<{
    id: string;
    scope: string;
    title: string | null;
    startDate: string;
    endDate: string;
    team: { leader: string; members: string[]; audity: string[] } | null;
    file: { name?: string | null; url?: string | null } | null;
  }>>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedTitle, setSelectedTitle] = useState('');
  const [selectedYear, setSelectedYear] = useState('ALL');
  const [searchText, setSearchText] = useState('');

  useEffect(() => {
    setIsLoading(true);
    const yearParam = selectedYear !== 'ALL' ? `?year=${selectedYear}` : '';
    apiFetch<{ data: typeof items }>(`/api/agenda/self-assessment${yearParam}`)
      .then((response) => setItems(response.data ?? []))
      .finally(() => setIsLoading(false));
  }, [selectedYear]);

  const titleOptions = useMemo(() => {
    const unique = Array.from(new Set(items.map((item) => item.title || item.scope)));
    return unique.sort();
  }, [items]);

  const yearOptions = useMemo(() => {
    const years = new Set<string>();
    items.forEach((item) => {
      if (item.startDate) years.add(item.startDate.slice(0, 4));
      if (item.endDate) years.add(item.endDate.slice(0, 4));
    });
    return ['ALL', ...Array.from(years).sort().reverse()];
  }, [items]);

  const filteredItems = useMemo(() => {
    const term = searchText.trim().toLowerCase();
    return items.filter((item) => {
      if (selectedTitle && (item.title || item.scope) !== selectedTitle) return false;
      if (!term) return true;
      const leader = item.team?.leader ?? '';
      const members = [...(item.team?.members ?? []), ...(item.team?.audity ?? [])].join(' ');
      const title = item.title ?? item.scope;
      return `${title} ${leader} ${members}`.toLowerCase().includes(term);
    });
  }, [items, selectedTitle, searchText]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-slate-800">Agenda Pengawasan</h1>
          <p className="text-sm text-slate-500">
            Menampilkan semua sesi self assessment yang sedang berjalan.
          </p>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="grid gap-3 lg:grid-cols-[minmax(220px,1fr)_minmax(140px,220px)_minmax(200px,1fr)_auto]">
          <select
            className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm"
            value={selectedTitle}
            onChange={(event) => setSelectedTitle(event.target.value)}
          >
            <option value="">Pilih Kegiatan</option>
            {titleOptions.map((title) => (
              <option key={title} value={title}>
                {title}
              </option>
            ))}
          </select>
          <select
            className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm"
            value={selectedYear}
            onChange={(event) => setSelectedYear(event.target.value)}
          >
            {yearOptions.map((year) => (
              <option key={year} value={year}>
                {year === 'ALL' ? 'Semua Tahun' : year}
              </option>
            ))}
          </select>
          <Input
            placeholder="Cari ketua tim atau anggota"
            value={searchText}
            onChange={(event) => setSearchText(event.target.value)}
          />
          <div className="flex items-center gap-2">
            <Button size="icon" className="h-10 w-10" onClick={() => setSearchText(searchText)}>
              <Search className="h-4 w-4" />
            </Button>
            <Button
              size="icon"
              variant="outline"
              className="h-10 w-10"
              onClick={() => {
                setSelectedTitle('');
                setSelectedYear('ALL');
                setSearchText('');
              }}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <Table>
          <TableHeader>
            <TableRow className="bg-slate-50/80">
              <TableHead className="w-12 text-center text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
                No
              </TableHead>
              <TableHead className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
                Nama Kegiatan
              </TableHead>
              <TableHead className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
                Ketua Tim
              </TableHead>
              <TableHead className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
                Anggota
              </TableHead>
              <TableHead className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
                Audity
              </TableHead>
              <TableHead className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
                Tanggal Mulai
              </TableHead>
              <TableHead className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
                Tanggal Selesai
              </TableHead>
              <TableHead className="text-center text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
                File
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={8} className="p-6 text-center text-sm text-slate-500">
                  Memuat agenda...
                </TableCell>
              </TableRow>
            ) : filteredItems.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="p-6 text-center text-sm text-slate-500">
                  Tidak ada sesi yang sedang berjalan.
                </TableCell>
              </TableRow>
            ) : (
              filteredItems.map((item, index) => {
                const teamMembers = item.team?.members ?? [];
                const teamAudity = item.team?.audity ?? [];
                return (
                  <TableRow key={item.id}>
                    <TableCell className="text-center text-sm">{index + 1}</TableCell>
                    <TableCell className="text-sm">
                      <div className="font-semibold text-slate-800">
                        {item.title ?? item.scope}
                      </div>
                      <div className="text-xs text-slate-500">
                        {item.startDate} - {item.endDate}
                      </div>
                    </TableCell>
                    <TableCell className="text-sm">
                      {item.team?.leader ?? '-'}
                    </TableCell>
                    <TableCell className="text-sm">
                      {teamMembers.length === 0 ? (
                        '-'
                      ) : (
                        <ol className="list-decimal space-y-1 pl-5 text-xs text-slate-600">
                          {teamMembers.map((name, idx) => (
                            <li key={`${item.id}-member-${idx}`}>{name}</li>
                          ))}
                        </ol>
                      )}
                    </TableCell>
                    <TableCell className="text-sm">
                      {teamAudity.length === 0 ? (
                        '-'
                      ) : (
                        <ol className="list-decimal space-y-1 pl-5 text-xs text-slate-600">
                          {teamAudity.map((name, idx) => (
                            <li key={`${item.id}-audity-${idx}`}>{name}</li>
                          ))}
                        </ol>
                      )}
                    </TableCell>
                    <TableCell className="text-sm">{formatDate(item.startDate)}</TableCell>
                    <TableCell className="text-sm">{formatDate(item.endDate)}</TableCell>
                    <TableCell className="text-center">
                      {item.file?.url ? (
                        <a
                          href={resolveApiUrl(item.file.url)}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-blue-50 text-blue-600 hover:bg-blue-100"
                        >
                          <FileText className="h-4 w-4" />
                        </a>
                      ) : (
                        <span className="text-xs text-slate-400">-</span>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
