import { useEffect, useMemo, useState } from 'react';
import { Loader2, LogOut, QrCode, RefreshCw, Smartphone } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { toast } from '@/hooks/use-toast';
import { apiFetch } from '@/lib/api';

type WhatsappSessionResponse = {
  data: {
    sessionName: string;
    status: string;
    me: {
      id?: string;
      pushName?: string;
    } | null;
    qr: {
      mimetype?: string;
      data?: string;
    } | null;
  };
};

type WhatsappSessionCardProps = {
  title?: string;
  description?: string;
};

export function WhatsappSessionCard({
  title = 'Sesi WhatsApp',
  description = 'Admin bisa logout sesi aktif, membuat sesi baru, dan scan QR yang diambil dari WAHA.',
}: WhatsappSessionCardProps) {
  const [sessionInfo, setSessionInfo] = useState<WhatsappSessionResponse['data'] | null>(null);
  const [isLoadingSession, setIsLoadingSession] = useState(true);
  const [isMutatingSession, setIsMutatingSession] = useState(false);
  const [sessionError, setSessionError] = useState<string | null>(null);

  const loadSessionInfo = () => {
    setIsLoadingSession(true);
    setSessionError(null);

    apiFetch<WhatsappSessionResponse>('/api/admin/whatsapp/session')
      .then((response) => {
        setSessionInfo(response.data);
      })
      .catch((error: Error) => {
        setSessionError(error.message || 'Gagal memuat sesi WhatsApp.');
      })
      .finally(() => setIsLoadingSession(false));
  };

  useEffect(() => {
    loadSessionInfo();
  }, []);

  useEffect(() => {
    if (!sessionInfo || sessionInfo.status === 'WORKING') {
      return;
    }

    const timer = window.setInterval(() => {
      loadSessionInfo();
    }, 15000);

    return () => window.clearInterval(timer);
  }, [sessionInfo]);

  const qrImageSrc = useMemo(() => {
    if (!sessionInfo?.qr?.data) {
      return null;
    }

    return `data:${sessionInfo.qr.mimetype || 'image/png'};base64,${sessionInfo.qr.data}`;
  }, [sessionInfo]);

  const handleSessionAction = (path: string, successTitle: string) => {
    setIsMutatingSession(true);
    setSessionError(null);

    apiFetch<WhatsappSessionResponse>(path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    })
      .then((response) => {
        setSessionInfo(response.data);
        toast({
          title: successTitle,
          description: `Status sesi sekarang: ${response.data.status}.`,
        });
      })
      .catch((error: Error) => {
        setSessionError(error.message || 'Gagal memproses sesi WhatsApp.');
      })
      .finally(() => setIsMutatingSession(false));
  };

  return (
    <Card className="border-slate-200 bg-white shadow-sm dark:border-blue-500/35 dark:bg-slate-950/70 dark:shadow-[0_18px_40px_rgba(2,6,23,0.5)]">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <QrCode className="h-5 w-5 text-emerald-500" />
          {title}
        </CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-5 lg:grid-cols-[1.1fr_320px]">
        <div className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="rounded-2xl border border-slate-200 bg-slate-50/80 p-4 dark:border-slate-800 dark:bg-slate-900/80">
              <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
                Nama Sesi
              </div>
              <div className="mt-2 text-lg font-semibold text-slate-800 dark:text-slate-100">
                {sessionInfo?.sessionName || 'default'}
              </div>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-slate-50/80 p-4 dark:border-slate-800 dark:bg-slate-900/80">
              <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
                Status
              </div>
              <div className="mt-2 text-lg font-semibold text-slate-800 dark:text-slate-100">
                {isLoadingSession ? 'Memuat...' : sessionInfo?.status || '-'}
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900/70">
            <div className="flex items-center gap-2 text-sm font-semibold text-slate-700 dark:text-slate-200">
              <Smartphone className="h-4 w-4 text-emerald-500" />
              Akun Terhubung
            </div>
            <div className="mt-2 text-sm text-slate-600 dark:text-slate-300">
              {sessionInfo?.me?.pushName || sessionInfo?.me?.id ? (
                <>
                  <div>{sessionInfo.me.pushName || '-'}</div>
                  <div className="text-xs text-slate-500 dark:text-slate-400">
                    {sessionInfo.me.id || '-'}
                  </div>
                </>
              ) : (
                'Belum ada akun yang terhubung.'
              )}
            </div>
          </div>

          {sessionError ? (
            <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-100">
              {sessionError}
            </div>
          ) : null}

          <div className="flex flex-wrap gap-3">
            <Button
              type="button"
              variant="outline"
              onClick={loadSessionInfo}
              disabled={isLoadingSession || isMutatingSession}
            >
              <RefreshCw className="mr-2 h-4 w-4" />
              Refresh QR
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() =>
                handleSessionAction('/api/admin/whatsapp/session/logout', 'Sesi berhasil logout')
              }
              disabled={isLoadingSession || isMutatingSession}
            >
              {isMutatingSession ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <LogOut className="mr-2 h-4 w-4" />
              )}
              Logout
            </Button>
            <Button
              type="button"
              onClick={() =>
                handleSessionAction('/api/admin/whatsapp/session/new', 'Sesi baru berhasil disiapkan')
              }
              disabled={isLoadingSession || isMutatingSession}
            >
              {isMutatingSession ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <QrCode className="mr-2 h-4 w-4" />
              )}
              Buat Sesi Baru
            </Button>
          </div>
        </div>

        <div className="flex flex-col items-center justify-center rounded-[28px] border border-dashed border-emerald-300 bg-emerald-50/60 p-5 text-center dark:border-emerald-500/30 dark:bg-emerald-500/10">
          {isLoadingSession ? (
            <div className="flex flex-col items-center gap-3 text-sm text-slate-500 dark:text-slate-300">
              <Loader2 className="h-8 w-8 animate-spin text-emerald-500" />
              Memuat QR WhatsApp...
            </div>
          ) : qrImageSrc ? (
            <>
              <img
                src={qrImageSrc}
                alt="QR WhatsApp"
                className="h-64 w-64 rounded-2xl bg-white p-3 shadow-sm"
              />
              <div className="mt-3 text-sm font-medium text-slate-700 dark:text-slate-200">
                Scan QR ini dengan WhatsApp
              </div>
            </>
          ) : (
            <div className="space-y-2 text-sm text-slate-600 dark:text-slate-300">
              <QrCode className="mx-auto h-12 w-12 text-emerald-500" />
              <div className="font-semibold">QR belum tersedia</div>
              <div>
                Jika sesi sudah `WORKING`, QR memang tidak ditampilkan. Logout atau buat sesi baru
                untuk mendapatkan QR baru.
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
