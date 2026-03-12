import { useState } from 'react';
import { Upload } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { FilterBar } from '@/components/filters/FilterBar';
import { KPICards } from '@/components/dashboard/KPICard';
import { StatusChart } from '@/components/charts/StatusChart';
import { CategoryChart } from '@/components/charts/CategoryChart';
import { LocationChart } from '@/components/charts/LocationChart';
import { TrendChart } from '@/components/charts/TrendChart';
import { CaseTable } from '@/components/table/CaseTable';
import { CaseDetailDrawer } from '@/components/detail/CaseDetailDrawer';
import { UploadModal } from '@/components/admin/UploadModal';

export function Overview() {
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Flight Report Overview</h1>
          <p className="text-muted-foreground">
            Summary of flight operations safety reports
          </p>
        </div>
        <Button onClick={() => setIsUploadModalOpen(true)}>
          <Upload className="mr-2 h-4 w-4" />
          Upload Report
        </Button>
      </div>

      <FilterBar />

      <KPICards />

      <div className="grid gap-6 md:grid-cols-2">
        <StatusChart />
        <CategoryChart />
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <LocationChart />
        <TrendChart />
      </div>

      <CaseTable />

      <CaseDetailDrawer />

      <UploadModal
        open={isUploadModalOpen}
        onOpenChange={setIsUploadModalOpen}
      />
    </div>
  );
}
