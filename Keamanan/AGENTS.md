# AGENTS.md

## Project Overview
- Folder `Keamanan` berisi:
  - `backend`: NestJS API + Prisma + PostgreSQL
  - `frontend`: React + TypeScript + Vite
- Pada deploy production, `keamanan-backend` mem-build frontend dan menyajikan `frontend/dist` langsung dari backend.
- Backend juga menyajikan `/uploads` secara statis bila folder upload ada.
- Domain deploy aktif:
  - `keamanan.ryvidia.my.id`
  - `apikeamanan.ryvidia.my.id`
- API utama saat ini masih sederhana:
  - `GET /api/health`
  - `GET /api/dashboard`
  - `POST /api/personnel`
  - `PATCH /api/supervision-activities/:activityId/status`
  - `POST /api/supervision-activities/:activityId/evidence`
- Data `Personil Keamanan` dan beberapa bagian dashboard sudah masuk PostgreSQL; sebagian konten dashboard lain masih berbasis data contoh/komposisi service.

## Build And Test Commands
- Backend:
  - `cd Keamanan/backend`
  - `npm install`
  - `npm run prisma:push`
  - `npm run prisma:seed`
  - `npm run start:dev`
  - `npm run build`
- Frontend:
  - `cd Keamanan/frontend`
  - `npm install`
  - `npm run dev`
  - `npm run build`

## Code Style Guidelines
- Backend:
  - pertahankan pola controller tipis + service untuk logika domain
  - akses database sebaiknya lewat `src/database` dan `DashboardService`
  - ada dua service Prisma (`src/database/prisma.service.ts` dan `src/prisma.service.ts`); jangan menambah kebingungan baru tanpa alasan jelas
- Frontend:
  - gunakan alias `@/`
  - styling saat ini memakai Tailwind + CSS lokal
  - dashboard cukup stateful dan UI-heavy; jangan pecah perilaku tanpa memahami alur state dan form existing
- Deploy/build:
  - `backend/Dockerfile` mem-build frontend lalu menyalin `frontend/dist` ke image backend
  - untuk perubahan production, cek frontend build output dan static serving backend secara bersamaan

## Testing Instructions
- Minimum check:
  - `cd Keamanan/backend && npm run build`
  - `cd Keamanan/frontend && npm run build`
- Jika data bootstrap disentuh:
  - `cd Keamanan/backend && npm run prisma:seed`
- Smoke test:
  - `GET /api/health`
  - `GET /api/dashboard`
  - tambah personil baru
  - update status supervision activity
  - upload evidence supervision
- Verifikasi deploy:
  - dashboard tampil lewat domain production
  - `keamanan.ryvidia.my.id` dan `apikeamanan.ryvidia.my.id` sama-sama menuju backend yang sama
  - jika backend direcreate, restart `gateway` bila upstream Nginx pusat masih menahan resolusi lama

## Security Considerations
- Service ini sudah terbuka lewat gateway pusat; jangan perlakukan lagi sebagai aplikasi lokal saja.
- Jangan hardcode secret atau endpoint sensitif ke source.
- Upload evidence tetap harus menjaga validasi ukuran dan tipe file.
- Jika nanti service ini ikut flow auth/SSO pusat, boundary auth dan CORS harus diperketat; jangan mengandalkan `origin: true` secara permanen tanpa review.
