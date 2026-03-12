import { FilterBar } from '@/components/filters/FilterBar';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { CaseTable } from '@/components/table/CaseTable';
import { CaseDetailDrawer } from '@/components/detail/CaseDetailDrawer';
import { useDashboard } from '@/contexts/DashboardContext';
import { FileText, AlertCircle, CheckCircle, Clock } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

export function Compliance() {
  const { filteredCases } = useDashboard();

  const findings = filteredCases.filter((c) => c.type === 'Finding');
  const openFindings = findings.filter((c) => c.status === 'Open');
  const overdueFindings = findings.filter((c) => c.status === 'Overdue');
  const closedFindings = findings.filter((c) => c.status === 'Closed');

  const complianceRate = findings.length > 0
    ? Math.round((closedFindings.length / findings.length) * 100)
    : 0;

  const categoryBreakdown = findings.reduce((acc, c) => {
    acc[c.category] = (acc[c.category] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const branchStats = findings.reduce((acc, c) => {
    if (!acc[c.branch]) {
      acc[c.branch] = {
        total: 0,
        open: 0,
        overdue: 0,
        closed: 0,
      };
    }
    acc[c.branch].total += 1;
    if (c.status === 'Open') acc[c.branch].open += 1;
    if (c.status === 'Overdue') acc[c.branch].overdue += 1;
    if (c.status === 'Closed') acc[c.branch].closed += 1;
    return acc;
  }, {} as Record<string, { total: number; open: number; overdue: number; closed: number }>);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">
          Compliance & Findings
        </h1>
        <p className="text-muted-foreground">
          Monitoring operational compliance findings
        </p>
      </div>

      <FilterBar />

      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total Findings
            </CardTitle>
            <FileText className="h-5 w-5 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{findings.length}</div>
            <p className="text-xs text-muted-foreground mt-2">
              Total compliance findings
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Open
            </CardTitle>
            <AlertCircle className="h-5 w-5 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{openFindings.length}</div>
            <p className="text-xs text-muted-foreground mt-2">
              Open findings
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Overdue
            </CardTitle>
            <Clock className="h-5 w-5 text-red-500" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{overdueFindings.length}</div>
            <p className="text-xs text-muted-foreground mt-2">
              Past due items
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Compliance Rate
            </CardTitle>
            <CheckCircle className="h-5 w-5 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{complianceRate}%</div>
            <p className="text-xs text-muted-foreground mt-2">
              Compliance rate
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Findings by Category</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {Object.entries(categoryBreakdown)
                .sort(([, a], [, b]) => b - a)
                .map(([category, count]) => {
                  const percentage = findings.length > 0
                    ? Math.round((count / findings.length) * 100)
                    : 0;

                  return (
                    <div key={category} className="space-y-2">
                      <div className="flex items-center justify-between text-sm">
                        <Badge variant="outline">{category}</Badge>
                        <span className="text-muted-foreground">
                          {count} ({percentage}%)
                        </span>
                      </div>
                      <div className="h-2 rounded-full bg-muted overflow-hidden">
                        <div
                          className="h-full bg-blue-500"
                          style={{ width: `${percentage}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Status by Unit</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {Object.entries(branchStats).map(([branch, stats]) => (
                <div key={branch} className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-sm">{branch}</span>
                    <span className="text-xs text-muted-foreground">
                      {stats.total} findings
                    </span>
                  </div>
                  <div className="flex gap-1 h-2">
                    <div
                      className="bg-blue-600 rounded-l"
                      style={{
                        width: `${(stats.closed / stats.total) * 100}%`,
                      }}
                      title={`Closed: ${stats.closed}`}
                    />
                    <div
                      className="bg-sky-400"
                      style={{
                        width: `${(stats.open / stats.total) * 100}%`,
                      }}
                      title={`Open: ${stats.open}`}
                    />
                    <div
                      className="bg-red-500 rounded-r"
                      style={{
                        width: `${(stats.overdue / stats.total) * 100}%`,
                      }}
                      title={`Overdue: ${stats.overdue}`}
                    />
                  </div>
                  <div className="flex gap-4 text-xs">
                    <span className="flex items-center gap-1">
                      <div className="h-2 w-2 rounded-full bg-blue-600" />
                      Closed: {stats.closed}
                    </span>
                    <span className="flex items-center gap-1">
                      <div className="h-2 w-2 rounded-full bg-sky-400" />
                      Open: {stats.open}
                    </span>
                    <span className="flex items-center gap-1">
                      <div className="h-2 w-2 rounded-full bg-red-500" />
                      Overdue: {stats.overdue}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      <CaseTable />

      <CaseDetailDrawer />
    </div>
  );
}
