import { useState } from 'react';
import { Upload, X, FileSpreadsheet, Check, AlertCircle } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { cn } from '@/lib/utils';

interface UploadModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

type UploadStep = 'select' | 'processing' | 'summary';

interface ImportSummary {
  totalRows: number;
  successRows: number;
  errorRows: number;
  errors: string[];
}

export function UploadModal({ open, onOpenChange }: UploadModalProps) {
  const [step, setStep] = useState<UploadStep>('select');
  const [file, setFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [progress, setProgress] = useState(0);
  const [summary, setSummary] = useState<ImportSummary | null>(null);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);

    const droppedFile = e.dataTransfer.files[0];
    if (droppedFile && droppedFile.name.endsWith('.xlsx')) {
      setFile(droppedFile);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      setFile(selectedFile);
    }
  };

  const handleUpload = async () => {
    if (!file) return;

    setStep('processing');
    setProgress(0);

    const interval = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 100) {
          clearInterval(interval);
          return 100;
        }
        return prev + 10;
      });
    }, 200);

    await new Promise((resolve) => setTimeout(resolve, 2000));

    setSummary({
      totalRows: 45,
      successRows: 42,
      errorRows: 3,
      errors: [
        'Row 12: Invalid date format',
        'Row 28: Category not found',
        'Row 35: Assignee is not registered in the system',
      ],
    });

    setStep('summary');
  };

  const handleApply = () => {
    onOpenChange(false);
    setTimeout(() => {
      setStep('select');
      setFile(null);
      setProgress(0);
      setSummary(null);
    }, 300);
  };

  const handleCancel = () => {
    onOpenChange(false);
    setTimeout(() => {
      setStep('select');
      setFile(null);
      setProgress(0);
      setSummary(null);
    }, 300);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Upload Excel Report</DialogTitle>
          <DialogDescription>
            Upload an Excel (.xlsx) file to import flight reports
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {step === 'select' && (
            <>
              <div
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                className={cn(
                  'relative rounded-lg border-2 border-dashed p-8 text-center transition-colors',
                  isDragging
                    ? 'border-primary bg-primary/5'
                    : 'border-muted-foreground/25 hover:border-muted-foreground/50'
                )}
              >
                <input
                  type="file"
                  accept=".xlsx"
                  onChange={handleFileSelect}
                  className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
                />
                <div className="flex flex-col items-center gap-2">
                  <Upload className="h-10 w-10 text-muted-foreground" />
                  <p className="text-sm font-medium">
                    Drag & drop an Excel file here
                  </p>
                  <p className="text-xs text-muted-foreground">
                    or click to select a file
                  </p>
                  <p className="text-xs text-muted-foreground mt-2">
                    Format: .xlsx (max 10MB)
                  </p>
                </div>
              </div>

              {file && (
                <div className="flex items-center gap-3 rounded-lg border p-4">
                  <FileSpreadsheet className="h-8 w-8 text-blue-500" />
                  <div className="flex-1">
                    <p className="font-medium text-sm">{file.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {(file.size / 1024).toFixed(0)} KB
                    </p>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setFile(null)}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              )}

              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertDescription className="text-xs">
                  Ensure the Excel format matches the provided template.
                  Required columns: Report Number, Title, Category, Status,
                  Area/Sector, Assignee, Date.
                </AlertDescription>
              </Alert>
            </>
          )}

          {step === 'processing' && (
            <div className="space-y-4">
              <div className="flex items-center justify-center py-8">
                <div className="text-center space-y-4">
                  <div className="flex justify-center">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary" />
                  </div>
                  <div>
                    <p className="font-medium">Processing file...</p>
                    <p className="text-sm text-muted-foreground">
                      Please wait a moment
                    </p>
                  </div>
                  <Progress value={progress} className="w-64" />
                  <p className="text-xs text-muted-foreground">{progress}%</p>
                </div>
              </div>
            </div>
          )}

          {step === 'summary' && summary && (
            <div className="space-y-4">
              <Alert className="border-blue-200 bg-blue-50 dark:bg-blue-950/20">
                <Check className="h-4 w-4 text-blue-600" />
                <AlertDescription>
                  <span className="font-medium text-blue-900 dark:text-blue-100">
                    Import successful!
                  </span>
                </AlertDescription>
              </Alert>

              <div className="rounded-lg border p-4 space-y-3">
                <h4 className="font-semibold text-sm">Import Summary</h4>
                <div className="grid grid-cols-3 gap-4">
                  <div className="text-center">
                    <p className="text-2xl font-bold">{summary.totalRows}</p>
                    <p className="text-xs text-muted-foreground">Total Rows</p>
                  </div>
                  <div className="text-center">
                    <p className="text-2xl font-bold text-blue-600">
                      {summary.successRows}
                    </p>
                    <p className="text-xs text-muted-foreground">Successful</p>
                  </div>
                  <div className="text-center">
                    <p className="text-2xl font-bold text-red-600">
                      {summary.errorRows}
                    </p>
                    <p className="text-xs text-muted-foreground">Failed</p>
                  </div>
                </div>
              </div>

              {summary.errors.length > 0 && (
                <div className="rounded-lg border border-red-200 bg-red-50 dark:bg-red-950/20 p-4">
                  <h4 className="font-semibold text-sm text-red-900 dark:text-red-100 mb-2">
                    Errors ({summary.errors.length})
                  </h4>
                  <ul className="space-y-1">
                    {summary.errors.map((error, index) => (
                      <li
                        key={index}
                        className="text-xs text-red-800 dark:text-red-200"
                      >
                        - {error}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleCancel}>
            Cancel
          </Button>
          {step === 'select' && (
            <Button onClick={handleUpload} disabled={!file}>
              <Upload className="mr-2 h-4 w-4" />
              Upload
            </Button>
          )}
          {step === 'summary' && (
            <Button onClick={handleApply}>
              <Check className="mr-2 h-4 w-4" />
              Apply
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
