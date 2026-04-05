# K2S Backend

Backend ini adalah aplikasi Laravel 12 untuk K2S.

## Komponen Runtime

- API Laravel utama
- queue worker untuk job/background processing
- `backend-init` untuk migrasi awal di Docker
- `backend-nginx` sebagai reverse proxy internal PHP-FPM
- integrasi ke:
  - SSO/Auth pusat
  - wrapper DNP
  - `whatsapp_api`

## Menjalankan Lokal

```bash
cd K2S-Web-Project/backend
cp .env.example .env
composer install
php artisan key:generate
php artisan migrate --force
php artisan serve
```

Queue worker:

```bash
php artisan queue:work
```

Test:

```bash
composer test
```

## Area Sensitif

- auth / SSO
- signed file routes
- queue jobs
- integrasi `external DNP`
- integrasi `whatsapp_api`
- admin `Kelola User`

## Catatan Deploy

- Deploy terpusat sekarang memakai `docker-compose.central.yml` dari root repo.
- K2S frontend production berjalan di:
  - `https://k2s.ryvidia.my.id`
- API K2S production berjalan di:
  - `https://apik2s.ryvidia.my.id`
- Jika backend/frontend upstream direcreate, restart `central-gateway` agar Nginx tidak memegang IP container lama.

## Konfigurasi Penting

- SSO:
  - `AUTH_MODE`
  - `SSO_ISSUER`
  - `SSO_AUDIENCE`
  - `SSO_JWKS_URL`
  - `SSO_AUTHORIZE_URL`
  - `SSO_TOKEN_URL`
  - `SSO_END_SESSION_URL`
  - `SSO_CLIENT_ID`
- Session/CORS:
  - `SESSION_SECURE_COOKIE`
  - `SESSION_SAME_SITE`
  - `CORS_ALLOW_ORIGINS`
  - `SANCTUM_STATEFUL_DOMAINS`
- WhatsApp bridge:
  - `WHATSAPP_API_SERVICE_URL`
  - `WHATSAPP_BOT_INTERNAL_TOKEN`
- External DNP:
  - `EXTERNAL_DNP_WRAPPER_URL`
  - `EXTERNAL_DNP_WRAPPER_INTERNAL_TOKEN`

## File Access

- Untuk non-Docker lokal, jalankan `php artisan storage:link` bila perlu.
- Di deploy Docker, file sensitif sebaiknya tetap diakses lewat endpoint auth/signed Laravel, bukan path storage mentah.

## Referensi

- `backend/docs/openapi.yaml`
- `backend/docs/AUTH_SSO_MIGRATION.md`
