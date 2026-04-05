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
- password database:
  - `DB_PASSWORD`, `DB_ROOT_PASSWORD`
  - `AUTH_DB_PASSWORD`
  - `LOGBOOK_DB_PASSWORD`
  - `K3_DB_PASSWORD`
  - `KEAMANAN_DB_PASSWORD`
- domain dan callback production di:
  - `BACKEND_APP_URL`
  - `VITE_API_BASE_URL`
  - `AUTH_BASE_URL`
  - `AUTH_ISSUER`
  - `AUTH_LOGIN_UI_URL`
  - `AUTH_VITE_API_BASE_URL`
  - `AUTH_VITE_K2S_BASE_URL`
  - `AUTH_VITE_LOGBOOK_BASE_URL`
  - `AUTH_VITE_K3_BASE_URL`
  - `AUTH_VITE_KEAMANAN_BASE_URL`
  - `AUTH_DEFAULT_REDIRECT_URI`
  - `AUTH_LOGBOOK_REDIRECT_URI`
  - `AUTH_K3_REDIRECT_URI`
  - `LOGBOOK_VITE_SSO_*`
  - `K3_SSO_*`
  - `K3_GOOGLE_REDIRECT_URI`
  - `CORS_ALLOW_ORIGINS`
  - `SANCTUM_STATEFUL_DOMAINS`
- jika pakai SSO pusat: `AUTH_MODE=sso` dan isi `SSO_*`
- jika pakai WhatsApp admin:
  - `WHATSAPP_API_SERVICE_URL`
  - `WHATSAPP_BOT_INTERNAL_TOKEN`
  - `WAHA_API_BASE_URL`
  - `WAHA_API_KEY`

## 2) Jalankan

```bash
docker compose --env-file .env.central -f docker-compose.central.yml up -d --build
```

Untuk restart bersih tanpa menghapus database:

```bash
docker compose --env-file .env.central -f docker-compose.central.yml down
docker compose --env-file .env.central -f docker-compose.central.yml up -d --build
```

Jangan jalankan `down -v` kecuali memang ingin menghapus seluruh volume database.

## 3) Hostname Production

Hostname yang dipakai saat ini:

- `auth.ryvidia.my.id`
- `authapi.ryvidia.my.id`
- `k2s.ryvidia.my.id`
- `apik2s.ryvidia.my.id`
- `logbook.ryvidia.my.id`
- `apilogbook.ryvidia.my.id`
- `k3.ryvidia.my.id`
- `apik3.ryvidia.my.id`
- `keamanan.ryvidia.my.id`
- `apikeamanan.ryvidia.my.id`

Pastikan semua hostname publik tersebut diarahkan ke gateway pusat melalui Cloudflare Tunnel atau reverse proxy yang sama.

## 4) Verifikasi Setelah Up

Cek container:

```bash
docker ps
```

Cek log penting:

```bash
docker logs central-gateway --tail 50
docker logs auth-backend --tail 50
docker logs logbook-backend --tail 50
docker logs k3-backend --tail 50
docker logs whatsapp-api --tail 50
```

Smoke test lokal via gateway:

```bash
curl -I -H "Host: authapi.ryvidia.my.id" http://127.0.0.1:8080/.well-known/openid-configuration
curl -I -H "Host: k2s.ryvidia.my.id" http://127.0.0.1:8080/
curl -I -H "Host: apilogbook.ryvidia.my.id" http://127.0.0.1:8080/api/v1/health
curl -I -H "Host: apik3.ryvidia.my.id" http://127.0.0.1:8080/api/google-drive/callback
```

Catatan penting:
- jika frontend/backend upstream direcreate, restart `gateway` agar Nginx me-resolve IP container terbaru.
- tanpa restart gateway, Anda bisa kena `502 Bad Gateway` meskipun container upstream sebenarnya sehat.

## 5) Catatan Service

- Compose pusat sekarang mengorkestrasi:
  - `Auth`
  - full stack `K2S`
  - `Logbook`
  - `K3`
  - `Keamanan`
  - `whatsapp-api`
- `Auth/backend` sekarang PostgreSQL-only.
- `K3` sekarang ikut SSO pusat dan memakai Google Drive OAuth.
- `Logbook` dan `K3` frontend production sensitif terhadap build env; jangan biarkan `.env` lokal dev bocor ke bundle deploy.

## 6) Google OAuth K3

Untuk fitur Google Drive di `K3`, pastikan OAuth Client Google memiliki `Authorized redirect URIs` yang cocok persis dengan env deploy:

```text
https://apik3.ryvidia.my.id/api/google-drive/callback
```

Jika tidak cocok, Google akan mengembalikan `redirect_uri_mismatch`.

## 7) Uji SSO Lokal (Opsional)

Central compose menyediakan profile `sso-local` untuk menjalankan Keycloak lokal.

Jalankan:

```bash
docker compose --env-file .env.central -f docker-compose.central.yml --profile sso-local up -d --build
```

Endpoint Keycloak default:
- Admin Console: `http://localhost:8080/admin`
- Realm metadata: `http://localhost:8080/realms/<realm>/.well-known/openid-configuration`

Langkah ringkas:
1. Buat realm.
2. Buat client OIDC.
3. Set redirect URI untuk Auth/K2S/Logbook/K3 lokal.
4. Ubah `.env.central` ke `AUTH_MODE=hybrid`, lalu isi `SSO_*`.
5. Restart stack compose setelah perubahan env.
