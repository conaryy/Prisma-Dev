import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { setSessionTokens } from '@/lib/session';
import { clearSsoState, exchangeAuthorizationCode, readSsoState } from '@/lib/sso';

type CallbackResolution = {
  accessToken: string;
  refreshToken?: string;
  returnTo: string;
};

let activeCallbackExchange: { key: string; promise: Promise<CallbackResolution> } | null = null;

export function AuthCallbackPage() {
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);
  const params = useMemo(() => new URLSearchParams(window.location.search), []);

  useEffect(() => {
    const code = params.get('code');
    const returnedState = params.get('state');

    if (!code || !returnedState) {
      clearSsoState();
      setError('Kode otorisasi tidak ditemukan.');
      return;
    }

    const flow = readSsoState();

    if (!flow.state || flow.state !== returnedState) {
      clearSsoState();
      setError('State tidak valid. Ulangi login.');
      return;
    }

    if (!flow.verifier) {
      clearSsoState();
      setError('PKCE verifier tidak ditemukan.');
      return;
    }

    const callbackKey = `${returnedState}:${code}`;
    const callbackPromise =
      activeCallbackExchange?.key === callbackKey
        ? activeCallbackExchange.promise
        : exchangeAuthorizationCode(code, flow.verifier)
            .then((result) => {
              if (!result.access_token) {
                throw new Error('Access token tidak ditemukan.');
              }

              return {
                accessToken: result.access_token,
                refreshToken: result.refresh_token,
                returnTo: flow.returnTo || '/',
              };
            })
            .finally(() => {
              clearSsoState();

              if (activeCallbackExchange?.key === callbackKey) {
                activeCallbackExchange = null;
              }
            });

    if (activeCallbackExchange?.key !== callbackKey) {
      activeCallbackExchange = {
        key: callbackKey,
        promise: callbackPromise,
      };
    }

    let ignore = false;

    callbackPromise
      .then((result) => {
        if (ignore) {
          return;
        }

        setSessionTokens({
          accessToken: result.accessToken,
          refreshToken: result.refreshToken,
        });
        navigate(result.returnTo, { replace: true });
      })
      .catch((reason: Error) => {
        if (!ignore) {
          setError(reason.message || 'Gagal menyelesaikan login SSO.');
        }
      });

    return () => {
      ignore = true;
    };
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
