import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { setSessionTokens } from '@/lib/session';
import { consumeSsoState, exchangeAuthorizationCode } from '@/lib/sso';

export function AuthCallbackPage() {
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
      .catch((reason: Error) => {
        setError(reason.message || 'Gagal menyelesaikan login SSO.');
      });
  }, [navigate, params]);

  return (
    <div className="auth-callback-page">
      <div className="auth-callback-card">
        {error ? (
          <>
            <h1 className="panel-title">Callback SSO Gagal</h1>
            <p className="detail-help">{error}</p>
            <button
              type="button"
              className="primary-action"
              onClick={() => navigate('/', { replace: true })}
            >
              Kembali
            </button>
          </>
        ) : (
          <>
            <h1 className="panel-title">Menyelesaikan Login</h1>
            <p className="detail-help">Sedang menyambungkan sesi K3 dengan Auth/SSO.</p>
          </>
        )}
      </div>
    </div>
  );
}
