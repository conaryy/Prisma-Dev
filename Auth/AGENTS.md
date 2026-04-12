# AGENTS.md

## Project Overview
- Folder `Auth` berisi 2 aplikasi aktif:
  - frontend React + TypeScript + Vite di root `Auth`
  - backend Express ESM di `Auth/backend`
- Auth adalah pintu masuk SSO pusat untuk `K2S`, `Logbook`, dan `K3`.
- Frontend route utama:
  - `/login`
  - `/portal-user`
  - `/portal-admin`
  - `/portal-admin/users`
  - `/profile`
- Backend menyediakan:
  - login session lokal
  - endpoint OIDC dasar: `/oauth/authorize`, `/oauth/token`
  - metadata OIDC dan JWKS
  - admin/self profile API di prefix `/api`
- Saat bootstrap, backend menjalankan `initDb()`, `seedDefaults()`, dan `initKeys()`.

## Build And Test Commands
- Frontend:
  - `cd Auth`
  - `npm install`
  - `npm run dev`
  - `npm run build`
- Backend:
  - `cd Auth/backend`
  - `cp .env.example .env`
  - `npm install`
  - `npm run dev`
  - `npm run start`
  - `npm test`
- Utilitas backend:
  - `npm run migrate:dry-run`
  - `npm run migrate:apply`
  - `npm run user:password -- --user admin --password Admin123!`

## Code Style Guidelines
- Frontend:
  - gunakan alias `@/`
  - pertahankan pola route sederhana di `src/App.tsx`
  - UI utama saat ini berpusat di `pages/Login.tsx`, `pages/UserPortal.tsx`, `pages/admin/AdminPortal.tsx`, dan `pages/admin/UserManagement.tsx`
- Backend:
  - pertahankan boundary yang sudah jelas:
    - `config.js` untuk env/config
    - `db.js` untuk akses PostgreSQL
    - `crypto.js` untuk JWK/JWT
    - `auth-service.js` untuk logika auth/OIDC/session
    - `routes/*.js` untuk boundary HTTP
    - `middleware.js`, `rate-limit.js`, `validation.js` untuk concern transversal
  - route public, admin, dan oauth sudah dipisah; jangan campur semua logic ke `server.js`
- Jika mengubah flow login:
  - perhatikan landing `portal-user` vs `portal-admin`
  - login UI dan `/oauth/authorize` sama-sama bergantung pada `return_to` yang disanitasi
- Jika mengubah OIDC:
  - sinkronkan issuer, redirect URI, post logout URI, client secret, dan mode public/confidential client
  - PKCE S256 saat ini diwajibkan pada Authorization Code flow

## Testing Instructions
- Frontend minimum:
  - `cd Auth && npm run build`
- Backend minimum:
  - `cd Auth/backend && npm test`
  - `cd Auth/backend && npm run dev`
  - cek `GET /health`
  - cek `GET /.well-known/openid-configuration`
  - cek `GET /.well-known/jwks.json`
  - uji login UI lokal
  - uji `/oauth/authorize` -> `/oauth/token` untuk client minimal:
    - `k2s-web`
    - `logbook-web`
    - `k3-web`
- Jika menyentuh admin API:
  - uji `/api/auth/me`
  - uji `/api/profile`
  - uji `/api/admin/users`
  - uji reset password dan proteksi session/permission

## Security Considerations
- Default dev admin masih ada dan wajib diganti di non-dev.
- Private JWK tidak boleh menjadi key production yang ter-commit.
- `AUTH_ALLOWED_ORIGINS`, issuer, audience, cookie/session config, dan daftar redirect URI harus sinkron dengan domain deploy aktif.
- `AUTH_SESSION_COOKIE_SECURE` harus `true` untuk HTTPS production.
- Rate limiting login, token, dan reset password adalah boundary penting; jangan dilepas.
- Client `K2S`, `Logbook`, dan `K3` sensitif terhadap mismatch secret atau redirect URI antara DB auth backend dan bundle frontend deploy.
