import { Search, X, Filter } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { useDashboard } from '@/contexts/DashboardContext';
import { branches, locations, pics } from '@/data/mockData';
import { CaseCategory, CaseStatus } from '@/types/hse';

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

const statuses: CaseStatus[] = ['Open', 'In Progress', 'Closed', 'Overdue'];

export function FilterBar() {
  const { filters, setFilters, isFilterActive, resetFilters, drillDownFilter } = useDashboard();

  const handleBranchToggle = (branch: string) => {
    const newBranches = filters.branches.includes(branch)
      ? filters.branches.filter((b) => b !== branch)
      : [...filters.branches, branch];
    setFilters({ ...filters, branches: newBranches });
  };

  const handleLocationToggle = (location: string) => {
    const newLocations = filters.locations.includes(location)
      ? filters.locations.filter((l) => l !== location)
      : [...filters.locations, location];
    setFilters({ ...filters, locations: newLocations });
  };

  const handleCategoryToggle = (category: CaseCategory) => {
    const newCategories = filters.categories.includes(category)
      ? filters.categories.filter((c) => c !== category)
      : [...filters.categories, category];
    setFilters({ ...filters, categories: newCategories });
  };

  const handleStatusToggle = (status: CaseStatus) => {
    const newStatuses = filters.statuses.includes(status)
      ? filters.statuses.filter((s) => s !== status)
      : [...filters.statuses, status];
    setFilters({ ...filters, statuses: newStatuses });
  };

  const handlePICToggle = (pic: string) => {
    const newPICs = filters.pics.includes(pic)
      ? filters.pics.filter((p) => p !== pic)
      : [...filters.pics, pic];
    setFilters({ ...filters, pics: newPICs });
  };

  const activeFilterCount =
    filters.branches.length +
    filters.locations.length +
    filters.categories.length +
    filters.statuses.length +
    filters.pics.length +
    (filters.search ? 1 : 0) +
    (drillDownFilter ? Object.keys(drillDownFilter).length : 0);

  return (
    <div className="space-y-3 rounded-lg border bg-card p-4">
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-0 sm:min-w-[200px]">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search report number, title, assignee..."
            value={filters.search}
            onChange={(e) => setFilters({ ...filters, search: e.target.value })}
            className="pl-9"
          />
        </div>

        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" className="gap-2">
              <Filter className="h-4 w-4" />
              Unit
              {filters.branches.length > 0 && (
                <Badge variant="secondary" className="ml-1">
                  {filters.branches.length}
                </Badge>
              )}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-64">
            <div className="space-y-2">
              <h4 className="font-medium text-sm">Select unit</h4>
              {branches.map((branch) => (
                <div key={branch} className="flex items-center space-x-2">
                  <Checkbox
                    id={`branch-${branch}`}
                    checked={filters.branches.includes(branch)}
                    onCheckedChange={() => handleBranchToggle(branch)}
                  />
                  <Label
                    htmlFor={`branch-${branch}`}
                    className="text-sm font-normal cursor-pointer"
                  >
                    {branch}
                  </Label>
                </div>
              ))}
            </div>
          </PopoverContent>
        </Popover>

        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" className="gap-2">
              <Filter className="h-4 w-4" />
              Area/Sector
              {filters.locations.length > 0 && (
                <Badge variant="secondary" className="ml-1">
                  {filters.locations.length}
                </Badge>
              )}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-64">
            <div className="space-y-2">
              <h4 className="font-medium text-sm">Select area/sector</h4>
              {locations.map((location) => (
                <div key={location} className="flex items-center space-x-2">
                  <Checkbox
                    id={`location-${location}`}
                    checked={filters.locations.includes(location)}
                    onCheckedChange={() => handleLocationToggle(location)}
                  />
                  <Label
                    htmlFor={`location-${location}`}
                    className="text-sm font-normal cursor-pointer"
                  >
                    {location}
                  </Label>
                </div>
              ))}
            </div>
          </PopoverContent>
        </Popover>

        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" className="gap-2">
              <Filter className="h-4 w-4" />
              Category
              {filters.categories.length > 0 && (
                <Badge variant="secondary" className="ml-1">
                  {filters.categories.length}
                </Badge>
              )}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-64">
            <div className="space-y-2">
              <h4 className="font-medium text-sm">Select category</h4>
              {categories.map((category) => (
                <div key={category} className="flex items-center space-x-2">
                  <Checkbox
                    id={`category-${category}`}
                    checked={filters.categories.includes(category)}
                    onCheckedChange={() => handleCategoryToggle(category)}
                  />
                  <Label
                    htmlFor={`category-${category}`}
                    className="text-sm font-normal cursor-pointer"
                  >
                    {category}
                  </Label>
                </div>
              ))}
            </div>
          </PopoverContent>
        </Popover>

        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" className="gap-2">
              <Filter className="h-4 w-4" />
              Status
              {filters.statuses.length > 0 && (
                <Badge variant="secondary" className="ml-1">
                  {filters.statuses.length}
                </Badge>
              )}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-64">
            <div className="space-y-2">
              <h4 className="font-medium text-sm">Select status</h4>
              {statuses.map((status) => (
                <div key={status} className="flex items-center space-x-2">
                  <Checkbox
                    id={`status-${status}`}
                    checked={filters.statuses.includes(status)}
                    onCheckedChange={() => handleStatusToggle(status)}
                  />
                  <Label
                    htmlFor={`status-${status}`}
                    className="text-sm font-normal cursor-pointer"
                  >
                    {status}
                  </Label>
                </div>
              ))}
            </div>
          </PopoverContent>
        </Popover>

        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" className="gap-2">
              <Filter className="h-4 w-4" />
              Assignee
              {filters.pics.length > 0 && (
                <Badge variant="secondary" className="ml-1">
                  {filters.pics.length}
                </Badge>
              )}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-64">
            <div className="space-y-2">
              <h4 className="font-medium text-sm">Select assignee</h4>
              {pics.map((pic) => (
                <div key={pic} className="flex items-center space-x-2">
                  <Checkbox
                    id={`pic-${pic}`}
                    checked={filters.pics.includes(pic)}
                    onCheckedChange={() => handlePICToggle(pic)}
                  />
                  <Label
                    htmlFor={`pic-${pic}`}
                    className="text-sm font-normal cursor-pointer"
                  >
                    {pic}
                  </Label>
                </div>
              ))}
            </div>
          </PopoverContent>
        </Popover>

        {isFilterActive && (
          <Button variant="ghost" size="sm" onClick={resetFilters} className="gap-2">
            <X className="h-4 w-4" />
            Reset
          </Button>
        )}
      </div>

      {activeFilterCount > 0 && (
        <div className="flex flex-wrap gap-2">
          {filters.branches.map((branch) => (
            <Badge key={branch} variant="secondary" className="gap-1">
              {branch}
              <X
                className="h-3 w-3 cursor-pointer"
                onClick={() => handleBranchToggle(branch)}
              />
            </Badge>
          ))}
          {filters.locations.map((location) => (
            <Badge key={location} variant="secondary" className="gap-1">
              {location}
              <X
                className="h-3 w-3 cursor-pointer"
                onClick={() => handleLocationToggle(location)}
              />
            </Badge>
          ))}
          {filters.categories.map((category) => (
            <Badge key={category} variant="secondary" className="gap-1">
              {category}
              <X
                className="h-3 w-3 cursor-pointer"
                onClick={() => handleCategoryToggle(category)}
              />
            </Badge>
          ))}
          {filters.statuses.map((status) => (
            <Badge key={status} variant="secondary" className="gap-1">
              {status}
              <X
                className="h-3 w-3 cursor-pointer"
                onClick={() => handleStatusToggle(status)}
              />
            </Badge>
          ))}
          {filters.pics.map((pic) => (
            <Badge key={pic} variant="secondary" className="gap-1">
              {pic}
              <X
                className="h-3 w-3 cursor-pointer"
                onClick={() => handlePICToggle(pic)}
              />
            </Badge>
          ))}
          {drillDownFilter && (
            <Badge variant="default" className="gap-1">
              Filter from chart
            </Badge>
          )}
        </div>
      )}
    </div>
  );
}
