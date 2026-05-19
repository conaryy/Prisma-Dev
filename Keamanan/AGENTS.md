# AGENTS.md — Keamanan Service

Service dashboard keamanan bandara. Mengelola data personel keamanan, fasilitas, dokumen, dan kegiatan pengawasan (audit, inspeksi, tes keamanan).

---

## Struktur Direktori

```
Keamanan/
├── backend/                       # NestJS + Prisma (PostgreSQL)
│   ├── src/
│   │   ├── main.ts               # Entry point
│   │   ├── app.module.ts         # Root module
│   │   ├── app.controller.ts     # Semua REST endpoints
│   │   ├── dashboard.service.ts  # Business logic (CRUD + dashboard)
│   │   ├── prisma.service.ts     # Prisma client wrapper
│   │   ├── auth/
│   │   │   ├── admin-auth.guard.ts          # JWT validation + admin role check
│   │   │   ├── jwks-token-verifier.service.ts  # JWKS token verification
│   │   │   └── current-user.ts
│   │   └── database/
│   │       ├── database.module.ts
│   │       └── prisma.service.ts
│   ├── prisma/
│   │   ├── schema.prisma         # Database schema
│   │   └── seed.js               # Seed data
│   ├── package.json
│   └── Dockerfile                # Multi-stage: build frontend + run backend
├── frontend/                      # React/Vite/TypeScript (SPA)
│   ├── src/
│   │   ├── App.tsx               # Main app component
│   │   ├── components/           # UI components
│   │   ├── lib/                  # Utilities
│   │   ├── styles/
│   │   └── types/
│   └── package.json
└── readme.md
```

---

## Tech Stack

| Layer | Teknologi |
|-------|-----------|
| Backend | NestJS 11, TypeScript |
| ORM | Prisma (PostgreSQL) |
| Auth | Custom JWKS token verifier (SSO JWT) |
| Frontend | React 18, TypeScript, Vite, Tailwind CSS 4 |

---

## Database Schema (PostgreSQL — Prisma)

| Model | Tabel (implicit) | Fungsi |
|-------|-------------------|--------|
| `Personnel` | `Personnel` | Data personel keamanan (nama, lokasi, lisensi, status, foto) |
| `EducationHistory` | `EducationHistory` | Riwayat pendidikan personel |
| `WorkHistory` | `WorkHistory` | Riwayat pekerjaan personel |
| `TrainingHistory` | `TrainingHistory` | Riwayat pelatihan personel |
| `SecurityFacility` | `SecurityFacility` | Fasilitas keamanan (zona, status, coverage, foto) |
| `SecurityDocument` | `SecurityDocument` | Dokumen keamanan (judul, owner, versi, status) |
| `SupervisionActivity` | `SupervisionActivity` | Kegiatan pengawasan (audit/inspeksi/tes) |
| `SupervisionEvidence` | `SupervisionEvidence` | File evidence kegiatan pengawasan |

### Enums
- `PersonnelStatus`: VALID, PERPANJANGAN, PELATIHAN
- `FacilityStatus`: OPTIMAL, PERLU_SERVIS, TERJADWAL
- `DocumentStatus`: AKTIF, REVIEW, REVISI
- `SupervisionCategory`: AUDIT, INSPEKSI, TEST
- `SupervisionStatus`: BELUM_TERLAKSANA, TERLAKSANA, PERLU_TINDAK_LANJUT

---

## API Endpoints (prefix: /api)

### Public
- `GET /api/health` — Health check

### Dashboard (no auth required for read)
- `GET /api/dashboard` — Full dashboard data (personnel, facilities, documents, supervision)

### Admin Only (AdminAuthGuard — JWT + admin role)
- `POST /api/personnel` — Create personnel
- `DELETE /api/personnel` — Clear all personnel
- `DELETE /api/personnel/:slug` — Delete personnel
- `POST /api/personnel/:slug/photo` — Upload personnel photo
- `POST /api/facilities` — Create facility (with optional photo)
- `DELETE /api/facilities/:id` — Delete facility
- `DELETE /api/documents` — Clear all documents
- `DELETE /api/documents/:sourceType/:id` — Delete document
- `PATCH /api/supervision-activities/:activityId/status` — Update supervision status
- `DELETE /api/supervision-activities/:activityId` — Delete supervision activity
- `POST /api/supervision-activities/:activityId/evidence` — Upload evidence

---

## Auth Guard

`AdminAuthGuard` melakukan:
1. Extract Bearer token dari header
2. Verify JWT via JWKS endpoint (SSO issuer)
3. Check role claim — hanya `admin` atau roles di `KEAMANAN_ADMIN_ROLES` yang diizinkan
4. Dashboard read (`GET /api/dashboard`) tidak memerlukan auth

---

## Konfigurasi (Environment)

| Env Var | Fungsi |
|---------|--------|
| `DATABASE_URL` | PostgreSQL connection (Prisma) |
| `PORT` | Backend port (default: 3107) |
| `KEAMANAN_CORS_ALLOW_ORIGINS` | CORS origins |
| `KEAMANAN_ADMIN_ROLES` | Roles yang dianggap admin (comma-separated) |
| `SSO_ISSUER` | SSO issuer URL |
| `SSO_AUDIENCE` | JWT audience |
| `SSO_JWKS_URL` | JWKS endpoint |
| `SSO_CLOCK_SKEW` | Clock skew tolerance (seconds) |
| `SSO_JWKS_CACHE_TTL` | JWKS cache TTL (seconds) |

Frontend build args (VITE_*):
| Env Var | Fungsi |
|---------|--------|
| `VITE_API_BASE_URL` | Backend API URL |
| `VITE_AUTH_PORTAL_URL` | Auth portal URL |
| `VITE_SSO_ENABLED` | Enable SSO login |
| `VITE_SSO_AUTH_BASE_URL` | SSO base URL |
| `VITE_SSO_AUTHORIZE_URL` | OAuth authorize endpoint |
| `VITE_SSO_TOKEN_URL` | OAuth token endpoint |
| `VITE_SSO_LOGOUT_URL` | Logout endpoint |
| `VITE_SSO_CLIENT_ID` | OAuth client ID |
| `VITE_SSO_REDIRECT_URI` | OAuth redirect URI |
| `VITE_SSO_SCOPE` | OAuth scope |

---

## Cara Development Lokal

```bash
# Backend
cd Keamanan/backend
npm install
npx prisma db push
npm run prisma:seed        # Seed initial data
npm run start:dev          # NestJS watch mode (port 3107)

# Frontend
cd Keamanan/frontend
npm install
npm run dev                # Vite dev server (port 5177)
```

---

## Konvensi & Tips

- Frontend di-bundle bersama backend saat Docker build (multi-stage Dockerfile).
- Backend serve static frontend di production — single container untuk keamanan service.
- `dashboard.service.ts` berisi semua business logic — controller hanya routing + validation.
- File uploads (foto personel, foto fasilitas, evidence) disimpan di `backend/uploads/`.
- Slug digunakan sebagai identifier URL-friendly untuk personnel dan facilities.
- Supervision activities memiliki schedule (year/month/week) untuk tracking jadwal pengawasan.
- Evidence files terkait dengan supervision activity (relasi one-to-many).
- Seed data tersedia via `npm run prisma:seed` untuk development.
- VITE_* env vars di-inject saat Docker build (ARG), bukan runtime.
