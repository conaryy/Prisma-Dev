# AGENTS.md

## Project Overview
- Folder ini berisi service Logbook dengan dua bagian:
  - `Logbook/frontend`: React + Vite + TypeScript.
  - `Logbook/backend`: NestJS + Prisma + PostgreSQL.
- Auth tidak dilakukan lokal; Logbook mengandalkan Auth Portal/SSO pusat.
- Frontend menjalankan flow OIDC Authorization Code + PKCE.
- Backend memverifikasi bearer token menggunakan issuer/audience/JWKS.
- Di compose pusat, Logbook aktif sebagai profile opsional `logbook`.

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
  - `npm run lint`
- Docker central dari root repo:
  - `docker compose --env-file .env.central -f docker-compose.central.yml --profile logbook up -d --build`

## Code Style Guidelines
- Frontend memakai React function component dengan styling utilitas sederhana.
- Backend memakai NestJS modular:
  - auth guard/strategy di `src/auth`
  - data access via Prisma di `src/database`
  - domain logbook di `src/logbook`
- Pertahankan validasi DTO dan `ValidationPipe` global.
- Untuk schema/data, semua perubahan database harus lewat `prisma/schema.prisma` dan sinkronisasi Prisma.

## Testing Instructions
- Tidak terlihat suite test formal untuk frontend atau backend.
- Minimum check:
  - `cd Logbook/backend && npm run build`
  - `cd Logbook/frontend && npm run build`
  - bila schema berubah, jalankan `npm run prisma:generate` dan `npm run prisma:push`
  - smoke test endpoint:
    - `GET /api/v1/health`
    - `GET /api/v1/logbook/me` dengan token valid
    - `GET /api/v1/logbook/entries`
- Untuk flow end-to-end, uji redirect login dari frontend ke Auth Portal dan callback kembali ke Logbook.

## Security Considerations
- Token SSO disimpan frontend ke `localStorage` menurut README; perlakukan ini sebagai tradeoff keamanan yang perlu dijaga dari XSS.
- Backend harus memvalidasi `iss`, `aud`, dan JWKS dengan benar; perubahan env SSO harus diuji ulang.
- `DATABASE_URL` Postgres adalah secret.
- CORS di backend mengizinkan origin lokal eksplisit plus daftar env; jangan melonggarkan aturan ini tanpa alasan.
- Gunakan profile `logbook` di Docker hanya saat service memang dibutuhkan agar permukaan serangan tetap kecil.
