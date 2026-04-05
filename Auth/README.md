# Auth Frontend

Frontend login terpisah untuk auth portal pusat.

## Status Arsitektur

- `Auth` sekarang dibagi 2:
  - `Auth` (frontend portal)
  - `Auth/backend` (auth service Express/OIDC)
- Jalur deploy aktif:
  - frontend: `https://auth.ryvidia.my.id`
  - backend: `https://authapi.ryvidia.my.id`
- Portal ini sekarang menjadi launcher pusat untuk:
  - K2S
  - Logbook
  - K3
  - Keamanan

## Catatan Penting

- Frontend auth tidak boleh lagi fallback ke `localhost` pada environment production non-localhost.
- Build frontend menerima:
  - `VITE_API_BASE_URL`
  - `VITE_SSO_AUTH_BASE_URL`
  - `VITE_K2S_BASE_URL`
  - `VITE_LOGBOOK_BASE_URL`
  - `VITE_K3_BASE_URL`
  - `VITE_KEAMANAN_BASE_URL`
- Untuk K2S, handoff portal memakai flow OIDC ke `/login?sso=1&return_to=...`, bukan redirect token sederhana.

## Menjalankan

```bash
cp .env.example .env
npm install
npm run dev
```

## Menjalankan Backend Auth

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

## Verifikasi Minimum

- buka halaman login
- login admin lokal
- verifikasi `/portal-admin`
- verifikasi launcher ke:
  - `k2s.ryvidia.my.id`
  - `logbook.ryvidia.my.id`
  - `k3.ryvidia.my.id`
  - `keamanan.ryvidia.my.id`
- verifikasi API auth backend:
  - `/.well-known/openid-configuration`
  - `/.well-known/jwks.json`
