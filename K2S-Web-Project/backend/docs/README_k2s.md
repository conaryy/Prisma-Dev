# Backend (Laravel + Sanctum)

Catatan:
- Folder backend sudah berisi project Laravel.
- Langkah di bawah hanya untuk instalasi Sanctum dan konfigurasi DB.

Langkah awal (ringkas):
1) Install Sanctum:
   composer require laravel/sanctum
   php artisan vendor:publish --provider="Laravel\\Sanctum\\SanctumServiceProvider"
   php artisan migrate
2) Update .env (DB):
   DB_DATABASE=k2s_p1
   DB_USERNAME=l12
   DB_PASSWORD=laravel12
3) Aktifkan Sanctum API:
   - Tambahkan EnsureFrontendRequestsAreStateful jika pakai cookie auth (opsional).
   - Untuk token API, cukup gunakan sanctum middleware pada route API.
4) Jalankan:
   php artisan serve

Catatan migration:
- Jika sebelumnya migrate dengan skema lama, gunakan DB baru atau `php artisan migrate:fresh`.

Catatan upload evidence:
- Jalankan `php artisan storage:link` agar URL public storage bisa diakses.

Catatan seeder:
- Jalankan `php artisan db:seed` untuk data awal (K2SSeeder).
- Admin default (sementara): user `admin`, password `admin` (segera ganti setelah login).

Catatan profile:
- Endpoint profil: PATCH /api/profile
- Endpoint ganti password: POST /api/profile/password

Catatan token:
- Atur masa berlaku token di .env: SANCTUM_EXPIRATION=1440 (menit).

Referensi kontrak API:
- backend/docs/openapi.yaml

Panduan migrasi auth ke SSO:
- backend/docs/AUTH_SSO_MIGRATION.md
