# K2S Auth Migration to SSO (OIDC)

Dokumen ini menjelaskan migrasi auth K2S dari token lokal Sanctum ke SSO terpusat berbasis OIDC.

## Mode Operasi

`AUTH_MODE` mendukung tiga mode:

- `local`: hanya login/password lokal + token Sanctum.
- `hybrid`: terima token Sanctum lama, dan terima bearer token OIDC.
- `sso`: hanya bearer token OIDC.

## Konfigurasi Env

Minimum untuk `hybrid`/`sso`:

- `SSO_ISSUER`
- `SSO_AUDIENCE`
- `SSO_JWKS_URL`
- `SSO_CLIENT_ID`
- `SSO_AUTHORIZE_URL` (frontend redirect)

Opsional:

- `SSO_TOKEN_URL`
- `SSO_END_SESSION_URL`
- `SSO_SCOPE`
- `SSO_*_ROLES` untuk mapping role claim -> role lokal K2S.
- `SSO_PROVISION_USERS=true|false` untuk auto-provision user lokal.

## Endpoint Auth Tambahan

- `GET /api/auth/sso-config`
  - Mengembalikan mode auth aktif dan metadata SSO agar frontend bisa switch flow.

## User Sync

Saat request menggunakan bearer token OIDC:

1. token diverifikasi (`iss`, `aud`, `exp`, signature RS256 via JWKS),
2. user dicari berdasarkan prioritas:
   - `sso_subject`
   - `email`
   - `username`
3. role claim dimapping ke role lokal:
   - `Admin`, `Viewer`
4. akses external DNP dimapping dari role SSO.

Kolom baru tabel `users`:

- `sso_subject` (unique, nullable)
- `sso_provider` (nullable)
- `last_sso_login_at` (nullable)

## Rekomendasi Rollout

1. Deploy mode `hybrid` di production.
2. Integrasikan frontend login redirect ke IdP (menggunakan `/api/auth/sso-config`).
3. Verifikasi semua route protected bekerja dengan token OIDC.
4. Setelah stabil, ganti ke mode `sso`.
5. Nonaktifkan credential login UI untuk user non-admin platform.

## Catatan Keamanan

- Gunakan HTTPS end-to-end di production.
- Batasi TTL access token (5-15 menit), gunakan refresh token rotation di IdP.
- Set `SSO_PROVISION_USERS=false` bila provisioning user harus lewat approval admin.
- Pastikan role claim dari IdP hanya dikeluarkan oleh realm/client tepercaya.
