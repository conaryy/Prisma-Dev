# AGENTS.md

## Project Overview
- Folder ini berisi 2 service:
  - `Auth/`: frontend portal login/admin portal berbasis React + TypeScript + Vite.
  - `Auth/backend`: auth service Express yang menyediakan login session lokal, endpoint OIDC dasar, JWKS, dan admin user management.
- Auth portal sekarang menjadi pintu masuk terpusat untuk:
  - `K2S`
  - `Logbook`
  - `K3`
  - `Keamanan`
- Jalur deploy aktif memakai:
  - frontend `auth.ryvidia.my.id`
  - backend `authapi.ryvidia.my.id`
- `Auth/backend` sekarang ikut `docker-compose.central.yml`.
- Saat startup, backend sekarang bukan hanya insert default oauth client, tapi juga meng-update record client jika secret atau redirect URI berubah.

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
- Frontend memakai React 18, TypeScript, React Router, Tailwind, dan utilitas UI ringan.
- Pertahankan pola alias `@/`, entrypoint sederhana, dan CSS global di `src/index.css`.
- Backend memakai ESM Node. Pertahankan pemisahan kecil per concern:
  - `config.js` untuk env/config
  - `db.js` untuk akses database
  - `crypto.js` untuk token/JWKS
  - `permissions.js` untuk permission map
  - `server.js` hanya untuk bootstrap
  - `routes/` untuk boundary HTTP
- Jika mengubah flow OIDC:
  - sinkronkan `oauth_clients`, `redirect_uri`, `post_logout_redirect_uri`, dan `client_secret`
  - jangan mengandalkan secret default dev untuk build production frontend lain
- Admin portal sekarang menjadi launcher lintas aplikasi. Untuk K2S, route ke `/login?sso=1&return_to=...`; jangan kembalikan handoff `K2S` ke domain lama atau localhost.

## Testing Instructions
- Frontend minimum:
  - `cd Auth && npm run build`
- Backend minimum:
  - `cd Auth/backend && npm test`
  - `cd Auth/backend && npm run dev`
  - cek `GET /health`
  - uji `/.well-known/openid-configuration`
  - uji `/.well-known/jwks.json`
  - uji login admin dev
  - uji `/oauth/authorize` + `/oauth/token` untuk minimal client `k2s-web`, `logbook-web`, `k3-web`
- Bila menyentuh seed/default client, verifikasi isi tabel:
  - `oauth_clients.id`
  - `client_secret`
  - `redirect_uris_json`
  - `post_logout_redirect_uris_json`

## Security Considerations
- Default admin dev masih aktif secara default dan wajib diganti untuk non-dev.
- Client secret default OIDC hanya aman untuk development.
- `AUTH_ALLOWED_ORIGINS`, issuer, audience, dan cookie/session config harus sinkron dengan domain deploy aktif.
- Private JWK disimpan di `Auth/backend/data/jwks-private.json`; jangan commit key production.
- Session cookie dikontrol `AUTH_SESSION_COOKIE_SECURE`; untuk HTTPS production harus `true`.
- Rate limiting login/token/reset password tetap harus dipertahankan.
- Saat mengubah `oauth_clients`, perhatikan bahwa frontend `K3` dan `Logbook` kini sensitif terhadap mismatch secret antara bundle frontend dan DB auth backend.
