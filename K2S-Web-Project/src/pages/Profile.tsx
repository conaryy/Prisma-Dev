import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { FormField, FormSection } from '@/components/shared/Form';
import { apiFetch, getAuthToken, setAuthUser } from '@/lib/api';

export function Profile() {
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = searchParams.get('tab') ?? 'profile';
  const [profileForm, setProfileForm] = useState({
    name: '',
    email: '',
    phone: '',
    position: '',
  });
  const [passwordForm, setPasswordForm] = useState({
    currentPassword: '',
    nextPassword: '',
    confirmPassword: '',
  });
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const tabs = useMemo(
    () => [
      { key: 'profile', label: 'Edit Profil' },
      { key: 'password', label: 'Ganti Password' },
    ],
    []
  );

  useEffect(() => {
    const token = getAuthToken();
    if (!token) {
      return;
    }
    apiFetch<{ data: { name: string; email: string; phone?: string; position?: string } }>(
      '/api/auth/me'
    )
      .then((response) => {
        setProfileForm((prev) => ({
          ...prev,
          name: response.data.name ?? '',
          email: response.data.email ?? '',
          phone: response.data.phone ?? '',
          position: response.data.position ?? '',
        }));
      })
      .catch(() => {
        setErrorMessage('Gagal memuat profil. Silakan login ulang.');
      });
  }, []);

  const setTab = (key: string) => {
    const next = new URLSearchParams(searchParams);
    next.set('tab', key);
    setSearchParams(next);
  };

  const handleSaveProfile = async () => {
    setStatusMessage(null);
    setErrorMessage(null);
    const token = getAuthToken();
    if (!token) {
      setErrorMessage('Token belum tersedia. Silakan login dulu.');
      return;
    }
    setIsSaving(true);
    try {
      await apiFetch('/api/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: profileForm.name,
          email: profileForm.email,
          phone: profileForm.phone || null,
          position: profileForm.position || null,
        }),
      });
      apiFetch<{ data: Record<string, unknown> }>('/api/auth/me')
        .then((response) => {
          if (response.data) {
            setAuthUser(response.data);
          }
        })
        .catch(() => {});
      setStatusMessage('Profil berhasil disimpan.');
    } catch (error) {
      setErrorMessage((error as Error).message);
    } finally {
      setIsSaving(false);
    }
  };

  const handleChangePassword = async () => {
    setStatusMessage(null);
    setErrorMessage(null);
    const token = getAuthToken();
    if (!token) {
      setErrorMessage('Token belum tersedia. Silakan login dulu.');
      return;
    }
    if (passwordForm.nextPassword !== passwordForm.confirmPassword) {
      setErrorMessage('Konfirmasi password tidak cocok.');
      return;
    }
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
      setStatusMessage('Password berhasil diperbarui.');
      setPasswordForm({
        currentPassword: '',
        nextPassword: '',
        confirmPassword: '',
      });
    } catch (error) {
      setErrorMessage((error as Error).message);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
            Profil Akun
          </p>
          <h1 className="mt-2 text-2xl font-semibold text-slate-800">
            Kelola Profil & Password
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Ubah data akun dan kredensial login.
          </p>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {tabs.map((tab) => (
          <Button
            key={tab.key}
            variant={activeTab === tab.key ? 'default' : 'outline'}
            size="sm"
            onClick={() => setTab(tab.key)}
          >
            {tab.label}
          </Button>
        ))}
      </div>

      {activeTab === 'profile' ? (
        <FormSection>
          <div className="grid gap-4 md:grid-cols-2">
            <FormField label="Nama">
              <Input
                placeholder="Admin"
                value={profileForm.name}
                onChange={(event) =>
                  setProfileForm((prev) => ({
                    ...prev,
                    name: event.target.value,
                  }))
                }
              />
            </FormField>
            <FormField label="Email / Username">
              <Input
                placeholder="admin"
                value={profileForm.email}
                onChange={(event) =>
                  setProfileForm((prev) => ({
                    ...prev,
                    email: event.target.value,
                  }))
                }
              />
            </FormField>
            <FormField label="No. Telepon">
              <Input
                placeholder="08xxxxxxxxxx"
                value={profileForm.phone}
                onChange={(event) =>
                  setProfileForm((prev) => ({
                    ...prev,
                    phone: event.target.value,
                  }))
                }
              />
            </FormField>
            <FormField label="Jabatan">
              <Input
                placeholder="Administrator"
                value={profileForm.position}
                onChange={(event) =>
                  setProfileForm((prev) => ({
                    ...prev,
                    position: event.target.value,
                  }))
                }
              />
            </FormField>
          </div>
          <div className="mt-4 flex justify-end gap-2">
            <Button variant="outline">Batal</Button>
            <Button onClick={handleSaveProfile} disabled={isSaving}>
              {isSaving ? 'Menyimpan...' : 'Simpan Profil'}
            </Button>
          </div>
        </FormSection>
      ) : (
        <FormSection>
          <div className="grid gap-4 md:grid-cols-2">
            <FormField label="Password Lama">
              <Input
                type="password"
                placeholder="********"
                value={passwordForm.currentPassword}
                onChange={(event) =>
                  setPasswordForm((prev) => ({
                    ...prev,
                    currentPassword: event.target.value,
                  }))
                }
              />
            </FormField>
            <FormField label="Password Baru">
              <Input
                type="password"
                placeholder="********"
                value={passwordForm.nextPassword}
                onChange={(event) =>
                  setPasswordForm((prev) => ({
                    ...prev,
                    nextPassword: event.target.value,
                  }))
                }
              />
            </FormField>
            <FormField label="Konfirmasi Password Baru">
              <Input
                type="password"
                placeholder="********"
                value={passwordForm.confirmPassword}
                onChange={(event) =>
                  setPasswordForm((prev) => ({
                    ...prev,
                    confirmPassword: event.target.value,
                  }))
                }
              />
            </FormField>
          </div>
          <div className="mt-4 flex justify-end gap-2">
            <Button variant="outline">Batal</Button>
            <Button onClick={handleChangePassword} disabled={isSaving}>
              {isSaving ? 'Menyimpan...' : 'Update Password'}
            </Button>
          </div>
        </FormSection>
      )}

      {errorMessage && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-xs text-red-700">
          {errorMessage}
        </div>
      )}
      {statusMessage && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-xs text-emerald-700">
          {statusMessage}
        </div>
      )}
      <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-700">
        Pastikan sudah login dan token tersimpan di browser agar API bisa diakses.
      </div>
    </div>
  );
}
