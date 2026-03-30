# AGENTS.md

## Project Overview
- Folder ini berisi 2 service:
  - `Auth/`: frontend portal login berbasis React + TypeScript + Vite.
  - `Auth/backend`: auth service Express yang menyediakan login session lokal, endpoint OIDC dasar, JWKS, dan admin user management.
- Portal ini menjadi pintu masuk auth terpusat untuk K2S dan Logbook.
- Docker production saat ini hanya tersedia untuk frontend portal (`Auth/Dockerfile`); backend auth belum masuk `docker-compose.central.yml`.

## Build And Test Commands
- Frontend:
  - `cd Auth`
  - `npm install`
  - `npm run dev`
  - `npm run build`
  - `npm run preview`
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
- Pertahankan pola alias `@/`, entrypoint sederhana di `src/main.tsx`, dan CSS global di `src/index.css`.
- Backend memakai ESM Node. Pertahankan pemisahan kecil per concern:
  - `config.js` untuk env/config.
  - `db.js` untuk akses database.
  - `crypto.js` untuk token/JWKS.
  - `permissions.js` untuk permission map.
  - `server.js` hanya untuk bootstrap app.
  - `routes/` untuk boundary HTTP.
  - `auth-utils.js`, `session-service.js`, `admin-user-service.js`, `validation.js`, `rate-limit.js` untuk logika domain dan guardrails.
- Di backend, normalisasi input dilakukan eksplisit. Jangan tambahkan akses data mentah tanpa validasi.

## Testing Instructions
- Tidak terlihat suite test otomatis formal untuk frontend maupun backend.
- Minimum check untuk frontend:
  - `cd Auth && npm run build`
- Minimum check untuk backend:
  - `cd Auth/backend && npm test`
  - `cd Auth/backend && npm run dev`
  - cek `GET /health`
  - uji login admin dev
  - uji endpoint `/.well-known/openid-configuration` dan `/.well-known/jwks.json`
- Bila menyentuh migrasi user dari K2S, jalankan `npm run migrate:dry-run` sebelum `npm run migrate:apply`.

## Security Considerations
- Default admin dev masih aktif secara default:
  - username `admin`
  - password `Admin123!`
  - wajib diganti untuk environment non-dev.
- Client secret default OIDC di config juga hanya aman untuk development.
- `AUTH_ALLOWED_ORIGINS`, issuer, audience, dan cookie/session config harus disetel benar sebelum integrasi lintas domain.
- Private JWK disimpan di `Auth/backend/data/jwks-private.json`; jangan commit key production.
- Session cookie dikontrol `AUTH_SESSION_COOKIE_SECURE`; tetap `false` untuk dev HTTP lokal, dan ubah ke `true` saat HTTPS.
- Rate limiting ringan sudah aktif untuk login, token endpoint, dan reset password; default-nya longgar untuk dev dan bisa diatur via `AUTH_RATE_LIMIT_*`.
- Runtime backend sekarang PostgreSQL-only; jangan kembalikan adapter SQLite tanpa alasan yang jelas.
