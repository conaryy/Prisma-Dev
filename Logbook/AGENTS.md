# AGENTS.md

## Project Overview
- Folder ini berisi service Logbook:
  - `Logbook/frontend`: React + Vite + TypeScript
  - `Logbook/backend`: NestJS + Prisma + PostgreSQL
- Logbook mengandalkan Auth Portal/SSO pusat.
- Frontend menjalankan Authorization Code + PKCE.
- Backend memverifikasi bearer token menggunakan issuer/audience/JWKS.
- Kategori aktif:
  - `tower`
  - `app`
  - `teknik`
- `logbook.service.ts` menjadi orchestration layer untuk query, filter, sort, pagination, dan import.
- Schema/database saat ini memakai kolom snake_case yang dipakai juga oleh raw SQL bootstrap/indexing.

## Build And Test Commands
- Frontend:
  - `cd Logbook/frontend`
  - `cp .env.example .env`
  - `npm install`
  - `npm run dev`
  - `npm run build`
- Backend:
  - `cd Logbook/backend`
  - `cp .env.example .env`
  - `npm install`
  - `npm run prisma:generate`
  - `npm run prisma:push`
  - `npm run start:dev`
  - `npm run build`
- Docker central dari root repo:
  - `docker compose --env-file .env.central -f docker-compose.central.yml up -d --build`

## Code Style Guidelines
- Frontend memakai React function component dengan styling utilitas sederhana.
- Backend memakai NestJS modular:
  - auth guard/strategy di `src/auth`
  - data access via Prisma di `src/database`
  - domain logbook di `src/logbook`
- Untuk schema/data:
  - semua perubahan database harus lewat `prisma/schema.prisma`
  - perhatikan mapping `@map(...)` ke kolom snake_case
  - raw SQL di `PrismaService` dan query service harus sinkron dengan nama kolom database
- Parser kategori baru atau heuristic import harus diletakkan di `src/logbook/imports`, bukan ditumpuk di `logbook.service.ts`.
- Untuk frontend production:
  - jangan mengandalkan `Logbook/frontend/.env`
  - build deploy harus memakai `VITE_*` dari compose/env production agar tidak bocor `localhost` atau `dev-secret-logbook`

## Testing Instructions
- Minimum check:
  - `cd Logbook/backend && npm run build`
  - `cd Logbook/frontend && npm run build`
  - bila schema berubah, jalankan `npm run prisma:generate` dan `npm run prisma:push`
  - smoke test endpoint:
    - `GET /api/v1/health`
    - `GET /api/v1/logbook/me` dengan token valid
    - `GET /api/v1/logbook/entries`
    - `POST /api/v1/logbook/import/teknik`
    - `POST /api/v1/logbook/import/app`
    - `POST /api/v1/logbook/import/tower`
- Untuk flow end-to-end:
  - uji redirect login ke auth portal
  - uji callback kembali ke `/auth/callback`
  - pastikan access token tersimpan dan request `entries` tidak `401`
- Untuk verifikasi deploy:
  - bundle frontend jangan memuat `localhost:3104` atau `dev-secret-logbook`
  - bundle harus memuat secret/redirect URI deploy yang sama dengan `oauth_clients.logbook-web`

## Security Considerations
- Token SSO disimpan di `localStorage`; jaga dari XSS.
- Backend harus memvalidasi `iss`, `aud`, dan JWKS dengan benar.
- Tombol purge memanggil penghapusan seluruh data logbook; perlakukan sebagai operasi destruktif.
- Import Excel harus tetap membaca tanggal dari serial workbook mentah; hindari perubahan yang memicu tanggal bergeser.
- Parser `app` dan `tower` memakai carry-forward row; jika heuristic berubah, uji dengan data referensi nyata.
