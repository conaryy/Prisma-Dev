import { FileText, Search, Database } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface EmptyStateProps {
  icon?: 'file' | 'search' | 'database';
  title?: string;
  message?: string;
  action?: {
    label: string;
    onClick: () => void;
  };
}

export function EmptyState({
  icon = 'file',
  title = 'No Data',
  message = 'No data available yet',
  action,
}: EmptyStateProps) {
  const Icon = icon === 'file' ? FileText : icon === 'search' ? Search : Database;

  return (
    <div className="flex flex-col items-center justify-center py-12 text-center">
      <div className="rounded-full bg-muted p-6 mb-4">
        <Icon className="h-12 w-12 text-muted-foreground" />
      </div>
      <h3 className="text-lg font-semibold mb-2">{title}</h3>
      <p className="text-sm text-muted-foreground max-w-sm mb-4">{message}</p>
      {action && (
        <Button onClick={action.onClick} variant="outline">
          {action.label}
        </Button>
      )}
    </div>
  );
}

export function NoResultsState({ onReset }: { onReset?: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-center">
      <div className="rounded-full bg-muted p-6 mb-4">
        <Search className="h-12 w-12 text-muted-foreground" />
      </div>
      <h3 className="text-lg font-semibold mb-2">No Results</h3>
      <p className="text-sm text-muted-foreground max-w-sm mb-4">
        No data matches the selected filters.
        Try adjusting or resetting your filters.
      </p>
      {onReset && (
        <Button onClick={onReset} variant="outline">
          Reset Filters
        </Button>
      )}
    </div>
  );
}
