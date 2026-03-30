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
- `Logbook` sudah tersedia sebagai profile opsional (`--profile logbook`).
- `K3` dan `Keamanan` belum dimasukkan karena belum punya Dockerfile deploy final.
- Setelah masing-masing siap, tambah service baru ke compose pusat dan route baru di `deploy/nginx/gateway.conf`.
- Contoh domain `example.com` hanya placeholder, ganti dengan domain production Anda.

Logbook sudah tersedia sebagai profile opsional:

```bash
docker compose --env-file .env.central -f docker-compose.central.yml --profile logbook up -d --build
```

Catatan:
- Profile `logbook` menambahkan `logbook-frontend` dan `logbook-backend`.
- Routing domain `logbook.*` di `gateway.conf` belum diaktifkan default agar gateway utama tidak gagal saat profile `logbook` tidak dijalankan.

## 5) Uji SSO Lokal (Opsional)

Central compose menyediakan profile `sso-local` untuk menjalankan Keycloak lokal.

Jalankan:

```bash
docker compose --env-file .env.central -f docker-compose.central.yml --profile sso-local up -d --build
```

Endpoint Keycloak default:

- Admin Console: `http://localhost:8080/admin`
- Realm metadata: `http://localhost:8080/realms/<realm>/.well-known/openid-configuration`

Langkah ringkas:

1. Buat realm (contoh `prisma-dev`).
2. Buat client OIDC (contoh `prisma-auth`).
3. Set redirect URI untuk Auth/K2S lokal.
4. Ubah `.env.central` ke `AUTH_MODE=hybrid`, lalu isi `SSO_*` dari realm tersebut.
5. Restart stack compose setelah perubahan env.
