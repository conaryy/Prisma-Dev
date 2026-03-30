# Logbook Blueprint (React + NestJS)

Struktur yang disiapkan:

- `frontend/`: React + Vite + TypeScript
- `backend/`: NestJS + JWT SSO guard (OIDC via JWKS)
- Design frontend diambil dari referensi `folder_referensi/project-bolt-sb1-socre5kj.zip` dan di-port ke React app ini.

## Arsitektur

- Login tetap terpusat di Auth Portal/SSO.
- Frontend Logbook mendukung alur OIDC `Authorization Code + PKCE`:
  - redirect ke Auth `/oauth/authorize`
  - callback di `/auth/callback`
  - token disimpan ke localStorage (`auth.portal.token`)
- Backend Logbook memverifikasi bearer token SSO (`iss`, `aud`, signature JWKS).

## Menjalankan Frontend (dev)

```bash
cd Logbook/frontend
cp .env.example .env
npm install
npm run dev
```

## Menjalankan Backend (dev)

```bash
cd Logbook/backend
cp .env.example .env
npm install
npm run start:dev
```

## Endpoint Awal

- Health: `GET /api/v1/health`
- Session check (protected): `GET /api/v1/logbook/me`

## Catatan Integrasi SSO

Untuk mode `hybrid` atau `sso`, isi env backend:

- `SSO_ISSUER`
- `SSO_AUDIENCE`
- `SSO_JWKS_URL`
- `SSO_CLIENT_ID`

Nilai ini harus sama dengan konfigurasi IdP pusat yang dipakai K2S/Auth.

## Rencana Next

1. Tambah modul inti logbook (entry, approval, attachment).
2. Tambah DB (Prisma/TypeORM) dan migration pipeline.
3. Tambah permission granular (admin/viewer + action-level permissions).
4. Hubungkan service `logbook` ke `docker-compose.central.yml` untuk deploy domain produksi.
