# AGENTS.md

## Project Overview
- Folder `Keamanan` berisi service dashboard keamanan dengan dua aplikasi:
  - `backend`: NestJS API + Prisma + PostgreSQL
  - `frontend`: React + TypeScript + Vite
- Status terkini:
  - service ini sudah ikut `docker-compose.central.yml`
  - domain deploy aktif memakai `keamanan.ryvidia.my.id` dan `apikeamanan.ryvidia.my.id`
- Data `Personil Keamanan` dipersist ke PostgreSQL; section lain masih banyak memakai data contoh.

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
- Backend mengikuti pola NestJS sederhana:
  - controller tipis
  - service menyimpan logika
  - `main.ts` mengatur CORS/static serving
- Frontend mengikuti pola React function component + CSS lokal.
- Jika perubahan menyentuh deploy production, perhatikan bahwa frontend build disajikan lewat backend/gateway pusat, bukan hanya dev local.

## Testing Instructions
- Minimum check:
  - `cd Keamanan/backend && npm run prisma:push`
  - `cd Keamanan/backend && npm run build`
  - `cd Keamanan/frontend && npm run build`
  - verifikasi `GET /api/health` dan `GET /api/dashboard`
  - verifikasi dashboard tampil lewat domain production

## Security Considerations
- Service ini sekarang sudah terbuka lewat gateway pusat, jadi jangan perlakukan lagi sebagai service local-only.
- Jangan tambahkan secret langsung ke source code.
- Jika nanti data dashboard diambil dari sumber nyata, validasi input query/filter dan perketat CORS sesuai origin resmi.
