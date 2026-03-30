import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { clearAuthToken, clearAuthUser, setAuthToken, setAuthUser } from '@/lib/api';
import { canAccessAdminPortal } from '@/lib/permissions';
import { clearSsoFlowLock, consumeSsoFlowState, exchangeAuthorizationCode } from '@/lib/sso';

export function AuthCallback() {
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);
  const params = useMemo(() => new URLSearchParams(window.location.search), []);

  useEffect(() => {
    const code = params.get('code');
    const returnedState = params.get('state');
    const flow = consumeSsoFlowState();

    if (!code || !returnedState) {
      setError('Kode otorisasi tidak ditemukan.');
      return;
    }
    if (!flow.state || flow.state !== returnedState) {
      setError('State tidak valid. Ulangi login.');
      return;
    }
    if (!flow.verifier) {
      setError('PKCE verifier hilang. Ulangi login.');
      return;
    }

    exchangeAuthorizationCode({ code, codeVerifier: flow.verifier })
      .then((response) => {
        if (!response.access_token) {
          throw new Error('Access token tidak tersedia.');
        }

        setAuthToken(response.access_token);
        if (response.user && typeof response.user === 'object') {
          setAuthUser(response.user);
        }

        const target =
          flow.returnTo ||
          (response.user && canAccessAdminPortal(response.user)
            ? '/admin'
            : '/dashboard');

        navigate(target, { replace: true });
      })
      .catch((err: Error) => {
        clearSsoFlowLock();
        clearAuthToken();
        clearAuthUser();
        setError(err.message || 'Gagal memproses callback SSO.');
      });
  }, [navigate, params]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-6 dark:bg-slate-950">
      <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-700 dark:bg-slate-900/85">
        {error ? (
          <div className="space-y-4">
            <h1 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
              Callback SSO Gagal
            </h1>
            <p className="text-sm text-red-600 dark:text-red-300">{error}</p>
            <Button onClick={() => navigate('/login', { replace: true })}>
              Kembali ke Login
            </Button>
          </div>
        ) : (
          <div className="flex items-center gap-3 text-slate-700 dark:text-slate-200">
            <Loader2 className="h-5 w-5 animate-spin" />
            <span>Menyelesaikan login SSO...</span>
          </div>
        )}
      </div>
    </div>
  );
}
