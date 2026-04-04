# AGENTS.md

## Project Overview
- Folder ini berisi service Logbook dengan dua bagian:
  - `Logbook/frontend`: React + Vite + TypeScript.
  - `Logbook/backend`: NestJS + Prisma + PostgreSQL.
- Auth tidak dilakukan lokal; Logbook mengandalkan Auth Portal/SSO pusat.
- Frontend menjalankan flow OIDC Authorization Code + PKCE.
- Backend memverifikasi bearer token menggunakan issuer/audience/JWKS.
- Di compose pusat, Logbook aktif sebagai profile opsional `logbook`.
- Domain logbook saat ini berfokus pada ingest arsip logbook ke database dan penelusuran data hasil import.
- Kategori logbook aktif:
  - `tower`
  - `app`
  - `teknik`
- Import parser backend sudah dipisah ke folder:
  - `Logbook/backend/src/logbook/imports/shared.ts`
  - `Logbook/backend/src/logbook/imports/types.ts`
  - `Logbook/backend/src/logbook/imports/teknik.parser.ts`
  - `Logbook/backend/src/logbook/imports/app.parser.ts`
  - `Logbook/backend/src/logbook/imports/tower.parser.ts`
- `Logbook/backend/src/logbook/logbook.service.ts` sekarang menjadi orchestration layer untuk query, filter, sort, pagination, dan penyimpanan hasil import.
- Frontend list logbook sudah memakai server-side pagination, search, sort, dan filter tahun/bulan.

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
- Smoke build minimum setelah perubahan parser/import:
  - `cd Logbook/backend && npm run build`
  - `cd Logbook/frontend && npm run build`
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
- Jangan menumpuk logic parser Excel di `logbook.service.ts`; parser kategori baru atau heuristik import harus diletakkan di folder `src/logbook/imports`.
- Utility parsing bersama seperti normalisasi string, tanggal, waktu, dan pembacaan workbook harus dipusatkan di `src/logbook/imports/shared.ts`.
- Untuk frontend list, pertahankan pola server-side:
  - backend menerima `page`, `pageSize`, `search`, `sort`, `year`, `month`
  - frontend jangan kembali ke client-side pagination untuk dataset besar
- Untuk perubahan visual frontend, pertahankan tema dark biru-ungu yang sudah dipakai di layout, topbar, sidebar, dan kartu tabel.

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
    - `POST /api/v1/logbook/import/teknik`
    - `POST /api/v1/logbook/import/app`
    - `POST /api/v1/logbook/import/tower`
- Untuk flow end-to-end, uji redirect login dari frontend ke Auth Portal dan callback kembali ke Logbook.
- Untuk list UI, verifikasi:
  - filter tahun/bulan
  - sort `terbaru` dan `terlama`
  - pagination 20 row
  - state berpindah kategori `tower/app/teknik`
- Untuk parser import, cek minimal satu sampel file referensi dari `folder_referensi` bila perubahan menyentuh heuristic parsing.

## Security Considerations
- Token SSO disimpan frontend ke `localStorage` menurut README; perlakukan ini sebagai tradeoff keamanan yang perlu dijaga dari XSS.
- Backend harus memvalidasi `iss`, `aud`, dan JWKS dengan benar; perubahan env SSO harus diuji ulang.
- `DATABASE_URL` Postgres adalah secret.
- CORS di backend mengizinkan origin lokal eksplisit plus daftar env; jangan melonggarkan aturan ini tanpa alasan.
- Gunakan profile `logbook` di Docker hanya saat service memang dibutuhkan agar permukaan serangan tetap kecil.
- Tombol purge di frontend memanggil penghapusan data logbook di database; perlakukan endpoint ini sebagai operasi destruktif dan jangan dilonggarkan tanpa kontrol yang jelas.
- Import Excel harus tetap membaca tanggal dari serial mentah workbook. Hindari mengaktifkan `cellDates: true` kembali tanpa audit, karena sebelumnya menyebabkan tanggal bergeser satu hari.
- Parser kategori `app` dan `tower` masih mengandalkan carry-forward dan penggabungan row lanjutan. Jika mengubah heuristic ini, uji ulang terhadap data referensi nyata, bukan hanya row sintetis.
