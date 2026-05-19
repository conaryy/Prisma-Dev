# AGENTS.md — K3 Service

Service checklist audit K3 (Keselamatan dan Kesehatan Kerja) dengan analisis dokumen Word dan integrasi Google Drive untuk penyimpanan evidence.

---

## Struktur Direktori

```
K3/
├── backend/                       # NestJS + Prisma (PostgreSQL)
│   ├── src/
│   │   ├── main.ts               # Entry point
│   │   ├── app.module.ts         # Root module
│   │   ├── app.controller.ts     # Semua REST endpoints
│   │   ├── checklist-audit.service.ts  # Logic analisis dokumen audit
│   │   ├── google-drive.service.ts     # Google Drive OAuth & file ops
│   │   ├── google-drive-callback.controller.ts  # OAuth callback handler
│   │   ├── auth/
│   │   │   ├── sso-auth.guard.ts
│   │   │   ├── sso-jwt.strategy.ts
│   │   │   └── current-user.decorator.ts
│   │   ├── common/
│   │   │   └── current-user.ts
│   │   └── database/
│   │       ├── database.module.ts
│   │       └── prisma.service.ts
│   ├── prisma/
│   │   └── schema.prisma         # Database schema
│   ├── package.json
│   └── Dockerfile
├── frontend/                      # React/Vite/TypeScript
│   ├── src/
│   │   ├── pages/
│   │   │   ├── DashboardPage.tsx
│   │   │   ├── ChecklistAuditPage.tsx
│   │   │   ├── UploadDocumentsPage.tsx
│   │   │   └── AuthCallback.tsx
│   │   ├── components/
│   │   └── lib/
│   └── package.json
└── README.md
```

---

## Tech Stack

| Layer | Teknologi |
|-------|-----------|
| Backend | NestJS, TypeScript |
| ORM | Prisma (PostgreSQL) |
| Auth | passport-jwt + jwks-rsa (SSO JWT) |
| Document Parsing | mammoth (Word .docx → analysis) |
| Cloud Storage | Google Drive API (googleapis) |
| Frontend | React 18, TypeScript, Vite, react-router-dom v7 |

---

## Database Schema (PostgreSQL — Prisma)

| Model | Tabel | Fungsi |
|-------|-------|--------|
| `K3AuditDocument` | `k3_audit_documents` | Dokumen audit yang dianalisis (metadata + analysisJson) |
| `K3GoogleDriveConnection` | `k3_google_drive_connections` | OAuth connection per user (refresh token) |
| `K3GoogleDriveAuthState` | `k3_google_drive_auth_states` | Temporary OAuth state (CSRF protection) |

---

## API Endpoints

### Session
- `GET /api/me` — Current user info

### Checklist Audit
- `GET /api/checklist-audit/latest` — Latest analysis result
- `GET /api/checklist-audit/documents` — List all audit documents
- `GET /api/checklist-audit/documents/:documentId` — Document detail + analysis
- `DELETE /api/checklist-audit/documents/:documentId` — Delete document
- `POST /api/checklist-audit/analyze` — Upload & analyze Word document (.docx)
- `POST /api/checklist-audit/:questionCode/files` — Upload evidence file per question
- `POST /api/checklist-audit/:questionCode/files/sync-drive` — Sync evidence to Google Drive
- `DELETE /api/checklist-audit/:questionCode/files/:fileId` — Delete evidence file
- `POST /api/checklist-audit/groups` — Create question group
- `PATCH /api/checklist-audit/groups/:groupId` — Update question group
- `DELETE /api/checklist-audit/groups/:groupId` — Delete question group

### Google Drive
- `GET /api/google-drive/status` — Connection status for current user
- `POST /api/google-drive/connect-url` — Generate OAuth authorization URL
- `POST /api/google-drive/disconnect` — Disconnect Google Drive
- `GET /api/google-drive/folders` — List folders in Drive
- `GET /api/google-drive/callback` — OAuth callback (redirect from Google)

---

## Alur Kerja Utama

### 1. Analisis Dokumen Audit
```
Upload .docx → mammoth parse → extract checklist criteria →
calculate compliance % → store analysisJson di DB
```

### 2. Evidence Management
```
Upload file evidence per question code →
store locally → optional sync ke Google Drive folder
```

### 3. Google Drive Integration
```
User connect Google account (OAuth2) →
refresh token stored di DB →
evidence files synced ke folder di Drive
```

---

## Konfigurasi (Environment)

| Env Var | Fungsi |
|---------|--------|
| `DATABASE_URL` | PostgreSQL connection (Prisma) |
| `PORT` | Backend port (default: 3106) |
| `SSO_ISSUER` | SSO issuer URL |
| `SSO_AUDIENCE` | JWT audience |
| `SSO_JWKS_URL` | JWKS endpoint |
| `GOOGLE_CLIENT_ID` | Google OAuth client ID |
| `GOOGLE_CLIENT_SECRET` | Google OAuth client secret |
| `GOOGLE_REDIRECT_URI` | OAuth callback URL |
| `GOOGLE_DRIVE_SCOPE` | Drive API scope |
| `GOOGLE_DRIVE_ROOT_FOLDER_ID` | Root folder ID di Drive |
| `GOOGLE_DRIVE_ROOT_FOLDER_NAME` | Root folder name (default: "K3 Evidence") |
| `K3_FRONTEND_BASE_URL` | Frontend URL (untuk redirect setelah OAuth) |

---

## Cara Development Lokal

```bash
# Backend
cd K3/backend
npm install
npx prisma db push
npm run start:dev          # NestJS watch mode (port 3106)

# Frontend
cd K3/frontend
npm install
npm run dev                # Vite dev server (port 5176)
```

---

## Konvensi & Tips

- Semua endpoint dilindungi `SsoAuthGuard` kecuali Google Drive callback.
- Google Drive callback (`/api/google-drive/callback`) harus match persis dengan `GOOGLE_REDIRECT_URI`.
- Dokumen audit disimpan sebagai JSON (`analysisJson`) di DB — berisi criteria, compliance %, groups.
- Evidence files disimpan lokal (storage) dan opsional di-sync ke Google Drive.
- File upload max 15MB (document) / 20MB (evidence).
- Frontend di-build dan di-serve oleh backend saat production (single container).
- `questionCode` adalah identifier unik per butir checklist dalam dokumen audit.
