import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { setSessionTokens } from '../lib/session';
import { consumeSsoState, exchangeAuthorizationCode } from '../lib/sso';

export default function AuthCallback() {
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);
  const params = useMemo(() => new URLSearchParams(window.location.search), []);

  useEffect(() => {
    const code = params.get('code');
    const returnedState = params.get('state');
    const flow = consumeSsoState();

    if (!code || !returnedState) {
      setError('Kode otorisasi tidak ditemukan.');
      return;
    }
    if (!flow.state || flow.state !== returnedState) {
      setError('State tidak valid. Ulangi login.');
      return;
    }
    if (!flow.verifier) {
      setError('PKCE verifier tidak ditemukan.');
      return;
    }

    exchangeAuthorizationCode(code, flow.verifier)
      .then((result) => {
        if (!result.access_token) {
          throw new Error('Access token tidak ditemukan.');
        }
        setSessionTokens({
          accessToken: result.access_token,
          refreshToken: result.refresh_token,
        });
        navigate(flow.returnTo || '/', { replace: true });
      })
      .catch((err: Error) => {
        setError(err.message || 'Gagal menyelesaikan login SSO.');
      });
  }, [navigate, params]);

  return (
    <div className="flex min-h-screen items-center justify-center px-6" style={{ backgroundImage: 'var(--body-bg)' }}>
      <div
        className="w-full max-w-md rounded-2xl border p-6 backdrop-blur-xl"
        style={{
          background: 'var(--surface-card)',
          borderColor: 'var(--border-soft)',
          boxShadow: 'var(--card-shadow)',
        }}
      >
        {error ? (
          <div className="space-y-4">
            <h1 className="text-lg font-semibold" style={{ color: 'var(--text-primary)' }}>
              Callback SSO Gagal
            </h1>
            <p className="text-sm text-red-600">{error}</p>
            <button
              type="button"
              onClick={() => navigate('/', { replace: true })}
              className="theme-primary-button rounded-lg px-4 py-2 text-sm font-semibold transition"
            >
              Kembali
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-3" style={{ color: 'var(--text-secondary)' }}>
            <Loader2 className="h-5 w-5 animate-spin" />
            <span>Menyelesaikan login SSO...</span>
          </div>
        )}
      </div>
    </div>
  );
}
