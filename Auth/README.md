# Auth Frontend

Frontend login terpisah untuk SSO/Auth portal.

## Status Arsitektur

- `Auth` sekarang dibagi 2:
  - `Auth` (frontend portal)
  - `Auth/backend` (auth service tahap awal)
- Detail backend lihat: `Auth/backend/README.md`.

## Migrasi Bertahap (Stage-1)

- Auth masih memakai backend K2S sebagai `auth-core sementara`.
- Endpoint utama:
  - `POST /api/auth/login`
  - `GET /api/auth/me`
  - `GET /api/auth/session` (payload terstruktur untuk multi-app: user + permissions + portal links + sso config)
- Tujuan stage ini: semua aplikasi mulai konsumsi kontrak auth yang sama sebelum service auth dipisah penuh.

## Catatan

- Desain halaman login disalin dari login `K2S-Web-Project` agar tampilan konsisten.
- Endpoint default API: `http://localhost:8000` (bisa diubah via `VITE_API_BASE_URL`).
- Target portal K2S bisa diatur via `VITE_K2S_BASE_URL` (contoh: `https://k2s.example.com`).
- Target portal Logbook bisa diatur via `VITE_LOGBOOK_BASE_URL` (contoh: `https://logbook.example.com`).

## Menjalankan

```bash
cp .env.example .env
npm install
npm run dev
```

## Menjalankan Backend Auth (Stage 1-2)

```bash
cd backend
cp .env.example .env
npm install
npm run dev
```

## Build

```bash
npm run build
npm run preview
```
