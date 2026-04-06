# AGENTS.md

## Project Overview
- Folder ini adalah service utama K2S.
- Terdiri dari:
  - frontend React + TypeScript + Vite di root folder ini
  - `backend`: Laravel 12 + Sanctum + queue + signed file URLs
  - `backend/wrapping`: wrapper Python untuk integrasi DNP eksternal
  - `backend/whatsapp_api`: service Python untuk bridge WAHA, webhook/session QR, dan pengiriman pesan admin
- Area sensitif saat ini:
  - flow SSO K2S ke auth pusat
  - menu admin `WhatsApp API`
  - menu admin `Kelola User`
  - `external DNP`
- Pada `docker-compose.central.yml`, service K2S mencakup `backend-init`, `backend`, `queue-worker`, `wrapper`, `whatsapp-api`, `backend-nginx`, dan `frontend`.

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
- WhatsApp API Python:
  - `cd K2S-Web-Project/backend/whatsapp_api`
  - `pip install -r requirements.txt`
  - `python app.py`
- Docker central dari root repo:
  - `docker compose --env-file .env.central -f docker-compose.central.yml up -d --build`

## Code Style Guidelines
- Frontend:
  - React function component + TypeScript
  - pertahankan struktur `pages/components/lib`
  - styling mengikuti Tailwind/shadcn yang sudah ada
- Untuk SSO frontend:
  - `src/lib/sso.ts` sekarang punya fallback production-aware ke `https://authapi.ryvidia.my.id`
  - build production harus menerima `VITE_SSO_*` dari compose; jangan biarkan fallback localhost bocor ke bundle deploy
- Untuk route admin:
  - `/admin/users` sekarang memakai halaman lokal K2S, bukan redirect ke auth portal
  - jangan kembalikan route itu ke handoff eksternal tanpa alasan yang jelas
- Backend Laravel:
  - ikuti konvensi controller/model/migration/middleware Laravel
  - perubahan auth/permission sebaiknya lewat middleware atau service security
- Wrapper:
  - `backend/wrapping` dan `backend/whatsapp_api` adalah service berbeda; jangan campur responsibility

## Testing Instructions
- Frontend minimum:
  - `cd K2S-Web-Project && npm run lint && npm run typecheck && npm run build`
- Backend minimum:
  - `cd K2S-Web-Project/backend && composer test`
  - bila menyentuh queue/job, verifikasi worker dengan `php artisan queue:work`
  - bila menyentuh storage/upload, lakukan skenario manual upload/download
- WhatsApp API Python:
  - minimum `python3 -m py_compile app.py`
  - uji load status sesi, QR, logout, sesi baru, dan satu pengiriman uji
- Verifikasi khusus deploy:
  - `frontend` harus terbuka di `k2s.ryvidia.my.id`
  - API lewat `apik2s.ryvidia.my.id`
  - jika `frontend` atau upstream K2S direcreate, restart `gateway` agar Nginx tidak menahan IP container lama

## Security Considerations
- Banyak endpoint sensitif berada di bawah middleware `auth.api`, `admin`, `external-dnp-access`, dan `signed`; jangan melepas middleware tersebut.
- Konfigurasi SSO/K2S bergantung pada `AUTH_MODE`, `SSO_*`, `CORS_ALLOW_ORIGINS`, dan `SANCTUM_STATEFUL_DOMAINS`.
- `whatsapp_api` memakai `WHATSAPP_BOT_INTERNAL_TOKEN` dan endpoint WAHA; sinkronkan dengan `.env.central`.
- Compose sempat membentuk cycle `backend -> whatsapp-api -> backend-nginx -> backend`; hindari menambah `depends_on` yang memutar lagi.
- Untuk deploy, jangan gunakan `docker compose down -v` kecuali memang ingin menghapus volume DB.
- Setelah recreate `backend`, `queue-worker`, atau `backend-nginx`, restart `gateway` agar upstream Nginx pusat tidak menahan resolusi container lama.
