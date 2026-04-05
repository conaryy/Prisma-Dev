# Auth Backend

Backend ini adalah auth service Express/OIDC pusat untuk stack Prisma Dev.

## Scope

- OIDC / metadata:
  - `/.well-known/openid-configuration`
  - `/.well-known/jwks.json`
  - `/oauth/authorize`
  - `/oauth/token`
  - `/oauth/userinfo`
  - `/oauth/revoke`
- Local login session:
  - `POST /auth/ui/login`
  - `POST /auth/logout`
- Admin user management:
  - `GET /api/auth/me`
  - `GET /api/admin/users`
  - `POST /api/admin/users`
  - `PATCH /api/admin/users/:id`
  - `DELETE /api/admin/users/:id`
  - `POST /api/admin/users/:id/reset-password`

## Menjalankan

```bash
cd Auth/backend
cp .env.example .env
npm install
npm run dev
```

Default dev:
- Base URL: `http://localhost:3104`
- Database: PostgreSQL
- Dev admin:
  - username: `admin`
  - password: `Admin123!`

## OIDC Client Defaults

Auth backend mengelola minimal client:
- `k2s-web`
- `logbook-web`
- `k3-web`

Saat startup, service sekarang akan:
- insert client jika belum ada
- update `client_secret`, `redirect_uris_json`, dan `post_logout_redirect_uris_json` jika nilai env berubah

Ini penting untuk deploy production agar perubahan secret/redirect URI tidak membuat frontend `invalid_client`.

## Verifikasi

Endpoint utama:

```bash
curl -I http://localhost:3104/.well-known/openid-configuration
curl -I http://localhost:3104/.well-known/jwks.json
```

Verifikasi isi `oauth_clients`:

```bash
psql -U sso_auth -d sso_auth -c "select id, client_secret, redirect_uris_json, post_logout_redirect_uris_json from oauth_clients;"
```

## Catatan

- PKCE `S256` wajib pada `/oauth/authorize`
- Token ditandatangani `RS256` dan dipublish via JWKS
- Private JWK disimpan di `backend/data/jwks-private.json`
- Jangan commit key production
