# AGENTS.md

## Project Overview
- Repo ini adalah monorepo multi-service untuk platform Prisma Dev.
- Service utama:
  - `K2S-Web-Project`: frontend React/Vite, backend Laravel 12, dan Python wrapper untuk integrasi DNP eksternal.
  - `Auth`: portal login React/Vite dan service auth Express/OIDC sederhana untuk tahap pemisahan auth/SSO.
  - `Logbook`: frontend React/Vite dan backend NestJS + Prisma/PostgreSQL dengan validasi token SSO via JWKS.
  - `K3`: backend NestJS + frontend React/Vite untuk dashboard dan checklist audit K3 tanpa login.
  - `Keamanan`: masih placeholder, belum terlihat service aktif selain penanda folder.
- Folder non-runtime:
  - `legacy_file`: arsip untuk backup, artefak migrasi, dan file lama yang tidak lagi dipakai jalur aktif.
- Orkestrasi container terpusat ada di `docker-compose.central.yml`.
- Gateway reverse proxy terpusat ada di `deploy/nginx/gateway.conf`.
- Profile opsional di compose pusat:
  - `logbook`: menyalakan stack Logbook.
  - `sso-local`: menyalakan Keycloak lokal untuk uji SSO.

## Build And Test Commands
- Central Docker:
  - `cp .env.central.example .env.central`
  - `docker compose --env-file .env.central -f docker-compose.central.yml up -d --build`
  - `docker compose --env-file .env.central -f docker-compose.central.yml --profile logbook up -d --build`
  - `docker compose --env-file .env.central -f docker-compose.central.yml --profile sso-local up -d --build`
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
- `K3`:
  - `cd K3 && npm install && npm run start:dev`
  - `cd K3/frontend && npm install && npm run dev`
  - `cd K3 && npm run build`
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
- Ikuti gaya yang sudah ada per service, jangan paksa standard baru lintas stack.
- Frontend React/TypeScript:
  - gunakan function component, import ESM, dan strict TypeScript bila sudah aktif.
  - pertahankan alias/import pattern yang sudah ada, misalnya `@/` pada `Auth` dan `K2S-Web-Project`.
  - styling dominan memakai Tailwind/CSS lokal; perubahan visual sebaiknya konsisten dengan pola file yang sedang disentuh.
- Backend Node/Nest/Express:
  - pertahankan modul kecil dan utilitas terpisah seperti di `Auth/backend/src`.
  - validasi input dan normalisasi data dilakukan dekat boundary request.
- Backend Laravel:
  - ikuti konvensi Laravel 12, controller tipis, route API eksplisit, middleware untuk auth/role/signed URL.
  - untuk perubahan PHP, jaga kompatibilitas dengan flow migrasi, queue, dan file storage.
- Python wrapper:
  - perubahan harus hati-hati karena service ini menjadi jembatan ke sistem eksternal.
- Hindari mengubah `.env`, kredensial, atau file hasil build kecuali memang diminta.

## Testing Instructions
- Coverage test otomatis belum merata di seluruh repo.
- Minimum verification per perubahan:
  - frontend Vite: jalankan `npm run build`; untuk `K2S-Web-Project` tambahkan `npm run lint` dan `npm run typecheck`.
  - `K2S-Web-Project/backend`: jalankan `composer test` bila perubahan menyentuh Laravel/PHP.
  - `Logbook/backend`: jalankan `npm run build` dan, bila menyentuh Prisma, `npm run prisma:generate`.
  - `Auth/backend`: jalankan `npm test`; lanjutkan smoke test `npm run dev` untuk `GET /health`, login admin dev, dan endpoint auth/OIDC terkait.
  - `K3`: tidak tampak suite test formal; verifikasi dengan `npm run build`, upload dokumen audit contoh, dan cek upload evidence.
- Saat memakai Docker central, verifikasi health dasar:
  - Auth portal terbuka.
  - K2S frontend terbuka.
  - API backend K2S merespons.
  - profile opsional (`logbook`, `sso-local`) hanya diuji jika service itu ikut dijalankan.

## Security Considerations
- Repo memuat beberapa file `.env` lokal yang berpotensi berisi rahasia; jangan disalin ke dokumentasi atau commit rahasia baru.
- Ganti seluruh kredensial default sebelum deploy:
  - MySQL/Postgres password di `.env.central`.
  - Keycloak bootstrap admin default.
  - dev admin `Auth/backend`.
  - client secret default OIDC di `Auth/backend`.
- `Auth/backend` sudah PostgreSQL-only dan punya rate limiting ringan + validation layer internal; jaga konfigurasi `AUTH_SESSION_COOKIE_SECURE` dan `AUTH_RATE_LIMIT_*` sesuai environment.
- `Auth/backend/data/jwks-private.json` disebut sebagai private key lokal; file private key tidak boleh masuk repo production.
- K2S dan Logbook bergantung pada konfigurasi CORS, issuer, audience, dan JWKS. Salah konfigurasi bisa membuka akses lintas origin atau membuat validasi token salah.
- Laravel memakai signed routes untuk download tertentu; pertahankan middleware `signed`/`signed:relative` saat mengubah route file/download.
- Upload file ada di K2S backend dan K3. Validasi ukuran, tipe file, dan akses file publik harus dipertahankan.
- `K3` saat ini tidak punya auth dan menyimpan state/evidence lokal; jangan anggap service ini aman untuk internet publik tanpa hardening tambahan.
- `folder_referensi` adalah bahan referensi, bukan service production.
- `legacy_file` adalah area arsip; jangan deploy, jangan pakai sebagai source of truth, dan perlakukan isinya sebagai data yang bisa tetap sensitif.

## Folder Guides
- Lihat `Auth/AGENTS.md` untuk portal auth dan auth backend.
- Lihat `K2S-Web-Project/AGENTS.md` untuk frontend K2S, backend Laravel, dan wrapper Python.
- Lihat `K3/AGENTS.md` untuk dashboard/checklist audit K3.
- Lihat `Logbook/AGENTS.md` untuk service logbook.
- Lihat `Keamanan/AGENTS.md` untuk status folder keamanan.
- Lihat `deploy/AGENTS.md` untuk gateway/infrastruktur.
- Lihat `folder_referensi/AGENTS.md` untuk folder referensi/non-production.
- Lihat `legacy_file/AGENTS.md` untuk aturan arsip legacy/non-runtime.
