import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import {
  AgendaItem,
  AuditItem,
  FacilityItem,
  FacilityGroupItem,
  FacilityCondition,
  Finding,
  FollowUp,
  InspectionItem,
  InstansiProfile,
  MonitoringItem,
  OrganizationItem,
  OrganizationStatus,
  PersonilItem,
  CertificateEvidenceType,
  CertificateItem,
  CertificateStatus,
  SourceType,
} from '@/types/kks';
import {
  seedAgenda,
  seedAudits,
  seedFacilities,
  seedFindings,
  seedFollowUps,
  seedInspections,
  seedInstansi,
  seedMonitoring,
  seedOrganizations,
  seedPersonil,
  seedCertificates,
} from '@/data/seed';
import { STORAGE_KEYS, scopedStorageKey } from '@/lib/storage';
import { useLocalStorageState } from '@/hooks/useLocalStorage';
import { apiFetch, getAuthToken, getAuthUser } from '@/lib/api';

interface AppDataContextType {
  instansi: InstansiProfile;
  facilities: FacilityItem[];
  facilityGroups: FacilityGroupItem[];
  organizations: OrganizationItem[];
  personil: PersonilItem[];
  certificates: CertificateItem[];
  agenda: AgendaItem[];
  audits: AuditItem[];
  inspections: InspectionItem[];
  monitoring: MonitoringItem[];
  findings: Finding[];
  followUps: FollowUp[];
  updateInstansi: (changes: Partial<InstansiProfile>) => void;
  addFacility: (item: Omit<FacilityItem, 'id'>) => void;
  updateFacility: (id: string, changes: Partial<FacilityItem>) => void;
  removeFacility: (id: string) => void;
  addFacilityGroup: (name: string) => Promise<FacilityGroupItem | null>;
  removeFacilityGroup: (id: string) => Promise<boolean>;
  addOrganization: (item: Omit<OrganizationItem, 'id'>) => void;
  updateOrganization: (id: string, changes: Partial<OrganizationItem>) => void;
  removeOrganization: (id: string) => void;
  addPersonil: (item: Omit<PersonilItem, 'id'>) => void;
  updatePersonil: (id: string, changes: Partial<PersonilItem>) => void;
  removePersonil: (id: string) => void;
  addCertificate: (
    item: Omit<CertificateItem, 'id'> & { file?: File | null }
  ) => void;
  updateCertificate: (
    id: string,
    changes: Partial<CertificateItem> & { file?: File | null }
  ) => void;
  removeCertificate: (id: string) => void;
  addAgenda: (item: Omit<AgendaItem, 'id'>) => void;
  updateAgenda: (id: string, changes: Partial<AgendaItem>) => void;
  removeAgenda: (id: string) => void;
  addAudit: (item: Omit<AuditItem, 'id'>) => void;
  updateAudit: (id: string, changes: Partial<AuditItem>) => void;
  removeAudit: (id: string) => void;
  addInspection: (item: Omit<InspectionItem, 'id'>) => void;
  updateInspection: (id: string, changes: Partial<InspectionItem>) => void;
  removeInspection: (id: string) => void;
  addMonitoring: (item: Omit<MonitoringItem, 'id'>) => void;
  updateMonitoring: (id: string, changes: Partial<MonitoringItem>) => void;
  removeMonitoring: (id: string) => void;
  addFinding: (item: Omit<Finding, 'id' | 'createdAt' | 'updatedAt'>) => void;
  updateFinding: (id: string, changes: Partial<Finding>) => void;
  removeFinding: (id: string) => void;
  addFollowUp: (
    item: Omit<FollowUp, 'id' | 'history' | 'createdAt' | 'updatedAt'> & {
      note?: string;
    }
  ) => void;
  updateFollowUp: (id: string, changes: Partial<FollowUp>) => void;
  removeFollowUp: (id: string) => void;
  addFollowUpHistory: (id: string, note: string) => void;
  apiError: string | null;
  clearApiError: () => void;
}

const AppDataContext = createContext<AppDataContextType | undefined>(undefined);

const nowISO = () => new Date().toISOString();
const noteStamp = (note: string) => `${new Date().toISOString()} - ${note}`;

const mapInstansiFromApi = (data: Record<string, unknown>): InstansiProfile => ({
  id: data.id as string,
  facilityGroup: (data.facility_group ?? data.facilityGroup ?? '') as string,
  kobu: (data.kobu ?? '') as string,
  bandara: (data.bandara ?? '') as string,
  cabangAirnav: (data.cabang_airnav ?? data.cabangAirnav ?? '') as string,
  name: (data.name ?? '') as string,
  alias: (data.alias ?? '') as string,
  address: (data.address ?? '') as string,
  contactName: (data.contact_name ?? data.contactName ?? '') as string,
  contactEmail: (data.contact_email ?? data.contactEmail ?? '') as string,
  contactPhone: (data.contact_phone ?? data.contactPhone ?? '') as string,
  fax: (data.fax ?? '') as string,
  postalCode: (data.postal_code ?? data.postalCode ?? '') as string,
  longitude: (data.longitude ?? '') as string,
  latitude: (data.latitude ?? '') as string,
  serviceArea: (data.service_area ?? data.serviceArea ?? '') as string,
  operatingHours: (data.operating_hours ?? data.operatingHours ?? '') as string,
  trafficType: (data.traffic_type ?? data.trafficType ?? '') as string,
  runwayCapacity: (data.runway_capacity ?? data.runwayCapacity ?? '') as string,
  runwayCondition: (data.runway_condition ?? data.runwayCondition ?? '') as string,
  location: (data.location ?? '') as string,
});

const mapFacilityFromApi = (data: Record<string, unknown>): FacilityItem => ({
  id: data.id as string,
  group: (data.facility_group ?? data.group ?? '') as string,
  name: (data.name ?? '') as string,
  merk: (data.merk ?? '') as string,
  type: (data.type ?? '') as string,
  frequency: (data.frequency ?? '') as string,
  ident: (data.ident ?? '') as string,
  condition: (data.condition_status ?? data.condition ?? 'Normal') as FacilityCondition,
});

const mapFacilityGroupFromApi = (
  data: Record<string, unknown>
): FacilityGroupItem => ({
  id: data.id as string,
  name: (data.name ?? '') as string,
});

const mapOrganizationFromApi = (data: Record<string, unknown>): OrganizationItem => ({
  id: data.id as string,
  unitName: (data.unit_name ?? data.unitName ?? '') as string,
  positionName: (data.position_name ?? data.positionName ?? '') as string,
  level: (data.level ?? '') as string,
  status: (data.status ?? 'Aktif') as OrganizationStatus,
});

const mapPersonilFromApi = (data: Record<string, unknown>): PersonilItem => ({
  id: data.id as string,
  name: (data.name ?? '') as string,
  position: (data.position ?? '') as string,
  level: (data.level ?? '') as string,
  field: (data.field_name ?? data.field ?? '') as string,
  tier: (data.tier ?? '') as string,
});

const mapCertificateFromApi = (data: Record<string, unknown>): CertificateItem => ({
  id: data.id as string,
  name: (data.name ?? '') as string,
  type: (data.type ?? '') as string,
  number: (data.number ?? '') as string,
  validUntil: (data.valid_until ?? data.validUntil ?? '') as string,
  status: (data.status ?? 'Berlaku') as CertificateStatus,
  evidenceType: (data.evidence_type ?? data.evidenceType ?? 'Sertifikat Non Evidence') as CertificateEvidenceType,
  fileName: (data.file_name ?? data.fileName ?? '') as string,
  fileUrl: (data.file_url ?? data.fileUrl ?? '') as string,
});

const normalizeDate = (value: unknown) => {
  const raw = typeof value === 'string' ? value : '';
  if (!raw) {
    return '';
  }
  return raw.length > 10 ? raw.slice(0, 10) : raw;
};

const mapAuditFromApi = (data: Record<string, unknown>): AuditItem => ({
  id: data.id as string,
  number: (data.number ?? '') as string,
  date: normalizeDate(data.date),
  location: (data.location ?? '') as string,
  status: (data.status ?? '') as string,
  focus: (data.focus ?? '') as string,
});

const mapAgendaFromApi = (data: Record<string, unknown>): AgendaItem => ({
  id: data.id as string,
  date: normalizeDate(data.date),
  activityType: (data.activity_type ?? data.activityType ?? '') as string,
  location: (data.location ?? '') as string,
  status: (data.status ?? '') as string,
});

const mapInspectionFromApi = (data: Record<string, unknown>): InspectionItem => ({
  id: data.id as string,
  number: (data.number ?? '') as string,
  date: normalizeDate(data.date),
  location: (data.location ?? '') as string,
  status: (data.status ?? '') as string,
  unit: (data.unit ?? '') as string,
});

const mapMonitoringFromApi = (data: Record<string, unknown>): MonitoringItem => ({
  id: data.id as string,
  date: normalizeDate(data.date),
  location: (data.location ?? '') as string,
  status: (data.status ?? '') as string,
  note: (data.note ?? '') as string,
});

const mapFindingFromApi = (data: Record<string, unknown>): Finding => ({
  id: data.id as string,
  sumber: (data.source_type ?? data.sourceType ?? 'Audit') as SourceType,
  sumberId: (data.source_id ?? data.sourceId ?? '') as string,
  kategori: (data.kategori ?? '') as string,
  deskripsi: (data.deskripsi ?? '') as string,
  severity: (data.severity ?? 'Low') as Finding['severity'],
  status: (data.status ?? 'Open') as Finding['status'],
  dueDate: normalizeDate(data.due_date ?? data.dueDate),
  createdAt: (data.created_at ?? data.createdAt ?? nowISO()) as string,
  updatedAt: (data.updated_at ?? data.updatedAt ?? nowISO()) as string,
});

const mapFollowUpFromApi = (data: Record<string, unknown>): FollowUp => ({
  id: data.id as string,
  findingId: (data.finding_id ?? data.findingId ?? '') as string,
  aksiPerbaikan: (data.aksi_perbaikan ?? data.aksiPerbaikan ?? '') as string,
  pic: (data.pic ?? '') as string,
  targetDate: normalizeDate(data.target_date ?? data.targetDate),
  status: (data.status ?? 'Open') as FollowUp['status'],
  evidenceFiles: [],
  history: [],
  createdAt: (data.created_at ?? data.createdAt ?? nowISO()) as string,
  updatedAt: (data.updated_at ?? data.updatedAt ?? nowISO()) as string,
});

export function AppDataProvider({ children }: { children: ReactNode }) {
  const authUser = getAuthUser<{ id?: string; email?: string; username?: string }>();
  const storageScope = authUser?.id ?? authUser?.email ?? authUser?.username ?? null;

  const [instansiState, setInstansiState] = useLocalStorageState(
    scopedStorageKey(STORAGE_KEYS.instansi, storageScope),
    seedInstansi
  );
  const [facilities, setFacilities] = useLocalStorageState(
    scopedStorageKey(STORAGE_KEYS.facilities, storageScope),
    seedFacilities
  );
  const [facilityGroups, setFacilityGroups] = useState<FacilityGroupItem[]>([]);
  const [organizations, setOrganizations] = useLocalStorageState(
    scopedStorageKey(STORAGE_KEYS.organizations, storageScope),
    seedOrganizations
  );
  const [personil, setPersonil] = useLocalStorageState(
    scopedStorageKey(STORAGE_KEYS.personil, storageScope),
    seedPersonil
  );
  const [certificates, setCertificates] = useLocalStorageState(
    scopedStorageKey(STORAGE_KEYS.certificates, storageScope),
    seedCertificates
  );
  const [agenda, setAgenda] = useLocalStorageState(
    scopedStorageKey(STORAGE_KEYS.agenda, storageScope),
    seedAgenda
  );
  const [audits, setAudits] = useLocalStorageState(
    scopedStorageKey(STORAGE_KEYS.audits, storageScope),
    seedAudits
  );
  const [inspections, setInspections] = useLocalStorageState(
    scopedStorageKey(STORAGE_KEYS.inspections, storageScope),
    seedInspections
  );
  const [monitoring, setMonitoring] = useLocalStorageState(
    scopedStorageKey(STORAGE_KEYS.monitoring, storageScope),
    seedMonitoring
  );
  const [findings, setFindings] = useLocalStorageState(
    scopedStorageKey(STORAGE_KEYS.findings, storageScope),
    seedFindings
  );
  const [followUps, setFollowUps] = useLocalStorageState(
    scopedStorageKey(STORAGE_KEYS.followUps, storageScope),
    seedFollowUps
  );
  const [apiError, setApiError] = useState<string | null>(null);

  const clearApiError = () => setApiError(null);

  const handleApiError = (action: string, error: unknown) => {
    const message =
      error instanceof Error && error.message ? error.message : 'Request failed.';
    setApiError(`${action}: ${message}`);
  };

  useEffect(() => {
    const token = getAuthToken();
    if (!token) {
      return;
    }

    const load = async () => {
      try {
        const [
          instansiRes,
          facilitiesRes,
          facilityGroupsRes,
          organizationsRes,
          personilRes,
          certificatesRes,
          auditsRes,
          agendaRes,
          inspectionsRes,
          monitoringRes,
          findingsRes,
          followUpsRes,
        ] = await Promise.all([
          apiFetch<{ data: Array<Record<string, unknown>> }>('/api/instansi?limit=200'),
          apiFetch<{ data: Array<Record<string, unknown>> }>('/api/facilities?limit=500'),
          apiFetch<{ data: Array<Record<string, unknown>> }>('/api/facility-groups?limit=500'),
          apiFetch<{ data: Array<Record<string, unknown>> }>('/api/organizations?limit=500'),
          apiFetch<{ data: Array<Record<string, unknown>> }>('/api/personil?limit=500'),
          apiFetch<{ data: Array<Record<string, unknown>> }>('/api/certificates?limit=500'),
          apiFetch<{ data: Array<Record<string, unknown>> }>('/api/audits?limit=500'),
          apiFetch<{ data: Array<Record<string, unknown>> }>('/api/agenda?limit=500'),
          apiFetch<{ data: Array<Record<string, unknown>> }>('/api/inspections?limit=500'),
          apiFetch<{ data: Array<Record<string, unknown>> }>('/api/monitoring?limit=500'),
          apiFetch<{ data: Array<Record<string, unknown>> }>('/api/findings?limit=500'),
          apiFetch<{ data: Array<Record<string, unknown>> }>('/api/follow-ups?limit=500'),
        ]);

        if (instansiRes.data?.length) {
          setInstansiState(mapInstansiFromApi(instansiRes.data[0]));
        }
        if (facilitiesRes.data) {
          setFacilities(facilitiesRes.data.map(mapFacilityFromApi));
        }
        if (facilityGroupsRes.data) {
          setFacilityGroups(facilityGroupsRes.data.map(mapFacilityGroupFromApi));
        }
        if (organizationsRes.data) {
          setOrganizations(organizationsRes.data.map(mapOrganizationFromApi));
        }
        if (personilRes.data) {
          setPersonil(personilRes.data.map(mapPersonilFromApi));
        }
        if (certificatesRes.data) {
          setCertificates(certificatesRes.data.map(mapCertificateFromApi));
        }
        if (auditsRes.data) {
          setAudits(auditsRes.data.map(mapAuditFromApi));
        }
        if (agendaRes.data) {
          setAgenda(agendaRes.data.map(mapAgendaFromApi));
        }
        if (inspectionsRes.data) {
          setInspections(inspectionsRes.data.map(mapInspectionFromApi));
        }
        if (monitoringRes.data) {
          setMonitoring(monitoringRes.data.map(mapMonitoringFromApi));
        }
        if (findingsRes.data) {
          setFindings(findingsRes.data.map(mapFindingFromApi));
        }
        if (followUpsRes.data) {
          setFollowUps(followUpsRes.data.map(mapFollowUpFromApi));
        }
      } catch (error) {
        console.warn('Failed to sync data from API', error);
        handleApiError('Sync data gagal', error);
      }
    };

    void load();
  }, [
    setInstansiState,
    setFacilities,
    setFacilityGroups,
    setOrganizations,
    setPersonil,
    setCertificates,
    setAudits,
    setAgenda,
    setInspections,
    setMonitoring,
    setFindings,
    setFollowUps,
  ]);

  const instansi = { ...seedInstansi, ...instansiState };

  const updateInstansi = (changes: Partial<InstansiProfile>) => {
    const token = getAuthToken();
    if (!token) {
      console.warn('Missing auth token, instansi update skipped.');
      return;
    }

    const next = { ...instansi, ...changes };

    const payload = {
      facilityGroup: next.facilityGroup,
      kobu: next.kobu,
      bandara: next.bandara,
      cabangAirnav: next.cabangAirnav,
      name: next.name,
      alias: next.alias,
      address: next.address,
      contactName: next.contactName,
      contactEmail: next.contactEmail,
      contactPhone: next.contactPhone,
      fax: next.fax,
      postalCode: next.postalCode,
      longitude: next.longitude,
      latitude: next.latitude,
      serviceArea: next.serviceArea,
      operatingHours: next.operatingHours,
      trafficType: next.trafficType,
      runwayCapacity: next.runwayCapacity,
      runwayCondition: next.runwayCondition,
      location: next.location,
    };

    void (async () => {
      try {
        if (next.id) {
          const response = await apiFetch<{ data: Record<string, unknown> }>(
            `/api/instansi/${next.id}`,
            {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
            }
          );
          setInstansiState(mapInstansiFromApi(response.data));
        } else {
          const response = await apiFetch<{ data: Record<string, unknown> }>('/api/instansi', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
          });
          setInstansiState(mapInstansiFromApi(response.data));
        }
      } catch (error) {
        console.warn('Failed to update instansi', error);
        handleApiError('Update instansi gagal', error);
      }
    })();
  };

  const addFacility = (item: Omit<FacilityItem, 'id'>) => {
    const token = getAuthToken();
    if (!token) {
      console.warn('Missing auth token, facility add skipped.');
      return;
    }

    void (async () => {
      try {
        await apiFetch<{ data: Record<string, unknown> }>('/api/facilities', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            group: item.group,
            name: item.name,
            merk: item.merk,
            type: item.type,
            frequency: item.frequency,
            ident: item.ident,
            condition: item.condition,
            instansiId: instansi.id ?? null,
          }),
        });
        const refreshed = await apiFetch<{ data: Array<Record<string, unknown>> }>(
          '/api/facilities?limit=500'
        );
        setFacilities(refreshed.data.map(mapFacilityFromApi));
      } catch (error) {
        console.warn('Failed to add facility', error);
        handleApiError('Tambah fasilitas gagal', error);
      }
    })();
  };

  const updateFacility = (id: string, changes: Partial<FacilityItem>) => {
    const token = getAuthToken();
    if (!token) {
      console.warn('Missing auth token, facility update skipped.');
      return;
    }

    void (async () => {
      try {
        await apiFetch<{ data: Record<string, unknown> }>(`/api/facilities/${id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            group: changes.group,
            name: changes.name,
            merk: changes.merk,
            type: changes.type,
            frequency: changes.frequency,
            ident: changes.ident,
            condition: changes.condition,
            instansiId: instansi.id ?? null,
          }),
        });
        const refreshed = await apiFetch<{ data: Array<Record<string, unknown>> }>(
          '/api/facilities?limit=500'
        );
        setFacilities(refreshed.data.map(mapFacilityFromApi));
      } catch (error) {
        console.warn('Failed to update facility', error);
        handleApiError('Update fasilitas gagal', error);
      }
    })();
  };

  const removeFacility = (id: string) => {
    const token = getAuthToken();
    if (!token) {
      console.warn('Missing auth token, facility delete skipped.');
      return;
    }

    void (async () => {
      try {
        await apiFetch(`/api/facilities/${id}`, { method: 'DELETE' });
        const refreshed = await apiFetch<{ data: Array<Record<string, unknown>> }>(
          '/api/facilities?limit=500'
        );
        setFacilities(refreshed.data.map(mapFacilityFromApi));
      } catch (error) {
        console.warn('Failed to remove facility', error);
        handleApiError('Hapus fasilitas gagal', error);
      }
    })();
  };

  const addFacilityGroup = async (name: string) => {
    const token = getAuthToken();
    if (!token) {
      console.warn('Missing auth token, facility group add skipped.');
      return null;
    }

    try {
      const response = await apiFetch<{ data: Record<string, unknown> }>(
        '/api/facility-groups',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name }),
        }
      );
      const nextGroup = mapFacilityGroupFromApi(response.data);
      setFacilityGroups((prev) =>
        [...prev.filter((group) => group.id !== nextGroup.id), nextGroup].sort((left, right) =>
          left.name.localeCompare(right.name, 'id-ID')
        )
      );
      return nextGroup;
    } catch (error) {
      console.warn('Failed to add facility group', error);
      handleApiError('Tambah kelompok fasilitas gagal', error);
      return null;
    }
  };

  const removeFacilityGroup = async (id: string) => {
    const token = getAuthToken();
    if (!token) {
      console.warn('Missing auth token, facility group delete skipped.');
      return false;
    }

    try {
      await apiFetch(`/api/facility-groups/${id}`, { method: 'DELETE' });
      const [refreshedFacilities, refreshedGroups] = await Promise.all([
        apiFetch<{ data: Array<Record<string, unknown>> }>('/api/facilities?limit=500'),
        apiFetch<{ data: Array<Record<string, unknown>> }>('/api/facility-groups?limit=500'),
      ]);
      setFacilities(refreshedFacilities.data.map(mapFacilityFromApi));
      setFacilityGroups(refreshedGroups.data.map(mapFacilityGroupFromApi));
      return true;
    } catch (error) {
      console.warn('Failed to remove facility group', error);
      handleApiError('Hapus kelompok fasilitas gagal', error);
      return false;
    }
  };

  const addOrganization = (item: Omit<OrganizationItem, 'id'>) => {
    const token = getAuthToken();
    if (!token) {
      console.warn('Missing auth token, organization add skipped.');
      return;
    }

    void (async () => {
      try {
        await apiFetch<{ data: Record<string, unknown> }>('/api/organizations', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            unitName: item.unitName,
            positionName: item.positionName,
            level: item.level,
            status: item.status,
            instansiId: instansi.id ?? null,
          }),
        });
        const refreshed = await apiFetch<{ data: Array<Record<string, unknown>> }>(
          '/api/organizations?limit=500'
        );
        setOrganizations(refreshed.data.map(mapOrganizationFromApi));
      } catch (error) {
        console.warn('Failed to add organization', error);
        handleApiError('Tambah organisasi gagal', error);
      }
    })();
  };

  const updateOrganization = (id: string, changes: Partial<OrganizationItem>) => {
    const token = getAuthToken();
    if (!token) {
      console.warn('Missing auth token, organization update skipped.');
      return;
    }

    void (async () => {
      try {
        await apiFetch<{ data: Record<string, unknown> }>(`/api/organizations/${id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            unitName: changes.unitName,
            positionName: changes.positionName,
            level: changes.level,
            status: changes.status,
            instansiId: instansi.id ?? null,
          }),
        });
        const refreshed = await apiFetch<{ data: Array<Record<string, unknown>> }>(
          '/api/organizations?limit=500'
        );
        setOrganizations(refreshed.data.map(mapOrganizationFromApi));
      } catch (error) {
        console.warn('Failed to update organization', error);
        handleApiError('Update organisasi gagal', error);
      }
    })();
  };

  const removeOrganization = (id: string) => {
    const token = getAuthToken();
    if (!token) {
      console.warn('Missing auth token, organization delete skipped.');
      return;
    }

    void (async () => {
      try {
        await apiFetch(`/api/organizations/${id}`, { method: 'DELETE' });
        const refreshed = await apiFetch<{ data: Array<Record<string, unknown>> }>(
          '/api/organizations?limit=500'
        );
        setOrganizations(refreshed.data.map(mapOrganizationFromApi));
      } catch (error) {
        console.warn('Failed to remove organization', error);
        handleApiError('Hapus organisasi gagal', error);
      }
    })();
  };

  const addPersonil = (item: Omit<PersonilItem, 'id'>) => {
    const token = getAuthToken();
    if (!token) {
      console.warn('Missing auth token, personil add skipped.');
      return;
    }

    void (async () => {
      try {
        await apiFetch<{ data: Record<string, unknown> }>('/api/personil', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: item.name,
            position: item.position,
            level: item.level,
            field: item.field,
            tier: item.tier,
            instansiId: instansi.id ?? null,
          }),
        });
        const refreshed = await apiFetch<{ data: Array<Record<string, unknown>> }>(
          '/api/personil?limit=500'
        );
        setPersonil(refreshed.data.map(mapPersonilFromApi));
      } catch (error) {
        console.warn('Failed to add personil', error);
        handleApiError('Tambah personil gagal', error);
      }
    })();
  };

  const updatePersonil = (id: string, changes: Partial<PersonilItem>) => {
    const token = getAuthToken();
    if (!token) {
      console.warn('Missing auth token, personil update skipped.');
      return;
    }

    void (async () => {
      try {
        await apiFetch<{ data: Record<string, unknown> }>(`/api/personil/${id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: changes.name,
            position: changes.position,
            level: changes.level,
            field: changes.field,
            tier: changes.tier,
            instansiId: instansi.id ?? null,
          }),
        });
        const refreshed = await apiFetch<{ data: Array<Record<string, unknown>> }>(
          '/api/personil?limit=500'
        );
        setPersonil(refreshed.data.map(mapPersonilFromApi));
      } catch (error) {
        console.warn('Failed to update personil', error);
        handleApiError('Update personil gagal', error);
      }
    })();
  };

  const removePersonil = (id: string) => {
    const token = getAuthToken();
    if (!token) {
      console.warn('Missing auth token, personil delete skipped.');
      return;
    }

    void (async () => {
      try {
        await apiFetch(`/api/personil/${id}`, { method: 'DELETE' });
        const refreshed = await apiFetch<{ data: Array<Record<string, unknown>> }>(
          '/api/personil?limit=500'
        );
        setPersonil(refreshed.data.map(mapPersonilFromApi));
      } catch (error) {
        console.warn('Failed to remove personil', error);
        handleApiError('Hapus personil gagal', error);
      }
    })();
  };

  const addCertificate = (item: Omit<CertificateItem, 'id'> & { file?: File | null }) => {
    const token = getAuthToken();
    if (!token) {
      console.warn('Missing auth token, certificate add skipped.');
      return;
    }

    void (async () => {
      try {
        const formData = new FormData();
        formData.append('name', item.name);
        formData.append('type', item.type);
        formData.append('number', item.number);
        formData.append('validUntil', item.validUntil);
        formData.append('status', item.status);
        formData.append('evidenceType', item.evidenceType);
        if (item.file) {
          formData.append('file', item.file);
        }
        await apiFetch<{ data: Record<string, unknown> }>('/api/certificates', {
          method: 'POST',
          body: formData,
        });
        const refreshed = await apiFetch<{ data: Array<Record<string, unknown>> }>(
          '/api/certificates?limit=500'
        );
        setCertificates(refreshed.data.map(mapCertificateFromApi));
      } catch (error) {
        console.warn('Failed to add certificate', error);
        handleApiError('Tambah sertifikat gagal', error);
      }
    })();
  };

  const updateCertificate = (
    id: string,
    changes: Partial<CertificateItem> & { file?: File | null }
  ) => {
    const token = getAuthToken();
    if (!token) {
      console.warn('Missing auth token, certificate update skipped.');
      return;
    }

    void (async () => {
      try {
        const formData = new FormData();
        formData.append('_method', 'PATCH');
        if (changes.name !== undefined) formData.append('name', changes.name);
        if (changes.type !== undefined) formData.append('type', changes.type);
        if (changes.number !== undefined) formData.append('number', changes.number);
        if (changes.validUntil !== undefined)
          formData.append('validUntil', changes.validUntil);
        if (changes.status !== undefined) formData.append('status', changes.status);
        if (changes.evidenceType !== undefined)
          formData.append('evidenceType', changes.evidenceType);
        if (changes.file) {
          formData.append('file', changes.file);
        }
        await apiFetch<{ data: Record<string, unknown> }>(`/api/certificates/${id}`, {
          method: 'POST',
          body: formData,
        });
        const refreshed = await apiFetch<{ data: Array<Record<string, unknown>> }>(
          '/api/certificates?limit=500'
        );
        setCertificates(refreshed.data.map(mapCertificateFromApi));
      } catch (error) {
        console.warn('Failed to update certificate', error);
        handleApiError('Update sertifikat gagal', error);
      }
    })();
  };

  const removeCertificate = (id: string) => {
    const token = getAuthToken();
    if (!token) {
      console.warn('Missing auth token, certificate delete skipped.');
      return;
    }

    void (async () => {
      try {
        await apiFetch(`/api/certificates/${id}`, { method: 'DELETE' });
        const refreshed = await apiFetch<{ data: Array<Record<string, unknown>> }>(
          '/api/certificates?limit=500'
        );
        setCertificates(refreshed.data.map(mapCertificateFromApi));
      } catch (error) {
        console.warn('Failed to remove certificate', error);
        handleApiError('Hapus sertifikat gagal', error);
      }
    })();
  };

  const addAgenda = (item: Omit<AgendaItem, 'id'>) => {
    const token = getAuthToken();
    if (!token) {
      console.warn('Missing auth token, agenda add skipped.');
      return;
    }

    void (async () => {
      try {
        await apiFetch('/api/agenda', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            date: item.date,
            activityType: item.activityType,
            location: item.location,
            status: item.status,
          }),
        });
        const refreshed = await apiFetch<{ data: Array<Record<string, unknown>> }>(
          '/api/agenda?limit=500'
        );
        setAgenda(refreshed.data.map(mapAgendaFromApi));
      } catch (error) {
        console.warn('Failed to add agenda', error);
        handleApiError('Tambah agenda gagal', error);
      }
    })();
  };

  const updateAgenda = (id: string, changes: Partial<AgendaItem>) => {
    const token = getAuthToken();
    if (!token) {
      console.warn('Missing auth token, agenda update skipped.');
      return;
    }

    void (async () => {
      try {
        await apiFetch(`/api/agenda/${id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            date: changes.date,
            activityType: changes.activityType,
            location: changes.location,
            status: changes.status,
          }),
        });
        const refreshed = await apiFetch<{ data: Array<Record<string, unknown>> }>(
          '/api/agenda?limit=500'
        );
        setAgenda(refreshed.data.map(mapAgendaFromApi));
      } catch (error) {
        console.warn('Failed to update agenda', error);
        handleApiError('Update agenda gagal', error);
      }
    })();
  };

  const removeAgenda = (id: string) => {
    const token = getAuthToken();
    if (!token) {
      console.warn('Missing auth token, agenda delete skipped.');
      return;
    }

    void (async () => {
      try {
        await apiFetch(`/api/agenda/${id}`, { method: 'DELETE' });
        const refreshed = await apiFetch<{ data: Array<Record<string, unknown>> }>(
          '/api/agenda?limit=500'
        );
        setAgenda(refreshed.data.map(mapAgendaFromApi));
      } catch (error) {
        console.warn('Failed to remove agenda', error);
        handleApiError('Hapus agenda gagal', error);
      }
    })();
  };

  const addAudit = (item: Omit<AuditItem, 'id'>) => {
    const token = getAuthToken();
    if (!token) {
      console.warn('Missing auth token, audit add skipped.');
      return;
    }

    void (async () => {
      try {
        await apiFetch<{ data: Record<string, unknown> }>('/api/audits', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            number: item.number,
            date: item.date,
            location: item.location,
            status: item.status,
            focus: item.focus,
          }),
        });
        const refreshed = await apiFetch<{ data: Array<Record<string, unknown>> }>(
          '/api/audits?limit=500'
        );
        setAudits(refreshed.data.map(mapAuditFromApi));
      } catch (error) {
        console.warn('Failed to add audit', error);
        handleApiError('Tambah audit gagal', error);
      }
    })();
  };

  const updateAudit = (id: string, changes: Partial<AuditItem>) => {
    const token = getAuthToken();
    if (!token) {
      console.warn('Missing auth token, audit update skipped.');
      return;
    }

    void (async () => {
      try {
        await apiFetch<{ data: Record<string, unknown> }>(`/api/audits/${id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            number: changes.number,
            date: changes.date,
            location: changes.location,
            status: changes.status,
            focus: changes.focus,
          }),
        });
        const refreshed = await apiFetch<{ data: Array<Record<string, unknown>> }>(
          '/api/audits?limit=500'
        );
        setAudits(refreshed.data.map(mapAuditFromApi));
      } catch (error) {
        console.warn('Failed to update audit', error);
        handleApiError('Update audit gagal', error);
      }
    })();
  };

  const removeAudit = (id: string) => {
    const token = getAuthToken();
    if (!token) {
      console.warn('Missing auth token, audit delete skipped.');
      return;
    }

    void (async () => {
      try {
        await apiFetch(`/api/audits/${id}`, { method: 'DELETE' });
        const refreshed = await apiFetch<{ data: Array<Record<string, unknown>> }>(
          '/api/audits?limit=500'
        );
        setAudits(refreshed.data.map(mapAuditFromApi));
      } catch (error) {
        console.warn('Failed to remove audit', error);
        handleApiError('Hapus audit gagal', error);
      }
    })();
  };

  const addInspection = (item: Omit<InspectionItem, 'id'>) => {
    const token = getAuthToken();
    if (!token) {
      console.warn('Missing auth token, inspection add skipped.');
      return;
    }

    void (async () => {
      try {
        await apiFetch('/api/inspections', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            number: item.number,
            date: item.date,
            location: item.location,
            status: item.status,
            unit: item.unit,
          }),
        });
        const refreshed = await apiFetch<{ data: Array<Record<string, unknown>> }>(
          '/api/inspections?limit=500'
        );
        setInspections(refreshed.data.map(mapInspectionFromApi));
      } catch (error) {
        console.warn('Failed to add inspection', error);
        handleApiError('Tambah inspeksi gagal', error);
      }
    })();
  };

  const updateInspection = (id: string, changes: Partial<InspectionItem>) => {
    const token = getAuthToken();
    if (!token) {
      console.warn('Missing auth token, inspection update skipped.');
      return;
    }

    void (async () => {
      try {
        await apiFetch(`/api/inspections/${id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            number: changes.number,
            date: changes.date,
            location: changes.location,
            status: changes.status,
            unit: changes.unit,
          }),
        });
        const refreshed = await apiFetch<{ data: Array<Record<string, unknown>> }>(
          '/api/inspections?limit=500'
        );
        setInspections(refreshed.data.map(mapInspectionFromApi));
      } catch (error) {
        console.warn('Failed to update inspection', error);
        handleApiError('Update inspeksi gagal', error);
      }
    })();
  };

  const removeInspection = (id: string) => {
    const token = getAuthToken();
    if (!token) {
      console.warn('Missing auth token, inspection delete skipped.');
      return;
    }

    void (async () => {
      try {
        await apiFetch(`/api/inspections/${id}`, { method: 'DELETE' });
        const refreshed = await apiFetch<{ data: Array<Record<string, unknown>> }>(
          '/api/inspections?limit=500'
        );
        setInspections(refreshed.data.map(mapInspectionFromApi));
      } catch (error) {
        console.warn('Failed to remove inspection', error);
        handleApiError('Hapus inspeksi gagal', error);
      }
    })();
  };

  const addMonitoring = (item: Omit<MonitoringItem, 'id'>) => {
    const token = getAuthToken();
    if (!token) {
      console.warn('Missing auth token, monitoring add skipped.');
      return;
    }

    void (async () => {
      try {
        await apiFetch('/api/monitoring', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            date: item.date,
            location: item.location,
            status: item.status,
            note: item.note,
          }),
        });
        const refreshed = await apiFetch<{ data: Array<Record<string, unknown>> }>(
          '/api/monitoring?limit=500'
        );
        setMonitoring(refreshed.data.map(mapMonitoringFromApi));
      } catch (error) {
        console.warn('Failed to add monitoring', error);
        handleApiError('Tambah monitoring gagal', error);
      }
    })();
  };

  const updateMonitoring = (id: string, changes: Partial<MonitoringItem>) => {
    const token = getAuthToken();
    if (!token) {
      console.warn('Missing auth token, monitoring update skipped.');
      return;
    }

    void (async () => {
      try {
        await apiFetch(`/api/monitoring/${id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            date: changes.date,
            location: changes.location,
            status: changes.status,
            note: changes.note,
          }),
        });
        const refreshed = await apiFetch<{ data: Array<Record<string, unknown>> }>(
          '/api/monitoring?limit=500'
        );
        setMonitoring(refreshed.data.map(mapMonitoringFromApi));
      } catch (error) {
        console.warn('Failed to update monitoring', error);
        handleApiError('Update monitoring gagal', error);
      }
    })();
  };

  const removeMonitoring = (id: string) => {
    const token = getAuthToken();
    if (!token) {
      console.warn('Missing auth token, monitoring delete skipped.');
      return;
    }

    void (async () => {
      try {
        await apiFetch(`/api/monitoring/${id}`, { method: 'DELETE' });
        const refreshed = await apiFetch<{ data: Array<Record<string, unknown>> }>(
          '/api/monitoring?limit=500'
        );
        setMonitoring(refreshed.data.map(mapMonitoringFromApi));
      } catch (error) {
        console.warn('Failed to remove monitoring', error);
        handleApiError('Hapus monitoring gagal', error);
      }
    })();
  };

  const addFinding = (item: Omit<Finding, 'id' | 'createdAt' | 'updatedAt'>) => {
    const token = getAuthToken();
    if (!token) {
      console.warn('Missing auth token, finding add skipped.');
      return;
    }

    void (async () => {
      try {
        await apiFetch('/api/findings', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            sourceType: item.sumber,
            sourceId: item.sumberId,
            kategori: item.kategori,
            deskripsi: item.deskripsi,
            severity: item.severity,
            status: item.status,
            dueDate: item.dueDate,
          }),
        });
        const refreshed = await apiFetch<{ data: Array<Record<string, unknown>> }>(
          '/api/findings?limit=500'
        );
        setFindings(refreshed.data.map(mapFindingFromApi));
      } catch (error) {
        console.warn('Failed to add finding', error);
        handleApiError('Tambah temuan gagal', error);
      }
    })();
  };

  const updateFinding = (id: string, changes: Partial<Finding>) => {
    const token = getAuthToken();
    if (!token) {
      console.warn('Missing auth token, finding update skipped.');
      return;
    }

    void (async () => {
      try {
        await apiFetch(`/api/findings/${id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            sourceType: changes.sumber,
            sourceId: changes.sumberId,
            kategori: changes.kategori,
            deskripsi: changes.deskripsi,
            severity: changes.severity,
            status: changes.status,
            dueDate: changes.dueDate,
          }),
        });
        const refreshed = await apiFetch<{ data: Array<Record<string, unknown>> }>(
          '/api/findings?limit=500'
        );
        setFindings(refreshed.data.map(mapFindingFromApi));
      } catch (error) {
        console.warn('Failed to update finding', error);
        handleApiError('Perbarui temuan gagal', error);
      }
    })();
  };

  const removeFinding = (id: string) => {
    const token = getAuthToken();
    if (!token) {
      console.warn('Missing auth token, finding delete skipped.');
      return;
    }

    void (async () => {
      try {
        await apiFetch(`/api/findings/${id}`, { method: 'DELETE' });
        const [refreshedFindings, refreshedFollowUps] = await Promise.all([
          apiFetch<{ data: Array<Record<string, unknown>> }>('/api/findings?limit=500'),
          apiFetch<{ data: Array<Record<string, unknown>> }>('/api/follow-ups?limit=500'),
        ]);
        setFindings(refreshedFindings.data.map(mapFindingFromApi));
        setFollowUps(refreshedFollowUps.data.map(mapFollowUpFromApi));
      } catch (error) {
        console.warn('Failed to remove finding', error);
        handleApiError('Hapus temuan gagal', error);
      }
    })();
  };

  const addFollowUp = (
    item: Omit<FollowUp, 'id' | 'history' | 'createdAt' | 'updatedAt'> & {
      note?: string;
    }
  ) => {
    const token = getAuthToken();
    if (!token) {
      console.warn('Missing auth token, follow up add skipped.');
      return;
    }

    void (async () => {
      try {
        await apiFetch('/api/follow-ups', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            findingId: item.findingId,
            aksiPerbaikan: item.aksiPerbaikan,
            pic: item.pic,
            targetDate: item.targetDate,
            status: item.status,
          }),
        });
        const refreshed = await apiFetch<{ data: Array<Record<string, unknown>> }>(
          '/api/follow-ups?limit=500'
        );
        setFollowUps(refreshed.data.map(mapFollowUpFromApi));
      } catch (error) {
        console.warn('Failed to add follow up', error);
        handleApiError('Tambah CAP gagal', error);
      }
    })();
  };

  const updateFollowUp = (id: string, changes: Partial<FollowUp>) => {
    const token = getAuthToken();
    if (!token) {
      console.warn('Missing auth token, follow up update skipped.');
      return;
    }

    void (async () => {
      try {
        await apiFetch(`/api/follow-ups/${id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            findingId: changes.findingId,
            aksiPerbaikan: changes.aksiPerbaikan,
            pic: changes.pic,
            targetDate: changes.targetDate,
            status: changes.status,
          }),
        });
        const refreshed = await apiFetch<{ data: Array<Record<string, unknown>> }>(
          '/api/follow-ups?limit=500'
        );
        setFollowUps(refreshed.data.map(mapFollowUpFromApi));
      } catch (error) {
        console.warn('Failed to update follow up', error);
        handleApiError('Perbarui CAP gagal', error);
      }
    })();
  };

  const removeFollowUp = (id: string) => {
    const token = getAuthToken();
    if (!token) {
      console.warn('Missing auth token, follow up delete skipped.');
      return;
    }

    void (async () => {
      try {
        await apiFetch(`/api/follow-ups/${id}`, { method: 'DELETE' });
        const refreshed = await apiFetch<{ data: Array<Record<string, unknown>> }>(
          '/api/follow-ups?limit=500'
        );
        setFollowUps(refreshed.data.map(mapFollowUpFromApi));
      } catch (error) {
        console.warn('Failed to remove follow up', error);
        handleApiError('Hapus CAP gagal', error);
      }
    })();
  };

  const addFollowUpHistory = (id: string, note: string) => {
    setFollowUps(
      followUps.map((item) =>
        item.id === id
          ? { ...item, history: [...item.history, noteStamp(note)] }
          : item
      )
    );
  };

  return (
    <AppDataContext.Provider
      value={{
        instansi,
        facilities,
        facilityGroups,
        organizations,
        personil,
        certificates,
        agenda,
        audits,
        inspections,
        monitoring,
        findings,
        followUps,
        updateInstansi,
        addFacility,
        updateFacility,
        removeFacility,
        addFacilityGroup,
        removeFacilityGroup,
        addOrganization,
        updateOrganization,
        removeOrganization,
        addPersonil,
        updatePersonil,
        removePersonil,
        addCertificate,
        updateCertificate,
        removeCertificate,
        addAgenda,
        updateAgenda,
        removeAgenda,
        addAudit,
        updateAudit,
        removeAudit,
        addInspection,
        updateInspection,
        removeInspection,
        addMonitoring,
        updateMonitoring,
        removeMonitoring,
        addFinding,
        updateFinding,
        removeFinding,
        addFollowUp,
        updateFollowUp,
        removeFollowUp,
        addFollowUpHistory,
        apiError,
        clearApiError,
      }}
    >
      {children}
    </AppDataContext.Provider>
  );
}

export function useAppData() {
  const context = useContext(AppDataContext);
  if (!context) {
    throw new Error('useAppData must be used within AppDataProvider');
  }
  return context;
}
