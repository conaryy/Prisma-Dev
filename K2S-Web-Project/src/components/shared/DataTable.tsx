import { useEffect, useMemo, useState } from 'react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

export interface Column<T> {
  header: string;
  className?: string;
  render: (row: T) => React.ReactNode;
}

interface DataTableProps<T> {
  columns: Column<T>[];
  data: T[];
  pageSize?: number;
  onRowClick?: (row: T) => void;
  emptyState?: string;
  isLoading?: boolean;
  rowClassName?: (row: T) => string;
}

export function DataTable<T extends { id?: string }>(
  props: DataTableProps<T>
) {
  const {
    columns,
    data,
    pageSize = 5,
    onRowClick,
    emptyState = 'Belum ada data.',
    isLoading = false,
    rowClassName,
  } = props;
  const [page, setPage] = useState(1);

  const totalPages = Math.max(1, Math.ceil(data.length / pageSize));

  useEffect(() => {
    if (page > totalPages) {
      setPage(totalPages);
    }
  }, [page, totalPages]);

  const pageData = useMemo(() => {
    const start = (page - 1) * pageSize;
    return data.slice(start, start + pageSize);
  }, [data, page, pageSize]);

  return (
    <div className="space-y-3">
      <Table className="overflow-hidden rounded-2xl border border-white/70 bg-white/70 shadow-sm backdrop-blur-sm dark:border-slate-700/80 dark:bg-slate-900/45">
        <TableHeader>
          <TableRow className="bg-slate-100/65 dark:bg-slate-800/65">
            {columns.map((column) => (
              <TableHead
                key={column.header}
                className={cn(
                  'text-xs font-semibold uppercase tracking-[0.2em] text-slate-400 dark:text-slate-300',
                  column.className
                )}
              >
                {column.header}
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {isLoading ? (
            Array.from({ length: 3 }).map((_, index) => (
              <TableRow key={`loading-${index}`}>
                {columns.map((column, colIndex) => (
                  <TableCell key={`${column.header}-${colIndex}`}>
                    <Skeleton className="h-4 w-full" />
                  </TableCell>
                ))}
              </TableRow>
            ))
          ) : pageData.length === 0 ? (
            <TableRow>
              <TableCell
                colSpan={columns.length}
                className="p-6 text-center text-sm text-slate-500 dark:text-slate-300"
              >
                {emptyState}
              </TableCell>
            </TableRow>
          ) : (
            pageData.map((row, index) => (
              <TableRow
                key={row.id ?? index}
                className={cn(
                  'transition-colors duration-200',
                  index % 2 === 1 && 'bg-white/30 dark:bg-slate-800/35',
                  onRowClick &&
                    'cursor-pointer hover:bg-blue-50/70 active:bg-blue-100/70 dark:hover:bg-slate-800/70 dark:active:bg-slate-700/70',
                  rowClassName?.(row)
                )}
                onClick={() => onRowClick?.(row)}
              >
                {columns.map((column) => (
                  <TableCell key={`${column.header}-${row.id ?? index}`}>
                    {column.render(row)}
                  </TableCell>
                ))}
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>

      <div className="flex items-center justify-between rounded-2xl border border-white/70 bg-white/70 px-3 py-2 text-xs text-slate-500 shadow-sm backdrop-blur-sm dark:border-slate-700/80 dark:bg-slate-900/45 dark:text-slate-300">
        <span>
          Halaman {page} dari {totalPages}
        </span>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setPage((prev) => Math.max(1, prev - 1))}
            disabled={page === 1}
          >
            Sebelumnya
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setPage((prev) => Math.min(totalPages, prev + 1))}
            disabled={page === totalPages}
          >
            Berikutnya
          </Button>
        </div>
      </div>
    </div>
  );
}
