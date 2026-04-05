import type { ReactNode } from 'react';
import { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, LogOut, Moon, ShieldCheck, Sun } from 'lucide-react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  apiFetch,
  clearAuthToken,
  clearAuthUser,
  setAuthUser,
} from '@/lib/api';
import { getStoredTheme, persistTheme } from '@/lib/theme';

type ProfileResponse = {
  id: string;
  name: string;
  username: string;
  email: string | null;
  role?: string;
};

function normalizeBaseUrl(value: string) {
  return value.replace(/\/+$/, '');
}

function getAuthServiceBaseUrl() {
  const env = (import.meta as { env?: Record<string, string> }).env ?? {};
  const configured = env.VITE_SSO_AUTH_BASE_URL?.trim();
  if (configured) {
    return normalizeBaseUrl(configured);
  }

  if (typeof window !== 'undefined') {
    const { hostname } = window.location;
    if (hostname === 'localhost' || hostname === '127.0.0.1') {
      return 'http://localhost:3104';
    }
  }

  return 'https://authapi.ryvidia.my.id';
}

function FieldShell({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <label className="space-y-2">
      <span className="text-sm font-semibold text-slate-700 dark:text-slate-200">{label}</span>
      {children}
    </label>
  );
}

export function Profile() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [isDark, setIsDark] = useState(() => getStoredTheme() === 'dark');
  const [profileForm, setProfileForm] = useState({
    name: '',
    username: '',
    email: '',
    role: '',
  });
  const [initialProfileForm, setInitialProfileForm] = useState({
    name: '',
    username: '',
    email: '',
    role: '',
  });
  const [passwordForm, setPasswordForm] = useState({
    currentPassword: '',
    nextPassword: '',
    confirmPassword: '',
  });
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  const activeTab = searchParams.get('tab') ?? 'profile';
  const backDestination = profileForm.role === 'Admin' ? '/portal-admin' : '/portal-user';
  const backLabel = profileForm.role === 'Admin' ? 'Kembali ke Portal Admin' : 'Kembali ke Portal Pengguna';
  const tabs = useMemo(
    () => [
      { key: 'profile', label: 'Edit Profil' },
      { key: 'password', label: 'Ganti Password' },
    ],
    []
  );

  useEffect(() => {
    const html = document.documentElement;
    const check = () => setIsDark(html.classList.contains('dark'));
    check();
    const observer = new MutationObserver(check);
    observer.observe(html, { attributes: true, attributeFilter: ['class'] });
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    apiFetch<{ data: ProfileResponse }>('/api/auth/me')
      .then((response) => {
        const next = {
          name: response.data.name ?? response.data.username ?? '',
          username: response.data.username ?? '',
          email: response.data.email ?? '',
          role: response.data.role ?? '',
        };
        setProfileForm(next);
        setInitialProfileForm(next);
        setAuthUser(response.data as unknown as Record<string, unknown>);
      })
      .catch(() => {
        clearAuthToken();
        clearAuthUser();
        navigate('/login', { replace: true });
      })
      .finally(() => setIsLoading(false));
  }, [navigate]);

  const setTab = (key: string) => {
    const next = new URLSearchParams(searchParams);
    next.set('tab', key);
    setSearchParams(next);
  };

  const handleThemeToggle = () => {
    const nextIsDark = !isDark;
    persistTheme(nextIsDark ? 'dark' : 'light');
    setIsDark(nextIsDark);
  };

  const handleLogout = () => {
    clearAuthToken();
    clearAuthUser();
    const postLogout = `${window.location.origin}/login`;
    const logoutUrl = new URL(`${getAuthServiceBaseUrl()}/auth/logout`);
    logoutUrl.searchParams.set('post_logout_redirect_uri', postLogout);
    window.location.replace(logoutUrl.toString());
  };

  const handleSaveProfile = async () => {
    setStatusMessage(null);
    setErrorMessage(null);
    setIsSaving(true);

    try {
      const response = await apiFetch<{ data: ProfileResponse }>('/api/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: profileForm.name,
          username: profileForm.username,
          email: profileForm.email || null,
        }),
      });

      const next = {
        name: response.data.name ?? response.data.username ?? '',
        username: response.data.username ?? '',
        email: response.data.email ?? '',
        role: response.data.role ?? profileForm.role,
      };
      setProfileForm(next);
      setInitialProfileForm(next);
      setAuthUser(response.data as unknown as Record<string, unknown>);
      setStatusMessage('Profil berhasil diperbarui.');
    } catch (error) {
      setErrorMessage((error as Error).message);
    } finally {
      setIsSaving(false);
    }
  };

  const handleChangePassword = async () => {
    setStatusMessage(null);
    setErrorMessage(null);
    setIsSaving(true);

    try {
      await apiFetch('/api/profile/password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          current_password: passwordForm.currentPassword,
          password: passwordForm.nextPassword,
          password_confirmation: passwordForm.confirmPassword,
        }),
      });
      setPasswordForm({
        currentPassword: '',
        nextPassword: '',
        confirmPassword: '',
      });
      setStatusMessage('Password berhasil diperbarui.');
    } catch (error) {
      setErrorMessage((error as Error).message);
    } finally {
      setIsSaving(false);
    }
  };

  const cardStyle = isDark
    ? {
        borderColor: '#1e3a6e',
        backgroundColor: 'rgba(8,16,42,0.86)',
        backdropFilter: 'blur(14px)',
        boxShadow: '0 18px 48px rgba(0,0,0,0.28)',
      }
    : {
        borderColor: '#dbe5f2',
        backgroundColor: 'rgba(255,255,255,0.96)',
        boxShadow: '0 18px 40px rgba(15,23,42,0.08)',
      };

  const topbarButtonStyle = isDark
    ? {
        borderColor: '#1e3a6e',
        backgroundColor: 'rgba(12,22,52,0.95)',
        color: '#cbd5e1',
      }
    : {
        borderColor: '#dbe5f2',
        backgroundColor: '#ffffff',
        color: '#475569',
        boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
      };

  const panelBorderStyle = isDark
    ? 'border-[#7c93cd]/70 bg-[rgba(12,22,52,0.62)]'
    : 'border-slate-300/90 bg-white/90';

  const inputClassName =
    'h-11 rounded-2xl border-slate-300/80 bg-white/95 text-slate-900 placeholder:text-slate-400 focus-visible:border-blue-300 focus-visible:ring-blue-200 dark:border-[#314f87] dark:bg-[#101b39]/92 dark:text-slate-100 dark:placeholder:text-slate-500';

  if (isLoading) {
    return <div className="min-h-screen" />;
  }

  return (
    <div
      className="min-h-screen"
      style={{
        backgroundColor: isDark ? 'transparent' : '#f8fafc',
        color: isDark ? '#f1f5f9' : '#0f172a',
      }}
    >
      <div className="w-full px-4 py-4 sm:px-6 sm:py-6 lg:px-8">
        <header>
          <div
            className="flex flex-wrap items-center justify-between gap-4 rounded-[28px] border px-4 py-3 sm:px-5"
            style={cardStyle}
          >
            <div className="flex min-w-0 items-center gap-3">
              <button
                type="button"
                onClick={() => navigate(backDestination)}
                className="flex h-12 w-12 items-center justify-center rounded-2xl border transition hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-200"
                style={topbarButtonStyle}
                aria-label="Kembali ke portal"
                title={backLabel}
              >
                <ArrowLeft className="h-5 w-5" />
              </button>
              <div
                className="flex h-12 w-12 items-center justify-center rounded-2xl border"
                style={topbarButtonStyle}
              >
                <img
                  src="/airnavpp.png"
                  alt="Airnav Indonesia"
                  className="h-9 w-9 object-contain"
                />
              </div>
              <div className="min-w-0">
                <p
                  className="text-[11px] font-semibold uppercase tracking-[0.28em]"
                  style={{ color: isDark ? '#64748b' : '#94a3b8' }}
                >
                  Profil Akun
                </p>
                <div
                  className="truncate text-sm font-semibold sm:text-base"
                  style={{ color: isDark ? '#e2e8f0' : '#1e293b' }}
                >
                  Kelola Profil &amp; Password
                </div>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleThemeToggle}
                className="gap-2 rounded-2xl border-white/80 bg-white/70 text-slate-700 shadow-sm transition hover:-translate-y-0.5 hover:bg-white hover:text-slate-700 dark:border-[#4268c4]/80 dark:bg-[#1b3f9b]/70 dark:text-blue-100 dark:hover:bg-[#2553be]/75 dark:hover:text-white"
              >
                {isDark ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4" />}
                {isDark ? 'Dark' : 'Light'}
              </Button>

              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => navigate(backDestination)}
                className="rounded-2xl"
              >
                {backLabel}
              </Button>

              <button
                type="button"
                onClick={handleLogout}
                aria-label="Logout"
                title="Logout"
                className="flex h-11 w-11 items-center justify-center rounded-2xl border transition hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-200"
                style={topbarButtonStyle}
              >
                <LogOut className="h-5 w-5" />
              </button>
            </div>
          </div>
        </header>

        <main className="mx-auto mt-8 w-full max-w-[1520px]">
          <section
            className="overflow-hidden rounded-[30px] border"
            style={cardStyle}
          >
            <div className="bg-gradient-to-r from-[#1d47b8] via-[#2b56c5] to-[#8db2f2] px-8 py-8">
              <p className="text-xs font-semibold uppercase tracking-[0.28em] text-blue-100/85">
                Profil Akun
              </p>
              <h1 className="mt-3 text-3xl font-semibold tracking-tight text-white">
                Kelola Profil &amp; Password
              </h1>
              <p className="mt-2 max-w-2xl text-sm text-blue-100/90">
                Kelola identitas akun, username, email, dan password tanpa perlu kembali ke halaman
                login.
              </p>
            </div>

            <div className="space-y-6 px-8 py-8">
              <div className="flex flex-wrap gap-2">
                {tabs.map((tab) => (
                  <Button
                    key={tab.key}
                    type="button"
                    size="sm"
                    variant={activeTab === tab.key ? 'default' : 'outline'}
                    onClick={() => setTab(tab.key)}
                    className="rounded-2xl"
                  >
                    {tab.label}
                  </Button>
                ))}
              </div>

              {activeTab === 'profile' ? (
                <div className={`rounded-[26px] border p-5 sm:p-6 ${panelBorderStyle}`}>
                  <div className="grid gap-4 md:grid-cols-2">
                    <FieldShell label="Nama">
                      <Input
                        value={profileForm.name}
                        onChange={(event) =>
                          setProfileForm((prev) => ({
                            ...prev,
                            name: event.target.value,
                            username: event.target.value,
                          }))
                        }
                        placeholder="Nama user"
                        className={inputClassName}
                      />
                    </FieldShell>

                    <FieldShell label="Email">
                      <Input
                        value={profileForm.email}
                        onChange={(event) =>
                          setProfileForm((prev) => ({
                            ...prev,
                            email: event.target.value,
                          }))
                        }
                        placeholder="user@local.test"
                        className={inputClassName}
                      />
                    </FieldShell>

                    <FieldShell label="Username">
                      <Input value={profileForm.username} readOnly className={inputClassName} />
                    </FieldShell>

                    <FieldShell label="Role">
                      <Input value={profileForm.role || '-'} readOnly className={inputClassName} />
                    </FieldShell>
                  </div>

                  <div className="mt-6 flex justify-end gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => {
                        setProfileForm(initialProfileForm);
                        setStatusMessage(null);
                        setErrorMessage(null);
                      }}
                    >
                      Batal
                    </Button>
                    <Button type="button" onClick={handleSaveProfile} disabled={isSaving}>
                      {isSaving ? 'Menyimpan...' : 'Simpan Profil'}
                    </Button>
                  </div>
                </div>
              ) : (
                <div className={`rounded-[26px] border p-5 sm:p-6 ${panelBorderStyle}`}>
                  <div className="grid gap-4 md:grid-cols-2">
                    <FieldShell label="Password Lama">
                      <Input
                        type="password"
                        value={passwordForm.currentPassword}
                        onChange={(event) =>
                          setPasswordForm((prev) => ({
                            ...prev,
                            currentPassword: event.target.value,
                          }))
                        }
                        placeholder="********"
                        className={inputClassName}
                      />
                    </FieldShell>

                    <FieldShell label="Password Baru">
                      <Input
                        type="password"
                        value={passwordForm.nextPassword}
                        onChange={(event) =>
                          setPasswordForm((prev) => ({
                            ...prev,
                            nextPassword: event.target.value,
                          }))
                        }
                        placeholder="Minimal 8 karakter"
                        className={inputClassName}
                      />
                    </FieldShell>

                    <FieldShell label="Konfirmasi Password Baru">
                      <Input
                        type="password"
                        value={passwordForm.confirmPassword}
                        onChange={(event) =>
                          setPasswordForm((prev) => ({
                            ...prev,
                            confirmPassword: event.target.value,
                          }))
                        }
                        placeholder="Ulangi password baru"
                        className={inputClassName}
                      />
                    </FieldShell>

                    <div
                      className={`flex items-center gap-3 rounded-[22px] border px-4 py-4 ${panelBorderStyle}`}
                    >
                      <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-blue-500/15 text-blue-500 dark:bg-blue-400/15 dark:text-blue-300">
                        <ShieldCheck className="h-5 w-5" />
                      </div>
                      <div>
                        <div className="text-sm font-semibold text-slate-800 dark:text-slate-100">
                          Keamanan akun
                        </div>
                        <p className="mt-1 text-xs leading-5 text-slate-500 dark:text-slate-400">
                          Password baru minimal 8 karakter dan harus berbeda dari password lama.
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="mt-6 flex justify-end gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() =>
                        setPasswordForm({
                          currentPassword: '',
                          nextPassword: '',
                          confirmPassword: '',
                        })
                      }
                    >
                      Batal
                    </Button>
                    <Button type="button" onClick={handleChangePassword} disabled={isSaving}>
                      {isSaving ? 'Menyimpan...' : 'Simpan Password'}
                    </Button>
                  </div>
                </div>
              )}

              {statusMessage ? (
                <div className="rounded-2xl border border-emerald-400/35 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-700 dark:text-emerald-200">
                  {statusMessage}
                </div>
              ) : null}

              {errorMessage ? (
                <div className="rounded-2xl border border-rose-400/35 bg-rose-500/10 px-4 py-3 text-sm text-rose-700 dark:text-rose-200">
                  {errorMessage}
                </div>
              ) : null}

              <div className="rounded-2xl border border-amber-400/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-800 dark:text-amber-200">
                Pastikan sesi login masih aktif sebelum menyimpan perubahan profil atau password.
              </div>
            </div>
          </section>
        </main>
      </div>
    </div>
  );
}
