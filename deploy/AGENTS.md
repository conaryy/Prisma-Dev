# AGENTS.md

## Project Overview
- Folder ini menyimpan artefak deploy/infrastruktur untuk gateway pusat.
- File aktif utama:
  - `deploy/nginx/gateway.conf`
- Gateway sekarang merutekan domain publik ke service container internal:
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

## Build And Test Commands
- Dari root repo:
  - `docker compose --env-file .env.central -f docker-compose.central.yml up -d --build`
- Setelah perubahan gateway:
  - recreate/restart service yang relevan
  - restart `gateway`
  - verifikasi tiap hostname dengan `curl -H "Host: ..."` ke `http://127.0.0.1:8080`

## Code Style Guidelines
- Jaga konfigurasi Nginx tetap sederhana dan eksplisit.
- Saat menambah service baru, definisikan `server_name`, `proxy_pass`, dan header proxy standar secara konsisten.
- Sinkronkan perubahan `gateway.conf` dengan `.env.central`, Cloudflare Tunnel hostname, dan build env frontend/backend.

## Testing Instructions
- Uji tiap route domain mengarah ke upstream yang benar.
- Jika frontend/backend container direcreate, restart `gateway`; Nginx bisa menahan IP upstream lama dan memicu `502`.
- Verifikasi:
  - OIDC discovery auth backend
  - K2S frontend
  - Logbook frontend + API
  - K3 frontend + API
  - Keamanan frontend + API

## Security Considerations
- Gateway internal compose tetap HTTP; TLS diterminasi di Cloudflare/tunnel.
- Header `X-Forwarded-*` harus dipertahankan agar aplikasi downstream membaca skema/origin dengan benar.
- Jangan expose upstream internal baru tanpa memastikan auth, CORS, dan health service sudah siap.
