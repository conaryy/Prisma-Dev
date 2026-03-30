# Auth Backend (Stage 1-2)

Backend ini adalah fondasi untuk memindahkan auth dari K2S ke service Auth terpisah (calon SSO).

## Scope Stage 1-2

- Kontrak Auth inti:
  - `/.well-known/openid-configuration`
  - `/.well-known/jwks.json`
  - `/oauth/authorize`
  - `/oauth/token`
  - `/oauth/userinfo`
  - `/oauth/revoke`
- Local login session untuk development:
  - `GET /auth/login`
  - `POST /auth/login`
  - `POST /auth/logout`
- Admin user management (via session login Auth):
  - `GET /api/auth/me`
  - `GET /api/admin/users`
  - `POST /api/admin/users`
  - `PATCH /api/admin/users/:id`
  - `DELETE /api/admin/users/:id`
  - `POST /api/admin/users/:id/reset-password`
- Penyimpanan runtime sekarang PostgreSQL penuh.

## Menjalankan

```bash
cd Auth/backend
cp .env.example .env
npm install
npm run dev
```

Default:
- Base URL: `http://localhost:4000`
- Database: PostgreSQL (`AUTH_DATABASE_URL` atau kombinasi `AUTH_PG_*`)
- Dev admin:
  - username: `admin`
  - password: `Admin123!`

## Migrasi User K2S -> Auth

Dry-run:

```bash
npm run migrate:dry-run
```

Dry-run akun tertentu:

```bash
node scripts/dry-run-k2s-users.mjs --only-user admin
```

Apply (dengan backup otomatis file SQLite):

```bash
npm run migrate:apply
```

Apply + ikut sinkron password hash dari K2S:

```bash
node scripts/dry-run-k2s-users.mjs --apply --sync-password
```

Reset / generate password user Auth:

```bash
npm run user:password -- --user admin --password Admin123!
npm run user:password -- --user user1 --generate
```

## Catatan Migrasi Ke PostgreSQL

- Runtime auth backend sudah dibersihkan menjadi PostgreSQL-only.
- Schema utama tetap ada di:
  - `sql/postgres-auth-schema.sql`
- Script operasional yang masih relevan:
  - `npm run migrate:dry-run`
  - `npm run migrate:apply`
  - `npm run user:password -- --user admin --password Admin123!`
- Artefak dan script SQLite lama sebaiknya dianggap legacy/cadangan migrasi, bukan jalur runtime utama.

## Catatan

- PKCE `S256` wajib pada endpoint `/oauth/authorize`.
- Token ditandatangani `RS256` dan public key dipublish via JWKS.
- File private JWK disimpan di `backend/data/jwks-private.json` (jangan di-commit ke production repo).
