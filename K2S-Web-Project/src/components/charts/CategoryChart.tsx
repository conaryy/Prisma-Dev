import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useDashboard } from '@/contexts/DashboardContext';
import { CaseCategory } from '@/types/hse';

export function CategoryChart() {
  const { filteredCases, setDrillDownFilter } = useDashboard();

  const categories: CaseCategory[] = [
    'Procedure',
    'Personnel',
    'Facility',
    'Incident',
    'Near Miss',
    'Runway Incursion',
    'Loss of Separation',
    'Bird Strike',
    'Weather',
    'Communication',
  ];

  const data = categories
    .map((category) => ({
      name: category,
      value: filteredCases.filter((c) => c.category === category).length,
    }))
    .filter((item) => item.value > 0)
    .sort((a, b) => b.value - a.value)
    .slice(0, 6);

  const handleBarClick = (data: { name?: string } | undefined) => {
    if (data && data.name) {
      setDrillDownFilter({ categories: [data.name as CaseCategory] });
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Top Report Categories</CardTitle>
      </CardHeader>
      <CardContent>
        {data.length === 0 ? (
          <div className="flex h-[300px] items-center justify-center text-sm text-muted-foreground">
            No data to display
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={data} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis type="number" />
              <YAxis dataKey="name" type="category" width={120} />
              <Tooltip />
              <Bar
                dataKey="value"
                fill="#0b5fa5"
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
