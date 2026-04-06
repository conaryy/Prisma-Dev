import {
  useEffect,
  useState,
  type Dispatch,
  type MouseEvent,
  type SetStateAction,
} from 'react';
import { Link, useLocation } from 'react-router-dom';
import {
  LayoutDashboard,
  Info,
  Building2,
  CalendarDays,
  ClipboardCheck,
  ClipboardList,
  CheckCircle,
  CheckCircle2,
  FileText,
  FolderOpen,
  Radar,
  Activity,
  Share2,
  ChevronDown,
  UserRound,
  Warehouse,
  Workflow,
  Users,
  Award,
  ShieldCheck,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { getAuthUser } from '@/lib/api';
import { canAccessExternalDnp, canManageAdminModule } from '@/lib/permissions';
import { useAppData } from '@/contexts/AppDataContext';

interface SidebarProps {
  isOpen?: boolean;
  isCollapsed?: boolean;
  onExpandRequest?: () => void;
}

const linkBase =
  'group relative flex min-w-0 items-center gap-3 rounded-2xl px-3 py-2 text-sm font-semibold transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-200 dark:focus-visible:ring-slate-500/50';
const linkActive =
  'bg-white text-slate-900 shadow-[0_12px_30px_rgba(59,130,246,0.18)] ring-1 ring-blue-100 before:absolute before:left-0 before:top-1/2 before:h-6 before:w-1 before:-translate-y-1/2 before:rounded-r-full before:bg-blue-500 dark:bg-slate-800 dark:text-slate-100 dark:shadow-[0_12px_30px_rgba(2,6,23,0.55)] dark:ring-slate-700 dark:before:bg-slate-300';
const linkIdle =
  'text-slate-600 hover:bg-blue-50 hover:text-blue-700 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-slate-100';

const subLinkBase =
  'group relative flex min-w-0 items-center gap-2 rounded-xl border border-transparent px-3 py-2 text-sm font-medium transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-200 dark:focus-visible:ring-slate-500/50';
const subLinkActive =
  'bg-white text-slate-900 shadow-sm ring-1 ring-blue-100 dark:bg-slate-800 dark:text-slate-100 dark:shadow-[0_8px_20px_rgba(2,6,23,0.45)] dark:ring-slate-700';
const subLinkIdle =
  'text-slate-600 hover:border-blue-200 hover:text-blue-700 dark:text-slate-300 dark:hover:border-slate-700 dark:hover:text-slate-100';
const navIconClass = 'h-4 w-4 shrink-0 text-current';

export function Sidebar({
  isOpen = true,
  isCollapsed = false,
  onExpandRequest,
}: SidebarProps) {
  const location = useLocation();
  const user = getAuthUser<{
    role?: string;
    name?: string;
    can_access_external_dnp?: boolean;
    permissions?: Record<string, unknown>;
  }>();
  const canAccessExternalDnpMenu = canAccessExternalDnp(user);
  const canAccessAdminMenu = canManageAdminModule(user);
  const { instansi } = useAppData();
  const profileName =
    instansi?.name?.trim() || user?.name?.trim() || 'Pengguna';
  const isInfoActive = location.pathname.startsWith('/informasi');
  const isInstansiActive = location.pathname.startsWith('/informasi/instansi');
  const isAuditPqActive = location.pathname.startsWith('/audit/protocol-question');
  const isAuditCapPath = location.pathname.startsWith('/audit/cap');
  const isAuditCapActive =
    isAuditCapPath || location.pathname.startsWith('/cap');
  const isAuditActive =
    location.pathname.startsWith('/audit') || isAuditCapActive;
  const isAuditResultActive =
    location.pathname === '/audit' ||
    (location.pathname.startsWith('/audit/') &&
      !isAuditPqActive &&
      !isAuditCapPath);
  const isAuditPqSelfActive =
    location.pathname === '/audit/protocol-question/self-assessment';
  const isAuditPqReviewActive =
    location.pathname === '/audit/protocol-question/hasil-review-dgca';
  const isAuditCapDraftActive =
    location.pathname === '/audit/cap/penyusunan';
  const isAuditCapFulfillmentActive =
    location.pathname === '/audit/cap/pemenuhan' ||
    location.pathname.startsWith('/cap');
  const isInspeksiPqActive = location.pathname.startsWith(
    '/inspeksi/protocol-question'
  );
  const isInspeksiCapPath = location.pathname.startsWith('/inspeksi/cap');
  const isInspeksiCapActive = isInspeksiCapPath;
  const isInspeksiActive = location.pathname.startsWith('/inspeksi');
  const isInspeksiResultActive =
    location.pathname === '/inspeksi' ||
    (location.pathname.startsWith('/inspeksi/') &&
      !isInspeksiPqActive &&
      !isInspeksiCapPath);
  const isInspeksiPqSelfActive =
    location.pathname === '/inspeksi/protocol-question/self-assessment';
  const isInspeksiPqReviewActive =
    location.pathname === '/inspeksi/protocol-question/hasil-review-dgca';
  const isInspeksiCapDraftActive =
    location.pathname === '/inspeksi/cap/penyusunan';
  const isInspeksiCapFulfillmentActive =
    location.pathname === '/inspeksi/cap/pemenuhan';
  const isSurveillancePqActive = location.pathname.startsWith(
    '/surveillance/protocol-question'
  );
  const isSurveillanceCapPath = location.pathname.startsWith('/surveillance/cap');
  const isSurveillanceCapActive = isSurveillanceCapPath;
  const isSurveillanceActive = location.pathname.startsWith('/surveillance');
  const isSurveillanceResultActive =
    location.pathname === '/surveillance' ||
    (location.pathname.startsWith('/surveillance/') &&
      !isSurveillancePqActive &&
      !isSurveillanceCapPath);
  const isSurveillancePqSelfActive =
    location.pathname === '/surveillance/protocol-question/self-assessment';
  const isSurveillancePqReviewActive =
    location.pathname === '/surveillance/protocol-question/hasil-review-dgca';
  const isSurveillanceCapDraftActive =
    location.pathname === '/surveillance/cap/penyusunan';
  const isSurveillanceCapFulfillmentActive =
    location.pathname === '/surveillance/cap/pemenuhan';
  const isMonitoringActive = location.pathname.startsWith('/monitoring');
  const isMonitoringPqActive = location.pathname.startsWith(
    '/monitoring/protocol-question'
  );
  const isMonitoringPqAgendaActive =
    location.pathname === '/monitoring/protocol-question/hasil-review-dgca';
  const isMonitoringResultActive = location.pathname === '/monitoring';
  const isExternalDnpActive = location.pathname.startsWith('/external-dnp');
  const isExternalDnpAuditActive = location.pathname.startsWith(
    '/external-dnp/audit'
  );
  const isExternalDnpAuditCapDraftActive = location.pathname.startsWith(
    '/external-dnp/audit/cap/penyusunan'
  );
  const isExternalDnpAuditCapFulfillmentActive = location.pathname.startsWith(
    '/external-dnp/audit/cap/pemenuhan'
  );
  const isExternalDnpInspeksiActive = location.pathname.startsWith(
    '/external-dnp/inspeksi'
  );
  const isExternalDnpInspeksiCapDraftActive = location.pathname.startsWith(
    '/external-dnp/inspeksi/cap/penyusunan'
  );
  const isExternalDnpInspeksiCapFulfillmentActive = location.pathname.startsWith(
    '/external-dnp/inspeksi/cap/pemenuhan'
  );
  const isExternalDnpSurveillanceActive = location.pathname.startsWith(
    '/external-dnp/surveillance'
  );
  const isExternalDnpSurveillanceCapDraftActive = location.pathname.startsWith(
    '/external-dnp/surveillance/cap/penyusunan'
  );
  const isExternalDnpSurveillanceCapFulfillmentActive = location.pathname.startsWith(
    '/external-dnp/surveillance/cap/pemenuhan'
  );
  const isAdminDashboardActive =
    location.pathname === '/admin' || location.pathname === '/admin/dashboard';
  const isAdminUsersActive = location.pathname.startsWith('/admin/users');
  const isAdminSelfAssessmentQuestionActive =
    location.pathname === '/admin/self-assessment';
  const isAdminSelfAssessmentSessionActive =
    location.pathname === '/admin/self-assessment-sessions';
  const isAdminReviewUnitSafetyActive = location.pathname.startsWith(
    '/admin/self-assessment-reviews'
  );
  const isAdminSelfAssessmentMenuActive =
    isAdminSelfAssessmentQuestionActive ||
    isAdminSelfAssessmentSessionActive ||
    isAdminReviewUnitSafetyActive;
  const isAdminCapReviewActive = location.pathname.startsWith(
    '/admin/self-assessment-cap-reviews'
  );
  const isAdminCapFulfillmentActive = location.pathname.startsWith(
    '/admin/self-assessment-cap-fulfillments'
  );
  const isAdminCapMenuActive =
    isAdminCapReviewActive || isAdminCapFulfillmentActive;
  const isAdminMonitoringReviewActive = location.pathname.startsWith(
    '/admin/monitoring-reviews'
  );
  const isAdminMonitoringMenuActive = isAdminMonitoringReviewActive;
  const [infoOpen, setInfoOpen] = useState(isInfoActive);
  const [instansiOpen, setInstansiOpen] = useState(isInstansiActive);
  const [auditOpen, setAuditOpen] = useState(isAuditActive);
  const [auditPqOpen, setAuditPqOpen] = useState(isAuditPqActive);
  const [auditCapOpen, setAuditCapOpen] = useState(isAuditCapActive);
  const [inspeksiOpen, setInspeksiOpen] = useState(isInspeksiActive);
  const [inspeksiPqOpen, setInspeksiPqOpen] = useState(isInspeksiPqActive);
  const [inspeksiCapOpen, setInspeksiCapOpen] = useState(isInspeksiCapActive);
  const [surveillanceOpen, setSurveillanceOpen] = useState(isSurveillanceActive);
  const [surveillancePqOpen, setSurveillancePqOpen] = useState(
    isSurveillancePqActive
  );
  const [surveillanceCapOpen, setSurveillanceCapOpen] = useState(
    isSurveillanceCapActive
  );
  const [monitoringOpen, setMonitoringOpen] = useState(isMonitoringActive);
  const [monitoringPqOpen, setMonitoringPqOpen] = useState(isMonitoringPqActive);
  const [externalDnpOpen, setExternalDnpOpen] = useState(isExternalDnpActive);
  const [externalDnpAuditOpen, setExternalDnpAuditOpen] = useState(
    isExternalDnpAuditActive
  );
  const [externalDnpInspeksiOpen, setExternalDnpInspeksiOpen] = useState(
    isExternalDnpInspeksiActive
  );
  const [externalDnpSurveillanceOpen, setExternalDnpSurveillanceOpen] = useState(
    isExternalDnpSurveillanceActive
  );
  const [adminSelfAssessmentMenuOpen, setAdminSelfAssessmentMenuOpen] = useState(
    isAdminSelfAssessmentMenuActive
  );
  const [adminCapMenuOpen, setAdminCapMenuOpen] = useState(isAdminCapMenuActive);
  const [adminMonitoringMenuOpen, setAdminMonitoringMenuOpen] = useState(
    isAdminMonitoringMenuActive
  );

  useEffect(() => {
    if (isInfoActive) {
      setInfoOpen(true);
    }
  }, [isInfoActive]);

  useEffect(() => {
    if (isInstansiActive) {
      setInstansiOpen(true);
    }
  }, [isInstansiActive]);

  useEffect(() => {
    if (isAuditActive) {
      setAuditOpen(true);
    }
  }, [isAuditActive]);

  useEffect(() => {
    if (isAuditPqActive) {
      setAuditPqOpen(true);
    }
  }, [isAuditPqActive]);

  useEffect(() => {
    if (isAuditCapActive) {
      setAuditCapOpen(true);
    }
  }, [isAuditCapActive]);

  useEffect(() => {
    if (isInspeksiActive) {
      setInspeksiOpen(true);
    }
  }, [isInspeksiActive]);

  useEffect(() => {
    if (isInspeksiPqActive) {
      setInspeksiPqOpen(true);
    }
  }, [isInspeksiPqActive]);

  useEffect(() => {
    if (isInspeksiCapActive) {
      setInspeksiCapOpen(true);
    }
  }, [isInspeksiCapActive]);

  useEffect(() => {
    if (isSurveillanceActive) {
      setSurveillanceOpen(true);
    }
  }, [isSurveillanceActive]);

  useEffect(() => {
    if (isSurveillancePqActive) {
      setSurveillancePqOpen(true);
    }
  }, [isSurveillancePqActive]);

  useEffect(() => {
    if (isSurveillanceCapActive) {
      setSurveillanceCapOpen(true);
    }
  }, [isSurveillanceCapActive]);

  useEffect(() => {
    if (isMonitoringActive) {
      setMonitoringOpen(true);
    }
  }, [isMonitoringActive]);

  useEffect(() => {
    if (isMonitoringPqActive) {
      setMonitoringPqOpen(true);
    }
  }, [isMonitoringPqActive]);

  useEffect(() => {
    if (isExternalDnpActive) {
      setExternalDnpOpen(true);
    }
  }, [isExternalDnpActive]);

  useEffect(() => {
    if (isExternalDnpAuditActive) {
      setExternalDnpAuditOpen(true);
    }
  }, [isExternalDnpAuditActive]);

  useEffect(() => {
    if (isExternalDnpInspeksiActive) {
      setExternalDnpInspeksiOpen(true);
    }
  }, [isExternalDnpInspeksiActive]);

  useEffect(() => {
    if (isExternalDnpSurveillanceActive) {
      setExternalDnpSurveillanceOpen(true);
    }
  }, [isExternalDnpSurveillanceActive]);

  useEffect(() => {
    if (isAdminSelfAssessmentMenuActive) {
      setAdminSelfAssessmentMenuOpen(true);
    }
  }, [isAdminSelfAssessmentMenuActive]);

  useEffect(() => {
    if (isAdminCapMenuActive) {
      setAdminCapMenuOpen(true);
    }
  }, [isAdminCapMenuActive]);

  useEffect(() => {
    if (isAdminMonitoringMenuActive) {
      setAdminMonitoringMenuOpen(true);
    }
  }, [isAdminMonitoringMenuActive]);


  const navItem = (href: string) => location.pathname === href;
  const navClass = (active: boolean) =>
    cn(linkBase, active ? linkActive : linkIdle);
  const subNavClass = (active: boolean) =>
    cn(subLinkBase, active ? subLinkActive : subLinkIdle);
  const labelClass = (...extra: Array<string | false | undefined>) =>
    cn(
      'min-w-0 truncate transition-[max-width,transform,opacity] duration-300 ease-in-out',
      isCollapsed
        ? 'max-w-0 translate-x-2 opacity-0'
        : 'max-w-full translate-x-0 opacity-100',
      extra
    );
  const blockLabelClass = (...extra: Array<string | false | undefined>) =>
    cn(
      'min-w-0 w-[11.25rem] shrink-0 transition-transform duration-300 ease-in-out',
      isCollapsed ? 'translate-x-6' : 'translate-x-0',
      extra
    );
  const handleCollapsedTriggerClick =
    (setOpen: Dispatch<SetStateAction<boolean>>) =>
    (event: MouseEvent<HTMLButtonElement>) => {
      if (!isCollapsed) {
        return;
      }
      event.preventDefault();
      setOpen(true);
      onExpandRequest?.();
    };
  const handleCollapsedNavLinkClick = (event: MouseEvent<HTMLElement>) => {
    if (!isCollapsed) {
      return;
    }
    const target = event.target as Element | null;
    if (!target?.closest('a[href]')) {
      return;
    }
    onExpandRequest?.();
  };

  return (
    <aside
      className={cn(
        'zoom-performance fixed left-0 top-0 z-40 h-screen w-72 overflow-hidden rounded-r-[24px] border-r border-white/70 bg-[rgba(255,255,255,0.98)] text-slate-900 shadow-[0_22px_60px_rgba(15,23,42,0.18)] transition-[transform,width] duration-300 ease-in-out lg:border-white/60 lg:bg-[rgba(255,255,255,0.82)] lg:shadow-[0_18px_44px_rgba(15,23,42,0.12)] dark:border-[#25448f] dark:bg-[#08143f] dark:text-slate-100 dark:shadow-[0_22px_60px_rgba(2,8,28,0.58)] lg:dark:border-slate-800 lg:dark:bg-[rgba(15,23,42,0.92)] lg:dark:shadow-[0_18px_44px_rgba(2,8,28,0.45)]',
        isOpen ? 'translate-x-0' : '-translate-x-full',
        isCollapsed ? 'lg:w-20' : 'lg:w-72',
        'lg:translate-x-0'
      )}
    >
      <div className="flex h-full min-h-0 flex-col">
        <div
          className="relative border-b border-white/80 bg-gradient-to-b from-white via-white to-blue-50 px-6 py-6 lg:border-white/70 lg:to-blue-50/80 dark:border-[#25448f] dark:from-[#08143f] dark:via-[#08143f] dark:to-[#12357f] lg:dark:border-slate-800 lg:dark:from-slate-900 lg:dark:via-slate-900 lg:dark:to-slate-800"
        >
          <div
            className="flex items-center gap-3"
          >
            <Avatar className="h-12 w-12 bg-white ring-1 ring-slate-200 shadow-sm dark:bg-[#102a72] dark:ring-white/55">
              <AvatarImage
                src="/airnavpp.png"
                alt="AirNav PP"
                className="object-contain bg-white p-1 dark:bg-white dark:brightness-95 dark:contrast-125"
              />
              <AvatarFallback className="bg-gradient-to-br from-blue-500 to-sky-400 text-white">
                KKS
              </AvatarFallback>
            </Avatar>
            <div
              className={blockLabelClass(
                isCollapsed && 'pointer-events-none'
              )}
            >
              <div className="text-[10px] uppercase tracking-[0.2em] text-slate-400 dark:text-slate-400">
                Dashboard KKS Terpadu
              </div>
              <div className="text-sm font-semibold text-slate-800 dark:text-slate-100">
                {profileName}
              </div>
              <div className="mt-2 inline-flex rounded-full bg-blue-50 px-2 py-1 text-[11px] font-semibold text-blue-600 dark:bg-slate-800 dark:text-slate-200">
                Tahap 1 Pengawasan
              </div>
            </div>
          </div>
        </div>

        <nav
          className="relative flex-1 space-y-2 overflow-y-auto px-4 py-5 text-slate-700 dark:text-slate-300"
          onClickCapture={handleCollapsedNavLinkClick}
        >
          <div
            className={labelClass(
              'px-2 text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-400 dark:text-slate-400'
            )}
          >
            Menu Utama
          </div>

          <Link to="/dashboard" className={navClass(navItem('/dashboard'))}>
            <LayoutDashboard className={navIconClass} />
            <span className={labelClass('flex-1')}>Dashboard</span>
          </Link>

          <Collapsible open={infoOpen} onOpenChange={setInfoOpen}>
            <CollapsibleTrigger
              className={navClass(isInfoActive)}
              onClick={handleCollapsedTriggerClick(setInfoOpen)}
            >
              <Info className={navIconClass} />
              <span className={labelClass('flex-1 text-left')}>Informasi</span>
              {!isCollapsed && (
                <ChevronDown
                  className={cn(
                    'h-4 w-4 text-current/70 transition-transform',
                    infoOpen && 'rotate-180'
                  )}
                />
              )}
            </CollapsibleTrigger>
            <CollapsibleContent
              className={cn(
                'mt-1 space-y-1 overflow-hidden pb-1 pl-5 pr-2 pt-1',
                isCollapsed && 'invisible pointer-events-none'
              )}
            >
              <Collapsible open={instansiOpen} onOpenChange={setInstansiOpen}>
                <CollapsibleTrigger
                  className={cn(subNavClass(isInstansiActive), 'pr-2')}
                  onClick={handleCollapsedTriggerClick(setInstansiOpen)}
                >
                  <span className="flex min-w-0 flex-1 items-center gap-2 text-left">
                    <Building2 className={navIconClass} />
                    <span className={labelClass('flex-1')}>Instansi</span>
                  </span>
                  {!isCollapsed && (
                    <ChevronDown
                      className={cn(
                        'h-4 w-4 text-current/70 transition-transform',
                        instansiOpen && 'rotate-180'
                      )}
                    />
                  )}
                </CollapsibleTrigger>
                <CollapsibleContent
                  className={cn(
                    'mt-1 space-y-1 overflow-hidden pb-1 pl-5 pr-2 pt-1',
                    isCollapsed && 'invisible pointer-events-none'
                  )}
                >
                  <Link
                    to="/informasi/instansi/profil"
                    className={cn(
                      subNavClass(navItem('/informasi/instansi/profil')),
                      'pl-8 text-[13px]'
                    )}
                  >
                    <UserRound className={navIconClass} />
                    <span className={labelClass('flex-1')}>Profil</span>
                  </Link>
                  <Link
                    to="/informasi/instansi/fasilitas"
                    className={cn(
                      subNavClass(navItem('/informasi/instansi/fasilitas')),
                      'pl-8 text-[13px]'
                    )}
                  >
                    <Warehouse className={navIconClass} />
                    <span className={labelClass('flex-1')}>Fasilitas</span>
                  </Link>
                  <Link
                    to="/informasi/instansi/organisasi"
                    className={cn(
                      subNavClass(navItem('/informasi/instansi/organisasi')),
                      'pl-8 text-[13px]'
                    )}
                  >
                    <Workflow className={navIconClass} />
                    <span className={labelClass('flex-1')}>Organisasi</span>
                  </Link>
                  <Link
                    to="/informasi/instansi/personil"
                    className={cn(
                      subNavClass(navItem('/informasi/instansi/personil')),
                      'pl-8 text-[13px]'
                    )}
                  >
                    <Users className={navIconClass} />
                    <span className={labelClass('flex-1')}>Personil</span>
                  </Link>
                  <Link
                    to="/informasi/instansi/sertifikat"
                    className={cn(
                      subNavClass(navItem('/informasi/instansi/sertifikat')),
                      'pl-8 text-[13px]'
                    )}
                  >
                    <Award className={navIconClass} />
                    <span className={labelClass('flex-1')}>Sertifikat</span>
                  </Link>
                </CollapsibleContent>
              </Collapsible>
              <Link
                to="/informasi/agenda-pengawasan"
                className={subNavClass(navItem('/informasi/agenda-pengawasan'))}
              >
                <CalendarDays className={navIconClass} />
                <span className={labelClass('flex-1')}>Agenda Pengawasan</span>
              </Link>
            </CollapsibleContent>
          </Collapsible>

          <Collapsible open={auditOpen} onOpenChange={setAuditOpen}>
            <CollapsibleTrigger
              className={navClass(isAuditActive)}
              onClick={handleCollapsedTriggerClick(setAuditOpen)}
            >
              <ClipboardCheck className={navIconClass} />
              <span className={labelClass('flex-1 text-left')}>Audit</span>
              {!isCollapsed && (
                <ChevronDown
                  className={cn(
                    'h-4 w-4 text-current/70 transition-transform',
                    auditOpen && 'rotate-180'
                  )}
                />
              )}
            </CollapsibleTrigger>
            <CollapsibleContent
              className={cn(
                'mt-1 space-y-1 overflow-hidden pb-1 pl-5 pr-2 pt-1',
                isCollapsed && 'invisible pointer-events-none'
              )}
            >
              <Collapsible open={auditPqOpen} onOpenChange={setAuditPqOpen}>
                <CollapsibleTrigger
                  className={cn(subNavClass(isAuditPqActive), 'pr-2')}
                  onClick={handleCollapsedTriggerClick(setAuditPqOpen)}
                >
                  <span className="flex min-w-0 flex-1 items-center gap-2 text-left">
                    <ClipboardList className={navIconClass} />
                    <span className={labelClass('flex-1')}>
                      Protocol Question (PQ)
                    </span>
                  </span>
                  {!isCollapsed && (
                    <ChevronDown
                      className={cn(
                        'h-4 w-4 text-current/70 transition-transform',
                        auditPqOpen && 'rotate-180'
                      )}
                    />
                  )}
                </CollapsibleTrigger>
                <CollapsibleContent
                  className={cn(
                    'mt-1 space-y-1 overflow-hidden pb-1 pl-5 pr-2 pt-1',
                    isCollapsed && 'invisible pointer-events-none'
                  )}
                >
                  <Link
                    to="/audit/protocol-question/self-assessment"
                    className={cn(
                      subNavClass(isAuditPqSelfActive),
                      'pl-8 text-[13px]'
                    )}
                  >
                    <CheckCircle className={navIconClass} />
                    <span className={labelClass('flex-1')}>Self Assessment</span>
                  </Link>
                  <Link
                    to="/audit/protocol-question/hasil-review-dgca"
                    className={cn(
                      subNavClass(isAuditPqReviewActive),
                      'pl-8 text-[13px]'
                    )}
                  >
                    <FileText className={navIconClass} />
                    <span className={labelClass('flex-1')}>
                      Hasil Review Unit Safety
                    </span>
                  </Link>
                </CollapsibleContent>
              </Collapsible>

              <Link to="/audit" className={subNavClass(isAuditResultActive)}>
                <ClipboardCheck className={navIconClass} />
                <span className={labelClass('flex-1')}>Hasil Audit</span>
              </Link>

              <Collapsible open={auditCapOpen} onOpenChange={setAuditCapOpen}>
                <CollapsibleTrigger
                  className={cn(subNavClass(isAuditCapActive), 'pr-2')}
                  onClick={handleCollapsedTriggerClick(setAuditCapOpen)}
                >
                  <span className="flex min-w-0 flex-1 items-center gap-2 text-left">
                    <CheckCircle2 className={navIconClass} />
                    <span className={labelClass('flex-1')}>CAP</span>
                  </span>
                  {!isCollapsed && (
                    <ChevronDown
                      className={cn(
                        'h-4 w-4 text-current/70 transition-transform',
                        auditCapOpen && 'rotate-180'
                      )}
                    />
                  )}
                </CollapsibleTrigger>
                <CollapsibleContent
                  className={cn(
                    'mt-1 space-y-1 overflow-hidden pb-1 pl-5 pr-2 pt-1',
                    isCollapsed && 'invisible pointer-events-none'
                  )}
                >
                  <Link
                    to="/audit/cap/penyusunan"
                    className={cn(
                      subNavClass(isAuditCapDraftActive),
                      'pl-8 text-[13px]'
                    )}
                  >
                    <FolderOpen className={navIconClass} />
                    <span className={labelClass('flex-1')}>Penyusunan CAP</span>
                  </Link>
                  <Link
                    to="/audit/cap/pemenuhan"
                    className={cn(
                      subNavClass(isAuditCapFulfillmentActive),
                      'pl-8 text-[13px]'
                    )}
                  >
                    <CheckCircle className={navIconClass} />
                    <span className={labelClass('flex-1')}>Pemenuhan CAP</span>
                  </Link>
                </CollapsibleContent>
              </Collapsible>
            </CollapsibleContent>
          </Collapsible>

          <Collapsible open={inspeksiOpen} onOpenChange={setInspeksiOpen}>
            <CollapsibleTrigger
              className={navClass(isInspeksiActive)}
              onClick={handleCollapsedTriggerClick(setInspeksiOpen)}
            >
              <ClipboardList className={navIconClass} />
              <span className={labelClass('flex-1 text-left')}>Inspeksi</span>
              {!isCollapsed && (
                <ChevronDown
                  className={cn(
                    'h-4 w-4 text-current/70 transition-transform',
                    inspeksiOpen && 'rotate-180'
                  )}
                />
              )}
            </CollapsibleTrigger>
            <CollapsibleContent
              className={cn(
                'mt-1 space-y-1 overflow-hidden pb-1 pl-5 pr-2 pt-1',
                isCollapsed && 'invisible pointer-events-none'
              )}
            >
              <Collapsible open={inspeksiPqOpen} onOpenChange={setInspeksiPqOpen}>
                <CollapsibleTrigger
                  className={cn(subNavClass(isInspeksiPqActive), 'pr-2')}
                  onClick={handleCollapsedTriggerClick(setInspeksiPqOpen)}
                >
                  <span className="flex min-w-0 flex-1 items-center gap-2 text-left">
                    <ClipboardList className={navIconClass} />
                    <span className={labelClass('flex-1')}>
                      Protocol Question (PQ)
                    </span>
                  </span>
                  {!isCollapsed && (
                    <ChevronDown
                      className={cn(
                        'h-4 w-4 text-current/70 transition-transform',
                        inspeksiPqOpen && 'rotate-180'
                      )}
                    />
                  )}
                </CollapsibleTrigger>
                <CollapsibleContent
                  className={cn(
                    'mt-1 space-y-1 overflow-hidden pb-1 pl-5 pr-2 pt-1',
                    isCollapsed && 'invisible pointer-events-none'
                  )}
                >
                  <Link
                    to="/inspeksi/protocol-question/self-assessment"
                    className={cn(
                      subNavClass(isInspeksiPqSelfActive),
                      'pl-8 text-[13px]'
                    )}
                  >
                    <CheckCircle className={navIconClass} />
                    <span className={labelClass('flex-1')}>Self Assessment</span>
                  </Link>
                  <Link
                    to="/inspeksi/protocol-question/hasil-review-dgca"
                    className={cn(
                      subNavClass(isInspeksiPqReviewActive),
                      'pl-8 text-[13px]'
                    )}
                  >
                    <FileText className={navIconClass} />
                    <span className={labelClass('flex-1')}>
                      Hasil Review Unit Safety
                    </span>
                  </Link>
                </CollapsibleContent>
              </Collapsible>

              <Link to="/inspeksi" className={subNavClass(isInspeksiResultActive)}>
                <ClipboardCheck className={navIconClass} />
                <span className={labelClass('flex-1')}>Hasil Inspeksi</span>
              </Link>

              <Collapsible open={inspeksiCapOpen} onOpenChange={setInspeksiCapOpen}>
                <CollapsibleTrigger
                  className={cn(subNavClass(isInspeksiCapActive), 'pr-2')}
                  onClick={handleCollapsedTriggerClick(setInspeksiCapOpen)}
                >
                  <span className="flex min-w-0 flex-1 items-center gap-2 text-left">
                    <CheckCircle2 className={navIconClass} />
                    <span className={labelClass('flex-1')}>CAP</span>
                  </span>
                  {!isCollapsed && (
                    <ChevronDown
                      className={cn(
                        'h-4 w-4 text-current/70 transition-transform',
                        inspeksiCapOpen && 'rotate-180'
                      )}
                    />
                  )}
                </CollapsibleTrigger>
                <CollapsibleContent
                  className={cn(
                    'mt-1 space-y-1 overflow-hidden pb-1 pl-5 pr-2 pt-1',
                    isCollapsed && 'invisible pointer-events-none'
                  )}
                >
                  <Link
                    to="/inspeksi/cap/penyusunan"
                    className={cn(
                      subNavClass(isInspeksiCapDraftActive),
                      'pl-8 text-[13px]'
                    )}
                  >
                    <FolderOpen className={navIconClass} />
                    <span className={labelClass('flex-1')}>Penyusunan CAP</span>
                  </Link>
                  <Link
                    to="/inspeksi/cap/pemenuhan"
                    className={cn(
                      subNavClass(isInspeksiCapFulfillmentActive),
                      'pl-8 text-[13px]'
                    )}
                  >
                    <CheckCircle className={navIconClass} />
                    <span className={labelClass('flex-1')}>Pemenuhan CAP</span>
                  </Link>
                </CollapsibleContent>
              </Collapsible>
            </CollapsibleContent>
          </Collapsible>

          <Collapsible open={surveillanceOpen} onOpenChange={setSurveillanceOpen}>
            <CollapsibleTrigger
              className={navClass(isSurveillanceActive)}
              onClick={handleCollapsedTriggerClick(setSurveillanceOpen)}
            >
              <Radar className={navIconClass} />
              <span className={labelClass('flex-1 text-left')}>Surveillance</span>
              {!isCollapsed && (
                <ChevronDown
                  className={cn(
                    'h-4 w-4 text-current/70 transition-transform',
                    surveillanceOpen && 'rotate-180'
                  )}
                />
              )}
            </CollapsibleTrigger>
            <CollapsibleContent
              className={cn(
                'mt-1 space-y-1 overflow-hidden pb-1 pl-5 pr-2 pt-1',
                isCollapsed && 'invisible pointer-events-none'
              )}
            >
              <Collapsible
                open={surveillancePqOpen}
                onOpenChange={setSurveillancePqOpen}
              >
                <CollapsibleTrigger
                  className={cn(subNavClass(isSurveillancePqActive), 'pr-2')}
                  onClick={handleCollapsedTriggerClick(setSurveillancePqOpen)}
                >
                  <span className="flex min-w-0 flex-1 items-center gap-2 text-left">
                    <ClipboardList className={navIconClass} />
                    <span className={labelClass('flex-1')}>
                      Protocol Question (PQ)
                    </span>
                  </span>
                  {!isCollapsed && (
                    <ChevronDown
                      className={cn(
                        'h-4 w-4 text-current/70 transition-transform',
                        surveillancePqOpen && 'rotate-180'
                      )}
                    />
                  )}
                </CollapsibleTrigger>
                <CollapsibleContent
                  className={cn(
                    'mt-1 space-y-1 overflow-hidden pb-1 pl-5 pr-2 pt-1',
                    isCollapsed && 'invisible pointer-events-none'
                  )}
                >
                  <Link
                    to="/surveillance/protocol-question/self-assessment"
                    className={cn(
                      subNavClass(isSurveillancePqSelfActive),
                      'pl-8 text-[13px]'
                    )}
                  >
                    <CheckCircle className={navIconClass} />
                    <span className={labelClass('flex-1')}>Self Assessment</span>
                  </Link>
                  <Link
                    to="/surveillance/protocol-question/hasil-review-dgca"
                    className={cn(
                      subNavClass(isSurveillancePqReviewActive),
                      'pl-8 text-[13px]'
                    )}
                  >
                    <FileText className={navIconClass} />
                    <span className={labelClass('flex-1')}>
                      Hasil Review Unit Safety
                    </span>
                  </Link>
                </CollapsibleContent>
              </Collapsible>

              <Link
                to="/surveillance"
                className={subNavClass(isSurveillanceResultActive)}
              >
                <Radar className={navIconClass} />
                <span className={labelClass('flex-1')}>Hasil Surveillance</span>
              </Link>

              <Collapsible
                open={surveillanceCapOpen}
                onOpenChange={setSurveillanceCapOpen}
              >
                <CollapsibleTrigger
                  className={cn(subNavClass(isSurveillanceCapActive), 'pr-2')}
                  onClick={handleCollapsedTriggerClick(setSurveillanceCapOpen)}
                >
                  <span className="flex min-w-0 flex-1 items-center gap-2 text-left">
                    <CheckCircle2 className={navIconClass} />
                    <span className={labelClass('flex-1')}>CAP</span>
                  </span>
                  {!isCollapsed && (
                    <ChevronDown
                      className={cn(
                        'h-4 w-4 text-current/70 transition-transform',
                        surveillanceCapOpen && 'rotate-180'
                      )}
                    />
                  )}
                </CollapsibleTrigger>
                <CollapsibleContent
                  className={cn(
                    'mt-1 space-y-1 overflow-hidden pb-1 pl-5 pr-2 pt-1',
                    isCollapsed && 'invisible pointer-events-none'
                  )}
                >
                  <Link
                    to="/surveillance/cap/penyusunan"
                    className={cn(
                      subNavClass(isSurveillanceCapDraftActive),
                      'pl-8 text-[13px]'
                    )}
                  >
                    <FolderOpen className={navIconClass} />
                    <span className={labelClass('flex-1')}>Penyusunan CAP</span>
                  </Link>
                  <Link
                    to="/surveillance/cap/pemenuhan"
                    className={cn(
                      subNavClass(isSurveillanceCapFulfillmentActive),
                      'pl-8 text-[13px]'
                    )}
                  >
                    <CheckCircle className={navIconClass} />
                    <span className={labelClass('flex-1')}>Pemenuhan CAP</span>
                  </Link>
                </CollapsibleContent>
              </Collapsible>
            </CollapsibleContent>
          </Collapsible>

          <Collapsible open={monitoringOpen} onOpenChange={setMonitoringOpen}>
            <CollapsibleTrigger
              className={navClass(isMonitoringActive)}
              onClick={handleCollapsedTriggerClick(setMonitoringOpen)}
            >
              <Activity className={navIconClass} />
              <span className={labelClass('flex-1 text-left')}>Monitoring</span>
              {!isCollapsed && (
                <ChevronDown
                  className={cn(
                    'h-4 w-4 text-current/70 transition-transform',
                    monitoringOpen && 'rotate-180'
                  )}
                />
              )}
            </CollapsibleTrigger>
            <CollapsibleContent
              className={cn(
                'mt-1 space-y-1 overflow-hidden pb-1 pl-5 pr-2 pt-1',
                isCollapsed && 'invisible pointer-events-none'
              )}
            >
              <Collapsible open={monitoringPqOpen} onOpenChange={setMonitoringPqOpen}>
                <CollapsibleTrigger
                  className={cn(subNavClass(isMonitoringPqActive), 'pr-2')}
                  onClick={handleCollapsedTriggerClick(setMonitoringPqOpen)}
                >
                  <span className="flex min-w-0 flex-1 items-center gap-2 text-left">
                    <ClipboardList className={navIconClass} />
                    <span className={labelClass('flex-1')}>
                      Protocol Question (PQ)
                    </span>
                  </span>
                  {!isCollapsed && (
                    <ChevronDown
                      className={cn(
                        'h-4 w-4 text-current/70 transition-transform',
                        monitoringPqOpen && 'rotate-180'
                      )}
                    />
                  )}
                </CollapsibleTrigger>
                <CollapsibleContent
                  className={cn(
                    'mt-1 space-y-1 overflow-hidden pb-1 pl-5 pr-2 pt-1',
                    isCollapsed && 'invisible pointer-events-none'
                  )}
                >
                  <Link
                    to="/monitoring/protocol-question/hasil-review-dgca"
                    className={cn(
                      subNavClass(isMonitoringPqAgendaActive),
                      'pl-8 text-[13px]'
                    )}
                  >
                    <FileText className={navIconClass} />
                    <span className={labelClass('flex-1')}>
                      Agenda Monitoring
                    </span>
                  </Link>
                </CollapsibleContent>
              </Collapsible>

              <Link
                to="/monitoring"
                className={subNavClass(isMonitoringResultActive)}
              >
                <Activity className={navIconClass} />
                <span className={labelClass('flex-1')}>Hasil Monitoring</span>
              </Link>
            </CollapsibleContent>
          </Collapsible>

          {canAccessExternalDnpMenu && (
          <Collapsible open={externalDnpOpen} onOpenChange={setExternalDnpOpen}>
            <CollapsibleTrigger
              className={navClass(isExternalDnpActive)}
              onClick={handleCollapsedTriggerClick(setExternalDnpOpen)}
            >
              <Share2 className={navIconClass} />
              <span className={labelClass('flex-1 text-left')}>Menu External DNP</span>
              {!isCollapsed && (
                <ChevronDown
                  className={cn(
                    'h-4 w-4 text-current/70 transition-transform',
                    externalDnpOpen && 'rotate-180'
                  )}
                />
              )}
            </CollapsibleTrigger>
            <CollapsibleContent
              className={cn(
                'mt-1 space-y-1 overflow-hidden pb-1 pl-5 pr-2 pt-1',
                isCollapsed && 'invisible pointer-events-none'
              )}
            >
              <Collapsible
                open={externalDnpAuditOpen}
                onOpenChange={setExternalDnpAuditOpen}
              >
                <CollapsibleTrigger
                  className={cn(subNavClass(isExternalDnpAuditActive), 'pr-2')}
                  onClick={handleCollapsedTriggerClick(setExternalDnpAuditOpen)}
                >
                  <span className="flex min-w-0 flex-1 items-center gap-2 text-left">
                    <ClipboardCheck className={navIconClass} />
                    <span className={labelClass('flex-1')}>Audit</span>
                  </span>
                  {!isCollapsed && (
                    <ChevronDown
                      className={cn(
                        'h-4 w-4 text-current/70 transition-transform',
                        externalDnpAuditOpen && 'rotate-180'
                      )}
                    />
                  )}
                </CollapsibleTrigger>
                <CollapsibleContent
                  className={cn(
                    'mt-1 space-y-1 overflow-hidden pb-1 pl-5 pr-2 pt-1',
                    isCollapsed && 'invisible pointer-events-none'
                  )}
                >
                  <Link
                    to="/external-dnp/audit/cap/penyusunan"
                    className={cn(
                      subNavClass(isExternalDnpAuditCapDraftActive),
                      'pl-8 text-[13px]'
                    )}
                  >
                    <FolderOpen className={navIconClass} />
                    <span className={labelClass('flex-1')}>Penyusunan CAP</span>
                  </Link>
                  <Link
                    to="/external-dnp/audit/cap/pemenuhan"
                    className={cn(
                      subNavClass(isExternalDnpAuditCapFulfillmentActive),
                      'pl-8 text-[13px]'
                    )}
                  >
                    <CheckCircle className={navIconClass} />
                    <span className={labelClass('flex-1')}>Pemenuhan CAP</span>
                  </Link>
                </CollapsibleContent>
              </Collapsible>

              <Collapsible
                open={externalDnpInspeksiOpen}
                onOpenChange={setExternalDnpInspeksiOpen}
              >
                <CollapsibleTrigger
                  className={cn(subNavClass(isExternalDnpInspeksiActive), 'pr-2')}
                  onClick={handleCollapsedTriggerClick(setExternalDnpInspeksiOpen)}
                >
                  <span className="flex min-w-0 flex-1 items-center gap-2 text-left">
                    <ClipboardList className={navIconClass} />
                    <span className={labelClass('flex-1')}>Inspeksi</span>
                  </span>
                  {!isCollapsed && (
                    <ChevronDown
                      className={cn(
                        'h-4 w-4 text-current/70 transition-transform',
                        externalDnpInspeksiOpen && 'rotate-180'
                      )}
                    />
                  )}
                </CollapsibleTrigger>
                <CollapsibleContent
                  className={cn(
                    'mt-1 space-y-1 overflow-hidden pb-1 pl-5 pr-2 pt-1',
                    isCollapsed && 'invisible pointer-events-none'
                  )}
                >
                  <Link
                    to="/external-dnp/inspeksi/cap/penyusunan"
                    className={cn(
                      subNavClass(isExternalDnpInspeksiCapDraftActive),
                      'pl-8 text-[13px]'
                    )}
                  >
                    <FolderOpen className={navIconClass} />
                    <span className={labelClass('flex-1')}>Penyusunan CAP</span>
                  </Link>
                  <Link
                    to="/external-dnp/inspeksi/cap/pemenuhan"
                    className={cn(
                      subNavClass(isExternalDnpInspeksiCapFulfillmentActive),
                      'pl-8 text-[13px]'
                    )}
                  >
                    <CheckCircle className={navIconClass} />
                    <span className={labelClass('flex-1')}>Pemenuhan CAP</span>
                  </Link>
                </CollapsibleContent>
              </Collapsible>

              <Collapsible
                open={externalDnpSurveillanceOpen}
                onOpenChange={setExternalDnpSurveillanceOpen}
              >
                <CollapsibleTrigger
                  className={cn(subNavClass(isExternalDnpSurveillanceActive), 'pr-2')}
                  onClick={handleCollapsedTriggerClick(setExternalDnpSurveillanceOpen)}
                >
                  <span className="flex min-w-0 flex-1 items-center gap-2 text-left">
                    <Radar className={navIconClass} />
                    <span className={labelClass('flex-1')}>Surveillance</span>
                  </span>
                  {!isCollapsed && (
                    <ChevronDown
                      className={cn(
                        'h-4 w-4 text-current/70 transition-transform',
                        externalDnpSurveillanceOpen && 'rotate-180'
                      )}
                    />
                  )}
                </CollapsibleTrigger>
                <CollapsibleContent
                  className={cn(
                    'mt-1 space-y-1 overflow-hidden pb-1 pl-5 pr-2 pt-1',
                    isCollapsed && 'invisible pointer-events-none'
                  )}
                >
                  <Link
                    to="/external-dnp/surveillance/cap/penyusunan"
                    className={cn(
                      subNavClass(isExternalDnpSurveillanceCapDraftActive),
                      'pl-8 text-[13px]'
                    )}
                  >
                    <FolderOpen className={navIconClass} />
                    <span className={labelClass('flex-1')}>Penyusunan CAP</span>
                  </Link>
                  <Link
                    to="/external-dnp/surveillance/cap/pemenuhan"
                    className={cn(
                      subNavClass(isExternalDnpSurveillanceCapFulfillmentActive),
                      'pl-8 text-[13px]'
                    )}
                  >
                    <CheckCircle className={navIconClass} />
                    <span className={labelClass('flex-1')}>Pemenuhan CAP</span>
                  </Link>
                </CollapsibleContent>
              </Collapsible>
            </CollapsibleContent>
          </Collapsible>
          )}

          {canAccessAdminMenu && (
            <div className="pt-4">
              <div
                className={labelClass(
                  'px-2 text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-400'
                )}
              >
                Admin
              </div>
              <Link to="/admin" className={navClass(isAdminDashboardActive)}>
                <ShieldCheck className={navIconClass} />
                <span className={labelClass('flex-1')}>Dashboard Admin</span>
              </Link>
              <Link to="/admin/users" className={navClass(isAdminUsersActive)}>
                <Users className={navIconClass} />
                <span className={labelClass('flex-1')}>Kelola User</span>
              </Link>
              <Collapsible
                open={adminSelfAssessmentMenuOpen}
                onOpenChange={setAdminSelfAssessmentMenuOpen}
              >
                <CollapsibleTrigger
                  className={cn(navClass(isAdminSelfAssessmentMenuActive), 'pr-2')}
                  onClick={handleCollapsedTriggerClick(setAdminSelfAssessmentMenuOpen)}
                >
                  <span className="flex min-w-0 flex-1 items-center gap-2 text-left">
                    <ClipboardList className={navIconClass} />
                    <span className={labelClass('flex-1')}>Self Assessment</span>
                  </span>
                  {!isCollapsed && (
                    <ChevronDown
                      className={cn(
                        'h-4 w-4 text-current/70 transition-transform',
                        adminSelfAssessmentMenuOpen && 'rotate-180'
                      )}
                    />
                  )}
                </CollapsibleTrigger>
                <CollapsibleContent
                  className={cn(
                    'mt-1 space-y-1 overflow-hidden pb-1 pl-5 pr-2 pt-1',
                    isCollapsed && 'invisible pointer-events-none'
                  )}
                >
                  <Link
                    to="/admin/self-assessment"
                    className={cn(
                      subNavClass(isAdminSelfAssessmentQuestionActive),
                      'pl-8 text-[13px]'
                    )}
                  >
                    <ClipboardList className={navIconClass} />
                    <span className={labelClass('flex-1')}>Pertanyaan Self Assessment</span>
                  </Link>
                  <Link
                    to="/admin/self-assessment-sessions"
                    className={cn(
                      subNavClass(isAdminSelfAssessmentSessionActive),
                      'pl-8 text-[13px]'
                    )}
                  >
                    <CalendarDays className={navIconClass} />
                    <span className={labelClass('flex-1')}>Sesi Self Assessment</span>
                  </Link>
                  <Link
                    to="/admin/self-assessment-reviews"
                    className={cn(
                      subNavClass(isAdminReviewUnitSafetyActive),
                      'pl-8 text-[13px]'
                    )}
                  >
                    <ClipboardCheck className={navIconClass} />
                    <span className={labelClass('flex-1')}>Review Unit Safety</span>
                  </Link>
                </CollapsibleContent>
              </Collapsible>
              <Collapsible open={adminCapMenuOpen} onOpenChange={setAdminCapMenuOpen}>
                <CollapsibleTrigger
                  className={cn(navClass(isAdminCapMenuActive), 'pr-2')}
                  onClick={handleCollapsedTriggerClick(setAdminCapMenuOpen)}
                >
                  <span className="flex min-w-0 flex-1 items-center gap-2 text-left">
                    <CheckCircle2 className={navIconClass} />
                    <span className={labelClass('flex-1')}>CAP</span>
                  </span>
                  {!isCollapsed && (
                    <ChevronDown
                      className={cn(
                        'h-4 w-4 text-current/70 transition-transform',
                        adminCapMenuOpen && 'rotate-180'
                      )}
                    />
                  )}
                </CollapsibleTrigger>
                <CollapsibleContent
                  className={cn(
                    'mt-1 space-y-1 overflow-hidden pb-1 pl-5 pr-2 pt-1',
                    isCollapsed && 'invisible pointer-events-none'
                  )}
                >
                  <Link
                    to="/admin/self-assessment-cap-reviews"
                    className={cn(subNavClass(isAdminCapReviewActive), 'pl-8 text-[13px]')}
                  >
                    <ClipboardCheck className={navIconClass} />
                    <span className={labelClass('flex-1')}>Review CAP</span>
                  </Link>
                  <Link
                    to="/admin/self-assessment-cap-fulfillments"
                    className={cn(
                      subNavClass(isAdminCapFulfillmentActive),
                      'pl-8 text-[13px]'
                    )}
                  >
                    <CheckCircle className={navIconClass} />
                    <span className={labelClass('flex-1')}>Hasil Pemenuhan CAP</span>
                  </Link>
                </CollapsibleContent>
              </Collapsible>
              <Collapsible
                open={adminMonitoringMenuOpen}
                onOpenChange={setAdminMonitoringMenuOpen}
              >
                <CollapsibleTrigger
                  className={cn(navClass(isAdminMonitoringMenuActive), 'pr-2')}
                  onClick={handleCollapsedTriggerClick(setAdminMonitoringMenuOpen)}
                >
                  <span className="flex min-w-0 flex-1 items-center gap-2 text-left">
                    <Activity className={navIconClass} />
                    <span className={labelClass('flex-1')}>Monitoring</span>
                  </span>
                  {!isCollapsed && (
                    <ChevronDown
                      className={cn(
                        'h-4 w-4 text-current/70 transition-transform',
                        adminMonitoringMenuOpen && 'rotate-180'
                      )}
                    />
                  )}
                </CollapsibleTrigger>
                <CollapsibleContent
                  className={cn(
                    'mt-1 space-y-1 overflow-hidden pb-1 pl-5 pr-2 pt-1',
                    isCollapsed && 'invisible pointer-events-none'
                  )}
                >
                  <Link
                    to="/admin/monitoring-reviews"
                    className={cn(
                      subNavClass(isAdminMonitoringReviewActive),
                      'pl-8 text-[13px]'
                    )}
                  >
                    <ClipboardCheck className={navIconClass} />
                    <span className={labelClass('flex-1')}>Review Monitoring</span>
                  </Link>
                </CollapsibleContent>
              </Collapsible>
            </div>
          )}
        </nav>
      </div>
    </aside>
  );
}
