import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useDashboard } from '@/contexts/DashboardContext';
import { CaseStatus } from '@/types/hse';

const STATUS_COLORS = {
  Open: '#0ea5e9',
  'In Progress': '#38bdf8',
  Closed: '#1d4ed8',
  Overdue: '#e11d2e',
};

export function StatusChart() {
  const { filteredCases, setDrillDownFilter } = useDashboard();

  const data = [
    { name: 'Open', value: filteredCases.filter((c) => c.status === 'Open').length },
    { name: 'In Progress', value: filteredCases.filter((c) => c.status === 'In Progress').length },
    { name: 'Closed', value: filteredCases.filter((c) => c.status === 'Closed').length },
    { name: 'Overdue', value: filteredCases.filter((c) => c.status === 'Overdue').length },
  ].filter((item) => item.value > 0);

  const handleClick = (entry: { name?: string } | undefined) => {
    if (!entry?.name) return;
    setDrillDownFilter({ statuses: [entry.name as CaseStatus] });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Status Distribution</CardTitle>
      </CardHeader>
      <CardContent>
        {data.length === 0 ? (
          <div className="flex h-[300px] items-center justify-center text-sm text-muted-foreground">
            No data to display
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={data}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={(entry) => `${entry.name}: ${entry.value}`}
                outerRadius={100}
                fill="#8884d8"
                dataKey="value"
                onClick={handleClick}
                className="cursor-pointer"
              >
                {data.map((entry, index) => (
                  <Cell
                    key={`cell-${index}`}
                    fill={STATUS_COLORS[entry.name as CaseStatus]}
                  />
                ))}
              </Pie>
              <Tooltip />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
}
