# AGENTS.md — Auth Service

Service SSO/OIDC terpusat untuk seluruh platform K2S. Menangani autentikasi, manajemen user, dan penerbitan token JWT.

---

## Struktur Direktori

```
Auth/
├── backend/                 # Express.js API server
│   ├── src/
│   │   ├── server.js        # Entry point, bootstrap Express app
│   │   ├── config.js        # Konfigurasi dari env vars
│   │   ├── db.js            # PostgreSQL connection (pg), schema init, seed
│   │   ├── crypto.js        # JWT signing/verification, JWKS, key management (jose)
│   │   ├── auth-service.js  # Business logic: login, session, user management
│   │   ├── middleware.js    # asyncHandler, requireSessionUser, requireManageUsers
│   │   ├── validation.js    # Input validation helpers
│   │   ├── rate-limit.js    # Rate limiter (login, token, reset-password)
│   │   ├── permissions.js   # Permission constants & defaults
│   │   ├── session-service.js
│   │   ├── k2s-user-sync.js # Sync user changes ke K2S backend
│   │   ├── admin-user-service.js
│   │   ├── certification-note-locations.js
│   │   ├── external-dnp-instansi.js
│   │   └── routes/
│   │       ├── public-routes.js  # Health, OIDC discovery, JWKS, login/logout
│   │       ├── oauth-routes.js   # /oauth/authorize, /oauth/token, /oauth/revoke, /oauth/userinfo
│   │       └── admin-routes.js   # /api/auth/me, /api/admin/users CRUD, profile, password
│   ├── sql/
│   │   └── postgres-auth-schema.sql  # DDL untuk semua tabel
│   ├── scripts/             # Utility scripts (migrate, set password)
│   ├── data/                # Runtime data (JWK keys, gitignored)
│   ├── test/                # Test files
│   └── package.json
├── src/                     # Frontend React/Vite/TypeScript
│   ├── App.tsx              # Router: /login, /portal-user, /portal-admin, /profile
│   ├── pages/
│   │   ├── Login.tsx
│   │   ├── Profile.tsx
│   │   ├── UserPortal.tsx
│   │   └── admin/
│   │       ├── AdminPortal.tsx
│   │       └── UserManagement.tsx
│   ├── components/
│   ├── lib/
│   └── main.tsx
├── Dockerfile               # Multi-stage: build frontend + run backend
├── package.json             # Frontend dependencies
└── vite.config.ts
```

---

## Tech Stack

| Layer | Teknologi |
|-------|-----------|
| Backend | Express.js (ESM), Node.js |
| Crypto/JWT | jose library (RS256) |
| Database | PostgreSQL 16 (raw SQL via `pg`, no ORM) |
| Frontend | React 18, TypeScript, Vite, Tailwind, Radix UI |
| Auth Protocol | OAuth 2.0 + OIDC (Authorization Code + PKCE S256) |

---

## Database Schema (PostgreSQL)

Tabel utama di `sql/postgres-auth-schema.sql`:

| Tabel | Fungsi |
|-------|--------|
| `users` | User accounts (id, username, email, phone, password_hash, role, permissions_json, status) |
| `oauth_clients` | Registered OAuth clients (redirect URIs, secrets, grant types) |
| `auth_sessions` | Server-side sessions (cookie-based) |
| `authorization_codes` | OAuth authorization codes (PKCE challenge, expiry) |
| `refresh_tokens` | Refresh tokens (hashed, revocable) |

---

## API Endpoints

### Public (no auth)
- `GET /health` — Health check
- `GET /.well-known/openid-configuration` — OIDC Discovery
- `GET /.well-known/jwks.json` — Public JWKS
- `GET /auth/login` — Login form (HTML, untuk redirect flow)
- `POST /auth/login` — Form login (redirect)
- `POST /auth/ui/login` — JSON login (untuk SPA frontend)
- `POST /auth/logout` — Logout (clear session)
- `GET /auth/logout` — Logout + redirect (post_logout_redirect_uri)

### OAuth
- `GET /oauth/authorize` — Authorization endpoint (PKCE required)
- `POST /oauth/token` — Token endpoint (authorization_code, refresh_token)
- `POST /oauth/revoke` — Revoke refresh token
- `GET /oauth/userinfo` — Get user info from access token

### Admin (requireSessionUser + requireManageUsers)
- `GET /api/auth/me` — Current user info
- `PATCH /api/profile` — Update own profile
- `POST /api/profile/password` — Change own password
- `GET /api/admin/users` — List all users
- `POST /api/admin/users` — Create user
- `PATCH /api/admin/users/:id` — Update user
- `DELETE /api/admin/users/:id` — Delete user
- `POST /api/admin/users/:id/reset-password` — Reset user password

---

## Alur Autentikasi (OIDC + PKCE)

```
1. Frontend redirect → GET /oauth/authorize?client_id=...&code_challenge=...&response_type=code
2. Jika belum login → redirect ke /auth/login (atau Auth frontend /login)
3. User login → session cookie di-set
4. Redirect kembali ke /oauth/authorize → generate authorization_code
5. Redirect ke client redirect_uri?code=...&state=...
6. Client POST /oauth/token (code + code_verifier) → access_token + refresh_token + id_token
7. Client pakai access_token (Bearer) untuk akses API service lain
8. Refresh via POST /oauth/token (grant_type=refresh_token)
```

---

## OAuth Clients (Auto-seeded)

| Client ID | Service | Default Port (dev) |
|-----------|---------|-------------------|
| `k2s-web` | K2S Frontend | :5173 |
| `logbook-web` | Logbook Frontend | :5175 |
| `k3-web` | K3 Frontend | :5176 |
| `keamanan-web` | Keamanan Frontend | :5177 |

Semua client adalah **public clients** (PKCE only, no client_secret di browser).

---

## Konfigurasi Penting (Environment)

| Env Var | Fungsi |
|---------|--------|
| `AUTH_DATABASE_URL` | PostgreSQL connection string |
| `AUTH_BASE_URL` | Base URL backend (issuer) |
| `AUTH_LOGIN_UI_URL` | URL frontend login page |
| `AUTH_JWK_PATH` / `AUTH_JWK_JSON` | Private JWK untuk signing |
| `AUTH_ALLOW_EPHEMERAL_JWK` | Generate key on-the-fly (dev only) |
| `AUTH_ALLOWED_ORIGINS` | CORS allowed origins |
| `AUTH_SESSION_COOKIE_SECURE` | Secure cookie flag |
| `AUTH_K2S_USER_SYNC_URL` | URL untuk sync user ke K2S backend |
| `AUTH_K2S_USER_SYNC_TOKEN` | Internal token untuk sync |
| `AUTH_DEFAULT_CLIENT_*` | Default OAuth client config (K2S) |
| `AUTH_LOGBOOK_CLIENT_*` | Logbook OAuth client config |
| `AUTH_K3_CLIENT_*` | K3 OAuth client config |
| `AUTH_KEAMANAN_CLIENT_*` | Keamanan OAuth client config |

---

## Cara Development Lokal

```bash
cd Auth/backend
cp .env.example .env  # atau buat .env manual
npm install
npm run dev           # node --watch src/server.js (port 3104)
```

Frontend:
```bash
cd Auth/
npm install
npm run dev           # vite dev server (port 5174)
```

---

## Konvensi & Tips

- **No ORM** — semua query raw SQL via `pg`. Gunakan `queryOne()`, `queryAll()`, `execQuery()`.
- **Placeholder `?`** — di-convert otomatis ke `$1, $2, ...` oleh helper `toPgSql()`.
- **Timestamps** — disimpan sebagai `BIGINT` (milliseconds since epoch), bukan `TIMESTAMP`.
- **Password hashing** — bcryptjs.
- **Token hashing** — SHA-256 (untuk refresh tokens di DB).
- **Session** — cookie-based (`auth_sid`), server-side di tabel `auth_sessions`.
- **User sync** — saat user dibuat/diupdate/dihapus, Auth service POST ke K2S backend (`/api/internal/auth/users/sync`).
- **Rate limiting** — in-memory, per IP dan per identity/client.
- **Frontend routing** — `/login`, `/portal-user`, `/portal-admin`, `/portal-admin/users`, `/profile`.
- **Jangan hardcode secrets** — semua via env vars.
