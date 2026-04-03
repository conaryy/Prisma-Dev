import { useEffect, useRef, useState, type Dispatch, type ReactNode, type SetStateAction } from 'react';
import { NavLink, Outlet, useLocation, useSearchParams } from 'react-router-dom';
import {
  createGoogleDriveConnectUrl,
  disconnectGoogleDrive,
  fetchChecklistDocuments,
  fetchGoogleDriveStatus,
  fetchSessionUser,
} from '@/lib/api';
import { clearSessionTokens, getSessionToken } from '@/lib/session';
import { buildSsoLogoutUrl, isSsoEnabled, startSsoLogin } from '@/lib/sso';
import type { ChecklistDocumentSummary, GoogleDriveStatus, SessionUser } from '@/types';

function formatDateTime(value: string) {
  return new Date(value).toLocaleString('id-ID', {
    dateStyle: 'medium',
    timeStyle: 'short',
  });
}

export type AppShellOutletContext = {
  setTopbarContent: Dispatch<SetStateAction<ReactNode>>;
  currentUser: SessionUser;
  googleDriveStatus: GoogleDriveStatus | null;
  refreshGoogleDriveStatus: () => Promise<void>;
  connectGoogleDrive: () => Promise<void>;
  isConnectingGoogleDrive: boolean;
  isLoadingGoogleDriveStatus: boolean;
};

type AuthState = 'checking' | 'redirecting' | 'ready' | 'error';

export function AppShell() {
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  const isDashboardPage = location.pathname === '/';
  const isChecklistPage = location.pathname === '/checklist-audit';
  const hasUnifiedPageScroll = isDashboardPage || location.pathname === '/upload-dokumen';
  const showsDocumentSwitcher = isDashboardPage || isChecklistPage;
  const navItems = [
    {
      code: '01',
      to: '/',
      label: 'Dashboard',
    },
    {
      code: '02',
      to: '/checklist-audit',
      label: 'Checklist Audit',
    },
    {
      code: '03',
      to: '/upload-dokumen',
      label: 'Upload Dokumen',
    },
  ] as const;
  const currentSection =
    location.pathname === '/upload-dokumen'
      ? 'Upload Dokumen'
      : location.pathname === '/checklist-audit'
        ? 'Checklist Audit'
        : 'Dashboard';
  const requestedDocumentId = searchParams.get('document') ?? '';
  const [documents, setDocuments] = useState<ChecklistDocumentSummary[]>([]);
  const [isLoadingDocuments, setIsLoadingDocuments] = useState(false);
  const [topbarContent, setTopbarContent] = useState<ReactNode>(null);
  const [authState, setAuthState] = useState<AuthState>('checking');
  const [authError, setAuthError] = useState<string | null>(null);
  const [currentUser, setCurrentUser] = useState<SessionUser | null>(null);
  const [googleDriveStatus, setGoogleDriveStatus] = useState<GoogleDriveStatus | null>(null);
  const [isLoadingGoogleDriveStatus, setIsLoadingGoogleDriveStatus] = useState(false);
  const [isConnectingGoogle, setIsConnectingGoogle] = useState(false);
  const [isDisconnectingGoogle, setIsDisconnectingGoogle] = useState(false);
  const [isAccountMenuOpen, setIsAccountMenuOpen] = useState(false);
  const accountMenuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    let ignore = false;
    const returnTo = `${window.location.pathname}${window.location.search}${window.location.hash}`;

    async function bootstrapAuth() {
      if (!isSsoEnabled()) {
        if (!ignore) {
          setAuthState('error');
          setAuthError('SSO K3 sedang dinonaktifkan.');
        }
        return;
      }

      const token = getSessionToken();
      if (!token) {
        if (!ignore) {
          setAuthState('redirecting');
        }
        await startSsoLogin(returnTo);
        return;
      }

      if (!ignore) {
        setAuthState('checking');
      }

      try {
        const payload = await fetchSessionUser();
        if (ignore) {
          return;
        }

        if (!payload.data) {
          throw new Error('Sesi login tidak ditemukan.');
        }

        setCurrentUser(payload.data);
        setAuthState('ready');
        setAuthError(null);
      } catch (reason) {
        if (ignore) {
          return;
        }

        clearSessionTokens();
        setCurrentUser(null);
        setAuthState('redirecting');
        setAuthError(reason instanceof Error ? reason.message : 'Sesi login tidak valid.');
        await startSsoLogin(returnTo);
      }
    }

    void bootstrapAuth();

    return () => {
      ignore = true;
    };
  }, []);

  async function refreshGoogleDriveStatus() {
    if (!currentUser) {
      return;
    }

    setIsLoadingGoogleDriveStatus(true);

    try {
      const payload = await fetchGoogleDriveStatus();
      setGoogleDriveStatus(payload.data);
    } finally {
      setIsLoadingGoogleDriveStatus(false);
    }
  }

  useEffect(() => {
    if (authState !== 'ready' || !currentUser) {
      return;
    }

    let ignore = false;
    setIsLoadingGoogleDriveStatus(true);

    fetchGoogleDriveStatus()
      .then((payload) => {
        if (!ignore) {
          setGoogleDriveStatus(payload.data);
        }
      })
      .catch(() => {
        if (!ignore) {
          setGoogleDriveStatus(null);
        }
      })
      .finally(() => {
        if (!ignore) {
          setIsLoadingGoogleDriveStatus(false);
        }
      });

    return () => {
      ignore = true;
    };
  }, [authState, currentUser]);

  useEffect(() => {
    if (authState !== 'ready' || !showsDocumentSwitcher) {
      setDocuments([]);
      setIsLoadingDocuments(false);
      return;
    }

    let ignore = false;
    setIsLoadingDocuments(true);

    fetchChecklistDocuments()
      .then((payload) => {
        if (!ignore) {
          setDocuments(payload.data);
        }
      })
      .catch(() => {
        if (!ignore) {
          setDocuments([]);
        }
      })
      .finally(() => {
        if (!ignore) {
          setIsLoadingDocuments(false);
        }
      });

    return () => {
      ignore = true;
    };
  }, [authState, showsDocumentSwitcher]);

  useEffect(() => {
    if (!isAccountMenuOpen) {
      return;
    }

    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target;
      if (!(target instanceof Node)) {
        return;
      }

      if (!accountMenuRef.current?.contains(target)) {
        setIsAccountMenuOpen(false);
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsAccountMenuOpen(false);
      }
    };

    window.addEventListener('pointerdown', handlePointerDown);
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      window.removeEventListener('pointerdown', handlePointerDown);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isAccountMenuOpen]);

  const activeDocumentId =
    requestedDocumentId && documents.some((document) => document.id === requestedDocumentId)
      ? requestedDocumentId
      : documents[0]?.id ?? '';

  useEffect(() => {
    if (!showsDocumentSwitcher || !activeDocumentId || activeDocumentId === requestedDocumentId) {
      return;
    }

    const nextParams = new URLSearchParams(searchParams);
    nextParams.set('document', activeDocumentId);
    setSearchParams(nextParams, { replace: true });
  }, [activeDocumentId, requestedDocumentId, searchParams, setSearchParams, showsDocumentSwitcher]);

  async function handleConnectGoogle() {
    setIsConnectingGoogle(true);

    try {
      const returnTo = `${window.location.pathname}${window.location.search}${window.location.hash}`;
      const payload = await createGoogleDriveConnectUrl(returnTo);
      window.location.assign(payload.data.authorizationUrl);
    } finally {
      setIsConnectingGoogle(false);
    }
  }

  async function handleDisconnectGoogle() {
    setIsDisconnectingGoogle(true);

    try {
      await disconnectGoogleDrive();
      await refreshGoogleDriveStatus();
    } finally {
      setIsDisconnectingGoogle(false);
    }
  }

  function handleLogout() {
    clearSessionTokens();
    window.location.assign(buildSsoLogoutUrl(`${window.location.origin}/`));
  }

  if (authState !== 'ready' || !currentUser) {
    return (
      <div className="auth-callback-page">
        <div className="auth-callback-card">
          <h1 className="panel-title">
            {authState === 'redirecting' ? 'Mengalihkan ke Auth' : 'Memeriksa Sesi'}
          </h1>
          <p className="detail-help">
            {authError ||
              (authState === 'redirecting'
                ? 'Sedang mengarahkan ke portal Auth/SSO K3.'
                : 'Sedang memverifikasi sesi login Anda.')}
          </p>
        </div>
      </div>
    );
  }

  const outletContext: AppShellOutletContext = {
    setTopbarContent,
    currentUser,
    googleDriveStatus,
    refreshGoogleDriveStatus,
    connectGoogleDrive: handleConnectGoogle,
    isConnectingGoogleDrive: isConnectingGoogle,
    isLoadingGoogleDriveStatus,
  };

  const accountLabel = currentUser.name || currentUser.username || currentUser.email || 'User K3';
  const accountMeta = currentUser.email || currentUser.username || currentUser.sub;
  const googleMeta = googleDriveStatus?.connected
    ? googleDriveStatus.accountEmail || googleDriveStatus.accountName || 'Google tersambung'
    : googleDriveStatus?.oauthReady
      ? 'Google belum tersambung'
      : 'Google Drive belum dikonfigurasi';

  return (
    <div className="app-layout">
      <aside className="app-sidebar">
        <div className="sidebar-glass-shell">
          <div className="sidebar-brand-panel">
            <div className="sidebar-brand">
              <div className="sidebar-brand-mark">
                <img src="/airnavpp.png" alt="Logo AirNav Indonesia" />
              </div>
              <div className="sidebar-brand-copy">
                <p className="sidebar-brand-eyebrow">AirNav Indonesia</p>
                <h1 className="sidebar-brand-title">SMK3</h1>
              </div>
            </div>
          </div>

          <div className="sidebar-section">
            <p className="sidebar-section-label">Menu</p>
            <nav className="sidebar-nav" aria-label="Navigasi utama">
              {navItems.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.to === '/'}
                  className={({ isActive }) => `sidebar-link${isActive ? ' is-active' : ''}`}
                >
                  <span className="sidebar-link-index">{item.code}</span>
                  <span className="sidebar-link-body">
                    <span className="sidebar-link-title">{item.label}</span>
                  </span>
                  <span className="sidebar-link-arrow" aria-hidden="true" />
                </NavLink>
              ))}
            </nav>
          </div>
        </div>
      </aside>

      <div className={`app-main${isChecklistPage ? ' is-checklist-page' : ''}`}>
        <header
          className={`app-topbar${showsDocumentSwitcher ? ' has-centered-document-switcher' : ''}${isChecklistPage ? ' is-checklist-page' : ''}`}
        >
          <div className="app-topbar-identity">
            <span className="app-topbar-kicker">Workspace SMK3</span>
            <div className="app-topbar-route">
              <span className="app-topbar-route-dot" aria-hidden="true" />
              <strong>{currentSection}</strong>
              <span className="app-topbar-route-copy">Audit internal AirNav Indonesia</span>
            </div>
          </div>

          {showsDocumentSwitcher && (
            <div className="app-topbar-center">
              <div className="topbar-document-switcher">
                <span className="app-topbar-kicker">Dokumen Aktif</span>
                <select
                  className="question-group-select topbar-document-select"
                  value={activeDocumentId}
                  onChange={(event) => {
                    const nextParams = new URLSearchParams(searchParams);
                    if (event.target.value) {
                      nextParams.set('document', event.target.value);
                      nextParams.delete('question');
                    } else {
                      nextParams.delete('document');
                      nextParams.delete('question');
                    }
                    setSearchParams(nextParams, { replace: true });
                  }}
                  disabled={isLoadingDocuments || documents.length === 0}
                  aria-label="Pilih dokumen audit dari topbar"
                >
                  <option value="">
                    {isLoadingDocuments
                      ? 'Memuat dokumen audit...'
                      : documents.length === 0
                        ? 'Belum ada dokumen audit'
                        : 'Pilih dokumen audit...'}
                  </option>
                  {documents.map((document) => (
                    <option key={document.id} value={document.id}>
                      {document.fileName} • {formatDateTime(document.analyzedAt)}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          )}

          <div className="app-topbar-tools">
            {topbarContent}

            <div className="topbar-account-tools">
              <div
                ref={accountMenuRef}
                className={`account-menu${isAccountMenuOpen ? ' is-open' : ''}`}
              >
                <button
                  type="button"
                  className="account-pill"
                  aria-label={`Akun aktif: ${accountLabel}`}
                  aria-haspopup="menu"
                  aria-expanded={isAccountMenuOpen}
                  onClick={() => setIsAccountMenuOpen((previous) => !previous)}
                >
                  <span className="account-pill-avatar" aria-hidden="true">
                    <img src="/airnavpp.png" alt="" />
                  </span>

                  <span className="account-pill-body">
                    <span className="account-pill-label">Akun Aktif</span>
                    <span className="account-pill-row">
                      <span className="account-pill-name">{accountLabel}</span>
                      <span className="account-pill-badge">SSO</span>
                    </span>
                    <span className="account-pill-meta">{accountMeta}</span>
                    <span className="account-pill-meta">{googleMeta}</span>
                  </span>

                  <span className="account-pill-action" aria-hidden="true" />
                </button>

                {isAccountMenuOpen && (
                  <div className="account-dropdown" role="menu" aria-label="Menu akun">
                    <div className="account-dropdown-actions">
                      {googleDriveStatus?.oauthReady ? (
                        googleDriveStatus.connected ? (
                          <button
                            type="button"
                            className="account-dropdown-action"
                            onClick={() => {
                              setIsAccountMenuOpen(false);
                              void handleDisconnectGoogle();
                            }}
                            disabled={isDisconnectingGoogle || isLoadingGoogleDriveStatus}
                            role="menuitem"
                          >
                            {isDisconnectingGoogle ? 'Memutuskan Google...' : 'Disconnect Google'}
                          </button>
                        ) : (
                          <button
                            type="button"
                            className="account-dropdown-action"
                            onClick={() => {
                              setIsAccountMenuOpen(false);
                              void handleConnectGoogle();
                            }}
                            disabled={isConnectingGoogle || isLoadingGoogleDriveStatus}
                            role="menuitem"
                          >
                            {isConnectingGoogle ? 'Mengarahkan...' : 'Connect Google'}
                          </button>
                        )
                      ) : (
                        <p className="account-dropdown-note">Google Drive belum dikonfigurasi.</p>
                      )}

                      <button
                        type="button"
                        className="account-dropdown-action is-danger"
                        onClick={() => {
                          setIsAccountMenuOpen(false);
                          handleLogout();
                        }}
                        role="menuitem"
                      >
                        Logout
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </header>

        <main
          className={`app-content${isChecklistPage ? ' is-checklist-page' : ''}${hasUnifiedPageScroll ? ' has-unified-page-scroll' : ''}`}
        >
          <Outlet context={outletContext} />
        </main>
      </div>
    </div>
  );
}
