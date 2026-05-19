# AGENTS.md — Prisma-Dev (K2S Platform)

Dokumen ini memberikan konteks bagi AI agent yang bekerja di repository ini.

---

## Gambaran Umum Project

Platform **K2S (Keselamatan, Keamanan, dan K3)** adalah sistem multi-service untuk manajemen audit keselamatan penerbangan (AirNav). Repository ini berisi seluruh source code dalam bentuk monorepo dengan arsitektur microservices yang di-deploy via Docker Compose.

---

## Struktur Direktori

```
Prisma-Dev/
├── Auth/                    # SSO/OIDC Auth Service (custom)
│   ├── backend/             # Express.js + PostgreSQL (jose library)
│   ├── src/                 # Frontend React/Vite/TypeScript
│   └── Dockerfile
├── K2S-Web-Project/         # Aplikasi utama K2S
│   ├── backend/             # Laravel 12 (PHP 8.2, MySQL)
│   │   ├── wrapping/        # Python Flask microservice - DNP scraper (:5001)
│   │   └── whatsapp_api/    # Python Flask microservice - WA bridge (:5002)
│   ├── src/                 # Frontend React/TypeScript/Vite
│   └── package.json
├── Logbook/                 # Service Logbook
│   ├── backend/             # NestJS + Prisma (PostgreSQL)
│   └── frontend/            # React/Vite
├── K3/                      # Service K3 (Checklist Audit)
│   ├── backend/             # NestJS + Prisma (PostgreSQL)
│   └── frontend/            # React/Vite
├── Keamanan/                # Service Keamanan (Dashboard)
│   ├── backend/             # NestJS + Prisma (PostgreSQL)
│   └── frontend/            # Bundled with backend at build time
├── deploy/
│   └── nginx/gateway.conf   # Nginx reverse proxy config
├── docker-compose.central.yml
├── .env.central.example     # Template environment variables
└── DEPLOY_CENTRAL.md        # Panduan deployment
```

---

## Tech Stack

| Layer | Teknologi |
|-------|-----------|
| Frontend (semua service) | React 18, TypeScript, Vite, Tailwind CSS, Radix UI / shadcn/ui |
| K2S Backend | Laravel 12 (PHP 8.2), Sanctum, Eloquent ORM |
| Auth Backend | Express.js (Node.js), jose (JWT/JWKS), PostgreSQL |
| Logbook Backend | NestJS, Prisma ORM, PostgreSQL |
| K3 Backend | NestJS, Prisma ORM, PostgreSQL, Google Drive API |
| Keamanan Backend | NestJS, Prisma ORM, PostgreSQL |
| Python Microservices | Flask (wrapping DNP scraper, WhatsApp API bridge) |
| Database | MySQL 8.0 (K2S), PostgreSQL 16 (Auth, Logbook, K3, Keamanan) |
| Infrastructure | Docker Compose, Nginx gateway |

---

## Arsitektur & Alur Request

```
Browser → Nginx Gateway (:8080) → route by subdomain:
  ├── auth.* / authapi.*       → Auth Service (frontend :80 / backend :3104)
  ├── k2s.*                    → K2S Frontend (:80)
  ├── apik2s.*                 → K2S Backend via backend-nginx → php-fpm
  ├── logbook.* / apilogbook.* → Logbook (frontend :80 / backend :3105)
  ├── k3.* / apik3.*           → K3 Backend (:3106, serves frontend too)
  └── keamanan.* / apikeamanan.* → Keamanan Backend (:3107, serves frontend too)
```

---

## Autentikasi & Keamanan

- **SSO terpusat** via Auth Service (OIDC + PKCE flow).
- Setiap service memvalidasi JWT via JWKS endpoint (`/.well-known/jwks.json`).
- Internal service-to-service auth menggunakan header `X-Internal-Token` (HMAC timing-safe).
- File evidence diakses via **Laravel Signed URL** (expiry + signature).
- Role-based access: `Admin`, `Viewer`, `External DNP` dengan permission granular per lokasi.

---

## Database

| Service | Database Name | Engine | Catatan |
|---------|--------------|--------|---------|
| K2S Core | `k2s` | MySQL 8.0 | ~60 tabel, Eloquent ORM |
| Auth | `sso_auth` | PostgreSQL 16 | Users, clients, sessions, tokens |
| Logbook | `logbook` | PostgreSQL 16 | Prisma ORM |
| K3 | `k3_audit` | PostgreSQL 16 | Prisma ORM |
| Keamanan | `keamanan` | PostgreSQL 16 | Prisma ORM |

---

## Cara Menjalankan (Docker Compose)

```bash
# 1. Siapkan env
cp .env.central.example .env.central
# Edit .env.central sesuai kebutuhan (minimal: APP_KEY, passwords, domains)

# 2. Build & run semua service
docker compose --env-file .env.central -f docker-compose.central.yml up -d --build

# 3. Verifikasi
docker ps
curl -I -H "Host: authapi.ryvidia.my.id" http://127.0.0.1:8080/.well-known/openid-configuration
```

Untuk development lokal per-service, lihat `package.json` atau `composer.json` di masing-masing folder.

---

## Konvensi Kode

### Umum
- Bahasa komentar dan dokumentasi: **Bahasa Indonesia** (kecuali kode dan nama variabel).
- Nama variabel, fungsi, class: **English**.
- Indentasi: 2 spaces (JS/TS), 4 spaces (PHP/Python).

### Frontend (React/TypeScript)
- Component naming: PascalCase.
- File naming: PascalCase untuk komponen, camelCase untuk utils/hooks.
- State management: React Context + hooks (tidak pakai Redux).
- UI library: Radix UI primitives + shadcn/ui components.
- Form handling: react-hook-form + zod validation.
- Routing: react-router-dom v7.

### K2S Backend (Laravel)
- Controller di `app/Http/Controllers/Api/`.
- Route definitions di `routes/api.php`.
- Migrations di `database/migrations/`.
- Queue jobs untuk operasi async (export/import DNP).
- Auth via middleware: `auth:sanctum` atau custom SSO JWT middleware.

### Satellite Backends (NestJS)
- Prisma sebagai ORM — schema di `prisma/schema.prisma`.
- Module-based architecture (auth, database, domain modules).
- JWT validation via `passport-jwt` + `jwks-rsa`.

### Auth Backend (Express)
- Plain Express.js tanpa framework tambahan.
- Route files di `src/routes/` (admin, oauth, public).
- Crypto operations via `jose` library.
- Database queries via `pg` (raw SQL, no ORM).

### Python Microservices
- Flask apps dengan token auth via `X-Internal-Token`.
- `wrapping/` — scraper untuk portal DNP eksternal.
- `whatsapp_api/` — bridge ke WAHA (WhatsApp HTTP API).

---

## Environment Variables

Semua env var terpusat di `.env.central` (untuk Docker Compose).
Template lengkap: `.env.central.example`.

Kategori utama:
- `APP_*` — Laravel app config
- `DB_*` — MySQL (K2S core)
- `AUTH_*` — Auth service config & client credentials
- `LOGBOOK_*` — Logbook service
- `K3_*` — K3 service
- `KEAMANAN_*` — Keamanan service
- `SSO_*` — SSO/OIDC config untuk K2S backend
- `EXTERNAL_DNP_*` — DNP scraper config
- `WHATSAPP_*` / `WAHA_*` — WhatsApp integration

---

## Domain / Hostname

Production domains (configurable via env):

| Subdomain | Service |
|-----------|---------|
| `auth.ryvidia.my.id` | Auth Frontend |
| `authapi.ryvidia.my.id` | Auth Backend API |
| `k2s.ryvidia.my.id` | K2S Frontend |
| `apik2s.ryvidia.my.id` | K2S Backend API |
| `logbook.ryvidia.my.id` | Logbook Frontend |
| `apilogbook.ryvidia.my.id` | Logbook Backend API |
| `k3.ryvidia.my.id` | K3 Frontend |
| `apik3.ryvidia.my.id` | K3 Backend API |
| `keamanan.ryvidia.my.id` | Keamanan Frontend |
| `apikeamanan.ryvidia.my.id` | Keamanan Backend API |

---

## Fitur Utama K2S

1. **Self Assessment** — Audit internal per area/sesi, jawaban SA/NA/NS, evidence upload.
2. **CAP (Corrective Action Plan)** — Penyusunan, review, pemenuhan, perpanjangan deadline.
3. **Export/Import DNP** — Sinkronisasi data ke/dari portal DNP eksternal (async via queue).
4. **Certification Notes** — Catatan sertifikasi per lokasi dengan evidence.
5. **Dashboard** — Trend modul, summary CAP, insight.
6. **Notifikasi** — System notifications + WhatsApp bot integration.
7. **Logbook** — Pencatatan harian dengan semantic search.
8. **K3 Audit** — Checklist audit K3 dengan Google Drive evidence storage.
9. **Keamanan** — Dashboard keamanan bandara.

---

## Tips untuk AI Agent

- Jangan edit `.env.central` langsung — gunakan `.env.central.example` sebagai referensi.
- Saat mengubah API di satu service, periksa apakah service lain bergantung padanya (terutama Auth ↔ semua service).
- K2S backend punya queue worker terpisah — perubahan pada Job class perlu di-test dengan queue running.
- Frontend build membutuhkan env vars (VITE_*) saat build time, bukan runtime.
- Prisma schema changes di satellite services perlu `prisma generate` dan `prisma db push` / `prisma migrate dev`.
- Laravel migrations di K2S backend dijalankan otomatis oleh `backend-init` container saat deploy.
- Gateway Nginx perlu di-restart jika container upstream di-recreate (untuk resolve IP baru).
- File secrets (JWK, tokens) tidak boleh di-commit — gunakan env vars atau Docker secrets.

---

## File Penting untuk Referensi

- `docker-compose.central.yml` — Orchestration semua service
- `.env.central.example` — Template lengkap environment variables
- `deploy/nginx/gateway.conf` — Routing rules per subdomain
- `DEPLOY_CENTRAL.md` — Panduan deployment step-by-step
- `mermaid_arsitektur_k2s.md` — Diagram arsitektur lengkap (Mermaid)
- `K2S-Web-Project/backend/routes/api.php` — Semua API routes K2S
- `Auth/backend/src/routes/` — OAuth & admin routes Auth service

---

## Ganti Domain

Saat mengganti domain (misal dari `ryvidia.my.id` ke `systennup.my.id`), file yang perlu diubah:

| # | File | Yang diubah |
|---|------|-------------|
| 1 | `.env.central` | Semua URL domain: `AUTH_*`, `VITE_*`, `SSO_*`, `CORS_ALLOW_ORIGINS`, `SANCTUM_STATEFUL_DOMAINS`, `LOGBOOK_*`, `K3_*`, `KEAMANAN_*`, semua redirect/callback URIs |
| 2 | `deploy/nginx/gateway.conf` | Semua `server_name` directives |
| 3 | `K2S-Web-Project/backend/docker/nginx.conf` | CORS origin regex (`$http_origin` matching) |

Setelah edit, **wajib full rebuild** (karena VITE_* ter-embed di frontend bundle saat build):

```bash
sudo docker compose --env-file .env.central -f docker-compose.central.yml down
sudo docker compose --env-file .env.central -f docker-compose.central.yml build --no-cache
sudo docker compose --env-file .env.central -f docker-compose.central.yml up -d
```

Jangan lupa:
- Update Cloudflare Tunnel / DNS ke domain baru.
- Kalau pakai Google Drive (K3), update Authorized Redirect URI di Google Cloud Console.
- Database tidak perlu diubah.
- JWK signing key (`deploy/secrets/auth-jwk.json`) tidak perlu diubah.
