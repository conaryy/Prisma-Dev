# AGENTS.md

## Project Overview
- Repo ini adalah monorepo multi-service untuk platform Prisma Dev.
- Service utama yang sekarang aktif di jalur deploy pusat:
  - `K2S-Web-Project`: frontend React/Vite, backend Laravel 12, Python wrapper DNP, dan service Python `whatsapp_api` untuk bridge WAHA/WhatsApp.
  - `Auth`: portal login React/Vite dan auth service Express/OIDC sederhana.
  - `Logbook`: frontend React/Vite dan backend NestJS + Prisma/PostgreSQL dengan validasi JWT via JWKS.
  - `K3`: backend NestJS + frontend React/Vite untuk dashboard/checklist audit, sekarang sudah ikut flow SSO pusat dan integrasi Google Drive OAuth.
  - `Keamanan`: backend NestJS + frontend React/Vite, sudah ikut `docker-compose.central.yml`.
- Folder non-runtime:
  - `legacy_file`: arsip file lama/nonaktif.
  - `folder_referensi`: bahan acuan, bukan source of truth runtime.
- Orkestrasi container terpusat ada di `docker-compose.central.yml`.
- Gateway reverse proxy terpusat ada di `deploy/nginx/gateway.conf`.
- Domain publik yang sedang dipakai:
  - `auth.ryvidia.my.id` dan `authapi.ryvidia.my.id`
  - `k2s.ryvidia.my.id` dan `apik2s.ryvidia.my.id`
  - `logbook.ryvidia.my.id` dan `apilogbook.ryvidia.my.id`
  - `k3.ryvidia.my.id` dan `apik3.ryvidia.my.id`
  - `keamanan.ryvidia.my.id` dan `apikeamanan.ryvidia.my.id`

## Build And Test Commands
- Central Docker:
  - `cp .env.central.example .env.central`
  - `docker compose --env-file .env.central -f docker-compose.central.yml up -d --build`
  - untuk restart bersih tanpa menghapus volume DB:
    - `docker compose --env-file .env.central -f docker-compose.central.yml down`
    - `docker compose --env-file .env.central -f docker-compose.central.yml up -d --build`
  - hindari `down -v` kecuali memang ingin menghapus data database.
- `Auth` frontend:
  - `cd Auth && npm install && npm run dev`
  - `cd Auth && npm run build`
- `Auth/backend`:
  - `cd Auth/backend && cp .env.example .env && npm install && npm run dev`
  - verifikasi: `npm test`
  - utilitas: `npm run migrate:dry-run`, `npm run migrate:apply`, `npm run user:password -- --user <user> --password <pass>`
- `K2S-Web-Project` frontend:
  - `cd K2S-Web-Project && npm install && npm run dev`
  - `cd K2S-Web-Project && npm run build`
  - `cd K2S-Web-Project && npm run lint && npm run typecheck`
- `K2S-Web-Project/backend`:
  - `cd K2S-Web-Project/backend && composer install`
  - `php artisan serve`
  - `php artisan migrate --force`
  - `php artisan queue:work`
  - `composer test`
- `K2S-Web-Project/backend/wrapping`:
  - `cd K2S-Web-Project/backend/wrapping && pip install -r requirements.txt`
  - `python app.py`
- `K2S-Web-Project/backend/whatsapp_api`:
  - `cd K2S-Web-Project/backend/whatsapp_api && pip install -r requirements.txt`
  - `python app.py`
- `K3`:
  - `cd K3/backend && npm install && npm run start:dev`
  - `cd K3/frontend && npm install && npm run dev`
  - `cd K3/backend && npm run build`
- `Logbook/backend`:
  - `cd Logbook/backend && cp .env.example .env && npm install`
  - `npm run start:dev`
  - `npm run prisma:generate`
  - `npm run prisma:push`
  - `npm run build`
- `Logbook/frontend`:
  - `cd Logbook/frontend && cp .env.example .env && npm install && npm run dev`
  - `npm run build`

## Code Style Guidelines
- Ikuti gaya yang sudah ada per service; jangan paksa standard lintas stack.
- Frontend React/TypeScript:
  - gunakan function component, import ESM, dan strict TypeScript bila sudah aktif.
  - pertahankan alias/import pattern yang sudah ada, misalnya `@/`.
  - bila service memakai `.env` frontend untuk dev lokal, jangan anggap file itu aman untuk build production; build production sekarang lebih banyak dipaksa dari `docker-compose.central.yml`.
- Backend Node/Nest/Express:
  - pertahankan modul kecil dan boundary jelas.
  - validasi input dan normalisasi data dilakukan dekat request boundary.
- Backend Laravel:
  - ikuti konvensi Laravel 12, controller tipis, route API eksplisit, middleware untuk auth/role/signed URL.
- Python services:
  - `wrapping` dan `whatsapp_api` punya responsibility berbeda; jangan dicampur.
- Hindari mengubah `.env`, kredensial, atau file hasil build kecuali memang diminta.

## Testing Instructions
- Coverage test otomatis belum merata.
- Minimum verification per perubahan:
  - frontend Vite: `npm run build`
  - `K2S-Web-Project`: tambah `npm run lint` dan `npm run typecheck`
  - `K2S-Web-Project/backend`: `composer test` bila perubahan menyentuh Laravel
  - `K2S-Web-Project/backend/whatsapp_api`: minimum `python3 -m py_compile app.py`
  - `Logbook/backend`: `npm run build` dan, bila menyentuh Prisma, `npm run prisma:generate`
  - `Auth/backend`: `npm test`
  - `K3`: `cd K3/backend && npm run build`
- Saat memakai Docker central, verifikasi health dasar:
  - auth portal terbuka
  - OIDC discovery `/.well-known/openid-configuration` hidup
  - `k2s`, `logbook`, `k3`, `keamanan` frontend terbuka
  - API terkait merespons lewat gateway
- Setelah recreate frontend/backend container yang menjadi upstream Nginx, restart `gateway` agar resolusi DNS upstream di Nginx segar lagi.

## Security Considerations
- Repo memuat beberapa file `.env` lokal yang berpotensi berisi rahasia; jangan disalin ke dokumentasi.
- Ganti seluruh kredensial default sebelum deploy:
  - MySQL/Postgres password di `.env.central`
  - dev admin `Auth/backend`
  - client secret OIDC dan Google OAuth
- `Auth/backend/data/jwks-private.json` adalah private key lokal; file private key tidak boleh masuk repo production.
- K2S, Logbook, dan K3 sekarang bergantung pada konfigurasi issuer, audience, redirect URI, dan JWKS yang sinkron.
- Build frontend `K3` dan `Logbook` production sekarang sensitif terhadap `.env` lokal dev; pastikan build deploy memakai value dari compose/env production, bukan fallback localhost.
- Laravel memakai signed routes untuk download tertentu; pertahankan middleware `signed`/`signed:relative`.
- `K2S-Web-Project/backend/whatsapp_api` memakai token internal dan berbicara ke WAHA; jaga `WHATSAPP_BOT_INTERNAL_TOKEN`, `WAHA_API_BASE_URL`, `WAHA_API_KEY`, dan session name tetap sinkron.
- `K3` memakai Google OAuth untuk Drive; `GOOGLE_REDIRECT_URI` di env deploy harus cocok persis dengan `Authorized redirect URIs` di Google Cloud Console.
- `legacy_file` dan `folder_referensi` bukan source of truth runtime.

## Folder Guides
- Lihat `Auth/AGENTS.md` untuk portal auth dan auth backend.
- Lihat `K2S-Web-Project/AGENTS.md` untuk frontend K2S, backend Laravel, wrapper DNP, dan `whatsapp_api`.
- Lihat `K3/AGENTS.md` untuk dashboard/checklist audit K3.
- Lihat `Logbook/AGENTS.md` untuk service logbook.
- Lihat `Keamanan/AGENTS.md` untuk dashboard keamanan.
- Lihat `deploy/AGENTS.md` untuk gateway/infrastruktur.
- Lihat `folder_referensi/AGENTS.md` untuk folder referensi/non-production.
- Lihat `legacy_file/AGENTS.md` untuk aturan arsip legacy/non-runtime.
