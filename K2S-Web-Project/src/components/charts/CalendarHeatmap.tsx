import { useMemo } from 'react';
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from '@/components/ui/tooltip';

interface CalendarHeatmapProps {
    userId: string;
    year?: number;
    data?: { date: Date }[]; // Real data
}

type DayData = {
    date: string;
    count: number;
    intensity: number; // 0-4
};

/* simple seeded random for deterministic data (fallback) */
function seededRandom(seed: number) {
    const x = Math.sin(seed) * 10000;
    return x - Math.floor(x);
}

function generateHeatmapData(userId: string, year: number, realData?: { date: Date }[]): DayData[] {
    const data: DayData[] = [];
    const startDate = new Date(year, 0, 1);
    const endDate = new Date(year, 11, 31);

    // If real data is provided, index it by date string YYYY-MM-DD
    const realCounts: Record<string, number> = {};
    if (realData) {
        realData.forEach(item => {
            const iso = item.date.toISOString().split('T')[0];
            realCounts[iso] = (realCounts[iso] || 0) + 1;
        });
    }

    // Create a seed based on userId and year (for fallback)
    let seed = 0;
    for (let i = 0; i < userId.length; i++) seed = (seed * 31 + userId.charCodeAt(i)) | 0;
    seed += year;

    for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
        const isoDate = d.toISOString().split('T')[0];

        let count = 0;

        if (realData) {
            count = realCounts[isoDate] || 0;
        } else {
            // Fallback to mock logic
            const rand = seededRandom(seed++);
            // 60% chance of 0 activity, 40% chance of 1-10
            if (rand > 0.6) {
                count = Math.floor((rand - 0.6) * 25); // 0-10 range
            }
        }

        // Intensity mapping: 0=0, 1-2=1, 3-4=2, 5-6=3, 7+=4
        let intensity = 0;
        if (count > 0) intensity = 1;
        if (count > 2) intensity = 2;
        if (count > 4) intensity = 3;
        if (count > 7) intensity = 4;

        data.push({ date: isoDate, count, intensity });
    }

    return data;
}

export function CalendarHeatmap({ userId, year = new Date().getFullYear(), data: realData }: CalendarHeatmapProps) {
    const data = useMemo(() => generateHeatmapData(userId, year, realData), [userId, year, realData]);

    const months = [
        'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'
    ];

    /* 
      GitHub style grid: 
      - 7 rows (Sun-Sat)
      - ~53 columns (Weeks)
      We need to map dates to grid positions.
    */
    const startDate = new Date(year, 0, 1);
    const startDay = startDate.getDay(); // 0=Sun, 1=Mon...

    // Helper to get color class based on intensity
    const getColor = (intensity: number) => {
        switch (intensity) {
            case 1: return 'bg-blue-200';
            case 2: return 'bg-blue-400';
            case 3: return 'bg-blue-600';
            case 4: return 'bg-blue-800';
            default: return 'bg-slate-100';
        }
    };

    return (
        <div className="w-full overflow-x-auto">
            <div className="min-w-[800px] p-4">
                {/* Month labels */}
                <div className="flex mb-2 text-xs text-slate-400">
                    {/* Approximate month positioning - simplified for responsiveness */}
                    {months.map(m => (
                        <div key={m} className="flex-1">{m}</div>
                    ))}
                </div>

                <div className="flex gap-1">
                    {/* Day labels (Mon/Wed/Fri) */}
                    <div className="flex flex-col gap-1 pr-2 text-[10px] text-slate-400 pt-5">
                        <div className="h-2.5">Sen</div>
                        <div className="h-2.5"> </div>
                        <div className="h-2.5">Rab</div>
                        <div className="h-2.5"> </div>
                        <div className="h-2.5">Jum</div>
                    </div>

                    {/* The Grid */}
                    <div className="grid grid-rows-7 grid-flow-col gap-1 flex-1">
                        {/* Blank cells for days before Jan 1st */}
                        {Array.from({ length: startDay }).map((_, i) => (
                            <div key={`blank-${i}`} className="w-2.5 h-2.5" />
                        ))}

                        <TooltipProvider delayDuration={0}>
                            {data.map((d) => (
                                <Tooltip key={d.date}>
                                    <TooltipTrigger asChild>
                                        <div
                                            className={`w-2.5 h-2.5 rounded-[1px] hover:ring-1 hover:ring-slate-400 transition-colors ${getColor(d.intensity)}`}
                                        />
                                    </TooltipTrigger>
                                    <TooltipContent className="text-xs">
                                        <b>{d.date}</b>: {d.count} aktivitas
                                    </TooltipContent>
                                </Tooltip>
                            ))}
                        </TooltipProvider>
                    </div>
                </div>

                {/* Legend */}
                <div className="flex items-center gap-1 text-[10px] text-slate-400 mt-3 justify-end">
                    <span>Less</span>
                    <div className="w-2.5 h-2.5 bg-slate-100 rounded-[1px]" />
                    <div className="w-2.5 h-2.5 bg-blue-200 rounded-[1px]" />
                    <div className="w-2.5 h-2.5 bg-blue-400 rounded-[1px]" />
                    <div className="w-2.5 h-2.5 bg-blue-600 rounded-[1px]" />
                    <div className="w-2.5 h-2.5 bg-blue-800 rounded-[1px]" />
                    <span>More</span>
                </div>
            </div>
        </div>
    );
}
