import { useState } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { useDashboard } from '@/contexts/DashboardContext';
import { format, subDays, subWeeks, subMonths, eachDayOfInterval, eachWeekOfInterval, eachMonthOfInterval } from 'date-fns';
import { enUS } from 'date-fns/locale';

type PeriodType = 'daily' | 'weekly' | 'monthly';

export function TrendChart() {
  const { filteredCases } = useDashboard();
  const [period, setPeriod] = useState<PeriodType>('daily');

  const generateTrendData = () => {
    const now = new Date();
    let intervals: Date[] = [];
    let formatString = 'dd MMM';

    switch (period) {
      case 'daily':
        intervals = eachDayOfInterval({
          start: subDays(now, 13),
          end: now,
        });
        formatString = 'dd MMM';
        break;
      case 'weekly':
        intervals = eachWeekOfInterval({
          start: subWeeks(now, 11),
          end: now,
        });
        formatString = 'dd MMM';
        break;
      case 'monthly':
        intervals = eachMonthOfInterval({
          start: subMonths(now, 11),
          end: now,
        });
        formatString = 'MMM yyyy';
        break;
    }

    return intervals.map((date) => {
      const casesInPeriod = filteredCases.filter((c) => {
        const caseDate = new Date(c.reportedDate);
        if (period === 'daily') {
          return format(caseDate, 'yyyy-MM-dd') === format(date, 'yyyy-MM-dd');
        } else if (period === 'weekly') {
          const weekStart = date;
          const weekEnd = subDays(new Date(date), -7);
          return caseDate >= weekStart && caseDate < weekEnd;
        } else {
          return (
            caseDate.getMonth() === date.getMonth() &&
            caseDate.getFullYear() === date.getFullYear()
          );
        }
      });

      return {
        date: format(date, formatString, { locale: enUS }),
        total: casesInPeriod.length,
        findings: casesInPeriod.filter((c) => c.type === 'Finding').length,
        occurrences: casesInPeriod.filter((c) => c.type === 'Occurrence').length,
      };
    });
  };

  const data = generateTrendData();

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>Report Trends</CardTitle>
          <ToggleGroup
            type="single"
            value={period}
            onValueChange={(value) => value && setPeriod(value as PeriodType)}
            size="sm"
          >
            <ToggleGroupItem value="daily">Daily</ToggleGroupItem>
            <ToggleGroupItem value="weekly">Weekly</ToggleGroupItem>
            <ToggleGroupItem value="monthly">Monthly</ToggleGroupItem>
          </ToggleGroup>
        </div>
      </CardHeader>
      <CardContent>
        {data.length === 0 ? (
          <div className="flex h-[300px] items-center justify-center text-sm text-muted-foreground">
            No data to display
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={data}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" angle={-45} textAnchor="end" height={80} />
              <YAxis />
              <Tooltip />
              <Legend />
              <Line type="monotone" dataKey="total" stroke="#0b5fa5" name="Total" strokeWidth={2} />
              <Line type="monotone" dataKey="findings" stroke="#e11d2e" name="Findings" strokeWidth={2} />
              <Line type="monotone" dataKey="occurrences" stroke="#38bdf8" name="Occurrences" strokeWidth={2} />
            </LineChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
}
