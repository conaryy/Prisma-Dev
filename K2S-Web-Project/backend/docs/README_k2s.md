# Backend K2S (Laravel + SSO)

Backend K2S sekarang bukan lagi panduan Sanctum awal semata, tetapi aplikasi Laravel yang sudah terhubung ke SSO pusat dan queue/background services.

## Langkah Lokal

```bash
cd K2S-Web-Project/backend
cp .env.example .env
composer install
php artisan key:generate
php artisan migrate --force
php artisan serve
```

Worker:

```bash
php artisan queue:work
```

## Konfigurasi Auth

Perhatikan env berikut:

- `AUTH_MODE`
- `SSO_ISSUER`
- `SSO_AUDIENCE`
- `SSO_JWKS_URL`
- `SSO_AUTHORIZE_URL`
- `SSO_TOKEN_URL`
- `SSO_END_SESSION_URL`
- `SSO_CLIENT_ID`

Jika deploy production terpusat, domain aktif saat ini:

- `https://k2s.ryvidia.my.id`
- `https://apik2s.ryvidia.my.id`

## Upload dan Storage

- `php artisan storage:link` dibutuhkan untuk skenario non-Docker lokal tertentu.
- File sensitif dan download terproteksi sebaiknya tetap lewat endpoint signed/auth.

## Seeder dan Akun

- Seeder hanya untuk development/internal setup.
- Jangan andalkan akun admin default lama untuk production.

## Referensi

- `backend/docs/openapi.yaml`
- `backend/docs/AUTH_SSO_MIGRATION.md`
