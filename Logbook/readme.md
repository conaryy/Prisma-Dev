# Logbook Service

Service Logbook pada monorepo Prisma Dev terdiri dari:

- `frontend/`: React + Vite + TypeScript
- `backend/`: NestJS + Prisma + PostgreSQL

Service ini dipakai untuk mengimpor arsip logbook ke database, lalu menelusuri hasil import melalui antarmuka web dengan autentikasi SSO pusat.

## Ringkasan Fitur

- login terpusat melalui Auth Portal / SSO
- validasi bearer token di backend via issuer, audience, dan JWKS
- import Excel untuk kategori:
  - `Teknik`
  - `APP`
  - `Tower`
- list logbook dengan:
  - server-side pagination
  - search statis berbasis keyword
  - filter tahun
  - filter bulan
  - pengurutan tanggal terbaru / terlama
- purge seluruh data logbook dari database untuk kebutuhan reset data dev

## Struktur Penting

- `frontend/src/components/layout`
  - layout utama, sidebar, dan topbar
- `frontend/src/pages`
  - halaman dashboard, logbook harian, dan rekap logbook
- `backend/src/auth`
  - guard dan utilitas autentikasi SSO
- `backend/src/database`
  - Prisma service
- `backend/src/logbook`
  - controller, service, DTO, dan domain logbook
- `backend/src/logbook/imports`
  - parser dan utility import Excel per kategori

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

## Catatan Import Excel

- Parser import dipisah per kategori di `backend/src/logbook/imports`.
- Tanggal Excel dibaca dari serial mentah workbook, bukan `cellDates: true`, untuk menghindari pergeseran tanggal.
- Parser `APP` dan `Tower` masih memakai heuristik carry-forward dan penggabungan row lanjutan.
- Parser `Teknik` memakai carry-forward tanggal dan jam, serta auto-numbering berdasarkan urutan data historis.

## Catatan Integrasi SSO

Untuk mode SSO, pastikan env backend dan frontend mengarah ke konfigurasi IdP pusat yang benar, terutama:

- `SSO_ISSUER`
- `SSO_AUDIENCE`
- `SSO_JWKS_URL`
- `SSO_CLIENT_ID`

## Catatan Pengembangan

- Gunakan `backend/src/logbook/imports` untuk semua logic parser baru, jangan menumpuk heuristic di `logbook.service.ts`.
- Untuk dataset besar, pertahankan server-side pagination dan search di backend.
- Tombol purge menghapus data logbook di database, jadi perlakukan sebagai operasi destruktif.
