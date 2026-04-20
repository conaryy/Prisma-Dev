# AGENTS.md

## Project Overview
- Repo ini adalah monorepo multi-service untuk platform Prisma Dev dengan orkestrasi utama di root.
- Source of truth deploy aktif:
  - `docker-compose.central.yml` untuk topologi service/container
  - `.env.central` untuk runtime env deploy pusat
  - `deploy/nginx/gateway.conf` untuk reverse proxy domain publik
- Service runtime aktif:
  - `K2S-Web-Project`: frontend React/Vite, backend Laravel 12, `queue-worker`, `backend-init`, Python `wrapping`, dan Python `whatsapp_api`
  - `Auth`: frontend React/Vite dan backend Express/OIDC + JWKS + admin portal
  - `Logbook`: frontend React/Vite terpisah dan backend NestJS + Prisma/PostgreSQL
  - `K3`: backend NestJS yang sekaligus mem-build dan menyajikan frontend React/Vite pada build production
  - `Keamanan`: backend NestJS yang menjadi upstream deploy aktif; frontend React/Vite tetap ada untuk dev/build lokal
- Service infra/data aktif:
  - `db` MySQL untuk K2S
  - `auth-db`, `logbook-db`, `k3-db`, `keamanan-db` PostgreSQL per service
  - profile opsional `sso-local`: `keycloak` dan `keycloak-db`
- Folder non-runtime:
  - `legacy_file`: arsip lama, bukan target perubahan runtime kecuali diminta
  - `folder_referensi`: bahan referensi, bukan source of truth implementasi aktif

## Active Deploy Topology
- Domain publik aktif:
  - `auth.ryvidia.my.id` -> `auth-frontend`
  - `authapi.ryvidia.my.id` -> `auth-backend`
  - `k2s.ryvidia.my.id` -> `frontend`
  - `apik2s.ryvidia.my.id` -> `backend-nginx`
  - `logbook.ryvidia.my.id` -> `logbook-frontend`
  - `apilogbook.ryvidia.my.id` -> `logbook-backend`
  - `k3.ryvidia.my.id` dan `apik3.ryvidia.my.id` -> `k3-backend`
  - `keamanan.ryvidia.my.id` dan `apikeamanan.ryvidia.my.id` -> `keamanan-backend`
- Gateway pusat berjalan HTTP internal di port `8080`; terminasi TLS diasumsikan terjadi di layer luar.
- Khusus K3 dan Keamanan, upstream deploy aktif mengarah ke backend, bukan container frontend terpisah.
- Khusus K2S, jalur request publik ke Laravel melewati `backend-nginx`, bukan langsung ke container `backend`.

## Cross-Service Dependencies
- Auth adalah issuer SSO pusat untuk K2S, Logbook, dan K3.
- K2S bergantung pada:
  - MySQL `db`
  - wrapper `backend/wrapping` untuk external DNP
  - `whatsapp-api` untuk bridge WAHA/WhatsApp
  - queue database worker untuk job async Laravel
- Logbook backend memvalidasi bearer token terhadap issuer/audience/JWKS dari Auth.
- K3 backend memvalidasi JWT ke Auth dan memiliki integrasi Google Drive OAuth.
- Keamanan sudah ikut deploy pusat, tetapi pola auth/data production-nya masih lebih sederhana dibanding K2S/Logbook/K3.
- Perubahan pada client ID, secret, issuer, redirect URI, atau JWKS hampir selalu berdampak lintas service dan harus dicek end-to-end.

## Build And Test Commands
- Central Docker dari root repo:
  - `cp .env.central.example .env.central`
  - `docker compose --env-file .env.central -f docker-compose.central.yml up -d --build`
  - restart bersih tanpa hapus volume:
    - `docker compose --env-file .env.central -f docker-compose.central.yml down`
    - `docker compose --env-file .env.central -f docker-compose.central.yml up -d --build`
  - jangan gunakan `down -v` kecuali memang ingin menghapus database
- `Auth` frontend:
  - `cd Auth && npm install && npm run dev`
  - `cd Auth && npm run build`
- `Auth/backend`:
  - `cd Auth/backend && cp .env.example .env && npm install && npm run dev`
  - `cd Auth/backend && npm test`
  - utilitas: `npm run migrate:dry-run`, `npm run migrate:apply`, `npm run user:password -- --user <user> --password <pass>`
- `K2S-Web-Project` frontend:
  - `cd K2S-Web-Project && npm install && npm run dev`
  - `cd K2S-Web-Project && npm run lint && npm run typecheck && npm run build`
- `K2S-Web-Project/backend` Laravel:
  - `cd K2S-Web-Project/backend && composer install`
  - `cp .env.example .env && php artisan key:generate`
  - `php artisan migrate --force`
  - `php artisan serve`
  - `php artisan queue:work`
  - `composer test`
  - alternatif dev terpadu: `composer dev`
- `K2S-Web-Project/backend/wrapping`:
  - `cd K2S-Web-Project/backend/wrapping && pip install -r requirements.txt`
  - `python app.py`
- `K2S-Web-Project/backend/whatsapp_api`:
  - `cd K2S-Web-Project/backend/whatsapp_api && pip install -r requirements.txt`
  - `python app.py`
- `Logbook/backend`:
  - `cd Logbook/backend && cp .env.example .env && npm install`
  - `npm run prisma:generate`
  - `npm run prisma:push`
  - `npm run start:dev`
  - `npm run build`
- `Logbook/frontend`:
  - `cd Logbook/frontend && cp .env.example .env && npm install && npm run dev`
  - `npm run build`
- `K3/backend`:
  - `cd K3/backend && cp .env.example .env && npm install`
  - `npm run prisma:push`
  - `npm run start:dev`
  - `npm run build`
- `K3/frontend`:
  - `cd K3/frontend && npm install && npm run dev`
- `Keamanan/backend`:
  - `cd Keamanan/backend && npm install`
  - `npm run prisma:push`
  - `npm run prisma:seed`
  - `npm run start:dev`
  - `npm run build`
- `Keamanan/frontend`:
  - `cd Keamanan/frontend && npm install && npm run dev`
  - `npm run build`

## Code Style Guidelines
- Ikuti gaya yang sudah ada per service; jangan paksa satu standar lintas stack.
- Frontend React/TypeScript:
  - gunakan function component, ESM import, dan ikuti alias/import pattern yang sudah dipakai
  - pertahankan struktur existing, misalnya `pages/components/lib`, dan jangan memindahkan concern tanpa alasan
  - jangan anggap `.env` frontend lokal aman untuk build production; deploy aktif lebih banyak dipaksa dari compose/build args
- Backend Node/Nest/Express:
  - pertahankan boundary kecil dan jelas antara controller/route, service, auth, dan data access
  - validasi input dan normalisasi data dilakukan sedekat mungkin dengan boundary request
- Backend Laravel:
  - ikuti konvensi Laravel 12: controller tipis, route eksplisit, middleware/service untuk auth dan permission
  - untuk area sensitif K2S, perhatikan middleware seperti `auth.api`, `admin`, `external-dnp-access`, dan `signed`
- Python services:
  - `backend/wrapping` dan `backend/whatsapp_api` punya responsibility berbeda; jangan dicampur
- Infrastruktur:
  - perubahan `gateway.conf`, `docker-compose.central.yml`, `.env.central.example`, dan env runtime lintas service harus dianggap satu paket perubahan
- Hindari mengubah `.env`, secret, private key, file build, atau volume data kecuali memang diminta.

## Testing Instructions
- Coverage otomatis belum merata; minimum verification mengikuti service yang disentuh.
- Minimum per area:
  - frontend Vite umum: `npm run build`
  - `K2S-Web-Project`: `npm run lint && npm run typecheck && npm run build`
  - `K2S-Web-Project/backend`: `composer test`
  - `K2S-Web-Project/backend/whatsapp_api`: `python3 -m py_compile app.py`
  - `Logbook/backend`: `npm run build`; jika schema berubah, tambah `npm run prisma:generate` dan `npm run prisma:push`
  - `Auth/backend`: `npm test`
  - `K3/backend`: `npm run build`
  - `Keamanan/backend`: `npm run build`; jika data bootstrap disentuh, jalankan `npm run prisma:seed`
- Untuk perubahan auth/SSO/infrastruktur, lakukan smoke test lintas service:
  - auth portal terbuka
  - `/.well-known/openid-configuration` hidup
  - `/.well-known/jwks.json` hidup
  - frontend `k2s`, `logbook`, `k3`, `keamanan` terbuka
  - API tiap domain merespons lewat gateway
  - flow login/callback tidak gagal karena mismatch issuer, audience, secret, atau redirect URI
- Setelah recreate container upstream yang dirujuk Nginx, restart `gateway` agar resolusi DNS container segar lagi.

## Security Considerations
- Repo memuat file `.env` lokal dan material sensitif; jangan salin nilainya ke dokumentasi atau commit baru.
- Ganti semua kredensial default sebelum deploy:
  - password MySQL/Postgres di `.env.central`
  - dev admin `Auth/backend`
  - OIDC client secret
  - Google OAuth secret
  - token internal wrapper/WhatsApp
- `Auth/backend/data/jwks-private.json` dan file JWK privat lain tidak boleh menjadi key production yang ter-commit.
- K2S, Logbook, dan K3 sensitif terhadap sinkronisasi:
  - issuer
  - audience
  - JWKS URL
  - client ID / client secret
  - redirect URI / post logout URI
- Build frontend production untuk K2S, Logbook, dan K3 tidak boleh bocor `localhost` atau dev secret ke bundle.
- `K3` Google OAuth sangat sensitif terhadap `redirect_uri_mismatch`; env deploy harus sama persis dengan konfigurasi Google Cloud Console.
- Laravel K2S memakai signed routes untuk beberapa file/download; pertahankan middleware `signed` atau `signed:relative` bila sudah ada.
- `K2S-Web-Project/backend/whatsapp_api` harus menjaga sinkronisasi `WHATSAPP_BOT_INTERNAL_TOKEN`, `WAHA_API_BASE_URL`, `WAHA_API_KEY`, dan session name.
- Tombol purge/import massal atau operasi bulk lain di service terkait harus diperlakukan sebagai operasi berisiko tinggi.

## Folder Guides
- `Auth/AGENTS.md`: portal auth dan auth backend/OIDC
- `K2S-Web-Project/AGENTS.md`: frontend K2S, Laravel backend, wrapper DNP, dan `whatsapp_api`
- `Logbook/AGENTS.md`: frontend/backend logbook dan detail Prisma/import
- `K3/AGENTS.md`: dashboard/checklist audit K3 dan Google Drive OAuth
- `Keamanan/AGENTS.md`: dashboard keamanan
- `deploy/AGENTS.md`: gateway/infrastruktur deploy
- `folder_referensi/AGENTS.md`: referensi non-production
- `legacy_file/AGENTS.md`: arsip legacy/non-runtime

## Working Rules For Future Changes
- Bila tugas menyentuh satu service saja, baca `AGENTS.md` di folder service itu sebelum mengubah kode.
- Bila tugas melanjutkan refactor frontend K2S, baca juga `K2S-Web-Project/refactor_process.md` setelah `K2S-Web-Project/AGENTS.md` agar konteks tahap refactor terakhir tidak hilang.
- Bila tugas butuh memahami struktur frontend/backend K2S lebih cepat, baca juga:
  - `K2S-Web-Project/arsitekltur.md` untuk arsitektur frontend
  - `K2S-Web-Project/backend/arsitektur.md` untuk arsitektur backend
- Bila tugas menyentuh domain, gateway, env deploy, SSO, atau compose, baca juga `deploy/AGENTS.md` dan cek `docker-compose.central.yml`.
- Jangan jadikan `legacy_file` atau `folder_referensi` sebagai dasar perubahan runtime tanpa verifikasi silang ke service aktif.
- Jika ada mismatch antara dokumentasi dan file runtime aktual, prioritaskan file runtime lalu update dokumentasinya.
