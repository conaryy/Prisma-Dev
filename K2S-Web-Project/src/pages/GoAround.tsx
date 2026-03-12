import { FilterBar } from '@/components/filters/FilterBar';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { CaseTable } from '@/components/table/CaseTable';
import { CaseDetailDrawer } from '@/components/detail/CaseDetailDrawer';
import { useDashboard } from '@/contexts/DashboardContext';
import { ClipboardCheck, CheckCircle2, Calendar } from 'lucide-react';
import { format, startOfMonth, endOfMonth } from 'date-fns';
import { enUS } from 'date-fns/locale';

export function GoAround() {
  const { filteredCases } = useDashboard();

  const goArounds = filteredCases.filter((c) => c.type === 'Go Around');
  const completedGoArounds = goArounds.filter((c) => c.status === 'Closed');
  const thisMonthGoArounds = goArounds.filter((c) => {
    const caseDate = new Date(c.reportedDate);
    const now = new Date();
    return (
      caseDate >= startOfMonth(now) &&
      caseDate <= endOfMonth(now)
    );
  });

  const completionRate = goArounds.length > 0
    ? Math.round((completedGoArounds.length / goArounds.length) * 100)
    : 0;

  const locationStats = goArounds.reduce((acc, c) => {
    acc[c.location] = (acc[c.location] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const topLocations = Object.entries(locationStats)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 5);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Go-Around Analysis</h1>
        <p className="text-muted-foreground">
          Analysis of go-around events and contributing factors
        </p>
      </div>

      <FilterBar />

      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total Go-Arounds
            </CardTitle>
            <ClipboardCheck className="h-5 w-5 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{goArounds.length}</div>
            <p className="text-xs text-muted-foreground mt-2">
              Total go-around events
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Resolved
            </CardTitle>
            <CheckCircle2 className="h-5 w-5 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{completedGoArounds.length}</div>
            <p className="text-xs text-muted-foreground mt-2">
              Reports closed
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              This Month
            </CardTitle>
            <Calendar className="h-5 w-5 text-sky-500" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{thisMonthGoArounds.length}</div>
            <p className="text-xs text-muted-foreground mt-2">
              {format(new Date(), 'MMMM yyyy', { locale: enUS })}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Completion Rate
            </CardTitle>
            <CheckCircle2 className="h-5 w-5 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{completionRate}%</div>
            <p className="text-xs text-muted-foreground mt-2">
              Report completion rate
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Top 5 Go-Around Locations</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {topLocations.map(([location, count]) => {
                const percentage = goArounds.length > 0
                  ? Math.round((count / goArounds.length) * 100)
                  : 0;

                return (
                  <div key={location} className="space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span className="font-medium">{location}</span>
                      <span className="text-muted-foreground">{count} events</span>
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
            <CardTitle>Investigation Status</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {[
                { status: 'Closed', label: 'Closed', color: 'bg-blue-600' },
                { status: 'In Progress', label: 'In Progress', color: 'bg-sky-500' },
                { status: 'Open', label: 'Open', color: 'bg-blue-300' },
              ].map(({ status, label, color }) => {
                const count = goArounds.filter((c) => c.status === status).length;
                const percentage = goArounds.length > 0
                  ? Math.round((count / goArounds.length) * 100)
                  : 0;

                return (
                  <div key={status} className="space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span className="font-medium">{label}</span>
                      <span className="text-muted-foreground">
                        {count} ({percentage}%)
                      </span>
                    </div>
                    <div className="h-2 rounded-full bg-muted overflow-hidden">
                      <div
                        className={`h-full ${color}`}
                        style={{ width: `${percentage}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      </div>

      <CaseTable />

      <CaseDetailDrawer />
    </div>
  );
}
