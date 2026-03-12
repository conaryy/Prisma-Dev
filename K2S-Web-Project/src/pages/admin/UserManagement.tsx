import { useEffect, useState } from 'react';
import { Eye, EyeOff, KeyRound, Plus, Trash2, Users } from 'lucide-react';
import { Modal } from '@/components/shared/Modal';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { toast } from '@/hooks/use-toast';
import { apiFetch } from '@/lib/api';

type UserItem = {
  id: string;
  name: string;
  username: string | null;
  email: string | null;
  role: string;
  status: string;
  can_access_external_dnp?: boolean;
};

const ROLE_OPTIONS = ['Admin', 'Viewer'];
const STATUS_OPTIONS = ['Active', 'Disabled'];

export function UserManagement() {
  const [users, setUsers] = useState<UserItem[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showResetPassword, setShowResetPassword] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isResetModalOpen, setIsResetModalOpen] = useState(false);
  const [isResetting, setIsResetting] = useState(false);
  const [resetErrorMessage, setResetErrorMessage] = useState<string | null>(null);
  const [resetTargetUser, setResetTargetUser] = useState<UserItem | null>(null);
  const [resetForm, setResetForm] = useState({
    password: '',
    confirmPassword: '',
    logoutSessions: true,
  });
  const [form, setForm] = useState({
    name: '',
    username: '',
    email: '',
    password: '',
    role: 'Viewer',
    status: 'Active',
    canAccessExternalDnp: true,
  });

  const loadUsers = () => {
    apiFetch<{ data: UserItem[] }>('/api/users?limit=200')
      .then((response) => setUsers(response.data))
      .catch((error: Error) => setErrorMessage(error.message || 'Gagal memuat user.'));
  };

  useEffect(() => {
    loadUsers();
  }, []);

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setErrorMessage(null);
    setIsSubmitting(true);
    const payload = {
      ...form,
      email: form.email.trim() || null,
      username: form.username.trim(),
      can_access_external_dnp: form.canAccessExternalDnp,
    };
    apiFetch('/api/users', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
      .then(() => {
        setForm({
          name: '',
          username: '',
          email: '',
          password: '',
          role: 'Viewer',
          status: 'Active',
          canAccessExternalDnp: true,
        });
        loadUsers();
      })
      .catch((error: Error) => {
        setErrorMessage(error.message || 'Gagal membuat user.');
      })
      .finally(() => setIsSubmitting(false));
  };

  const handleDelete = (id: string) => {
    setErrorMessage(null);
    apiFetch(`/api/users/${id}`, { method: 'DELETE' })
      .then(() => loadUsers())
      .catch((error: Error) => {
        setErrorMessage(error.message || 'Gagal menghapus user.');
      });
  };

  const openResetModal = (user: UserItem) => {
    setResetTargetUser(user);
    setResetErrorMessage(null);
    setShowResetPassword(false);
    setResetForm({
      password: '',
      confirmPassword: '',
      logoutSessions: true,
    });
    setIsResetModalOpen(true);
  };

  const closeResetModal = () => {
    if (isResetting) {
      return;
    }
    setIsResetModalOpen(false);
    setResetTargetUser(null);
    setResetErrorMessage(null);
    setShowResetPassword(false);
    setResetForm({
      password: '',
      confirmPassword: '',
      logoutSessions: true,
    });
  };

  const handleResetPasswordSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!resetTargetUser) {
      return;
    }

    setResetErrorMessage(null);

    if (resetForm.password !== resetForm.confirmPassword) {
      setResetErrorMessage('Konfirmasi password tidak cocok.');
      return;
    }

    setIsResetting(true);
    apiFetch<{ data: { user: UserItem } }>(`/api/users/${resetTargetUser.id}/reset-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        password: resetForm.password,
        password_confirmation: resetForm.confirmPassword,
        logout_sessions: resetForm.logoutSessions,
      }),
    })
      .then((response) => {
        toast({
          title: 'Password berhasil direset',
          description: `Password baru untuk ${response.data.user.name} sudah disimpan.`,
        });
        closeResetModal();
      })
      .catch((error: Error) => {
        setResetErrorMessage(error.message || 'Gagal reset password user.');
      })
      .finally(() => setIsResetting(false));
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <span className="flex h-10 w-10 items-center justify-center rounded-xl border border-blue-200 bg-blue-50 text-blue-600 shadow-sm">
          <Users className="h-5 w-5" />
        </span>
        <div>
          <h1 className="text-xl font-semibold text-slate-800">Kelola User</h1>
          <p className="text-sm text-slate-500">
            Tambah user baru atau ubah aksesnya.
          </p>
        </div>
      </div>

      <form
        className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
        onSubmit={handleSubmit}
        autoComplete="off"
      >
        <div className="grid gap-4 md:grid-cols-2">
          <Input
            value={form.name}
            onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))}
            placeholder="Nama lengkap"
            required
            autoComplete="off"
          />
          <Input
            value={form.username}
            onChange={(event) =>
              setForm((prev) => ({ ...prev, username: event.target.value }))
            }
            placeholder="Username"
            required
            autoComplete="new-username"
          />
          <Input
            value={form.email}
            onChange={(event) => setForm((prev) => ({ ...prev, email: event.target.value }))}
            placeholder="Email (opsional)"
            autoComplete="off"
          />
          <div className="relative">
            <Input
              type={showPassword ? 'text' : 'password'}
              value={form.password}
              onChange={(event) =>
                setForm((prev) => ({ ...prev, password: event.target.value }))
              }
              placeholder="Password"
              required
              className="pr-10"
              autoComplete="new-password"
            />
            <button
              type="button"
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 transition hover:text-slate-700"
              onClick={() => setShowPassword((prev) => !prev)}
              aria-label={showPassword ? 'Sembunyikan password' : 'Tampilkan password'}
            >
              {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            <Select
              value={form.role}
              onValueChange={(value) => setForm((prev) => ({ ...prev, role: value }))}
            >
              <SelectTrigger>
                <SelectValue placeholder="Role" />
              </SelectTrigger>
              <SelectContent>
                {ROLE_OPTIONS.map((role) => (
                  <SelectItem key={role} value={role}>
                    {role}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select
              value={form.status}
              onValueChange={(value) => setForm((prev) => ({ ...prev, status: value }))}
            >
              <SelectTrigger>
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                {STATUS_OPTIONS.map((status) => (
                  <SelectItem key={status} value={status}>
                    {status}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <label className="flex items-center gap-2 text-sm text-slate-600">
            <Checkbox
              checked={form.canAccessExternalDnp}
              onCheckedChange={(checked) =>
                setForm((prev) => ({
                  ...prev,
                  canAccessExternalDnp: checked === true,
                }))
              }
            />
            Akses Menu External DNP
          </label>
        </div>

        <Button type="submit" disabled={isSubmitting} className="gap-2">
          <Plus className="h-4 w-4" />
          {isSubmitting ? 'Menyimpan...' : 'Tambah User'}
        </Button>

        {errorMessage && (
          <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {errorMessage}
          </div>
        )}
      </form>

      <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nama</TableHead>
              <TableHead>Username</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Role</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>External DNP</TableHead>
              <TableHead className="text-right">Aksi</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {users.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center text-sm text-slate-500">
                  Belum ada user.
                </TableCell>
              </TableRow>
            ) : (
              users.map((user) => (
                <TableRow key={user.id}>
                  <TableCell>{user.name}</TableCell>
                  <TableCell>{user.username || '-'}</TableCell>
                  <TableCell>{user.email || '-'}</TableCell>
                  <TableCell>{user.role}</TableCell>
                  <TableCell>{user.status}</TableCell>
                  <TableCell>
                    {user.can_access_external_dnp === false ? 'Tidak' : 'Ya'}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => openResetModal(user)}
                      aria-label={`Reset password ${user.name}`}
                      title="Reset password"
                    >
                      <KeyRound className="h-4 w-4 text-amber-500" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleDelete(user.id)}
                      aria-label="Hapus user"
                    >
                      <Trash2 className="h-4 w-4 text-red-500" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <Modal
        open={isResetModalOpen}
        onOpenChange={(open) => {
          if (!open) {
            closeResetModal();
          } else {
            setIsResetModalOpen(true);
          }
        }}
        title="Reset password user?"
        description={
          resetTargetUser
            ? `Isi password baru untuk ${resetTargetUser.name}${resetTargetUser.username ? ` (${resetTargetUser.username})` : ''}.`
            : 'Isi password baru user.'
        }
      >
        <form className="space-y-4" onSubmit={handleResetPasswordSubmit} autoComplete="off">
          <div className="space-y-2">
            <Input
              type={showResetPassword ? 'text' : 'password'}
              value={resetForm.password}
              onChange={(event) =>
                setResetForm((prev) => ({ ...prev, password: event.target.value }))
              }
              placeholder="Password baru"
              required
              minLength={8}
              autoComplete="new-password"
            />
            <Input
              type={showResetPassword ? 'text' : 'password'}
              value={resetForm.confirmPassword}
              onChange={(event) =>
                setResetForm((prev) => ({ ...prev, confirmPassword: event.target.value }))
              }
              placeholder="Konfirmasi password baru"
              required
              minLength={8}
              autoComplete="new-password"
            />
            <button
              type="button"
              className="inline-flex items-center gap-2 text-xs text-slate-500 transition hover:text-slate-700"
              onClick={() => setShowResetPassword((prev) => !prev)}
            >
              {showResetPassword ? (
                <>
                  <EyeOff className="h-3.5 w-3.5" />
                  Sembunyikan password
                </>
              ) : (
                <>
                  <Eye className="h-3.5 w-3.5" />
                  Tampilkan password
                </>
              )}
            </button>
            <label className="flex items-center gap-2 text-xs text-slate-600">
              <input
                type="checkbox"
                checked={resetForm.logoutSessions}
                onChange={(event) =>
                  setResetForm((prev) => ({
                    ...prev,
                    logoutSessions: event.target.checked,
                  }))
                }
                className="h-3.5 w-3.5 rounded border-slate-300"
              />
              Logout sesi login user setelah reset
            </label>
            {resetErrorMessage && (
              <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
                {resetErrorMessage}
              </div>
            )}
          </div>

          <div className="flex flex-wrap justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={closeResetModal}
              disabled={isResetting}
            >
              Batal
            </Button>
            <Button
              type="submit"
              className="bg-red-500 text-white hover:bg-red-600"
              disabled={isResetting}
            >
              {isResetting ? 'Menyimpan...' : 'Simpan Password Baru'}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
