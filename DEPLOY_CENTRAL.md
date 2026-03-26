# Central Docker Deploy

File utama:
- `docker-compose.central.yml`
- `.env.central.example`
- `deploy/nginx/gateway.conf`

## 1) Siapkan env

```bash
cp .env.central.example .env.central
```

Ubah minimal:
- `APP_KEY`
- `DB_PASSWORD`, `DB_ROOT_PASSWORD`
- Domain production di:
  - `BACKEND_APP_URL`
  - `VITE_API_BASE_URL`
  - `AUTH_VITE_API_BASE_URL`
  - `CORS_ALLOW_ORIGINS`
  - `SANCTUM_STATEFUL_DOMAINS`
- Jika pakai SSO: `AUTH_MODE=hybrid|sso` + `SSO_*`

## 2) Jalankan

```bash
docker compose --env-file .env.central -f docker-compose.central.yml up -d --build
```

## 3) Akses (Production)

Pastikan DNS mengarah ke host gateway:

```bash
auth.example.com
k2s.example.com
api.example.com
```

Lalu buka:
- `https://auth.example.com`
- `https://k2s.example.com`

API K2S:
- `https://api.example.com`

## 4) Catatan

- Compose pusat ini mengorkestrasi `Auth` + full stack `K2S`.
- `K3`, `Keamanan`, `Logbook` belum dimasukkan karena belum punya Dockerfile deploy final.
- Setelah masing-masing siap, tambah service baru ke compose pusat dan route baru di `deploy/nginx/gateway.conf`.
- Contoh domain `example.com` hanya placeholder, ganti dengan domain production Anda.
