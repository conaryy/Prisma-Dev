# Production Deploy Checklist (K2S)

> **Penting:** Deploy aktif platform saat ini menggunakan **orkestrasi terpusat** di root repo (`docker-compose.central.yml` + `.env.central`), bukan `docker-compose.yml` lokal yang ada di folder ini. Panduan di bawah berlaku untuk deploy **standalone** K2S saja (misalnya dev/staging lokal). Untuk deploy production terpusat, lihat `DEPLOY_CENTRAL.md` dan `deploy/AGENTS.md` di root repo.


## 1) Prepare environment

1. Copy env template:
   - `cp .env.production.example .env.production`
2. Set real secrets and domains in `.env.production`:
   - `APP_KEY`
   - `DB_PASSWORD`, `DB_ROOT_PASSWORD`
   - `BACKEND_APP_URL`, `VITE_API_BASE_URL`
   - `CORS_ALLOW_ORIGINS`, `SANCTUM_STATEFUL_DOMAINS`
   - `QUEUE_CONNECTION`
3. Jika K2S ikut SSO pusat (aktif di production):
   - `VITE_SSO_ENABLED=true`
   - `VITE_SSO_AUTH_BASE_URL` → base URL auth service (default: `https://authapi.ryvidia.my.id`)
   - `VITE_SSO_AUTHORIZE_URL` → endpoint authorize
   - `VITE_SSO_TOKEN_URL` → endpoint token exchange
   - `VITE_SSO_LOGOUT_URL` → endpoint logout
   - `VITE_SSO_CLIENT_ID` → client ID K2S (default: `k2s-web`)
   - `VITE_SSO_REDIRECT_URI` → harus cocok persis dengan yang didaftarkan di Auth service
   - `VITE_AUTH_PORTAL_URL` → URL Auth Portal untuk link cross-service
   - `VITE_ALLOW_QUERY_TOKEN` → `true` jika izinkan token via URL query param (opsional)

## 2) Build and run

1. Start containers:
   - `docker compose --env-file .env.production up -d --build`
2. Backend setup is automated by `backend-init` service:
   - `php artisan migrate --force`
   - optional seed sesuai env
3. Queue worker dijalankan oleh `queue-worker`
4. Jika `APP_KEY` masih kosong, generate sekali:
   - `docker compose --env-file .env.production exec backend php artisan key:generate --show`
   - copy value ke `.env.production`, lalu restart services

## 3) Storage and file access

- Untuk non-Docker local deploy:
  - `php artisan storage:link`
- Untuk Docker setup ini, file akses sebaiknya lewat endpoint auth/signed Laravel.

## 4) Security baseline

- `APP_ENV=production`
- `APP_DEBUG=false`
- `SESSION_SECURE_COOKIE=true` saat HTTPS
- `CORS_ALLOW_ORIGINS` harus explicit
- Rotate DB password, `APP_KEY`, dan secret internal sebelum production
- Jika fitur WhatsApp admin aktif:
  - sinkronkan `WHATSAPP_API_SERVICE_URL`
  - `WHATSAPP_BOT_INTERNAL_TOKEN`
  - `WAHA_API_BASE_URL`
  - `WAHA_API_KEY`

## 5) Post-deploy validation

- API health / app health merespons
- Login K2S via SSO berhasil
- Route admin `Kelola User` membuka halaman lokal K2S `/admin/users`
- File upload/download berjalan
- Background queue/worker berjalan
- Menu `WhatsApp API` bisa membaca status sesi WAHA

## 6) Ops notes

- Jika container `frontend` atau `backend-nginx` direcreate di deploy terpusat, restart `gateway` agar Nginx tidak menahan IP upstream lama.
- Jangan gunakan `docker compose down -v` kecuali memang ingin menghapus volume/database.
