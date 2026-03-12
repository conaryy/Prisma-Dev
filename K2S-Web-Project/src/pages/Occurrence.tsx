import { FilterBar } from '@/components/filters/FilterBar';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { CaseTable } from '@/components/table/CaseTable';
import { CaseDetailDrawer } from '@/components/detail/CaseDetailDrawer';
import { useDashboard } from '@/contexts/DashboardContext';
import { AlertTriangle, TrendingDown } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

export function Occurrence() {
  const { filteredCases } = useDashboard();

  const occurrences = filteredCases.filter((c) => c.type === 'Occurrence');
  const incidents = occurrences.filter((c) => c.category === 'Incident');
  const nearMisses = occurrences.filter((c) => c.category === 'Near Miss');
  const criticalCases = occurrences.filter((c) => c.severity === 'Critical');

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Flight Occurrence Analysis</h1>
        <p className="text-muted-foreground">
          Analysis of operational events and near misses
        </p>
      </div>

      <FilterBar />

      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total Occurrences
            </CardTitle>
            <AlertTriangle className="h-5 w-5 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{occurrences.length}</div>
            <div className="mt-2 flex items-center gap-1 text-xs">
              <TrendingDown className="h-3 w-3 text-red-500" />
              <span className="text-red-500">-12.5%</span>
              <span className="text-muted-foreground ml-1">vs last month</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Incident
            </CardTitle>
            <AlertTriangle className="h-5 w-5 text-red-500" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{incidents.length}</div>
            <p className="text-xs text-muted-foreground mt-2">
              Operational incidents
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Near Miss
            </CardTitle>
            <AlertTriangle className="h-5 w-5 text-sky-500" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{nearMisses.length}</div>
            <p className="text-xs text-muted-foreground mt-2">
              Near miss events
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Critical Occurrences
            </CardTitle>
            <AlertTriangle className="h-5 w-5 text-red-600" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{criticalCases.length}</div>
            <p className="text-xs text-muted-foreground mt-2">
              High severity
            </p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Severity Distribution</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {['Critical', 'High', 'Medium', 'Low'].map((severity) => {
              const count = occurrences.filter((c) => c.severity === severity).length;
              const percentage = occurrences.length > 0
                ? Math.round((count / occurrences.length) * 100)
                : 0;

              return (
                <div key={severity} className="flex items-center gap-4">
                  <div className="w-24">
                    <Badge
                      className={
                        severity === 'Critical'
                          ? 'bg-red-100 text-red-800'
                          : severity === 'High'
                          ? 'bg-blue-100 text-blue-800'
                          : severity === 'Medium'
                          ? 'bg-sky-100 text-sky-800'
                          : 'bg-slate-100 text-slate-800'
                      }
                    >
                      {severity}
                    </Badge>
                  </div>
                  <div className="flex-1">
                    <div className="h-4 rounded-full bg-muted overflow-hidden">
                      <div
                        className={`h-full ${
                          severity === 'Critical'
                            ? 'bg-red-500'
                            : severity === 'High'
                            ? 'bg-blue-500'
                            : severity === 'Medium'
                            ? 'bg-sky-500'
                            : 'bg-slate-400'
                        }`}
                        style={{ width: `${percentage}%` }}
                      />
                    </div>
                  </div>
                  <div className="w-20 text-right">
                    <span className="text-sm font-medium">{count}</span>
                    <span className="text-xs text-muted-foreground ml-1">
                      ({percentage}%)
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      <CaseTable />

      <CaseDetailDrawer />
    </div>
  );
}
