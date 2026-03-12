import { format } from 'date-fns';
import { enUS } from 'date-fns/locale';
import { X, FileText, Paperclip, History, Download } from 'lucide-react';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useDashboard } from '@/contexts/DashboardContext';
import { CaseStatus, CaseSeverity, CaseType } from '@/types/hse';

const getStatusColor = (status: CaseStatus) => {
  switch (status) {
    case 'Open':
      return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200';
    case 'In Progress':
      return 'bg-sky-100 text-sky-800 dark:bg-sky-900 dark:text-sky-200';
    case 'Closed':
      return 'bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-200';
    case 'Overdue':
      return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200';
    default:
      return '';
  }
};

const getSeverityColor = (severity: CaseSeverity) => {
  switch (severity) {
    case 'Low':
      return 'bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-200';
    case 'Medium':
      return 'bg-sky-100 text-sky-800 dark:bg-sky-900 dark:text-sky-200';
    case 'High':
      return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200';
    case 'Critical':
      return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200';
    default:
      return '';
  }
};

const getTypeLabel = (type: CaseType) => {
  switch (type) {
    case 'Finding':
      return 'Finding';
    case 'Occurrence':
      return 'Occurrence';
    case 'Go Around':
      return 'Go-Around';
    default:
      return type;
  }
};

export function CaseDetailDrawer() {
  const { selectedCase, isDetailOpen, setIsDetailOpen } = useDashboard();

  if (!selectedCase) return null;

  return (
    <Sheet open={isDetailOpen} onOpenChange={setIsDetailOpen}>
      <SheetContent className="w-full sm:max-w-2xl overflow-y-auto">
        <SheetHeader>
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <SheetTitle className="text-xl">{selectedCase.caseNumber}</SheetTitle>
              <p className="text-sm text-muted-foreground mt-1">
                {selectedCase.title}
              </p>
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setIsDetailOpen(false)}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </SheetHeader>

        <div className="mt-6">
          <Tabs defaultValue="summary">
            <TabsList className="grid w-full grid-cols-2 gap-2 sm:grid-cols-5">
              <TabsTrigger value="summary">Summary</TabsTrigger>
              <TabsTrigger value="description">Description</TabsTrigger>
              <TabsTrigger value="actions">Actions</TabsTrigger>
              <TabsTrigger value="attachments">Attachments</TabsTrigger>
              <TabsTrigger value="audit">Audit Trail</TabsTrigger>
            </TabsList>

            <ScrollArea className="h-[calc(100vh-250px)] mt-4">
              <TabsContent value="summary" className="space-y-4">
                <div className="rounded-lg border p-4">
                  <h3 className="font-semibold mb-4">General Information</h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-sm text-muted-foreground">Report Number</p>
                      <p className="font-medium">{selectedCase.caseNumber}</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Report Type</p>
                      <Badge variant="outline">{getTypeLabel(selectedCase.type)}</Badge>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Status</p>
                      <Badge className={getStatusColor(selectedCase.status)}>
                        {selectedCase.status}
                      </Badge>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Severity</p>
                      <Badge className={getSeverityColor(selectedCase.severity)}>
                        {selectedCase.severity}
                      </Badge>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Category</p>
                      <p className="font-medium">{selectedCase.category}</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Unit</p>
                      <p className="font-medium">{selectedCase.branch}</p>
                    </div>
                    <div className="col-span-2">
                      <p className="text-sm text-muted-foreground">Area/Sector</p>
                      <p className="font-medium">{selectedCase.location}</p>
                    </div>
                  </div>
                </div>

                <div className="rounded-lg border p-4">
                  <h3 className="font-semibold mb-4">Responsible Parties</h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-sm text-muted-foreground">Reported By</p>
                      <p className="font-medium">{selectedCase.reportedBy}</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Assigned To</p>
                      <p className="font-medium">{selectedCase.assignedTo}</p>
                    </div>
                  </div>
                </div>

                <div className="rounded-lg border p-4">
                  <h3 className="font-semibold mb-4">Timeline</h3>
                  <div className="space-y-3">
                    <div>
                      <p className="text-sm text-muted-foreground">Report Date</p>
                      <p className="font-medium">
                        {format(new Date(selectedCase.reportedDate), 'dd MMMM yyyy', {
                          locale: enUS,
                        })}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Due Date</p>
                      <p className="font-medium">
                        {format(new Date(selectedCase.dueDate), 'dd MMMM yyyy', {
                          locale: enUS,
                        })}
                      </p>
                    </div>
                    {selectedCase.closedDate && (
                      <div>
                        <p className="text-sm text-muted-foreground">Closed Date</p>
                        <p className="font-medium">
                          {format(new Date(selectedCase.closedDate), 'dd MMMM yyyy', {
                            locale: enUS,
                          })}
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="description" className="space-y-4">
                <div className="rounded-lg border p-4">
                  <h3 className="font-semibold mb-2 flex items-center gap-2">
                    <FileText className="h-4 w-4" />
                    Description
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    {selectedCase.description}
                  </p>
                </div>

                {selectedCase.findings && (
                  <div className="rounded-lg border p-4">
                    <h3 className="font-semibold mb-2">Findings</h3>
                    <p className="text-sm text-muted-foreground">
                      {selectedCase.findings}
                    </p>
                  </div>
                )}
              </TabsContent>

              <TabsContent value="actions" className="space-y-4">
                {selectedCase.correctiveActions && (
                  <div className="rounded-lg border p-4">
                    <h3 className="font-semibold mb-2">Corrective Actions</h3>
                    <p className="text-sm text-muted-foreground">
                      {selectedCase.correctiveActions}
                    </p>
                  </div>
                )}

                {selectedCase.preventiveActions && (
                  <div className="rounded-lg border p-4">
                    <h3 className="font-semibold mb-2">Preventive Actions</h3>
                    <p className="text-sm text-muted-foreground">
                      {selectedCase.preventiveActions}
                    </p>
                  </div>
                )}

                {!selectedCase.correctiveActions && !selectedCase.preventiveActions && (
                  <div className="flex flex-col items-center justify-center py-8 text-center">
                    <FileText className="h-12 w-12 text-muted-foreground mb-3" />
                    <p className="text-sm text-muted-foreground">
                      No follow-up actions recorded yet
                    </p>
                  </div>
                )}
              </TabsContent>

              <TabsContent value="attachments" className="space-y-4">
                {selectedCase.attachments && selectedCase.attachments.length > 0 ? (
                  <div className="space-y-2">
                    {selectedCase.attachments.map((attachment) => (
                      <div
                        key={attachment.id}
                        className="flex items-center justify-between rounded-lg border p-4"
                      >
                        <div className="flex items-center gap-3">
                          <Paperclip className="h-5 w-5 text-muted-foreground" />
                          <div>
                            <p className="font-medium text-sm">{attachment.name}</p>
                            <p className="text-xs text-muted-foreground">
                              {(attachment.size / 1024).toFixed(0)} KB - Uploaded by{' '}
                              {attachment.uploadedBy}
                            </p>
                          </div>
                        </div>
                        <Button variant="ghost" size="icon">
                          <Download className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center py-8 text-center">
                    <Paperclip className="h-12 w-12 text-muted-foreground mb-3" />
                    <p className="text-sm text-muted-foreground">
                      No attachments
                    </p>
                  </div>
                )}
              </TabsContent>

              <TabsContent value="audit" className="space-y-4">
                {selectedCase.auditTrail && selectedCase.auditTrail.length > 0 ? (
                  <div className="space-y-4">
                    {selectedCase.auditTrail.map((entry, index) => (
                      <div key={entry.id}>
                        <div className="flex gap-4">
                          <div className="flex flex-col items-center">
                            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10">
                              <History className="h-4 w-4 text-primary" />
                            </div>
                            {index < selectedCase.auditTrail!.length - 1 && (
                              <div className="w-px flex-1 bg-border mt-2" />
                            )}
                          </div>
                          <div className="flex-1 pb-4">
                            <div className="flex items-center justify-between">
                              <p className="font-medium">{entry.action}</p>
                              <p className="text-xs text-muted-foreground">
                                {format(new Date(entry.performedAt), 'dd MMM yyyy, HH:mm', {
                                  locale: enUS,
                                })}
                              </p>
                            </div>
                            <p className="text-sm text-muted-foreground mt-1">
                              {entry.details}
                            </p>
                            <p className="text-xs text-muted-foreground mt-1">
                              by {entry.performedBy}
                            </p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center py-8 text-center">
                    <History className="h-12 w-12 text-muted-foreground mb-3" />
                    <p className="text-sm text-muted-foreground">
                      No audit trail available
                    </p>
                  </div>
                )}
              </TabsContent>
            </ScrollArea>
          </Tabs>
        </div>
      </SheetContent>
    </Sheet>
  );
}
