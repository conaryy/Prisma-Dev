import { NavLink, Outlet, useLocation } from 'react-router-dom';

export function AppShell() {
  const location = useLocation();
  const isChecklistPage = location.pathname === '/checklist-audit';
  const pageTitle = 'Dashboard K3';
  const pageSubtitle = 'Ringkasan penerapan audit internal SMK3 berbasis hasil dokumen terbaru.';
  const nowLabel = new Intl.DateTimeFormat('id-ID', {
    weekday: 'long',
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  }).format(new Date());

  return (
    <div className="app-layout">
      <aside className="app-sidebar">
        <div className="sidebar-brand">
          <div className="sidebar-brand-mark">K3</div>
          <div>
            <p className="sidebar-brand-eyebrow">AirNav Indonesia</p>
            <h1 className="sidebar-brand-title">SMK3</h1>
          </div>
        </div>

        <div className="sidebar-section">
          <p className="sidebar-section-label">Menu</p>
          <nav className="sidebar-nav" aria-label="Navigasi utama">
            <NavLink to="/" end className={({ isActive }) => `sidebar-link${isActive ? ' is-active' : ''}`}>
              Dashboard
            </NavLink>
            <NavLink
              to="/checklist-audit"
              className={({ isActive }) => `sidebar-link${isActive ? ' is-active' : ''}`}
            >
              Checklist Audit
            </NavLink>
          </nav>
        </div>
      </aside>

      <div className={`app-main${isChecklistPage ? ' is-checklist-page' : ''}`}>
        {!isChecklistPage && (
          <header className="app-topbar">
            <div>
              <p className="topbar-label">Menu K3</p>
              <h2 className="topbar-title">{pageTitle}</h2>
              <p className="topbar-copy">{pageSubtitle}</p>
            </div>

            <div className="topbar-meta">
              <div className="topbar-pill">
                <span className="topbar-pill-label">Mode</span>
                <strong>Tanpa Login</strong>
              </div>
              <div className="topbar-pill">
                <span className="topbar-pill-label">Tanggal</span>
                <strong>{nowLabel}</strong>
              </div>
            </div>
          </header>
        )}

        <main className={`app-content${isChecklistPage ? ' is-checklist-page' : ''}`}>
          <Outlet />
        </main>
      </div>
    </div>
  );
}
