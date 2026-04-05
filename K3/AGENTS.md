# AGENTS.md

## Project Overview
- Folder ini berisi aplikasi K3:
  - backend NestJS di `K3/backend/src`
  - frontend React + TypeScript + Vite di `K3/frontend`
- Fokus utama:
  - dashboard K3
  - checklist audit
  - upload dan penyimpanan dokumen audit
  - integrasi Google Drive
- Status terkini:
  - K3 sekarang ikut `docker-compose.central.yml`
  - frontend K3 sekarang memakai flow SSO pusat via `authapi.ryvidia.my.id`
  - backend juga menyajikan `frontend/dist` pada build production

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
- Backend memakai NestJS dengan TypeScript `strict`.
- Frontend relatif ringan; ikuti pola React + TypeScript tanpa state management besar.
- Untuk deploy production:
  - jangan mengandalkan `K3/frontend/.env` untuk secret/redirect URI
  - build deploy harus menerima `VITE_SSO_*` dari compose dan menimpa env dev lokal
- `K3/backend/Dockerfile` sekarang juga mem-build frontend; perubahan env frontend production harus dilacak sampai Dockerfile/build args, bukan hanya file `.env`.
- Untuk Google Drive OAuth, jaga `GOOGLE_REDIRECT_URI` sinkron dengan environment deploy.

## Testing Instructions
- Minimum check:
  - `cd K3/backend && npm run build`
  - uji login SSO sampai `auth/callback`
  - uji upload dokumen `.docx` atau `.doc`
  - uji pemilihan dokumen di menu checklist
  - uji tambah/hapus evidence
  - uji integrasi Google Drive
- Untuk verifikasi deploy:
  - bundle frontend jangan memuat `dev-secret-k3` atau `localhost`
  - `oauth_clients.k3-web` di auth backend harus cocok dengan `AUTH_K3_CLIENT_SECRET` dan `AUTH_K3_REDIRECT_URI`
  - `GOOGLE_REDIRECT_URI` harus persis sama dengan `Authorized redirect URIs` di Google Cloud Console

## Security Considerations
- Service ini sekarang tidak lagi dianggap tanpa auth; frontend production sudah ikut SSO pusat.
- Upload utama dan evidence tetap perlu validasi ukuran dan tipe file.
- Google OAuth sangat sensitif terhadap `redirect_uri_mismatch`; perubahan domain API harus diikuti update di Google Cloud Console.
- Secret frontend dev di `K3/frontend/.env` tidak boleh bocor ke bundle production.
