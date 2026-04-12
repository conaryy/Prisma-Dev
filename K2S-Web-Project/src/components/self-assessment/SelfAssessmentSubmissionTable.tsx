import { FolderOpen, RefreshCw, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

export type SelfAssessmentSubmissionTableArea = {
  id: string;
  label: string;
  onClick?: () => void;
  disabled?: boolean;
};

export type SelfAssessmentSubmissionTableRow = {
  id: string;
  scope?: string | null;
  areas: SelfAssessmentSubmissionTableArea[];
  userName?: string | null;
  leader?: string | null;
  members: string[];
  auditees: string[];
  schedule?: string | null;
  action?: {
    label: string;
    onClick: () => void;
    disabled?: boolean;
  };
};

type SelfAssessmentSubmissionTableProps = {
  rows: SelfAssessmentSubmissionTableRow[];
  isLoading?: boolean;
  loadingMessage?: string;
  emptyMessage?: string;
  emptyHint?: string;
  totalCount?: number;
  showScopeColumn?: boolean;
  showUserColumn?: boolean;
  showActionColumn?: boolean;
  dateHeaderLabel?: string;
  onResetFilters?: () => void;
};

export function SelfAssessmentSubmissionTable({
  rows,
  isLoading = false,
  loadingMessage = 'Memuat data...',
  emptyMessage = 'Belum ada data',
  emptyHint = 'Coba ubah filter bulan/tahun atau reset filter',
  totalCount,
  showScopeColumn = false,
  showUserColumn = false,
  showActionColumn = false,
  dateHeaderLabel = 'Tanggal Pelaksanaan',
  onResetFilters,
}: SelfAssessmentSubmissionTableProps) {
  const columnCount =
    6 +
    (showScopeColumn ? 1 : 0) +
    (showUserColumn ? 1 : 0) +
    (showActionColumn ? 1 : 0);

  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900/60">
      <Table className="w-full">
        <TableHeader className="bg-slate-50/80">
          <TableRow>
            <TableHead
              rowSpan={2}
              className="border-r border-slate-200 text-center text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500"
            >
              No
            </TableHead>
            {showScopeColumn ? (
              <TableHead
                rowSpan={2}
                className="border-r border-slate-200 text-center text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500"
              >
                Scope
              </TableHead>
            ) : null}
            <TableHead
              rowSpan={2}
              className="border-r border-slate-200 text-center text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500"
            >
              Area
            </TableHead>
            {showUserColumn ? (
              <TableHead
                rowSpan={2}
                className="border-r border-slate-200 text-center text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500"
              >
                User
              </TableHead>
            ) : null}
            <TableHead
              rowSpan={2}
              className="border-r border-slate-200 text-center text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500"
            >
              Ketua Tim
            </TableHead>
            <TableHead
              colSpan={2}
              className="border-r border-slate-200 text-center text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500"
            >
              Anggota
            </TableHead>
            <TableHead
              rowSpan={2}
              className={`text-center text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500 ${
                showActionColumn ? 'border-r border-slate-200' : ''
              }`}
            >
              {dateHeaderLabel}
            </TableHead>
            {showActionColumn ? (
              <TableHead
                rowSpan={2}
                className="text-center text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500"
              >
                Aksi
              </TableHead>
            ) : null}
          </TableRow>
          <TableRow className="bg-slate-50/50">
            <TableHead className="border-r border-slate-200 text-center text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500">
              Anggota
            </TableHead>
            <TableHead className="border-r border-slate-200 text-center text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500">
              Audity
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {isLoading ? (
            <TableRow>
              <TableCell colSpan={columnCount} className="py-10 text-center text-sm text-slate-500">
                {loadingMessage}
              </TableCell>
            </TableRow>
          ) : rows.length === 0 ? (
            <TableRow>
              <TableCell colSpan={columnCount} className="py-16">
                <div className="flex flex-col items-center gap-3 text-center text-slate-500">
                  <div className="relative">
                    <FolderOpen className="h-16 w-16 text-blue-200" />
                    <Search className="absolute bottom-1 right-0 h-6 w-6 rounded-full bg-blue-100 p-1 text-blue-400" />
                  </div>
                  <div className="space-y-1">
                    <div className="text-base font-semibold text-slate-700">
                      {emptyMessage}
                    </div>
                    <div className="text-sm text-slate-500">{emptyHint}</div>
                  </div>
                  {onResetFilters ? (
                    <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
                      <Button
                        type="button"
                        variant="outline"
                        className="rounded-xl border-slate-200 px-4 text-slate-600 shadow-sm hover:border-blue-200 hover:bg-blue-50"
                        onClick={onResetFilters}
                      >
                        <RefreshCw className="mr-2 h-4 w-4" />
                        Reset Filter
                      </Button>
                    </div>
                  ) : null}
                </div>
              </TableCell>
            </TableRow>
          ) : (
            rows.map((row, index) => (
              <TableRow key={row.id}>
                <TableCell className="text-center text-sm">{index + 1}</TableCell>
                {showScopeColumn ? (
                  <TableCell className="text-center text-sm capitalize">
                    {row.scope ?? '-'}
                  </TableCell>
                ) : null}
                <TableCell className="text-center">
                  <div className="flex flex-wrap justify-center gap-2">
                    {row.areas.map((area) =>
                      area.onClick ? (
                        <Button
                          key={area.id}
                          type="button"
                          size="sm"
                          variant="outline"
                          className="h-8 rounded-lg border-blue-200 bg-blue-50 text-xs font-semibold text-blue-700"
                          onClick={area.onClick}
                          disabled={area.disabled}
                        >
                          {area.label}
                        </Button>
                      ) : (
                        <span
                          key={area.id}
                          className="inline-flex min-h-8 items-center rounded-lg border border-slate-200 px-3 text-xs font-semibold text-slate-700"
                        >
                          {area.label}
                        </span>
                      )
                    )}
                  </div>
                </TableCell>
                {showUserColumn ? (
                  <TableCell className="text-center text-sm">
                    {row.userName ?? '-'}
                  </TableCell>
                ) : null}
                <TableCell className="text-center text-sm">
                  {row.leader?.trim() ? row.leader : '-'}
                </TableCell>
                <TableCell className="text-sm">
                  <ol className="list-decimal space-y-1 pl-4">
                    {row.members.map((name) => (
                      <li key={name}>{name}</li>
                    ))}
                  </ol>
                </TableCell>
                <TableCell className="text-sm">
                  <ol className="list-decimal space-y-1 pl-4">
                    {row.auditees.map((name) => (
                      <li key={name}>{name}</li>
                    ))}
                  </ol>
                </TableCell>
                <TableCell className="text-center text-sm text-slate-500">
                  {row.schedule ?? '-'}
                </TableCell>
                {showActionColumn ? (
                  <TableCell className="text-center">
                    {row.action ? (
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-9 min-w-[96px] rounded-xl border-blue-200 bg-blue-50 text-blue-700 shadow-sm hover:border-blue-300 hover:bg-blue-100"
                        onClick={row.action.onClick}
                        disabled={row.action.disabled}
                      >
                        {row.action.label}
                      </Button>
                    ) : (
                      '-'
                    )}
                  </TableCell>
                ) : null}
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
      <div className="border-t border-slate-200 px-4 py-3 text-sm text-slate-500">
        Menampilkan {rows.length || 0} dari total {(totalCount ?? rows.length) || 0} data
      </div>
    </div>
  );
}
