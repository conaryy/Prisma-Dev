# AGENTS.md

## Project Overview
- Folder ini berisi aplikasi K3:
  - `backend`: NestJS + Prisma + PostgreSQL
  - `frontend`: React + TypeScript + Vite
- Pada deploy production, `k3-backend` mem-build frontend dan menyajikan `frontend/dist` langsung dari backend.
- Backend juga menyajikan `/uploads` secara statis bila folder upload ada.
- K3 memakai SSO pusat dan integrasi Google Drive OAuth.
- Area utama saat ini:
  - dashboard
  - upload dokumen audit
  - analisis checklist audit
  - upload evidence per butir
  - sinkronisasi evidence ke Google Drive

## Build And Test Commands
- Backend dev:
  - `cd K3/backend`
  - `cp .env.example .env`
  - `npm install`
  - `npm run prisma:push`
  - `npm run start:dev`
- Frontend dev:
  - `cd K3/frontend`
  - `npm install`
  - `npm run dev`
- Build production:
  - `cd K3/backend`
  - `npm run build`

## Code Style Guidelines
- Backend:
  - pertahankan boundary yang ada:
    - `auth/*` untuk SSO guard/strategy
    - `database/*` untuk Prisma
    - `checklist-audit.service.ts` untuk domain audit/evidence
    - `google-drive.service.ts` dan `google-drive-callback.controller.ts` untuk integrasi Drive
  - endpoint utama sekarang dipusatkan di `AppController`; tambah route baru dengan hati-hati agar controller ini tidak menjadi dumping ground
- Frontend:
  - gunakan alias `@/`
  - route utama ada di `/`, `/upload-dokumen`, `/checklist-audit`, dan `/auth/callback`
  - flow auth client ada di `frontend/src/lib/sso.ts` dan `frontend/src/lib/session.ts`
- Deploy/build:
  - `backend/Dockerfile` menulis `.env.production` frontend dari build args `VITE_SSO_*`
  - jika env SSO frontend berubah, cek Dockerfile, compose args, dan env auth sekaligus

## Testing Instructions
- Minimum check:
  - `cd K3/backend && npm run build`
- Disarankan untuk perubahan yang menyentuh Prisma:
  - `cd K3/backend && npm run prisma:push`
- Smoke test aplikasi:
  - login SSO sampai `/auth/callback`
  - `GET /api/me`
  - `GET /api/checklist-audit/latest`
  - upload dokumen `.doc` atau `.docx`
  - lihat daftar dokumen
  - upload dan hapus evidence
  - uji status, connect URL, list folder, dan disconnect Google Drive
  - bila relevan, uji sync evidence ke Google Drive
- Verifikasi deploy:
  - `k3.ryvidia.my.id` dan `apik3.ryvidia.my.id` sama-sama mengarah ke `k3-backend`
  - bundle frontend jangan memuat `localhost` atau dev secret
  - `oauth_clients.k3-web`, env auth, dan env K3 harus sinkron

## Security Considerations
- Service ini bukan lagi local-only; semua flow utamanya sekarang bergantung pada SSO pusat.
- Upload utama dan evidence harus tetap menjaga batas ukuran file dan validasi tipe.
- Google OAuth sangat sensitif terhadap `redirect_uri_mismatch`; `GOOGLE_REDIRECT_URI` harus cocok persis dengan Google Cloud Console.
- Jika static serving frontend atau uploads diubah, pastikan route `/api` tidak tertimpa fallback SPA.
