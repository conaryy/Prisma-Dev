import { FormField } from '@/components/shared/Form';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import type { SelfAssessmentExportDnpAreaTarget } from '@/lib/selfAssessment';

type SelfAssessmentDnpLoginPanelProps = {
  isImportMode: boolean;
  localArea: string;
  derivedDnpYear: number;
  isDnpLoginCollapsed: boolean;
  selectedDnpAreaKey: string;
  dnpAreas: SelfAssessmentExportDnpAreaTarget[];
  dnpSessionId: string;
  hasStoredActiveSession: boolean;
  hasRunningImportJob: boolean;
  isLoading: boolean;
  dnpUsername: string;
  dnpPassword: string;
  dnpYear: string;
  dnpCaptchaUrl: string;
  dnpCaptcha: string;
  dnpImportError: string | null;
  dnpImportDetail: string | null;
  dnpImportMessage: string | null;
  isImportingDnp: boolean;
  onRefreshDnpState: () => void;
  onToggleCollapsed: () => void;
  onUsernameChange: (value: string) => void;
  onPasswordChange: (value: string) => void;
  onYearChange: (value: string) => void;
  onInitDnpSession: () => void;
  onCaptchaChange: (value: string) => void;
  onSelectedAreaKeyChange: (value: string) => void;
  onLoadDnpAreas: () => void;
  onImportDnpCompare: () => void;
  resolveUrl: (url: string) => string;
  hasCompareSnapshot: boolean;
};

export function SelfAssessmentDnpLoginPanel({
  isImportMode,
  localArea,
  derivedDnpYear,
  isDnpLoginCollapsed,
  selectedDnpAreaKey,
  dnpAreas,
  dnpSessionId,
  hasStoredActiveSession,
  hasRunningImportJob,
  isLoading,
  dnpUsername,
  dnpPassword,
  dnpYear,
  dnpCaptchaUrl,
  dnpCaptcha,
  dnpImportError,
  dnpImportDetail,
  dnpImportMessage,
  isImportingDnp,
  onRefreshDnpState,
  onToggleCollapsed,
  onUsernameChange,
  onPasswordChange,
  onYearChange,
  onInitDnpSession,
  onCaptchaChange,
  onSelectedAreaKeyChange,
  onLoadDnpAreas,
  onImportDnpCompare,
  resolveUrl,
  hasCompareSnapshot,
}: SelfAssessmentDnpLoginPanelProps) {
  const selectedAreaLabel =
    dnpAreas.find((item) => `${item.fillCode1}::${item.fillCode2}` === selectedDnpAreaKey)
      ?.area || '-';

  return (
    <div className="space-y-4 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <div className="text-sm font-semibold text-slate-700">
            {isImportMode ? 'Login DNP Untuk Import' : 'Login DNP Untuk Export'}
          </div>
          <div className="text-xs text-slate-500">
            Area lokal: {localArea} • Tahun: {derivedDnpYear}
          </div>
          {isDnpLoginCollapsed ? (
            <div className="text-xs text-slate-500">
              Area DNP: {selectedAreaLabel}
              {dnpSessionId ? ` • Session: ${dnpSessionId}` : ''}
            </div>
          ) : null}
          {hasStoredActiveSession ? (
            <div className="text-xs text-emerald-400">
              Sesi DNP aktif tersimpan dan siap direuse.
            </div>
          ) : null}
          {hasRunningImportJob ? (
            <div className="text-xs text-amber-400">
              Sedang proses pengambilan data DNP.
            </div>
          ) : null}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onRefreshDnpState}
            disabled={isLoading}
          >
            Refresh
          </Button>
          {hasCompareSnapshot ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onToggleCollapsed}
            >
              {isDnpLoginCollapsed ? 'Login' : 'Minimize'}
            </Button>
          ) : null}
        </div>
      </div>
      {!isDnpLoginCollapsed ? (
        <>
          <div className="grid gap-3 md:grid-cols-3">
            <FormField label="Username DNP" required>
              <Input
                value={dnpUsername}
                onChange={(event) => onUsernameChange(event.target.value)}
                placeholder="Username DNP"
              />
            </FormField>
            <FormField label="Password DNP" required>
              <Input
                type="password"
                value={dnpPassword}
                onChange={(event) => onPasswordChange(event.target.value)}
                placeholder="Password DNP"
              />
            </FormField>
            <FormField label="Tahun DNP" required>
              <Input
                type="number"
                min={2000}
                max={2100}
                value={dnpYear}
                onChange={(event) => onYearChange(event.target.value)}
                placeholder="Tahun"
              />
            </FormField>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={onInitDnpSession}
              disabled={isImportingDnp}
            >
              Muat Captcha
            </Button>
            {dnpSessionId ? (
              <span className="text-xs text-slate-500">Session: {dnpSessionId}</span>
            ) : null}
          </div>
          {dnpCaptchaUrl ? (
            <div className="space-y-3">
              <img
                src={resolveUrl(dnpCaptchaUrl)}
                alt="Captcha DNP"
                className="h-16 rounded-lg border border-slate-200 bg-white px-3 py-2"
              />
              <FormField label="Captcha" required>
                <Input
                  value={dnpCaptcha}
                  onChange={(event) => onCaptchaChange(event.target.value)}
                  placeholder="Masukkan captcha"
                />
              </FormField>
            </div>
          ) : null}
          {dnpAreas.length > 0 ? (
            <FormField label="Area DNP" required>
              <select
                className="h-10 w-full rounded-md border border-slate-200 px-3 text-sm"
                value={selectedDnpAreaKey}
                onChange={(event) => onSelectedAreaKeyChange(event.target.value)}
              >
                {dnpAreas.map((item) => (
                  <option
                    key={`${item.fillCode1}-${item.fillCode2}`}
                    value={`${item.fillCode1}::${item.fillCode2}`}
                  >
                    {item.area}
                  </option>
                ))}
              </select>
            </FormField>
          ) : null}
        </>
      ) : null}
      {dnpImportError ? (
        <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-600">
          {dnpImportError}
        </div>
      ) : null}
      {dnpImportDetail ? (
        <pre className="max-h-48 overflow-auto whitespace-pre-wrap rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-[11px] text-amber-900">
          {dnpImportDetail}
        </pre>
      ) : null}
      {dnpImportMessage ? (
        <div className="rounded-xl border border-blue-200 bg-blue-50 px-3 py-2 text-xs text-blue-700">
          {dnpImportMessage}
        </div>
      ) : null}
      {!isDnpLoginCollapsed ? (
        <div className="flex flex-wrap items-center justify-end gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={onLoadDnpAreas}
            disabled={
              isImportingDnp ||
              !dnpSessionId ||
              !dnpUsername.trim() ||
              !dnpPassword.trim() ||
              !dnpCaptcha.trim() ||
              !dnpYear.trim()
            }
          >
            Ambil Daftar Area
          </Button>
          <Button
            className="bg-blue-500 text-white hover:bg-blue-600"
            onClick={onImportDnpCompare}
            disabled={
              isImportingDnp ||
              !dnpSessionId ||
              !dnpUsername.trim() ||
              !dnpPassword.trim() ||
              !dnpCaptcha.trim() ||
              !dnpYear.trim() ||
              !selectedDnpAreaKey
            }
          >
            {isImportingDnp ? 'Mengambil Data DNP...' : 'Ambil Data Area DNP'}
          </Button>
        </div>
      ) : null}
    </div>
  );
}
