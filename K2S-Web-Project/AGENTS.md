# AGENTS.md

## Project Overview
- Folder ini adalah service utama K2S.
- Terdiri dari:
  - `K2S-Web-Project/`: frontend React + TypeScript + Vite.
  - `K2S-Web-Project/backend`: backend Laravel 12 + Sanctum + queue + signed file URLs.
  - `K2S-Web-Project/backend/wrapping`: wrapper Python untuk otomasi/integrasi DNP eksternal.
- Pada `docker-compose.central.yml`, service K2S mencakup `backend-init`, `backend`, `queue-worker`, `wrapper`, `backend-nginx`, dan `frontend`.

## Build And Test Commands
- Frontend:
  - `cd K2S-Web-Project`
  - `npm install`
  - `npm run dev`
  - `npm run build`
  - `npm run lint`
  - `npm run typecheck`
- Backend Laravel:
  - `cd K2S-Web-Project/backend`
  - `composer install`
  - `cp .env.example .env`
  - `php artisan key:generate`
  - `php artisan migrate --force`
  - `php artisan serve`
  - `php artisan queue:work`
  - `composer test`
- Wrapper Python:
  - `cd K2S-Web-Project/backend/wrapping`
  - `pip install -r requirements.txt`
  - `python app.py`
- Docker central dari root repo:
  - `docker compose --env-file .env.central -f docker-compose.central.yml up -d --build`

## Code Style Guidelines
- Frontend:
  - React function component + TypeScript.
  - pertahankan struktur page/component/lib yang sudah besar dan modular.
  - styling mengikuti Tailwind/shadcn yang sudah ada; jangan mencampur pola styling baru tanpa alasan kuat.
- Backend Laravel:
  - ikuti konvensi controller, model, migration, middleware, dan route Laravel.
  - route API sudah eksplisit dan padat; perubahan auth/permission sebaiknya lewat middleware atau service security yang sudah ada.
  - untuk fitur SSO, lihat area `app/Security/Sso`.
- Wrapper:
  - perubahan harus minimal dan terukur karena menyentuh otomasi eksternal dan file artefak.

## Testing Instructions
- Frontend minimum:
  - `cd K2S-Web-Project && npm run lint && npm run typecheck && npm run build`
- Backend minimum:
  - `cd K2S-Web-Project/backend && composer test`
  - bila menyentuh storage/upload, jalankan juga skenario manual file upload/download.
  - bila menyentuh queue/job, verifikasi worker dengan `php artisan queue:work`.
- Wrapper:
  - tidak terlihat suite test formal; lakukan smoke test endpoint/flow yang terhubung ke backend.
- Docker:
  - verifikasi MySQL sehat, migrasi berjalan via `backend-init`, API hidup lewat `backend-nginx`, dan frontend dapat memanggil API.

## Security Considerations
- Banyak endpoint sensitif berada di bawah middleware `auth.api`, `admin`, `external-dnp-access`, dan `signed`; jangan melepas middleware tersebut saat refactor.
- File download publik tertentu diamankan dengan signed URL; pastikan route name dan signature tetap konsisten.
- Konfigurasi SSO/K2S bergantung pada `AUTH_MODE`, `SSO_*`, `CORS_ALLOW_ORIGINS`, dan `SANCTUM_STATEFUL_DOMAINS`.
- Wrapper memakai token internal (`EXTERNAL_DNP_WRAPPER_INTERNAL_TOKEN`) dan secret key. Treat sebagai secret.
- Upload evidence/file ada di backend; pastikan limit ukuran, storage path, dan akses publik tetap terkontrol.
- Seeder/akun admin default di dokumentasi lama bersifat sementara dan harus diganti untuk environment nyata.
