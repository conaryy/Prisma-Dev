# K3

Website K3 ini sekarang memakai:

- `NestJS` sebagai backend API
- `PostgreSQL + Prisma` untuk penyimpanan dokumen audit dan hasil analisis
- `React + TypeScript + Vite` sebagai frontend
- SSO pusat untuk login aplikasi
- integrasi Google Drive OAuth untuk flow dokumen tertentu

## Struktur utama

- `backend/` backend NestJS
- `backend/prisma/schema.prisma` schema PostgreSQL
- `backend/src/` source utama backend
- `frontend/` aplikasi React TypeScript

## Menjalankan saat development

Backend:

```bash
cd K3/backend
cp .env.example .env
npm install
npm run prisma:push
npm run start:dev
```

Frontend:

```bash
cd K3/frontend
npm install
npm run dev
```

## Build production

Dari folder `K3/backend`:

```bash
npm run build
```

Perintah ini akan build frontend React lalu build backend NestJS.

## Catatan Deploy Penting

- Frontend production K3 sekarang harus memakai `VITE_SSO_*` dari deploy env, bukan fallback `.env` localhost.
- OAuth client `k3-web` di auth backend harus sinkron dengan:
  - `AUTH_K3_CLIENT_SECRET`
  - `AUTH_K3_REDIRECT_URI`
- Redirect URI Google Drive harus sinkron dengan:
  - `GOOGLE_REDIRECT_URI=https://apik3.ryvidia.my.id/api/google-drive/callback`
- URI tersebut juga harus didaftarkan di Google Cloud Console pada `Authorized redirect URIs`.

## Flow penggunaan

1. Login via auth pusat.
2. Akses dashboard K3.
3. Upload dokumen audit.
4. Pilih dokumen di checklist audit.
5. Tambah/hapus evidence.
6. Jika memakai Google Drive, verifikasi OAuth callback tidak `redirect_uri_mismatch`.
