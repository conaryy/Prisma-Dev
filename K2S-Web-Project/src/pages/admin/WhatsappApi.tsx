import { useEffect, useMemo, useState } from 'react';
import {
  Copy,
  Loader2,
  Plus,
  Send,
  Share2,
  Trash2,
} from 'lucide-react';
import { WhatsappSessionCard } from '@/components/admin/WhatsappSessionCard';
import { Badge } from '@/components/ui/badge';
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { toast } from '@/hooks/use-toast';
import { apiFetch } from '@/lib/api';

type SelectOption = {
  value: string;
  label: string;
};

type WhatsappOptionsResponse = {
  data: {
    options: {
      instansi: SelectOption[];
      scopes: SelectOption[];
      areas: SelectOption[];
      years: number[];
    };
  };
};

type FilterItem = {
  id: string;
  instansi: string;
  scope: string;
  year: string;
  area: string;
  compactSummary: boolean;
  compactSummaryTouched: boolean;
};

type PhoneEntry = {
  id: string;
  phoneNumber: string;
};

type DeliveryGroup = {
  id: string;
  phones: PhoneEntry[];
  draftPhoneNumber: string;
  items: FilterItem[];
};

type PreviewState = {
  loading: boolean;
  text: string;
  error: string | null;
};

type SendBatchResponse = {
  data: {
    queued: boolean;
    summary: {
      totalTargets: number;
    };
    message: string;
  };
};

type PreviewBatchResponse = {
  data: {
    text: string;
  };
};

const ALL_VALUE = 'all';

let localIdCounter = 0;

function createLocalId(prefix: string) {
  localIdCounter += 1;
  return `${prefix}-${localIdCounter}`;
}

function createEmptyFilterItem(): FilterItem {
  return {
    id: createLocalId('item'),
    instansi: ALL_VALUE,
    scope: ALL_VALUE,
    year: ALL_VALUE,
    area: ALL_VALUE,
    compactSummary: true,
    compactSummaryTouched: false,
  };
}

function createEmptyTarget(): DeliveryGroup {
  return {
    id: createLocalId('target'),
    phones: [],
    draftPhoneNumber: '',
    items: [createEmptyFilterItem()],
  };
}

interface FilterEditorProps {
  item: FilterItem;
  itemNumber: number;
  canRemove: boolean;
  onChange: (next: FilterItem) => void;
  onDuplicate: () => void;
  onRemove: () => void;
}

function FilterEditor({
  item,
  itemNumber,
  canRemove,
  onChange,
  onDuplicate,
  onRemove,
}: FilterEditorProps) {
  const [options, setOptions] = useState<WhatsappOptionsResponse['data']['options']>({
    instansi: [],
    scopes: [],
    areas: [],
    years: [],
  });
  const [isLoadingOptions, setIsLoadingOptions] = useState(true);
  const [optionsError, setOptionsError] = useState<string | null>(null);

  const shouldDefaultCompactSummary =
    item.instansi === ALL_VALUE || item.scope === ALL_VALUE;

  const syncCompactSummary = (nextItem: FilterItem) => {
    if (nextItem.compactSummaryTouched) {
      return nextItem;
    }

    return {
      ...nextItem,
      compactSummary: nextItem.instansi === ALL_VALUE || nextItem.scope === ALL_VALUE,
    };
  };

  useEffect(() => {
    setIsLoadingOptions(true);
    setOptionsError(null);

    const params = new URLSearchParams();
    if (item.instansi !== ALL_VALUE) {
      params.set('instansi', item.instansi);
    }
    if (item.scope !== ALL_VALUE) {
      params.set('scope', item.scope);
    }
    if (item.year !== ALL_VALUE) {
      params.set('year', item.year);
    }

    apiFetch<WhatsappOptionsResponse>(`/api/admin/whatsapp/options?${params.toString()}`)
      .then((response) => {
        setOptions(response.data.options);
      })
      .catch((error: Error) => {
        setOptionsError(error.message || 'Gagal memuat opsi filter.');
      })
      .finally(() => setIsLoadingOptions(false));
  }, [item.instansi, item.scope, item.year]);

  useEffect(() => {
    if (item.instansi !== ALL_VALUE && !options.instansi.some((option) => option.value === item.instansi)) {
      onChange(syncCompactSummary({ ...item, instansi: ALL_VALUE, area: ALL_VALUE }));
    }
  }, [item, onChange, options.instansi]);

  useEffect(() => {
    if (item.scope !== ALL_VALUE && !options.scopes.some((option) => option.value === item.scope)) {
      onChange(syncCompactSummary({ ...item, scope: ALL_VALUE, area: ALL_VALUE }));
    }
  }, [item, onChange, options.scopes]);

  useEffect(() => {
    if (item.year !== ALL_VALUE && !options.years.some((option) => String(option) === item.year)) {
      onChange(syncCompactSummary({ ...item, year: ALL_VALUE, area: ALL_VALUE }));
    }
  }, [item, onChange, options.years]);

  useEffect(() => {
    if (item.area !== ALL_VALUE && !options.areas.some((option) => option.value === item.area)) {
      onChange(syncCompactSummary({ ...item, area: ALL_VALUE }));
    }
  }, [item, onChange, options.areas]);

  const modeLabel = item.compactSummary
    ? 'Ringkasan temuan'
    : 'Daftar temuan per scope';

  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4 dark:border-slate-800 dark:bg-slate-900/60">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="text-sm font-semibold text-slate-800 dark:text-slate-100">
            Item Kirim {itemNumber}
          </div>
          <div className="text-xs text-slate-500 dark:text-slate-400">{modeLabel}</div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button type="button" size="sm" variant="outline" onClick={onDuplicate}>
            <Copy className="mr-2 h-4 w-4" />
            Duplikasi
          </Button>
          <Button type="button" size="sm" variant="outline" onClick={onRemove} disabled={!canRemove}>
            <Trash2 className="mr-2 h-4 w-4" />
            Hapus
          </Button>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="space-y-2">
          <label className="text-sm font-medium text-slate-700 dark:text-slate-200">Instansi</label>
          <Select
            value={item.instansi}
            onValueChange={(value) => onChange(syncCompactSummary({ ...item, instansi: value, area: ALL_VALUE }))}
          >
            <SelectTrigger>
              <SelectValue placeholder="Pilih instansi" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL_VALUE}>Semua instansi</SelectItem>
              {options.instansi.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium text-slate-700 dark:text-slate-200">Tahun</label>
          <Select
            value={item.year}
            onValueChange={(value) => onChange(syncCompactSummary({ ...item, year: value, area: ALL_VALUE }))}
          >
            <SelectTrigger>
              <SelectValue placeholder="Pilih tahun" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL_VALUE}>Semua tahun</SelectItem>
              {options.years.map((option) => (
                <SelectItem key={option} value={String(option)}>
                  {option}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium text-slate-700 dark:text-slate-200">Scope</label>
          <Select
            value={item.scope}
            onValueChange={(value) => onChange(syncCompactSummary({ ...item, scope: value, area: ALL_VALUE }))}
          >
            <SelectTrigger>
              <SelectValue placeholder="Pilih scope" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL_VALUE}>Semua scope</SelectItem>
              {options.scopes.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium text-slate-700 dark:text-slate-200">Area</label>
          <Select value={item.area} onValueChange={(value) => onChange(syncCompactSummary({ ...item, area: value }))}>
            <SelectTrigger>
              <SelectValue placeholder="Pilih area" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL_VALUE}>Semua area</SelectItem>
              {options.areas.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="mt-3 text-xs text-slate-500 dark:text-slate-400">
        {isLoadingOptions
          ? 'Memuat opsi filter...'
          : `${options.instansi.length} instansi, ${options.scopes.length} scope, ${options.areas.length} area tersedia.`}
      </div>
      <div className="mt-3 flex items-start gap-3 rounded-xl border border-slate-200 bg-white/70 px-3 py-3 dark:border-slate-800 dark:bg-slate-950/50">
        <Checkbox
          id={`compact-summary-${item.id}`}
          checked={item.compactSummary}
          onCheckedChange={(checked) => {
            const nextValue = checked === true;
            if (!nextValue && item.compactSummary) {
              const confirmed = window.confirm(
                'Jika Ringkas Temuan dimatikan, pesan WhatsApp bisa menjadi sangat panjang. Lanjut nonaktifkan?'
              );
              if (!confirmed) {
                return;
              }
            }

            onChange({
              ...item,
              compactSummary: nextValue,
              compactSummaryTouched: true,
            });
          }}
        />
        <div className="space-y-1">
          <label
            htmlFor={`compact-summary-${item.id}`}
            className="text-sm font-medium text-slate-700 dark:text-slate-200"
          >
            Ringkas Temuan
          </label>
          <div className="text-xs text-slate-500 dark:text-slate-400">
            Aktifkan untuk mengirim ringkasan format singkat. Default aktif saat semua instansi atau semua scope dipilih.
          </div>
          {shouldDefaultCompactSummary && !item.compactSummaryTouched ? (
            <div className="text-[11px] text-emerald-600 dark:text-emerald-300">
              Ringkasan aktif otomatis untuk kombinasi filter ini.
            </div>
          ) : null}
        </div>
      </div>
      {optionsError ? (
        <div className="mt-3 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-100">
          {optionsError}
        </div>
      ) : null}
    </div>
  );
}

export function WhatsappApi() {
  const [targets, setTargets] = useState<DeliveryGroup[]>([createEmptyTarget()]);
  const [previews, setPreviews] = useState<Record<string, PreviewState>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const totalItems = useMemo(
    () => targets.reduce((sum, target) => sum + target.items.length, 0),
    [targets]
  );
  const totalPhones = useMemo(
    () => targets.reduce((sum, target) => sum + target.phones.length, 0),
    [targets]
  );

  const updateTargetDraftPhone = (targetId: string, phoneNumber: string) => {
    setTargets((prev) =>
      prev.map((target) =>
        target.id === targetId
          ? {
              ...target,
              draftPhoneNumber: phoneNumber,
            }
          : target
      )
    );
  };

  const updateTargetItem = (targetId: string, itemId: string, nextItem: FilterItem) => {
    setTargets((prev) =>
      prev.map((target) =>
        target.id === targetId
          ? {
              ...target,
              items: target.items.map((item) => (item.id === itemId ? nextItem : item)),
            }
          : target
      )
    );
  };

  const removeTarget = (targetId: string) => {
    setTargets((prev) => (prev.length > 1 ? prev.filter((target) => target.id !== targetId) : prev));
  };

  const addTarget = () => {
    setTargets((prev) => [...prev, createEmptyTarget()]);
  };

  const addPhoneToTarget = (targetId: string) => {
    setTargets((prev) =>
      prev.map((target) => {
        if (target.id !== targetId) {
          return target;
        }

        const normalized = target.draftPhoneNumber.trim();
        if (!normalized) {
          return target;
        }

        const exists = target.phones.some((phone) => phone.phoneNumber === normalized);
        if (exists) {
          return {
            ...target,
            draftPhoneNumber: '',
          };
        }

        return {
          ...target,
          phones: [
            ...target.phones,
            {
              id: createLocalId('phone'),
              phoneNumber: normalized,
            },
          ],
          draftPhoneNumber: '',
        };
      })
    );
  };

  const removePhoneFromTarget = (targetId: string, phoneId: string) => {
    setTargets((prev) =>
      prev.map((target) =>
        target.id === targetId
          ? { ...target, phones: target.phones.filter((phone) => phone.id !== phoneId) }
          : target
      )
    );
  };

  const addItemToTarget = (targetId: string) => {
    setTargets((prev) =>
      prev.map((target) =>
        target.id === targetId
          ? { ...target, items: [...target.items, createEmptyFilterItem()] }
          : target
      )
    );
  };

  const duplicateItemInTarget = (targetId: string, itemId: string) => {
    setTargets((prev) =>
      prev.map((target) => {
        if (target.id !== targetId) {
          return target;
        }

        const source = target.items.find((item) => item.id === itemId);
        if (!source) {
          return target;
        }

        return {
          ...target,
          items: [
            ...target.items,
            {
              ...source,
              id: createLocalId('item'),
            },
          ],
        };
      })
    );
  };

  const removeItemFromTarget = (targetId: string, itemId: string) => {
    setTargets((prev) =>
      prev.map((target) =>
        target.id === targetId && target.items.length > 1
          ? { ...target, items: target.items.filter((item) => item.id !== itemId) }
          : target
      )
    );
  };

  const handlePreview = (targetId: string) => {
    const target = targets.find((item) => item.id === targetId);
    if (!target) {
      return;
    }

    setPreviews((prev) => ({
      ...prev,
      [targetId]: {
        loading: true,
        text: prev[targetId]?.text ?? '',
        error: null,
      },
    }));

    apiFetch<PreviewBatchResponse>('/api/admin/whatsapp/preview-batch', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        items: target.items.map((item) => ({
          instansi: item.instansi === ALL_VALUE ? null : item.instansi,
          scope: item.scope,
          year: item.year === ALL_VALUE ? null : Number(item.year),
          area: item.area === ALL_VALUE ? null : item.area,
          compactSummary: item.compactSummary,
        })),
      }),
    })
      .then((response) => {
        setPreviews((prev) => ({
          ...prev,
          [targetId]: {
            loading: false,
            text: response.data.text,
            error: null,
          },
        }));
      })
      .catch((error: Error) => {
        setPreviews((prev) => ({
          ...prev,
          [targetId]: {
            loading: false,
            text: prev[targetId]?.text ?? '',
            error: error.message || 'Gagal membuat preview pesan.',
          },
        }));
      });
  };

  const handleClosePreview = (targetId: string) => {
    setPreviews((prev) => {
      if (!prev[targetId]) {
        return prev;
      }

      return {
        ...prev,
        [targetId]: {
          loading: false,
          text: '',
          error: null,
        },
      };
    });
  };

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setErrorMessage(null);
    setIsSubmitting(true);

    apiFetch<SendBatchResponse>('/api/admin/whatsapp/send-batch', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        targets: targets.flatMap((target) =>
          target.phones.map((phone) => ({
            phoneNumber: phone.phoneNumber.trim(),
            items: target.items.map((item) => ({
              instansi: item.instansi === ALL_VALUE ? null : item.instansi,
              scope: item.scope,
              year: item.year === ALL_VALUE ? null : Number(item.year),
              area: item.area === ALL_VALUE ? null : item.area,
              compactSummary: item.compactSummary,
            })),
          }))
        ),
      }),
    })
      .then((response) => {
        const summary = response.data.summary;
        toast({
          title: 'Batch WhatsApp masuk antrean',
          description: response.data.message || `${summary.totalTargets} nomor sedang diproses melalui queue.`,
        });
        setErrorMessage(null);
      })
      .catch((error: Error) => {
        setErrorMessage(error.message || 'Gagal mengirim batch WhatsApp.');
      })
      .finally(() => setIsSubmitting(false));
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <span className="flex h-10 w-10 items-center justify-center rounded-xl border border-emerald-200 bg-emerald-50 text-emerald-600 shadow-sm dark:border-emerald-500/40 dark:bg-emerald-500/15 dark:text-emerald-200">
          <Share2 className="h-5 w-5" />
        </span>
        <div>
          <h1 className="text-xl font-semibold text-slate-800 dark:text-slate-100">
            WhatsApp API - External DNP
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-300">
            Kelola sesi WAHA dan kirim beberapa paket temuan External DNP ke beberapa nomor sekaligus.
          </p>
        </div>
      </div>

      <WhatsappSessionCard />

      <Card className="border-slate-200 bg-white shadow-sm dark:border-blue-500/35 dark:bg-slate-950/70 dark:shadow-[0_18px_40px_rgba(2,6,23,0.5)]">
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <CardTitle>Pengaturan Batch Kirim</CardTitle>
              <CardDescription>
                Satu pengiriman bisa memiliki beberapa nomor tujuan dan beberapa item kirim dengan filter yang berbeda.
              </CardDescription>
            </div>
            <Button type="button" onClick={addTarget}>
              <Plus className="mr-2 h-4 w-4" />
              Tambah Pengiriman Lain
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <form className="space-y-6" onSubmit={handleSubmit}>
            {targets.map((target, targetIndex) => (
              <div
                key={target.id}
                className="rounded-[28px] border border-slate-200 bg-slate-50/50 p-5 dark:border-slate-800 dark:bg-slate-900/50"
              >
                <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <div className="text-lg font-semibold text-slate-800 dark:text-slate-100">
                      Pengiriman {targetIndex + 1}
                    </div>
                    <div className="text-sm text-slate-500 dark:text-slate-400">
                      {target.phones.length} nomor tujuan, {target.items.length} item kirim
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button type="button" size="sm" variant="outline" onClick={() => removeTarget(target.id)} disabled={targets.length <= 1}>
                      <Trash2 className="mr-2 h-4 w-4" />
                      Hapus Pengiriman
                    </Button>
                  </div>
                </div>

                <div className="mb-4 space-y-2">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <label className="text-sm font-medium text-slate-700 dark:text-slate-200">Nomor WhatsApp</label>
                    <Button type="button" size="sm" variant="outline" onClick={() => addPhoneToTarget(target.id)}>
                      <Plus className="mr-2 h-4 w-4" />
                      Tambah Nomor Baru
                    </Button>
                  </div>
                  <Input
                    value={target.draftPhoneNumber}
                    onChange={(event) => updateTargetDraftPhone(target.id, event.target.value)}
                    placeholder="62812345678"
                    inputMode="numeric"
                  />
                  {target.phones.length > 0 && (
                    <div className="flex flex-wrap gap-2 pt-1">
                      {target.phones.map((phone) => (
                        <Badge
                          key={phone.id}
                          variant="outline"
                          className="gap-2 rounded-full border-slate-600 bg-slate-900/30 px-3 py-1 text-sm text-slate-100"
                        >
                          <span>{phone.phoneNumber}</span>
                          <button
                            type="button"
                            className="text-rose-400 transition hover:text-rose-300"
                            onClick={() => removePhoneFromTarget(target.id, phone.id)}
                          >
                            x
                          </button>
                        </Badge>
                      ))}
                    </div>
                  )}
                  <div className="text-xs text-slate-500 dark:text-slate-400">
                    Ketik nomor lalu klik `Tambah Nomor Baru` untuk menyimpannya ke daftar nomor tujuan pengiriman ini.
                  </div>
                </div>

                <div className="space-y-4">
                  {target.items.map((item, itemIndex) => (
                    <FilterEditor
                      key={item.id}
                      item={item}
                      itemNumber={itemIndex + 1}
                      canRemove={target.items.length > 1}
                      onChange={(nextItem) => updateTargetItem(target.id, item.id, nextItem)}
                      onDuplicate={() => duplicateItemInTarget(target.id, item.id)}
                      onRemove={() => removeItemFromTarget(target.id, item.id)}
                    />
                  ))}
                </div>

                <div className="mt-4">
                  <div className="flex flex-wrap gap-3">
                    <Button type="button" variant="outline" onClick={() => addItemToTarget(target.id)}>
                      <Plus className="mr-2 h-4 w-4" />
                      Tambah Item Kirim
                    </Button>
                    <Button type="button" variant="outline" onClick={() => handlePreview(target.id)}>
                      {previews[target.id]?.loading ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      ) : (
                        <Send className="mr-2 h-4 w-4" />
                      )}
                      Preview Pesan
                    </Button>
                  </div>
                </div>

                {previews[target.id]?.error ? (
                  <div className="mt-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-100">
                    {previews[target.id]?.error}
                  </div>
                ) : null}

                {previews[target.id]?.text ? (
                  <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-950/70 p-4 dark:border-slate-800">
                    <div className="mb-3 flex items-center justify-between gap-3">
                      <div className="text-sm font-semibold text-slate-100">Preview Pesan</div>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => handleClosePreview(target.id)}
                      >
                        Tutup
                      </Button>
                    </div>
                    <pre className="whitespace-pre-wrap break-words text-sm leading-6 text-slate-200">
                      {previews[target.id]?.text}
                    </pre>
                  </div>
                ) : null}
              </div>
            ))}

            {errorMessage ? (
              <div className="whitespace-pre-line rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-100">
                {errorMessage}
              </div>
            ) : null}

            <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600 dark:border-slate-800 dark:bg-slate-900/80 dark:text-slate-300">
              <div>
                {targets.length} pengiriman, {totalPhones} nomor tujuan, {totalItems} item kirim.
              </div>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Send className="mr-2 h-4 w-4" />
                )}
                Kirim Semua
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
