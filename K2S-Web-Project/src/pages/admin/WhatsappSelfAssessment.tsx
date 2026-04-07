import { useEffect, useMemo, useState } from 'react';
import { Loader2, MessageSquareMore, Plus, Save, Send, Trash2 } from 'lucide-react';
import { WhatsappSessionCard } from '@/components/admin/WhatsappSessionCard';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { apiFetch } from '@/lib/api';
import { toast } from '@/hooks/use-toast';

type PanelSetting = {
  key: string;
  label: string;
  description: string;
  audience: 'admin' | 'user';
  usesPhoneNumbers: boolean;
  enabled: boolean;
  phoneNumbers: string[];
};

type PanelState = PanelSetting & {
  draftPhoneNumber: string;
};

type UserRecipient = {
  id: string;
  phoneNumber: string;
  userIds: string[];
};

type UserOption = {
  id: string;
  name: string;
  username?: string | null;
  email?: string | null;
  phone?: string | null;
};

type PanelResponse = {
  data: {
    panels: PanelSetting[];
    previews: Array<{
      key: string;
      text: string;
    }>;
    userRecipients: UserRecipient[];
    users: UserOption[];
  };
};

const createLocalRecipientId = () =>
  typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID()
    : `recipient-${Date.now()}-${Math.random().toString(36).slice(2)}`;

export function WhatsappSelfAssessment() {
  const [panels, setPanels] = useState<PanelState[]>([]);
  const [previews, setPreviews] = useState<Record<string, string>>({});
  const [openPreviews, setOpenPreviews] = useState<Record<string, boolean>>({});
  const [userRecipients, setUserRecipients] = useState<UserRecipient[]>([]);
  const [userOptions, setUserOptions] = useState<UserOption[]>([]);
  const [recipientDraftPhoneNumber, setRecipientDraftPhoneNumber] = useState('');
  const [recipientDraftUserIds, setRecipientDraftUserIds] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const totalNumbers = useMemo(
    () => panels.reduce((sum, panel) => sum + panel.phoneNumbers.length, 0),
    [panels]
  );
  const adminPanels = useMemo(
    () => panels.filter((panel) => panel.audience === 'admin'),
    [panels]
  );
  const userPanels = useMemo(
    () => panels.filter((panel) => panel.audience === 'user'),
    [panels]
  );
  const usersWithPhone = useMemo(
    () => userOptions.filter((user) => (user.phone ?? '').trim() !== ''),
    [userOptions]
  );
  const usersWithoutPhone = useMemo(
    () => userOptions.filter((user) => (user.phone ?? '').trim() === ''),
    [userOptions]
  );

  const loadSettings = () => {
    setIsLoading(true);
    setErrorMessage(null);

    apiFetch<PanelResponse>('/api/admin/whatsapp/self-assessment/settings')
      .then((response) => {
        setPanels(
          response.data.panels.map((panel) => ({
            ...panel,
            draftPhoneNumber: '',
          }))
        );
        setPreviews(
          Object.fromEntries(response.data.previews.map((item) => [item.key, item.text]))
        );
        setUserRecipients(response.data.userRecipients ?? []);
        setUserOptions(response.data.users ?? []);
        setRecipientDraftPhoneNumber('');
        setRecipientDraftUserIds([]);
      })
      .catch((error: Error) => {
        setErrorMessage(error.message || 'Gagal memuat pengaturan WhatsApp Self Assessment.');
      })
      .finally(() => setIsLoading(false));
  };

  useEffect(() => {
    loadSettings();
  }, []);

  const updateDraft = (panelKey: string, value: string) => {
    setPanels((prev) =>
      prev.map((panel) =>
        panel.key === panelKey
          ? {
              ...panel,
              draftPhoneNumber: value,
            }
          : panel
      )
    );
  };

  const updateEnabled = (panelKey: string, enabled: boolean) => {
    setPanels((prev) =>
      prev.map((panel) =>
        panel.key === panelKey
          ? {
              ...panel,
              enabled,
            }
          : panel
      )
    );
  };

  const addPhoneNumber = (panelKey: string) => {
    setPanels((prev) =>
      prev.map((panel) => {
        if (panel.key !== panelKey) {
          return panel;
        }

        const digits = panel.draftPhoneNumber.replace(/\D+/g, '').trim();
        if (!digits) {
          return panel;
        }

        if (panel.phoneNumbers.includes(digits)) {
          return {
            ...panel,
            draftPhoneNumber: '',
          };
        }

        return {
          ...panel,
          phoneNumbers: [...panel.phoneNumbers, digits],
          draftPhoneNumber: '',
        };
      })
    );
  };

  const removePhoneNumber = (panelKey: string, phoneNumber: string) => {
    setPanels((prev) =>
      prev.map((panel) =>
        panel.key === panelKey
          ? {
              ...panel,
              phoneNumbers: panel.phoneNumbers.filter((item) => item !== phoneNumber),
            }
          : panel
      )
    );
  };

  const toggleDraftRecipientUser = (userId: string, enabled: boolean) => {
    setRecipientDraftUserIds((prev) =>
      enabled ? Array.from(new Set([...prev, userId])) : prev.filter((item) => item !== userId)
    );
  };

  const addUserRecipient = () => {
    const digits = recipientDraftPhoneNumber.replace(/\D+/g, '').trim();
    if (!digits || recipientDraftUserIds.length === 0) {
      return;
    }

    setUserRecipients((prev) => {
      const existingIndex = prev.findIndex((item) => item.phoneNumber === digits);
      if (existingIndex >= 0) {
        const next = [...prev];
        next[existingIndex] = {
          ...next[existingIndex],
          userIds: Array.from(new Set([...next[existingIndex].userIds, ...recipientDraftUserIds])),
        };
        return next;
      }

      return [
        ...prev,
        {
          id: createLocalRecipientId(),
          phoneNumber: digits,
          userIds: recipientDraftUserIds,
        },
      ];
    });

    setRecipientDraftPhoneNumber('');
    setRecipientDraftUserIds([]);
  };

  const removeUserRecipient = (recipientId: string) => {
    setUserRecipients((prev) => prev.filter((item) => item.id !== recipientId));
  };

  const saveSettings = () => {
    setIsSaving(true);
    setErrorMessage(null);

    apiFetch<PanelResponse>('/api/admin/whatsapp/self-assessment/settings', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        panels: panels.map((panel) => ({
          key: panel.key,
          enabled: panel.enabled,
          phoneNumbers: panel.phoneNumbers,
        })),
        userRecipients: userRecipients.map((recipient) => ({
          id: recipient.id,
          phoneNumber: recipient.phoneNumber,
          userIds: recipient.userIds,
        })),
      }),
    })
      .then((response) => {
        setPanels(
          response.data.panels.map((panel) => ({
            ...panel,
            draftPhoneNumber: '',
          }))
        );
        setPreviews(
          Object.fromEntries(response.data.previews.map((item) => [item.key, item.text]))
        );
        setUserRecipients(response.data.userRecipients ?? []);
        setUserOptions(response.data.users ?? []);
        setRecipientDraftPhoneNumber('');
        setRecipientDraftUserIds([]);
        toast({
          title: 'Pengaturan tersimpan',
          description: 'Nomor notifikasi WhatsApp Self Assessment berhasil diperbarui.',
        });
      })
      .catch((error: Error) => {
        setErrorMessage(error.message || 'Gagal menyimpan pengaturan WhatsApp.');
      })
      .finally(() => setIsSaving(false));
  };

  const handleOpenPreview = (panelKey: string) => {
    setOpenPreviews((prev) => ({
      ...prev,
      [panelKey]: true,
    }));
  };

  const handleClosePreview = (panelKey: string) => {
    setOpenPreviews((prev) => ({
      ...prev,
      [panelKey]: false,
    }));
  };

  const resolveUserLabels = (userIds: string[]) =>
    userIds
      .map((userId) => userOptions.find((item) => item.id === userId))
      .filter((item): item is UserOption => Boolean(item))
      .map((item) => item.name);

  const renderUserChecklist = (items: UserOption[]) => (
    <div className="space-y-2">
      {items.map((user) => {
        const checked = recipientDraftUserIds.includes(user.id);
        return (
          <label
            key={user.id}
            className="flex items-start gap-3 rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm text-slate-700 dark:border-slate-800 dark:bg-slate-950/60 dark:text-slate-200"
          >
            <Checkbox
              checked={checked}
              onCheckedChange={(value) => toggleDraftRecipientUser(user.id, value === true)}
            />
            <div className="space-y-1">
              <div className="font-medium text-slate-800 dark:text-slate-100">{user.name}</div>
              <div className="text-xs text-slate-500 dark:text-slate-400">
                {[user.username, user.email].filter(Boolean).join(' • ') || 'Tanpa identitas tambahan'}
              </div>
              <div className="text-xs text-slate-500 dark:text-slate-400">
                {user.phone ? `Nomor user: ${user.phone}` : 'Nomor user belum diisi'}
              </div>
            </div>
          </label>
        );
      })}
    </div>
  );

  const recipientDraftValid =
    recipientDraftPhoneNumber.replace(/\D+/g, '').trim() !== '' && recipientDraftUserIds.length > 0;

  const userPanelEnabledCount = userPanels.filter((panel) => panel.enabled).length;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <span className="flex h-10 w-10 items-center justify-center rounded-xl border border-blue-200 bg-blue-50 text-blue-600 shadow-sm dark:border-blue-500/40 dark:bg-blue-500/15 dark:text-blue-200">
          <MessageSquareMore className="h-5 w-5" />
        </span>
        <div>
          <h1 className="text-xl font-semibold text-slate-800 dark:text-slate-100">
            WhatsApp API - Self Assessment
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-300">
            Atur notifikasi admin dan user.
          </p>
        </div>
      </div>

      <WhatsappSessionCard />

      <Card className="border-slate-200 bg-white shadow-sm dark:border-blue-500/35 dark:bg-slate-950/70 dark:shadow-[0_18px_40px_rgba(2,6,23,0.5)]">
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <CardTitle>Panel Notifikasi WhatsApp Admin</CardTitle>
              <CardDescription>
                Tentukan nomor tujuan untuk tiap panel notifikasi Self Assessment lokal.
              </CardDescription>
            </div>
            <Button type="button" onClick={saveSettings} disabled={isLoading || isSaving}>
              {isSaving ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Save className="mr-2 h-4 w-4" />
              )}
              Simpan Pengaturan
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="rounded-2xl border border-slate-200 bg-slate-50/80 p-4 text-sm text-slate-600 dark:border-slate-800 dark:bg-slate-900/60 dark:text-slate-300">
            <div className="font-semibold text-slate-800 dark:text-slate-100">
              {totalNumbers} nomor aktif di seluruh panel admin
            </div>
            <div className="mt-1">
              Scope `monitoring` akan masuk panel `Monitoring`. Scope lain akan mengikuti panel masing-masing:
              `Self Assessment`, `Penyusunan CAP`, dan `Pemenuhan CAP`.
            </div>
          </div>

          {errorMessage ? (
            <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-100">
              {errorMessage}
            </div>
          ) : null}

          {isLoading ? (
            <div className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50/80 px-4 py-4 text-sm text-slate-600 dark:border-slate-800 dark:bg-slate-900/60 dark:text-slate-300">
              <Loader2 className="h-4 w-4 animate-spin" />
              Memuat pengaturan panel WhatsApp...
            </div>
          ) : (
            <div className="grid gap-4 xl:grid-cols-2">
              {adminPanels.map((panel) => (
                <div
                  key={panel.key}
                  className="rounded-[28px] border border-slate-200 bg-slate-50/60 p-5 dark:border-slate-800 dark:bg-slate-900/50"
                >
                  <div className="mb-4">
                    <div className="text-lg font-semibold text-slate-800 dark:text-slate-100">
                      {panel.label}
                    </div>
                    <div className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                      {panel.description}
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <label className="text-sm font-medium text-slate-700 dark:text-slate-200">
                      Nomor Tujuan
                    </label>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => addPhoneNumber(panel.key)}
                    >
                      <Plus className="mr-2 h-4 w-4" />
                      Tambah Nomor
                    </Button>
                  </div>

                  <div className="mt-3">
                    <Input
                      value={panel.draftPhoneNumber}
                      onChange={(event) => updateDraft(panel.key, event.target.value)}
                      placeholder="628123456789"
                      inputMode="numeric"
                    />
                  </div>

                  {panel.phoneNumbers.length > 0 ? (
                    <div className="mt-4 flex flex-wrap gap-2">
                      {panel.phoneNumbers.map((phoneNumber) => (
                        <div
                          key={`${panel.key}-${phoneNumber}`}
                          className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 dark:border-slate-700 dark:bg-slate-950/70 dark:text-slate-200"
                        >
                          <span>{phoneNumber}</span>
                          <button
                            type="button"
                            className="text-slate-400 transition-colors hover:text-rose-500"
                            onClick={() => removePhoneNumber(panel.key, phoneNumber)}
                            aria-label={`Hapus ${phoneNumber}`}
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="mt-4 rounded-2xl border border-dashed border-slate-300 px-4 py-4 text-sm text-slate-500 dark:border-slate-700 dark:text-slate-400">
                      Belum ada nomor tujuan untuk panel ini.
                    </div>
                  )}

                  <div className="mt-4">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => handleOpenPreview(panel.key)}
                    >
                      <Send className="mr-2 h-4 w-4" />
                      Preview Pesan
                    </Button>
                  </div>

                  {openPreviews[panel.key] ? (
                    <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-950/70 p-4 dark:border-slate-800">
                      <div className="mb-3 flex items-center justify-between gap-3">
                        <div className="text-sm font-semibold text-slate-100">Preview Pesan</div>
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          onClick={() => handleClosePreview(panel.key)}
                        >
                          Tutup
                        </Button>
                      </div>
                      <pre className="whitespace-pre-wrap break-words text-sm leading-6 text-slate-200">
                        {previews[panel.key] || 'Preview belum tersedia.'}
                      </pre>
                    </div>
                  ) : null}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="border-slate-200 bg-white shadow-sm dark:border-blue-500/35 dark:bg-slate-950/70 dark:shadow-[0_18px_40px_rgba(2,6,23,0.5)]">
        <CardHeader>
          <CardTitle>Panel Notifikasi WhatsApp User</CardTitle>
          <CardDescription>
            Notifikasi user ke nomor profil. Nomor lain bisa dijadikan tujuan per user.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {isLoading ? (
            <div className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50/80 px-4 py-4 text-sm text-slate-600 dark:border-slate-800 dark:bg-slate-900/60 dark:text-slate-300">
              <Loader2 className="h-4 w-4 animate-spin" />
              Memuat pengaturan panel user...
            </div>
          ) : (
            <>
              <div className="rounded-[28px] border border-slate-200 bg-slate-50/60 p-5 dark:border-slate-800 dark:bg-slate-900/50">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <div className="text-base font-semibold text-slate-800 dark:text-slate-100">
                      Notifikasi User
                    </div>
                    <div className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                      Nomor ini ikut menerima notifikasi user yang dipilih.
                    </div>
                  </div>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={addUserRecipient}
                    disabled={!recipientDraftValid}
                  >
                    <Plus className="mr-2 h-4 w-4" />
                    Tambah Nomor
                  </Button>
                </div>

                <div className="mt-4 grid gap-4 xl:grid-cols-[minmax(0,280px)_1fr]">
                  <div className="space-y-3">
                    <div>
                      <label className="text-sm font-medium text-slate-700 dark:text-slate-200">
                        Nomor Notif User
                      </label>
                      <div className="mt-2">
                        <Input
                          value={recipientDraftPhoneNumber}
                          onChange={(event) => setRecipientDraftPhoneNumber(event.target.value)}
                          placeholder="628123456789"
                          inputMode="numeric"
                        />
                      </div>
                    </div>
                    <div className="rounded-2xl border border-slate-200 bg-white/80 px-4 py-3 text-sm text-slate-600 dark:border-slate-800 dark:bg-slate-950/50 dark:text-slate-300">
                      <div className="font-semibold text-slate-800 dark:text-slate-100">
                        {userRecipients.length} nomor user aktif
                      </div>
                      <div className="mt-1">
                        {userRecipients.reduce((sum, item) => sum + item.userIds.length, 0)} relasi user tersimpan
                      </div>
                      <div className="mt-1">
                        {recipientDraftUserIds.length === 0
                          ? 'Belum ada user dipilih'
                          : `${recipientDraftUserIds.length} user dipilih`}
                      </div>
                    </div>
                    {!recipientDraftValid &&
                    (recipientDraftPhoneNumber.trim() !== '' || recipientDraftUserIds.length > 0) ? (
                      <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-100">
                        Isi nomor `628...` dan pilih minimal satu user sebelum menambah nomor.
                      </div>
                    ) : null}
                  </div>

                  <div className="rounded-2xl border border-slate-200 bg-white/80 p-4 dark:border-slate-800 dark:bg-slate-950/50">
                    <div className="grid gap-4 lg:grid-cols-2">
                      <div className="space-y-3">
                        <div className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">
                          User Dengan Nomor
                        </div>
                        <div className="max-h-72 overflow-y-auto pr-1">
                          {usersWithPhone.length > 0 ? (
                            renderUserChecklist(usersWithPhone)
                          ) : (
                            <div className="rounded-2xl border border-dashed border-slate-300 px-4 py-4 text-sm text-slate-500 dark:border-slate-700 dark:text-slate-400">
                              Belum ada user dengan nomor profil.
                            </div>
                          )}
                        </div>
                      </div>

                      <div className="space-y-3">
                        <div className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">
                          User Tanpa Nomor
                        </div>
                        <div className="max-h-72 overflow-y-auto pr-1">
                          {usersWithoutPhone.length > 0 ? (
                            renderUserChecklist(usersWithoutPhone)
                          ) : (
                            <div className="rounded-2xl border border-dashed border-slate-300 px-4 py-4 text-sm text-slate-500 dark:border-slate-700 dark:text-slate-400">
                              Semua user sudah punya nomor profil.
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {userRecipients.length > 0 ? (
                  <div className="mt-4 grid gap-3 lg:grid-cols-2">
                    {userRecipients.map((recipient) => {
                      const labels = resolveUserLabels(recipient.userIds);
                      return (
                        <div
                          key={recipient.id}
                          className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-950/60"
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <div className="text-sm font-semibold text-slate-800 dark:text-slate-100">
                                {recipient.phoneNumber}
                              </div>
                              <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                                Menerima notif untuk {recipient.userIds.length} user
                              </div>
                            </div>
                            <button
                              type="button"
                              className="text-slate-400 transition-colors hover:text-rose-500"
                              onClick={() => removeUserRecipient(recipient.id)}
                              aria-label={`Hapus ${recipient.phoneNumber}`}
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>

                          <div className="mt-3 flex flex-wrap gap-2">
                            {(labels.length > 0 ? labels : recipient.userIds).map((label) => (
                              <span
                                key={`${recipient.id}-${label}`}
                                className="inline-flex items-center rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-medium text-slate-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300"
                              >
                                {label}
                              </span>
                            ))}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="mt-4 rounded-2xl border border-dashed border-slate-300 px-4 py-4 text-sm text-slate-500 dark:border-slate-700 dark:text-slate-400">
                    Belum ada nomor notif non-user yang dikaitkan ke user tertentu.
                  </div>
                )}
              </div>

              <div className="rounded-[28px] border border-slate-200 bg-slate-50/60 p-5 dark:border-slate-800 dark:bg-slate-900/50">
                <div className="text-base font-semibold text-slate-800 dark:text-slate-100">
                  Pengiriman Ke User
                </div>
                <div className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                  {userPanelEnabledCount} dari {userPanels.length} panel user aktif. Pengiriman utama selalu mengacu ke nomor WhatsApp pada profil user.
                </div>
              </div>

              {userPanels.map((panel) => (
                <div
                  key={panel.key}
                  className="rounded-[28px] border border-slate-200 bg-slate-50/60 p-5 dark:border-slate-800 dark:bg-slate-900/50"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="space-y-1">
                      <div className="text-base font-semibold text-slate-800 dark:text-slate-100">
                        {panel.label}
                      </div>
                      <div className="text-sm text-slate-500 dark:text-slate-400">
                        {panel.description}
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-sm text-slate-500 dark:text-slate-400">
                        {panel.enabled ? 'Aktif' : 'Nonaktif'}
                      </span>
                      <Switch
                        checked={panel.enabled}
                        onCheckedChange={(checked) => updateEnabled(panel.key, checked === true)}
                      />
                    </div>
                  </div>

                  <div className="mt-4">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => handleOpenPreview(panel.key)}
                    >
                      <Send className="mr-2 h-4 w-4" />
                      Preview Pesan
                    </Button>
                  </div>

                  {openPreviews[panel.key] ? (
                    <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-950/70 p-4 dark:border-slate-800">
                      <div className="mb-3 flex items-center justify-between gap-3">
                        <div className="text-sm font-semibold text-slate-100">Preview Pesan</div>
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          onClick={() => handleClosePreview(panel.key)}
                        >
                          Tutup
                        </Button>
                      </div>
                      <pre className="whitespace-pre-wrap break-words text-sm leading-6 text-slate-200">
                        {previews[panel.key] || 'Preview belum tersedia.'}
                      </pre>
                    </div>
                  ) : null}
                </div>
              ))}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
