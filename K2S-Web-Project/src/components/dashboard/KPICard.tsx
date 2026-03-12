import { ReactNode } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ArrowUp, ArrowDown, TrendingUp } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useDashboard } from '@/contexts/DashboardContext';
import { CaseStatus } from '@/types/hse';

interface KPICardProps {
  title: string;
  value: number | string;
  trend?: number;
  icon: ReactNode;
  onClick?: () => void;
  className?: string;
}

export function KPICard({
  title,
  value,
  trend,
  icon,
  onClick,
  className,
}: KPICardProps) {
  const isPositiveTrend = trend !== undefined && trend > 0;
  const isNegativeTrend = trend !== undefined && trend < 0;

  return (
    <Card
      className={cn(
        'transition-all hover:shadow-lg',
        onClick && 'cursor-pointer hover:border-primary',
        className
      )}
      onClick={onClick}
    >
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">
          {title}
        </CardTitle>
        <div className="text-muted-foreground">{icon}</div>
      </CardHeader>
      <CardContent>
        <div className="text-3xl font-bold">{value}</div>
        {trend !== undefined && (
          <div className="mt-2 flex items-center gap-1 text-xs">
            {isPositiveTrend && (
              <>
                <ArrowUp className="h-3 w-3 text-blue-500" />
                <span className="text-blue-500">+{Math.abs(trend)}%</span>
              </>
            )}
            {isNegativeTrend && (
              <>
                <ArrowDown className="h-3 w-3 text-red-500" />
                <span className="text-red-500">{trend}%</span>
              </>
            )}
            {trend === 0 && (
              <>
                <TrendingUp className="h-3 w-3 text-muted-foreground" />
                <span className="text-muted-foreground">0%</span>
              </>
            )}
            <span className="text-muted-foreground ml-1">vs last month</span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export function KPICards() {
  const { filteredCases, setDrillDownFilter } = useDashboard();

  const totalFindings = filteredCases.filter(
    (c) => c.type === 'Finding'
  ).length;
  const openCases = filteredCases.filter((c) => c.status === 'Open').length;
  const overdueCases = filteredCases.filter(
    (c) => c.status === 'Overdue'
  ).length;
  const totalOccurrences = filteredCases.filter(
    (c) => c.type === 'Occurrence'
  ).length;
  const goAroundTotal = filteredCases.filter(
    (c) => c.type === 'Go Around'
  ).length;

  const handleKPIClick = (filter: { statuses?: CaseStatus[] }) => {
    setDrillDownFilter(filter);
  };

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
      <KPICard
        title="Total Findings"
        value={totalFindings}
        trend={12.5}
        icon={
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="2"
            className="h-5 w-5"
          >
            <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
            <circle cx="9" cy="7" r="4" />
            <path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" />
          </svg>
        }
      />

      <KPICard
        title="Open"
        value={openCases}
        trend={-8.3}
        icon={
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="2"
            className="h-5 w-5 text-blue-500"
          >
            <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
          </svg>
        }
        onClick={() => handleKPIClick({ statuses: ['Open'] })}
        className="border-blue-200 dark:border-blue-900"
      />

      <KPICard
        title="Overdue"
        value={overdueCases}
        trend={15.2}
        icon={
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="2"
            className="h-5 w-5 text-red-500"
          >
            <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
            <line x1="12" y1="9" x2="12" y2="13" />
            <line x1="12" y1="17" x2="12.01" y2="17" />
          </svg>
        }
        onClick={() => handleKPIClick({ statuses: ['Overdue'] })}
        className="border-red-200 dark:border-red-900"
      />

      <KPICard
        title="Total Occurrences"
        value={totalOccurrences}
        trend={-5.4}
        icon={
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="2"
            className="h-5 w-5 text-sky-600"
          >
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="8" x2="12" y2="12" />
            <line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
        }
        className="border-sky-200 dark:border-sky-900"
      />

      <KPICard
        title="Go-Around"
        value={goAroundTotal}
        trend={8.7}
        icon={
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="2"
            className="h-5 w-5 text-blue-500"
          >
            <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
          </svg>
        }
        className="border-blue-200 dark:border-blue-900"
      />
    </div>
  );
}
