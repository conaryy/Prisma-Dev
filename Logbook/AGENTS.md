# AGENTS.md

## Project Overview
- Folder ini berisi service Logbook:
  - `frontend`: React + Vite + TypeScript
  - `backend`: NestJS + Prisma + PostgreSQL
- Backend berjalan dengan global prefix `api/v1`.
- Backend memvalidasi access token SSO melalui `SsoJwtStrategy` dan `SsoAuthGuard`.
- Domain logbook aktif:
  - frontend `logbook.ryvidia.my.id`
  - backend `apilogbook.ryvidia.my.id`
- Kategori logbook aktif:
  - `tower`
  - `app`
  - `teknik`
- Import parser dipisah per kategori di `src/logbook/imports`.

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
- Frontend:
  - gunakan pola yang ada di `components/layout`, `components/ui`, `lib`, `hooks`, dan `pages`
  - SSO client ada di `frontend/src/lib/sso.ts`; jangan ubah flow callback tanpa cek integrasi auth portal
- Backend:
  - pertahankan pemisahan:
    - `src/auth` untuk auth guard/strategy/current-user
    - `src/database` untuk Prisma
    - `src/health` untuk health endpoint
    - `src/logbook` untuk domain utama
  - import parser kategori baru harus ditaruh di `src/logbook/imports`, bukan menambah beban `logbook.service.ts`
  - query utama memang memakai kombinasi Prisma schema dan raw SQL; bila schema berubah, cek keduanya
- Schema/database:
  - perubahan database tetap harus lewat `prisma/schema.prisma`
  - perhatikan mapping `@map(...)` dan nama kolom snake_case yang dipakai raw SQL
  - service sengaja mengembalikan `DATE` sebagai text untuk menghindari timezone shift; jangan ubah itu tanpa uji data nyata

## Testing Instructions
- Minimum check:
  - `cd Logbook/backend && npm run build`
  - `cd Logbook/frontend && npm run build`
- Jika schema berubah:
  - `cd Logbook/backend && npm run prisma:generate && npm run prisma:push`
- Smoke test backend:
  - `GET /api/v1/health`
  - `GET /api/v1/logbook/me`
  - `GET /api/v1/logbook/entries`
  - `POST /api/v1/logbook/import/teknik`
  - `POST /api/v1/logbook/import/app`
  - `POST /api/v1/logbook/import/tower`
  - `DELETE /api/v1/logbook/purge`
- End-to-end minimum:
  - redirect login ke auth portal
  - callback ke `/auth/callback`
  - request entries tidak `401`
  - filter tahun/bulan tetap konsisten
- Verifikasi deploy:
  - bundle frontend tidak memuat `localhost` atau dev secret
  - `oauth_clients.logbook-web` harus cocok dengan env deploy logbook dan auth backend

## Security Considerations
- Access token frontend disimpan client-side; hindari perubahan yang memperluas risiko XSS.
- Backend wajib memvalidasi `iss`, `aud`, dan JWKS dengan benar.
- Endpoint purge adalah operasi destruktif total; perlakukan perubahan di sana sebagai high risk.
- Import Excel harus tetap menjaga pembacaan tanggal serial workbook mentah.
- Parser `app` dan `tower` memakai pola carry-forward row; perubahan heuristic harus diuji dengan data contoh nyata.
