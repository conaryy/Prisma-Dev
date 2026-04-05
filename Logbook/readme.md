# Logbook Service

Service Logbook pada monorepo Prisma Dev terdiri dari:

- `frontend/`: React + Vite + TypeScript
- `backend/`: NestJS + Prisma + PostgreSQL

Service ini dipakai untuk mengimpor arsip logbook ke database, lalu menelusuri hasil import melalui antarmuka web dengan autentikasi SSO pusat.

## Ringkasan Fitur

- login terpusat melalui Auth Portal / SSO
- frontend memakai Authorization Code + PKCE
- backend memvalidasi bearer token via issuer, audience, dan JWKS
- import Excel untuk kategori:
  - `Teknik`
  - `APP`
  - `Tower`
- list logbook dengan:
  - server-side pagination
  - search keyword
  - filter tahun
  - filter bulan
  - urutan terbaru / terlama
- purge seluruh data logbook dari database

## Struktur Penting

- `frontend/src/components/layout`
- `frontend/src/pages`
- `frontend/src/lib`
- `backend/src/auth`
- `backend/src/database`
- `backend/src/logbook`
- `backend/src/logbook/imports`

## Menjalankan Frontend

```bash
cd Logbook/frontend
cp .env.example .env
npm install
npm run dev
```

## Menjalankan Backend

```bash
cd Logbook/backend
cp .env.example .env
npm install
npm run prisma:generate
npm run prisma:push
npm run start:dev
```

## Build Minimum

```bash
cd Logbook/backend
npm run build

cd ../frontend
npm run build
```

## Endpoint Penting

- `GET /api/v1/health`
- `GET /api/v1/logbook/me`
- `GET /api/v1/logbook/entries`
- `POST /api/v1/logbook/import/teknik`
- `POST /api/v1/logbook/import/app`
- `POST /api/v1/logbook/import/tower`
- `DELETE /api/v1/logbook/purge`

## Catatan Deploy Penting

- Deploy aktif memakai:
  - frontend `https://logbook.ryvidia.my.id`
  - API `https://apilogbook.ryvidia.my.id`
- Build frontend production tidak boleh mengandalkan `Logbook/frontend/.env` dev lokal.
- Build deploy harus memakai env production untuk:
  - `VITE_LOGBOOK_API_BASE_URL`
  - `VITE_AUTH_PORTAL_URL`
  - `VITE_SSO_AUTH_BASE_URL`
  - `VITE_SSO_AUTHORIZE_URL`
  - `VITE_SSO_TOKEN_URL`
  - `VITE_SSO_LOGOUT_URL`
  - `VITE_SSO_CLIENT_ID`
  - `VITE_SSO_CLIENT_SECRET`
  - `VITE_SSO_REDIRECT_URI`
- Secret frontend Logbook harus sama dengan record `oauth_clients.logbook-web` di auth backend. Jika mismatch, callback/login bisa terlihat benar tetapi API tetap `401 Unauthorized`.

## Catatan Import Excel

- Parser import dipisah per kategori di `backend/src/logbook/imports`.
- Tanggal Excel dibaca dari serial mentah workbook untuk menghindari pergeseran tanggal.
- Parser `APP` dan `Tower` masih memakai heuristik carry-forward dan penggabungan row lanjutan.
- Parser `Teknik` memakai carry-forward tanggal/jam dan auto-numbering.

## Catatan Schema Database

- Query backend dan bootstrap Prisma sekarang mengasumsikan kolom snake_case:
  - `entry_date`
  - `entry_time`
  - `entry_no`
  - `call_sign`
  - dst.
- `prisma/schema.prisma` harus tetap sinkron dengan raw SQL di `src/database/prisma.service.ts`.

## Catatan Pengembangan

- Gunakan `backend/src/logbook/imports` untuk semua logic parser baru.
- Untuk dataset besar, pertahankan server-side pagination dan search di backend.
- Tombol purge menghapus data logbook di database, jadi perlakukan sebagai operasi destruktif.
