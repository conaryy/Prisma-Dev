import { Suspense, lazy, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Eye, EyeOff, Lock, Mail } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import {
  apiFetch,
  clearAuthToken,
  clearAuthUser,
  getAuthToken,
  setAuthUser,
} from '@/lib/api';
import supportAnimation from '../../Support.json';
import loginBackground from '../../bg2.jpeg';

const LazyLottie = lazy(() => import('lottie-react'));

export function Login() {
  const navigate = useNavigate();
  const searchParams = new URLSearchParams(window.location.search);
  const ssoReturnTo = searchParams.get('return_to');
  const isSsoUiLogin = Boolean(ssoReturnTo);
  const centralPortalLanding =
    typeof window === 'undefined'
      ? '/portal-admin'
      : `${window.location.origin}/portal-admin`;
  const defaultSsoBaseUrl =
    typeof window !== 'undefined' &&
    (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')
      ? 'http://localhost:3104'
      : 'https://authapi.ryvidia.my.id';
  const ssoBaseUrl =
    ((import.meta as { env?: Record<string, string> }).env?.VITE_SSO_AUTH_BASE_URL ??
      defaultSsoBaseUrl)
      .replace(/\/+$/, '');
  const [form, setForm] = useState({
    email: '',
    password: '',
    remember: false,
  });
  const [isPasswordVisible, setIsPasswordVisible] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (isSsoUiLogin) {
      return;
    }

    const token = getAuthToken();
    if (!token) {
      return;
    }
    apiFetch<{ data: { role?: string } }>('/api/auth/me')
      .then((response) => {
        if (response.data) {
          setAuthUser(response.data as Record<string, unknown>);
        }
        const role = response.data?.role;
        navigate(role === 'Admin' ? '/portal-admin' : '/portal-user');
      })
      .catch(() => {
        clearAuthToken();
        clearAuthUser();
      });
  }, [isSsoUiLogin, navigate]);

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setErrorMessage(null);
    setIsSubmitting(true);

    if (isSsoUiLogin) {
      fetch(`${ssoBaseUrl}/auth/ui/login`, {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify({
          email: form.email,
          password: form.password,
          return_to: centralPortalLanding,
        }),
      })
        .then(async (response) => {
          const data = await response.json().catch(() => ({}));
          if (!response.ok) {
            throw new Error(
              (typeof data?.error === 'string' && data.error) || 'Login gagal.'
            );
          }
          const redirectTo =
            (typeof data?.redirect_to === 'string' && data.redirect_to) ||
            centralPortalLanding;
          if (!redirectTo) {
            throw new Error('Return URL tidak tersedia.');
          }
          window.location.assign(redirectTo);
        })
        .catch((error: Error) => {
          setErrorMessage(error.message || 'Login gagal.');
        })
        .finally(() => setIsSubmitting(false));
      return;
    }

    fetch(`${ssoBaseUrl}/auth/ui/login`, {
      method: 'POST',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({
        email: form.email,
        password: form.password,
        return_to: `${window.location.origin}/portal-admin`,
      }),
    })
      .then(async (response) => {
        const data = await response.json().catch(() => ({}));
        if (!response.ok) {
          throw new Error(
            (typeof data?.error === 'string' && data.error) || 'Login gagal.'
          );
        }

        const redirectTo =
          (typeof data?.redirect_to === 'string' && data.redirect_to) ||
          `${window.location.origin}/portal-admin`;
        window.location.assign(redirectTo);
      })
      .catch((error: Error) => {
        setErrorMessage(error.message || 'Login gagal.');
      })
      .finally(() => setIsSubmitting(false));
  };

  return (
    <div
      className="relative min-h-screen overflow-hidden bg-slate-50 text-slate-900 transition-colors duration-300 dark:bg-slate-950 dark:text-slate-100"
      style={
        {
          '--login-hero': '#2563eb',
          '--login-hero-deep': '#1d4ed8',
          '--login-hero-light': '#60a5fa',
          '--login-hero-soft': '#dbeafe',
        } as React.CSSProperties
      }
    >
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -left-32 top-20 h-72 w-72 rounded-full bg-[var(--login-hero-soft)] opacity-60 blur-3xl dark:bg-blue-500/30" />
        <div className="absolute -right-20 -top-24 h-60 w-60 rounded-full bg-blue-100 opacity-70 blur-3xl dark:bg-indigo-500/25" />
        <div className="absolute bottom-0 left-1/2 h-40 w-40 -translate-x-1/2 rounded-full bg-sky-100 opacity-60 blur-2xl dark:bg-cyan-500/20" />
      </div>

      <div className="relative grid min-h-screen w-full grid-cols-1 md:grid-cols-[1.05fr_0.95fr]">
        <section className="relative flex flex-col justify-center px-6 py-12 sm:px-10 lg:px-14">
          <div className="pointer-events-none absolute inset-0">
            <div
              className="absolute inset-y-0 left-0 right-0 bg-cover bg-center bg-no-repeat opacity-30 md:-right-20 lg:-right-28"
              style={{ backgroundImage: `url(${loginBackground})` }}
            />
            <div className="absolute inset-y-0 left-0 right-0 bg-white/88 backdrop-blur-[1px] md:-right-20 lg:-right-28 dark:bg-slate-950/80" />
          </div>

          <div className="relative z-10 mx-auto w-full max-w-lg space-y-10">
            <div className="space-y-4 animate-in fade-in slide-in-from-left-6 duration-700">
              <div className="flex items-center gap-3">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white shadow-[0_14px_30px_rgba(15,23,42,0.12)]">
                <img
                  src="/airnavpp.png"
                  alt="Airnav Indonesia"
                  className="h-10 w-10 object-contain"
                />
              </div>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.28em] text-slate-400">
                    Airnav Indonesia
                  </p>
                  <h1 className="text-4xl font-extrabold uppercase tracking-[0.26em] sm:text-5xl">
                    <span className="text-[#1e3a8a]">PRI</span>
                    <span className="relative inline-block align-baseline">
                      <span className="invisible">M</span>
                      <span className="pointer-events-none absolute inset-0 text-[#1e3a8a] [clip-path:polygon(0_0,70%_0,45%_100%,0_100%)]">
                        M
                      </span>
                      <span className="pointer-events-none absolute inset-0 text-[#dc2626] [clip-path:polygon(70%_0,100%_0,100%_100%,45%_100%)]">
                        M
                      </span>
                    </span>
                    <span className="text-[#1e3a8a]">A</span>
                  </h1>
                </div>
              </div>
              <p className="text-base text-slate-500 dark:text-slate-300">
                Masuk untuk membuka portal pengguna atau portal admin Prima sesuai akses akun Anda.
              </p>
            </div>

            <form
              className="space-y-6 animate-in fade-in slide-in-from-left-6 duration-700 delay-100"
              onSubmit={handleSubmit}
            >
              <div className="space-y-4 rounded-3xl border border-white/80 bg-white/90 p-7 shadow-[0_20px_45px_rgba(15,23,42,0.08)] backdrop-blur sm:p-8 dark:border-slate-700 dark:bg-slate-900/85 dark:shadow-[0_20px_45px_rgba(2,6,23,0.6)]">
                <div className="space-y-2">
                  <label className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-400 dark:text-slate-300">
                    Email atau username
                  </label>
                  <div className="relative">
                    <Mail className="pointer-events-none absolute left-4 top-1/2 z-10 h-5 w-5 -translate-y-1/2 text-slate-400 dark:text-slate-400" />
                    <Input
                      type="text"
                      value={form.email}
                      onChange={(event) =>
                        setForm((prev) => ({
                          ...prev,
                          email: event.target.value,
                        }))
                      }
                      className="h-12 pl-12 text-base"
                      placeholder="nama@domain.com"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-400 dark:text-slate-300">
                    Password
                  </label>
                  <div className="relative">
                    <Lock className="pointer-events-none absolute left-4 top-1/2 z-10 h-5 w-5 -translate-y-1/2 text-slate-400 dark:text-slate-400" />
                    <Input
                      type={isPasswordVisible ? 'text' : 'password'}
                      value={form.password}
                      onChange={(event) =>
                        setForm((prev) => ({
                          ...prev,
                          password: event.target.value,
                        }))
                      }
                      className="h-12 pl-12 pr-12 text-base"
                      placeholder="********"
                    />
                    <button
                      type="button"
                      onClick={() => setIsPasswordVisible((prev) => !prev)}
                      aria-label={
                        isPasswordVisible ? 'Sembunyikan password' : 'Tampilkan password'
                      }
                      className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 transition hover:text-slate-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-200 dark:text-slate-400 dark:hover:text-slate-200"
                    >
                      {isPasswordVisible ? (
                        <EyeOff className="h-5 w-5" />
                      ) : (
                        <Eye className="h-5 w-5" />
                      )}
                    </button>
                  </div>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-3 text-sm">
                  <label className="flex items-center gap-2 font-semibold text-slate-500 dark:text-slate-300">
                    <Checkbox
                      checked={form.remember}
                      onCheckedChange={(checked) =>
                        setForm((prev) => ({
                          ...prev,
                          remember: checked === true,
                        }))
                      }
                    />
                    Ingat saya
                  </label>
                  <Button
                    type="button"
                    variant="link"
                    className="h-auto px-0 text-sm font-semibold text-blue-600"
                  >
                    Lupa password?
                  </Button>
                </div>

                <Button
                  className="h-12 w-full rounded-2xl bg-[var(--login-hero)] text-base text-white shadow-[0_18px_35px_rgba(37,99,235,0.35)] transition hover:bg-[var(--login-hero-deep)]"
                  type="submit"
                  disabled={isSubmitting}
                >
                  {isSubmitting ? 'Masuk...' : isSsoUiLogin ? 'Masuk SSO' : 'Masuk'}
                </Button>

                {errorMessage && (
                  <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                    {errorMessage}
                  </div>
                )}
              </div>

              <p className="text-center text-sm text-slate-500 dark:text-slate-300">
                Belum punya akun?{' '}
                <a
                  href="https://wa.me/6281217672800?text=Halo%20admin%2C%20saya%20ingin%20minta%20akses%20akun%20K3.%20Terima%20kasih."
                  target="_blank"
                  rel="noreferrer"
                  className="font-semibold text-blue-600"
                >
                  Hubungi admin
                </a>
              </p>
            </form>
          </div>
        </section>

        <section className="relative hidden md:flex md:items-stretch">
          <div className="relative z-10 h-full w-full animate-in fade-in slide-in-from-right-6 duration-700 delay-150">
            <div className="relative -ml-px flex h-full w-full items-center justify-center overflow-visible rounded-l-[2.5rem] rounded-r-none bg-[var(--login-hero)] px-2 py-4 md:py-6 lg:px-4">
              <div className="absolute inset-0 overflow-hidden rounded-l-[2.5rem] rounded-r-none">
                <div className="absolute -left-24 -top-16 h-56 w-56 rounded-full bg-[var(--login-hero-light)] opacity-45 blur-3xl" />
                <div className="absolute -bottom-32 right-[-40%] h-80 w-80 rounded-full bg-[var(--login-hero-deep)] opacity-40 blur-3xl" />
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(255,255,255,0.25),transparent_50%),radial-gradient(circle_at_80%_0%,rgba(255,255,255,0.2),transparent_55%)]" />
              </div>
              <div className="relative z-10 flex w-full items-center justify-center pointer-events-none">
                <div className="aspect-[13/8] w-full shrink-0 max-w-none md:w-[94%] lg:w-[101%] xl:w-[112%] 2xl:w-[119%] md:-translate-x-12 lg:-translate-x-14 xl:-translate-x-16 2xl:-translate-x-20">
                  <Suspense
                    fallback={
                      <div className="h-[300px] w-[300px]" aria-hidden="true" />
                    }
                  >
                    <LazyLottie
                      animationData={supportAnimation}
                      loop
                      autoplay
                      aria-hidden="true"
                      className="h-full w-full"
                    />
                  </Suspense>
                </div>
              </div>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
