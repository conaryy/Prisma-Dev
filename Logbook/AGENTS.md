# AGENTS.md — Logbook Service

Service pencatatan logbook harian operasional ATC (Tower, APP, Teknik) dengan fitur import Excel dan semantic search.

---

## Struktur Direktori

```
Logbook/
├── backend/                    # NestJS + Prisma (PostgreSQL)
│   ├── src/
│   │   ├── main.ts            # Entry point
│   │   ├── app.module.ts      # Root module
│   │   ├── auth/              # SSO JWT authentication
│   │   │   ├── sso-auth.guard.ts
│   │   │   ├── sso-jwt.strategy.ts
│   │   │   └── current-user.decorator.ts
│   │   ├── common/
│   │   │   └── current-user.ts
│   │   ├── database/
│   │   │   ├── database.module.ts
│   │   │   └── prisma.service.ts
│   │   ├── health/            # Health check endpoint
│   │   ├── logbook/           # Core logbook module
│   │   │   ├── logbook.controller.ts   # REST endpoints
│   │   │   ├── logbook.service.ts      # Business logic
│   │   │   ├── logbook.module.ts
│   │   │   ├── dto/           # Query & import DTOs
│   │   │   └── imports/       # Excel parsers (tower, app, teknik)
│   │   ├── semantic-search/   # Semantic search module
│   │   │   ├── semantic-search.controller.ts
│   │   │   ├── semantic-search.service.ts
│   │   │   ├── semantic-search.indexing.ts
│   │   │   ├── semantic-search.embedding.ts
│   │   │   ├── semantic-search.documents.ts
│   │   │   ├── semantic-search.filters.ts
│   │   │   └── semantic-search.config.ts
│   │   ├── scripts/
│   │   │   └── semantic-seed.ts
│   │   └── types/
│   ├── prisma/
│   │   └── schema.prisma      # Database schema
│   ├── package.json
│   └── Dockerfile
├── frontend/                   # React/Vite/TypeScript
│   ├── src/
│   │   ├── pages/
│   │   │   ├── Dashboard.tsx
│   │   │   ├── LogbookHarian.tsx
│   │   │   ├── RekapLogbook.tsx
│   │   │   ├── ImportManagement.tsx
│   │   │   └── AuthCallback.tsx
│   │   ├── components/
│   │   ├── hooks/
│   │   ├── lib/
│   │   └── types/
│   └── package.json
└── README.md
```

---

## Tech Stack

| Layer | Teknologi |
|-------|-----------|
| Backend | NestJS, TypeScript |
| ORM | Prisma (PostgreSQL) |
| Auth | passport-jwt + jwks-rsa (SSO JWT validation) |
| File Import | xlsx library (Excel parsing) |
| Semantic Search | Custom embedding + indexing (in-process) |
| Frontend | React 18, TypeScript, Vite, Tailwind, react-router-dom v7 |

---

## Database Schema (PostgreSQL — Prisma)

| Model | Tabel | Fungsi |
|-------|-------|--------|
| `TowerLogbookEntry` | `tower_logbook_entries` | Logbook Tower/TWR |
| `AppLogbookEntry` | `app_logbook_entries` | Logbook APP (Approach) |
| `TeknikLogbookEntry` | `teknik_logbook_entries` | Logbook Teknik |
| `LogbookImportBatch` | `logbook_import_batches` | Batch import metadata |
| `LogbookImportSource` | `logbook_import_sources` | Raw source rows per batch |
| `LogbookImportError` | `logbook_import_errors` | Validation errors per batch |
| `LogbookAuditTrail` | `logbook_audit_trails` | Audit trail (who did what) |
| `LogbookIntegrityRecord` | `logbook_integrity_records` | Hash integrity records |

---

## API Endpoints (prefix: /api/v1)

### Logbook
- `GET /logbook/me` — Current user session & permissions
- `GET /logbook/entries` — List entries (paginated, filterable by category/year/month/search)
- `POST /logbook/import/tower` — Import Tower logbook (Excel .xlsx)
- `POST /logbook/import/app` — Import APP logbook (Excel .xlsx)
- `POST /logbook/import/teknik` — Import Teknik logbook (Excel .xlsx)
- `GET /logbook/import-batches` — List import batches
- `GET /logbook/import-batches/:batchId` — Batch detail
- `GET /logbook/import-batches/:batchId/errors` — Batch errors
- `POST /logbook/import-batches/:batchId/rollback` — Rollback batch
- `DELETE /logbook/purge` — Purge all logbook data (admin)

### Semantic Search
- `GET /logbook/search/semantic/status` — Index status
- `POST /logbook/search/semantic` — Search (query, limit, filters)
- `POST /logbook/search/semantic/reindex` — Trigger reindex

### Health
- `GET /health` — Health check

---

## Logbook Categories

| Category | Model | Fields Khusus |
|----------|-------|---------------|
| `tower` | TowerLogbookEntry | operationType, facility, callSign, description |
| `app` | AppLogbookEntry | operationType, facility, callSign, description |
| `teknik` | TeknikLogbookEntry | equipment, frequencySection, incident |

---

## Import Flow

1. User upload file `.xlsx` via frontend
2. Backend parse Excel menggunakan parser spesifik (tower/app/teknik)
3. Validasi per-row, catat errors
4. Insert valid rows ke tabel logbook
5. Simpan metadata batch (total, valid, invalid, status)
6. Support reimport (replace batch lama)

---

## Konfigurasi (Environment)

| Env Var | Fungsi |
|---------|--------|
| `DATABASE_URL` | PostgreSQL connection (Prisma) |
| `PORT` | Backend port (default: 3105) |
| `LOGBOOK_CORS_ALLOW_ORIGINS` | CORS origins |
| `LOGBOOK_SSO_ISSUER` | SSO issuer URL |
| `LOGBOOK_SSO_AUDIENCE` | JWT audience |
| `LOGBOOK_SSO_JWKS_URL` | JWKS endpoint for JWT validation |

---

## Cara Development Lokal

```bash
# Backend
cd Logbook/backend
npm install
npx prisma db push        # Sync schema ke DB
npm run start:dev          # NestJS watch mode (port 3105)

# Frontend
cd Logbook/frontend
npm install
npm run dev                # Vite dev server (port 5175)
```

---

## Konvensi & Tips

- Prisma schema di `prisma/schema.prisma` — setelah edit, jalankan `npx prisma generate`.
- Semua endpoint dilindungi `SsoAuthGuard` (JWT validation via JWKS).
- Import parsers di `src/logbook/imports/` — satu parser per kategori logbook.
- Semantic search berjalan in-process (tidak butuh external service).
- Reindex semantic search via endpoint atau script: `npm run semantic:seed`.
- File upload max 15MB (Excel .xlsx only).
- Audit trail otomatis dicatat untuk operasi import, rollback, dan purge.
