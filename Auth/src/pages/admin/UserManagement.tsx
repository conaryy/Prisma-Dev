import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { KeyRound, Trash2, UserPlus, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { apiFetch, ApiError } from '@/lib/api';

type PermissionState = {
  can_access_admin_portal: boolean;
  can_manage_users: boolean;
  can_manage_admin_module: boolean;
  can_access_k2s_dashboard: boolean;
  can_access_logbook: boolean;
  can_access_k3: boolean;
  can_access_keamanan: boolean;
  can_access_external_dnp: boolean;
};

type UserItem = {
  id: string;
  name: string;
  username: string;
  email: string | null;
  role: 'Admin' | 'Viewer';
  status: 'Active' | 'Disabled';
  permissions: PermissionState;
};

const PERMISSION_LABELS: Array<{ key: keyof PermissionState; label: string }> = [
  { key: 'can_access_k2s_dashboard', label: 'K2S Dashboard' },
  { key: 'can_access_logbook', label: 'Logbook' },
  { key: 'can_access_k3', label: 'K3' },
  { key: 'can_access_keamanan', label: 'Keamanan' },
  { key: 'can_access_external_dnp', label: 'Fitur External DNP' },
  { key: 'can_access_admin_portal', label: 'Portal Admin' },
  { key: 'can_manage_admin_module', label: 'Menu Admin' },
  { key: 'can_manage_users', label: 'Kelola User' },
];

function defaultPermissions(role: 'Admin' | 'Viewer'): PermissionState {
  const admin = role === 'Admin';
  return {
    can_access_admin_portal: admin,
    can_manage_users: admin,
    can_manage_admin_module: admin,
    can_access_k2s_dashboard: true,
    can_access_logbook: true,
    can_access_k3: admin,
    can_access_keamanan: admin,
    can_access_external_dnp: admin,
  };
}

export function UserManagement() {
  const navigate = useNavigate();
  const [users, setUsers] = useState<UserItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [resetTarget, setResetTarget] = useState<UserItem | null>(null);
  const [resetPassword, setResetPassword] = useState('');
  const [selfUserId, setSelfUserId] = useState<string | null>(null);

  const [form, setForm] = useState({
    name: '',
    username: '',
    email: '',
    password: '',
    role: 'Viewer' as 'Admin' | 'Viewer',
    status: 'Active' as 'Active' | 'Disabled',
    permissions: defaultPermissions('Viewer'),
  });

  const canSubmit = useMemo(() => {
    return (
      form.name.trim().length >= 2 &&
      form.username.trim().length >= 3 &&
      form.password.length >= 8
    );
  }, [form.name, form.username, form.password]);

  const loadUsers = async () => {
    setLoading(true);
    setError(null);
    try {
      const me = await apiFetch<{ data: UserItem }>('/api/auth/me');
      if (!me?.data?.permissions?.can_manage_users && me?.data?.role !== 'Admin') {
        navigate('/portal-admin', { replace: true });
        return;
      }
      setSelfUserId(me.data.id);
      const response = await apiFetch<{ data: UserItem[] }>('/api/admin/users');
      setUsers(response.data ?? []);
    } catch (err) {
      const e = err as ApiError;
      if (e.status === 401) {
        navigate('/login', { replace: true });
        return;
      }
      setError(e.message || 'Gagal memuat user.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadUsers();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onRoleChange = (role: 'Admin' | 'Viewer') => {
    setForm((prev) => ({ ...prev, role, permissions: defaultPermissions(role) }));
  };

  const onCreate = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!canSubmit) return;
    setIsSubmitting(true);
    setError(null);
    try {
      await apiFetch('/api/admin/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: form.name.trim(),
          username: form.username.trim(),
          email: form.email.trim() || null,
          password: form.password,
          role: form.role,
          status: form.status,
          permissions: form.permissions,
        }),
      });
      setForm({
        name: '',
        username: '',
        email: '',
        password: '',
        role: 'Viewer',
        status: 'Active',
        permissions: defaultPermissions('Viewer'),
      });
      await loadUsers();
    } catch (err) {
      setError((err as Error).message || 'Gagal menambah user.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const onDelete = async (user: UserItem) => {
    if (!window.confirm(`Hapus user "${user.username}"?`)) return;
    try {
      await apiFetch(`/api/admin/users/${user.id}`, { method: 'DELETE' });
      await loadUsers();
    } catch (err) {
      setError((err as Error).message || 'Gagal menghapus user.');
    }
  };

  const onResetPassword = async () => {
    if (!resetTarget) return;
    if (resetPassword.length < 8) {
      setError('Password baru minimal 8 karakter.');
      return;
    }
    try {
      await apiFetch(`/api/admin/users/${resetTarget.id}/reset-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          password: resetPassword,
          logout_sessions: true,
        }),
      });
      setResetTarget(null);
      setResetPassword('');
    } catch (err) {
      setError((err as Error).message || 'Gagal reset password.');
    }
  };

  return (
    <div className="min-h-screen bg-[#000a2e] px-4 py-6 text-slate-100 sm:px-6">
      <div className="mx-auto w-full max-w-[1400px] space-y-5">
        <header className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[#3158bb66] bg-[#0a1538]/85 p-4 backdrop-blur">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl border border-[#3158bb66] bg-[#112457]">
              <Users className="h-5 w-5 text-blue-200" />
            </span>
            <div>
              <h1 className="text-lg font-semibold">Kelola User (Auth 5174)</h1>
              <p className="text-sm text-slate-300">Source of truth user/permission terpusat di Auth.</p>
            </div>
          </div>
          <Button type="button" variant="outline" onClick={() => navigate('/portal-admin')}>
            Kembali Portal
          </Button>
        </header>

        <form onSubmit={onCreate} className="space-y-4 rounded-2xl border border-[#3158bb66] bg-[#0a1538]/85 p-4">
          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
            <Input placeholder="Nama lengkap" value={form.name} onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))} />
            <Input placeholder="Username" value={form.username} onChange={(e) => setForm((p) => ({ ...p, username: e.target.value }))} />
            <Input placeholder="Email (opsional)" value={form.email} onChange={(e) => setForm((p) => ({ ...p, email: e.target.value }))} />
            <Input type="password" placeholder="Password min 8 karakter" value={form.password} onChange={(e) => setForm((p) => ({ ...p, password: e.target.value }))} />
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            <label className="space-y-2 text-sm">
              <span className="text-slate-300">Role</span>
              <select
                className="h-10 w-full rounded-lg border border-[#3158bb66] bg-[#0f1e49] px-3"
                value={form.role}
                onChange={(e) => onRoleChange(e.target.value as 'Admin' | 'Viewer')}
              >
                <option value="Viewer">Viewer</option>
                <option value="Admin">Admin</option>
              </select>
            </label>
            <label className="space-y-2 text-sm">
              <span className="text-slate-300">Status</span>
              <select
                className="h-10 w-full rounded-lg border border-[#3158bb66] bg-[#0f1e49] px-3"
                value={form.status}
                onChange={(e) => setForm((p) => ({ ...p, status: e.target.value as 'Active' | 'Disabled' }))}
              >
                <option value="Active">Active</option>
                <option value="Disabled">Disabled</option>
              </select>
            </label>
          </div>

          <div className="grid gap-2 md:grid-cols-2 lg:grid-cols-4">
            {PERMISSION_LABELS.map((item) => (
              <label key={item.key} className="flex items-center gap-2 rounded-lg border border-[#3158bb66] px-3 py-2 text-sm">
                <Checkbox
                  checked={Boolean(form.permissions[item.key])}
                  onCheckedChange={(checked) =>
                    setForm((prev) => ({
                      ...prev,
                      permissions: {
                        ...prev.permissions,
                        [item.key]: checked === true,
                      },
                    }))
                  }
                />
                <span>{item.label}</span>
              </label>
            ))}
          </div>

          <Button type="submit" disabled={!canSubmit || isSubmitting} className="gap-2">
            <UserPlus className="h-4 w-4" />
            {isSubmitting ? 'Menyimpan...' : 'Tambah User'}
          </Button>
        </form>

        {error ? (
          <div className="rounded-xl border border-red-500/50 bg-red-500/10 px-4 py-3 text-sm text-red-200">{error}</div>
        ) : null}

        <section className="overflow-x-auto rounded-2xl border border-[#3158bb66] bg-[#0a1538]/85">
          <table className="min-w-full text-sm">
            <thead className="bg-[#132a67] text-left text-slate-200">
              <tr>
                <th className="px-3 py-2">Username</th>
                <th className="px-3 py-2">Email</th>
                <th className="px-3 py-2">Role</th>
                <th className="px-3 py-2">Status</th>
                <th className="px-3 py-2">Service</th>
                <th className="px-3 py-2 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td className="px-3 py-4 text-slate-300" colSpan={6}>Memuat data...</td></tr>
              ) : users.length === 0 ? (
                <tr><td className="px-3 py-4 text-slate-300" colSpan={6}>Belum ada user.</td></tr>
              ) : (
                users.map((user) => (
                  <tr key={user.id} className="border-t border-[#3158bb55]">
                    <td className="px-3 py-2">{user.username}</td>
                    <td className="px-3 py-2">{user.email || '-'}</td>
                    <td className="px-3 py-2">{user.role}</td>
                    <td className="px-3 py-2">{user.status}</td>
                    <td className="px-3 py-2">
                      {[
                        user.permissions.can_access_k2s_dashboard && 'K2S',
                        user.permissions.can_access_logbook && 'Logbook',
                        user.permissions.can_access_k3 && 'K3',
                        user.permissions.can_access_keamanan && 'Keamanan',
                      ].filter(Boolean).join(', ') || '-'}
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex justify-end gap-2">
                        <Button type="button" variant="outline" size="sm" onClick={() => setResetTarget(user)}>
                          <KeyRound className="h-4 w-4" />
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          disabled={user.id === selfUserId}
                          onClick={() => onDelete(user)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </section>

        {resetTarget ? (
          <div className="rounded-2xl border border-[#3158bb66] bg-[#0a1538]/95 p-4">
            <h2 className="mb-3 text-sm font-semibold">Reset password: {resetTarget.username}</h2>
            <div className="flex flex-wrap items-center gap-2">
              <Input
                className="max-w-sm"
                type="password"
                value={resetPassword}
                placeholder="Password baru minimal 8 karakter"
                onChange={(e) => setResetPassword(e.target.value)}
              />
              <Button type="button" onClick={onResetPassword}>
                Simpan Password
              </Button>
              <Button type="button" variant="outline" onClick={() => { setResetTarget(null); setResetPassword(''); }}>
                Batal
              </Button>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}

