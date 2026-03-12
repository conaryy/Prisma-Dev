import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { useAppData } from '@/contexts/AppDataContext';
import { FormField, FormSection } from '@/components/shared/Form';
import { InstansiProfile } from '@/types/kks';

const inputBaseClass =
  'flex h-10 w-full rounded-xl border border-input bg-white/80 px-3 text-sm shadow-sm transition-colors duration-200 focus-visible:outline-none focus-visible:border-blue-300 focus-visible:ring-2 focus-visible:ring-blue-200 disabled:cursor-not-allowed disabled:opacity-50';

const defaultForm: InstansiProfile = {
  facilityGroup: '',
  kobu: '',
  bandara: '',
  cabangAirnav: '',
  name: '',
  alias: '',
  address: '',
  contactName: '',
  contactEmail: '',
  contactPhone: '',
  fax: '',
  postalCode: '',
  longitude: '',
  latitude: '',
  serviceArea: '',
  operatingHours: '',
  trafficType: '',
  runwayCapacity: '',
  runwayCondition: '',
  location: '',
};

export function Instansi() {
  const { instansi, updateInstansi } = useAppData();
  const [form, setForm] = useState<InstansiProfile>(() => ({
    ...defaultForm,
    ...instansi,
  }));
  const [isEditing, setIsEditing] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    setForm({ ...defaultForm, ...instansi });
  }, [instansi]);

  const handleChange = (key: keyof InstansiProfile, value: string) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const validate = () => {
    const nextErrors: Record<string, string> = {};
    if (!form.facilityGroup.trim()) {
      nextErrors.facilityGroup = 'Kelompok fasilitas wajib diisi.';
    }
    if (!form.kobu.trim()) nextErrors.kobu = 'KOBU wajib diisi.';
    if (!form.bandara.trim()) nextErrors.bandara = 'Bandara wajib diisi.';
    if (!form.cabangAirnav.trim()) {
      nextErrors.cabangAirnav = 'Cabang Airnav wajib diisi.';
    }
    if (!form.name.trim()) nextErrors.name = 'Nama instansi wajib diisi.';
    if (form.contactEmail.trim() && !form.contactEmail.includes('@')) {
      nextErrors.contactEmail = 'Format email tidak valid.';
    }
    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const handleSave = () => {
    if (!validate()) return;
    updateInstansi(form);
    setIsEditing(false);
  };

  const handleCancel = () => {
    setForm({ ...defaultForm, ...instansi });
    setErrors({});
    setIsEditing(false);
  };

  const profileTitle = 'Profil';

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-slate-800">{profileTitle}</h1>
          <p className="text-sm text-slate-500">
            Kelola data profil instansi.
          </p>
        </div>
        {isEditing ? (
          <div className="flex gap-2">
            <Button variant="outline" onClick={handleCancel}>
              Batal
            </Button>
            <Button onClick={handleSave}>Simpan</Button>
          </div>
        ) : (
          <Button onClick={() => setIsEditing(true)}>Edit Profil</Button>
        )}
      </div>

      <FormSection>
        <div className="grid gap-6 lg:grid-cols-2">
          <div className="space-y-4">
            <FormField
              label="Kelompok Fasilitas"
              required
              error={errors.facilityGroup}
            >
              <Input
                className={inputBaseClass}
                value={form.facilityGroup}
                onChange={(event) =>
                  handleChange('facilityGroup', event.target.value)
                }
                disabled={!isEditing}
              />
            </FormField>

            <FormField label="KOBU" required error={errors.kobu}>
              <Input
                className={inputBaseClass}
                value={form.kobu}
                onChange={(event) => handleChange('kobu', event.target.value)}
                disabled={!isEditing}
              />
            </FormField>

            <FormField label="Bandara" required error={errors.bandara}>
              <Input
                className={inputBaseClass}
                value={form.bandara}
                onChange={(event) => handleChange('bandara', event.target.value)}
                disabled={!isEditing}
              />
            </FormField>

            <FormField
              label="Cabang Airnav"
              required
              error={errors.cabangAirnav}
            >
              <Input
                className={inputBaseClass}
                value={form.cabangAirnav}
                onChange={(event) =>
                  handleChange('cabangAirnav', event.target.value)
                }
                disabled={!isEditing}
              />
            </FormField>

            <FormField label="Nama" required error={errors.name}>
              <Input
                value={form.name}
                onChange={(event) => handleChange('name', event.target.value)}
                disabled={!isEditing}
              />
            </FormField>

            <FormField label="Alias">
              <Input
                value={form.alias}
                onChange={(event) => handleChange('alias', event.target.value)}
                disabled={!isEditing}
              />
            </FormField>

            <FormField label="Nomor Telepon">
              <Input
                value={form.contactPhone}
                onChange={(event) => handleChange('contactPhone', event.target.value)}
                disabled={!isEditing}
              />
            </FormField>

            <FormField label="No Fax.">
              <Input
                value={form.fax}
                onChange={(event) => handleChange('fax', event.target.value)}
                disabled={!isEditing}
              />
            </FormField>

            <FormField label="Kode Pos">
              <Input
                value={form.postalCode}
                onChange={(event) => handleChange('postalCode', event.target.value)}
                disabled={!isEditing}
              />
            </FormField>

            <FormField label="Longitude">
              <Input
                value={form.longitude}
                onChange={(event) => handleChange('longitude', event.target.value)}
                disabled={!isEditing}
              />
            </FormField>

            <FormField label="Latitude">
              <Input
                value={form.latitude}
                onChange={(event) => handleChange('latitude', event.target.value)}
                disabled={!isEditing}
              />
            </FormField>

            <FormField label="Area Pelayanan">
              <Input
                value={form.serviceArea}
                onChange={(event) => handleChange('serviceArea', event.target.value)}
                disabled={!isEditing}
              />
            </FormField>
          </div>

          <div className="space-y-4">
            <FormField label="Jam Operasi">
              <Input
                value={form.operatingHours}
                onChange={(event) =>
                  handleChange('operatingHours', event.target.value)
                }
                disabled={!isEditing}
              />
            </FormField>

            <FormField label="Type of traffic permitted">
              <Input
                value={form.trafficType}
                onChange={(event) => handleChange('trafficType', event.target.value)}
                disabled={!isEditing}
              />
            </FormField>

            <FormField label="Runway Capacity">
              <Input
                value={form.runwayCapacity}
                onChange={(event) =>
                  handleChange('runwayCapacity', event.target.value)
                }
                disabled={!isEditing}
              />
            </FormField>

            <FormField label="Runway Condition">
              <Input
                value={form.runwayCondition}
                onChange={(event) =>
                  handleChange('runwayCondition', event.target.value)
                }
                disabled={!isEditing}
              />
            </FormField>

            <FormField label="Email" error={errors.contactEmail}>
              <Input
                type="email"
                value={form.contactEmail}
                onChange={(event) =>
                  handleChange('contactEmail', event.target.value)
                }
                disabled={!isEditing}
              />
            </FormField>

            <FormField label="Lokasi Lokasi">
              <Input
                className={inputBaseClass}
                value={form.location}
                onChange={(event) => handleChange('location', event.target.value)}
                disabled={!isEditing}
              />
            </FormField>

            <FormField label="Alamat">
              <Textarea
                rows={5}
                value={form.address}
                onChange={(event) => handleChange('address', event.target.value)}
                disabled={!isEditing}
              />
            </FormField>
          </div>
        </div>
      </FormSection>
    </div>
  );
}
