# AGENTS.md

## Project Overview
- Folder ini adalah service utama K2S.
- Terdiri dari:
  - frontend React + TypeScript + Vite di root folder ini.
  - `K2S-Web-Project/backend`: backend Laravel 12 + Sanctum + queue + signed file URLs.
  - `K2S-Web-Project/backend/wrapping`: wrapper Python untuk otomasi/integrasi DNP eksternal.
  - `K2S-Web-Project/backend/whatsapp_api`: service Python untuk bridge WAHA, webhook WhatsApp, session/QR WAHA, dan pengiriman pesan dari menu admin.
- Area K2S yang sensitif saat ini:
  - `external DNP` memakai kombinasi frontend, Laravel, queue, dan wrapper Python.
  - menu admin `WhatsApp API` memakai frontend K2S, endpoint admin Laravel, dan service `backend/whatsapp_api`.
  - `send-batch` pada menu admin `WhatsApp API` sekarang diproses oleh queue Laravel, bukan request sinkron langsung.
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
- WhatsApp API Python:
  - `cd K2S-Web-Project/backend/whatsapp_api`
  - `pip install -r requirements.txt`
  - `python app.py`
- Docker central dari root repo:
  - `docker compose --env-file .env.central -f docker-compose.central.yml up -d --build`

## Code Style Guidelines
- Frontend:
  - React function component + TypeScript.
  - pertahankan struktur page/component/lib yang sudah besar dan modular.
  - styling mengikuti Tailwind/shadcn yang sudah ada; jangan mencampur pola styling baru tanpa alasan kuat.
  - untuk halaman admin `WhatsApp API`, pertahankan pola state lokal per card/pengiriman dan hindari memecah UX batch menjadi flow terpisah tanpa alasan kuat.
  - jika mengubah formatter atau payload kirim WhatsApp, jaga konsistensi dengan fitur `Preview Pesan`.
- Backend Laravel:
  - ikuti konvensi controller, model, migration, middleware, dan route Laravel.
  - route API sudah eksplisit dan padat; perubahan auth/permission sebaiknya lewat middleware atau service security yang sudah ada.
  - untuk fitur SSO, lihat area `app/Security/Sso`.
  - untuk fitur WhatsApp API, lebih aman jika Laravel membentuk pesan final lalu Python hanya meneruskan ke WAHA; hindari loop sinkron Laravel -> Python -> Laravel untuk flow admin.
- Wrapper:
  - perubahan harus minimal dan terukur karena menyentuh otomasi eksternal dan file artefak.
  - `backend/wrapping` dan `backend/whatsapp_api` adalah service berbeda; jangan campur responsibility-nya.

## Testing Instructions
- Frontend minimum:
  - `cd K2S-Web-Project && npm run lint && npm run typecheck && npm run build`
- Backend minimum:
  - `cd K2S-Web-Project/backend && composer test`
  - bila menyentuh storage/upload, jalankan juga skenario manual file upload/download.
  - bila menyentuh queue/job, verifikasi worker dengan `php artisan queue:work`.
  - bila menyentuh `send-batch` WhatsApp, verifikasi job Laravel berjalan dan delay antar nomor tetap hanya aktif saat target lebih dari satu nomor.
- Wrapper:
  - tidak terlihat suite test formal; lakukan smoke test endpoint/flow yang terhubung ke backend.
- WhatsApp API Python:
  - minimum `cd K2S-Web-Project/backend/whatsapp_api && python3 -m py_compile app.py`
  - bila menyentuh webhook/bot command, uji `/help` dan minimal satu command `/temuan ...`
  - bila menyentuh admin session WAHA, verifikasi load status, QR, logout, dan sesi baru
  - bila menyentuh menu admin kirim, verifikasi preview pesan dan satu pengiriman nyata atau mock ke nomor uji
- Docker:
  - verifikasi MySQL sehat, migrasi berjalan via `backend-init`, API hidup lewat `backend-nginx`, dan frontend dapat memanggil API.

## Security Considerations
- Banyak endpoint sensitif berada di bawah middleware `auth.api`, `admin`, `external-dnp-access`, dan `signed`; jangan melepas middleware tersebut saat refactor.
- File download publik tertentu diamankan dengan signed URL; pastikan route name dan signature tetap konsisten.
- Konfigurasi SSO/K2S bergantung pada `AUTH_MODE`, `SSO_*`, `CORS_ALLOW_ORIGINS`, dan `SANCTUM_STATEFUL_DOMAINS`.
- Wrapper memakai token internal (`EXTERNAL_DNP_WRAPPER_INTERNAL_TOKEN`) dan secret key. Treat sebagai secret.
- `backend/whatsapp_api` juga memakai token internal bersama Laravel, serta kredensial/URL WAHA. Sinkronkan `WHATSAPP_BOT_INTERNAL_TOKEN`, `WAHA_API_BASE_URL`, webhook path, dan session name.
- Untuk dev lokal, waspadai deadlock jika flow admin membuat Laravel memanggil Python lalu Python memanggil Laravel lagi saat server web berjalan single-threaded.
- Untuk flow admin `WhatsApp API`, pertahankan arsitektur `Laravel format pesan -> queue/job Laravel -> Python forward ke WAHA` agar request admin tidak tertahan lama.
- Upload evidence/file ada di backend; pastikan limit ukuran, storage path, dan akses publik tetap terkontrol.
- Seeder/akun admin default di dokumentasi lama bersifat sementara dan harus diganti untuk environment nyata.
