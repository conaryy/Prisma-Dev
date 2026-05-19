# AGENTS.md — K2S-Web-Project

Aplikasi utama platform K2S. Terdiri dari frontend React SPA dan backend Laravel 12, plus dua Python microservices (DNP scraper & WhatsApp bridge).

---

## Struktur Direktori

```
K2S-Web-Project/
├── src/                         # Frontend React/TypeScript/Vite
│   ├── App.tsx                  # Router utama (lazy-loaded pages)
│   ├── AppShell.tsx             # Layout shell (sidebar, header)
│   ├── main.tsx                 # Entry point
│   ├── pages/                   # Halaman-halaman
│   │   ├── admin/               # Admin-only pages
│   │   ├── external-dnp/        # External DNP pages
│   │   ├── Dashboard.tsx
│   │   ├── Login.tsx
│   │   ├── AuthCallback.tsx
│   │   └── ...                  # ~57 page components
│   ├── components/              # Reusable UI components
│   │   └── auth/                # RequireAuth, RequireAdmin, RequireExternalDnp
│   ├── contexts/                # React Context (AppDataContext, DashboardContext)
│   ├── hooks/                   # Custom hooks
│   ├── lib/                     # Utilities
│   ├── types/                   # TypeScript type definitions
│   └── data/                    # Static data
├── backend/                     # Laravel 12 (PHP 8.2)
│   ├── app/
│   │   ├── Http/
│   │   │   ├── Controllers/Api/ # 40 API controllers
│   │   │   └── Middleware/
│   │   │       ├── AuthenticateApiRequest.php  # SSO JWT / Sanctum auth
│   │   │       ├── EnsureAdmin.php
│   │   │       ├── EnsureExternalDnpAccess.php
│   │   │       └── EnsureInternalApiToken.php
│   │   ├── Jobs/                # Queue jobs (async operations)
│   │   │   ├── RunExternalDnpSync.php
│   │   │   ├── RunSelfAssessmentExportDnpImport.php
│   │   │   ├── RunSelfAssessmentImportDnpInject.php
│   │   │   ├── RunSelfAssessmentQuestionImport.php
│   │   │   └── RunWhatsappBatchSend.php
│   │   ├── Models/              # ~60 Eloquent models
│   │   └── Security/Sso/       # OIDC token validator, user synchronizer
│   ├── routes/
│   │   └── api.php             # Semua API routes (~327 lines)
│   ├── database/
│   │   ├── migrations/         # ~30+ migration files
│   │   └── seeders/
│   ├── config/                 # Laravel config files
│   ├── storage/                # File uploads, logs
│   ├── wrapping/               # Python Flask - DNP Scraper (:5001)
│   │   ├── app.py
│   │   ├── requirements.txt
│   │   ├── Dockerfile
│   │   └── templates/
│   ├── whatsapp_api/           # Python Flask - WhatsApp Bridge (:5002)
│   │   ├── app.py
│   │   ├── requirements.txt
│   │   └── Dockerfile
│   ├── Dockerfile              # PHP-FPM container
│   ├── composer.json
│   └── docker/                 # Nginx config for backend-nginx
├── package.json                # Frontend dependencies
├── vite.config.ts
├── tailwind.config.js
└── tsconfig.json
```

---

## Tech Stack

| Layer | Teknologi |
|-------|-----------|
| Frontend | React 18, TypeScript, Vite, Tailwind CSS, Radix UI / shadcn/ui |
| Forms | react-hook-form + zod |
| Routing | react-router-dom v7 (lazy loading) |
| Charts | recharts |
| Backend | Laravel 12, PHP 8.2 |
| ORM | Eloquent |
| Auth | SSO JWT (OIDC) + Sanctum (fallback/hybrid) |
| Queue | Laravel Queue (database driver) |
| Database | MySQL 8.0 |
| Microservices | Python Flask (wrapping, whatsapp_api) |

---

## API Routes Overview (routes/api.php)

### Public (no auth)
- `POST /api/auth/login` — Local login (Sanctum)
- `GET /api/auth/sso-config` — SSO configuration for frontend
- `GET /api/self-assessment/evidence/{id}/signed` — Signed file download
- `GET /api/self-assessment/cap/fulfillment-files/{file}/signed` — Signed CAP file
- Various other signed download routes

### Authenticated (middleware: AuthenticateApiRequest)
- `GET/PATCH /api/profile` — User profile
- `GET /api/notifications` — System notifications
- `GET /api/instansi` — Instansi data
- `GET /api/self-assessment/questions` — SA questions
- `GET /api/self-assessment/sessions` — SA sessions
- `POST /api/self-assessment/answers/bulk` — Submit answers
- `GET /api/self-assessment/cap` — CAP list
- `POST /api/self-assessment/cap/{cap}/fulfillments` — Submit CAP fulfillment
- `GET /api/certification-notes/{locationSlug}` — Certification notes
- Resources: facilities, organizations, personil, certificates, agenda, audits, inspections, monitoring, findings, follow-ups

### Admin Only (middleware: admin)
- `GET /api/dashboard/admin-module-trend` — Dashboard trends
- CRUD `/api/users` — User management
- `POST /api/admin/self-assessment/sessions` — Create SA session
- `POST /api/admin/self-assessment/questions` — Manage questions
- Import/Export DNP endpoints
- WhatsApp admin endpoints

### External DNP (middleware: external-dnp-access)
- `GET /api/external-dnp/sessions` — DNP sessions
- `GET /api/external-dnp/caps` — DNP CAPs
- Sync endpoints with captcha

### Internal Service-to-Service
- `POST /api/internal/auth/users/sync` — User sync from Auth service
- `GET /api/internal/whatsapp/external-dnp/temuan` — WhatsApp bot data

---

## Middleware Stack

| Middleware | Fungsi |
|-----------|--------|
| `AuthenticateApiRequest` | Validate JWT (SSO) atau Sanctum token. Support mode: `sso`, `local`, `hybrid` |
| `EnsureAdmin` | Cek `role === 'Admin'` |
| `EnsureExternalDnpAccess` | Cek permission `can_access_external_dnp` |
| `EnsureInternalApiToken` | Validate `X-Internal-Token` header (HMAC timing-safe) |

---

## Auth Mode

Dikonfigurasi via `AUTH_MODE` env var:

| Mode | Behavior |
|------|----------|
| `sso` | Hanya terima JWT dari Auth Service (production) |
| `local` | Hanya Sanctum token (standalone dev) |
| `hybrid` | Coba Sanctum dulu, fallback ke SSO JWT |

---

## Queue Jobs

| Job | Fungsi |
|-----|--------|
| `RunExternalDnpSync` | Sync data dari portal DNP eksternal (scraping) |
| `RunSelfAssessmentExportDnpImport` | Export hasil SA ke portal DNP |
| `RunSelfAssessmentImportDnpInject` | Import pertanyaan dari DNP |
| `RunSelfAssessmentQuestionImport` | Import pertanyaan dari file |
| `RunWhatsappBatchSend` | Kirim batch WhatsApp notifications |

Queue worker berjalan di container terpisah (`k2s-queue-worker`).

---

## Python Microservices

### wrapping/ (DNP Scraper, port 5001)
- Flask app yang melakukan web scraping ke portal DNP eksternal.
- Auth: `X-Internal-Token` header (env: `EXTERNAL_DNP_WRAPPER_INTERNAL_TOKEN`).
- Fungsi: login ke portal DNP, scrape data pertanyaan/jawaban, submit data.

### whatsapp_api/ (WhatsApp Bridge, port 5002)
- Flask app sebagai bridge ke WAHA (WhatsApp HTTP API).
- Auth: `X-Internal-Token` header (env: `WHATSAPP_BOT_INTERNAL_TOKEN`).
- Fungsi: kirim pesan WhatsApp, cek session status, handle webhook dari WAHA.

---

## Frontend Architecture

### Routing & Auth Guards
- `RequireAuth` — Redirect ke login jika belum authenticated
- `RequireAdmin` — Hanya role Admin
- `RequireExternalDnp` — Hanya user dengan akses External DNP

### State Management
- `AppDataContext` — Global app state (user, permissions, instansi)
- `DashboardContext` — Dashboard-specific state

### Page Categories
| Kategori | Pages |
|----------|-------|
| Dashboard | Dashboard, AdminDashboard |
| Self Assessment | AuditSelfAssessment, InspeksiSelfAssessment, MonitoringSelfAssessment, Surveillance |
| CAP | CapDraft, CapFulfillment, CapReview (per modul) |
| External DNP | ExternalDnpAudit/Inspeksi/Surveillance CAP pages |
| Instansi | Profil, Fasilitas, Organisasi, Personil, Sertifikat |
| Certification | CatatanSertifikasi, PemenuhanSertifikat |
| Admin | UserManagement, SelfAssessmentSessions, Questions, ExportDnp, ImportDnp, WhatsApp |
| Pengawasan | Agenda, Temuan, FollowUp |

---

## Database (MySQL)

~60 tabel, grouped:

| Group | Tabel Utama |
|-------|-------------|
| User & Auth | `users`, `personal_access_tokens` |
| Self Assessment | `self_assessment_questions`, `_sessions`, `_session_areas`, `_answers`, `_evidences`, `_reviews`, `_results` |
| CAP | `self_assessment_caps`, `_cap_reviews`, `_cap_fulfillments`, `_cap_fulfillment_files`, `_cap_extensions` |
| External DNP | `external_dnp_sessions`, `_areas`, `_questions`, `_caps`, `_export_dnp_snapshots`, `_export_dnp_pairings` |
| Certification | `certification_note_tables`, `_rows`, `_evidence_files` |
| Instansi | `instansis`, `facilities`, `facility_groups`, `organizations`, `personil`, `certificates` |
| Pengawasan | `agendas`, `audits`, `inspections`, `monitorings`, `findings`, `follow_ups`, `follow_up_histories` |
| Notifikasi | `system_notifications`, `whatsapp_notification_panels`, `whatsapp_user_notification_recipients` |
| Queue | `jobs`, `failed_jobs` |

---

## Cara Development Lokal

### Backend (Laravel)
```bash
cd K2S-Web-Project/backend
composer install
cp .env.example .env
php artisan key:generate
php artisan migrate
php artisan serve          # port 8000

# Queue worker (terminal terpisah)
php artisan queue:work --tries=1

# Atau all-in-one:
composer dev
```

### Frontend
```bash
cd K2S-Web-Project
npm install
npm run dev               # Vite dev server (port 5173)
```

---

## Konvensi & Tips

- **Controllers** selalu di `app/Http/Controllers/Api/` — jangan buat controller di luar namespace ini.
- **Models** menggunakan Eloquent — relasi didefinisikan di model, bukan di controller.
- **Migrations** bernama dengan timestamp prefix — jangan rename migration yang sudah di-deploy.
- **Frontend pages** menggunakan lazy loading — setiap page di-import via `lazy()` di App.tsx.
- **File uploads** disimpan di `storage/` (non-public) — akses via signed URL.
- **Queue jobs** untuk operasi berat (scraping, batch send) — jangan jalankan synchronous di controller.
- **Internal API** (`/api/internal/*`) hanya boleh diakses oleh service lain via `X-Internal-Token`.
- **SSO claims** di-map ke user lokal via `SsoUserSynchronizer` — user otomatis dibuat/diupdate saat login SSO.
- **Frontend env vars** (`VITE_*`) di-inject saat build time — perubahan perlu rebuild.
- **Jangan edit** `vendor/` atau `node_modules/` — gunakan composer/npm untuk dependency.

---

## Ganti Domain — CORS Nginx Config

Saat ganti domain, selain `.env.central`, file `backend/docker/nginx.conf` juga **wajib diubah**.

File ini berisi regex CORS yang menentukan origin mana yang diizinkan di level Nginx (sebelum request sampai ke Laravel):

```nginx
# backend/docker/nginx.conf — baris ini perlu diupdate:
if ($http_origin ~* "^https://([a-z0-9-]+\.)?(ryvidia|systennup)\.my\.id$") {
    set $cors_origin $http_origin;
}
```

Tambahkan domain baru ke regex di atas. Contoh menambah `newdomain.com`:

```nginx
if ($http_origin ~* "^https://([a-z0-9-]+\.)?(ryvidia|systennup|newdomain)\.my\.id$") {
    set $cors_origin $http_origin;
}
```

Setelah edit, rebuild container `backend-nginx` dan restart gateway:

```bash
sudo docker compose --env-file .env.central -f docker-compose.central.yml up -d --build --force-recreate backend-nginx
sudo docker compose --env-file .env.central -f docker-compose.central.yml restart gateway
```

**Kenapa ini penting:**
- Nginx (`k2s-backend-nginx`) handle preflight OPTIONS request langsung — tanpa meneruskan ke PHP.
- Kalau origin tidak match regex, `Access-Control-Allow-Origin` tidak dikirim → browser block semua request sebagai "CORS error".
- Laravel CORS config (`config/cors.php`) hanya berlaku untuk request yang sampai ke PHP (non-OPTIONS).
