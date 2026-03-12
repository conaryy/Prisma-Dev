import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useDashboard } from '@/contexts/DashboardContext';

export function LocationChart() {
  const { filteredCases, setDrillDownFilter } = useDashboard();

  const locationCounts = filteredCases.reduce((acc, caseItem) => {
    acc[caseItem.location] = (acc[caseItem.location] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const data = Object.entries(locationCounts)
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 6);

  const handleBarClick = (data: { name?: string } | undefined) => {
    if (data && data.name) {
      setDrillDownFilter({ locations: [data.name] });
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Top Areas/Sectors</CardTitle>
      </CardHeader>
      <CardContent>
        {data.length === 0 ? (
          <div className="flex h-[300px] items-center justify-center text-sm text-muted-foreground">
            No data to display
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={data}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" angle={-45} textAnchor="end" height={80} />
              <YAxis />
              <Tooltip />
              <Bar
                dataKey="value"
                fill="#0ea5e9"
                onClick={handleBarClick}
                className="cursor-pointer"
              />
            </BarChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
}
