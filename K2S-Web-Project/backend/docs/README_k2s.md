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

## Export DNP Self Assessment

- Fitur `Self Assessment > Export DNP` sekarang mendukung:
  - ambil daftar area DNP
  - compare pertanyaan lokal vs DNP berbasis similarity teks
  - simpan pairing pertanyaan lokal -> pertanyaan DNP
  - export draft jawaban ke DNP
  - upload file evidence lokal ke draft DNP
- Endpoint admin aktif:
  - `POST /api/admin/self-assessment/export-dnp/init`
  - `POST /api/admin/self-assessment/export-dnp/areas`
  - `POST /api/admin/self-assessment/export-dnp/import`
  - `POST /api/admin/self-assessment/export-dnp/matches`
  - `POST /api/admin/self-assessment/export-dnp/export`
  - `GET /api/admin/self-assessment/export-dnp/jobs/{job}`
- Snapshot compare disimpan overwrite per kombinasi `session_area_id + user_id`, jadi import ulang area yang sama akan memperbarui data lama, bukan menambah snapshot baru.
- Pairing yang dipilih admin disimpan di summary snapshot compare agar state bisa pulih lagi saat halaman dibuka ulang.
- Jalur compare/export ini sangat bergantung pada wrapper Python `backend/wrapping/app.py` yang mengadopsi mekanisme dari `folder_referensi/test5`.
- Jika UI masih memunculkan error lama yang tidak sesuai kode terbaru, biasanya proses `wrapper` atau `backend` yang aktif belum direstart.

## Seeder dan Akun

- Seeder hanya untuk development/internal setup.
- Jangan andalkan akun admin default lama untuk production.

## Referensi

- `backend/docs/openapi.yaml`
- `backend/docs/AUTH_SSO_MIGRATION.md`
