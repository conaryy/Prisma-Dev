# AGENTS.md

## Project Overview
- Folder `deploy` menyimpan artefak deploy/infrastruktur gateway pusat.
- File aktif utama:
  - `deploy/nginx/gateway.conf`
- Source of truth topologi container tetap ada di root `docker-compose.central.yml`.
- Gateway saat ini merutekan:
  - `auth.ryvidia.my.id` -> `auth-frontend`
  - `authapi.ryvidia.my.id` -> `auth-backend:3104`
  - `k2s.ryvidia.my.id` -> `frontend`
  - `apik2s.ryvidia.my.id` -> `backend-nginx:80`
  - `logbook.ryvidia.my.id` -> `logbook-frontend`
  - `apilogbook.ryvidia.my.id` -> `logbook-backend:3105`
  - `k3.ryvidia.my.id` -> `k3-backend:3106`
  - `apik3.ryvidia.my.id` -> `k3-backend:3106`
  - `keamanan.ryvidia.my.id` -> `keamanan-backend:3107`
  - `apikeamanan.ryvidia.my.id` -> `keamanan-backend:3107`
- Gateway berjalan HTTP internal di port `8080`.

## Build And Test Commands
- Dari root repo:
  - `docker compose --env-file .env.central -f docker-compose.central.yml up -d --build`
- Setelah perubahan gateway:
  - recreate/restart service relevan
  - restart `gateway`
  - verifikasi hostname dengan `curl -H "Host: ..."` ke `http://127.0.0.1:8080`

## Code Style Guidelines
- Jaga konfigurasi Nginx tetap eksplisit dan mudah dibaca.
- Saat menambah route/domain baru:
  - sinkronkan `server_name`
  - `proxy_pass`
  - header `Host`, `X-Real-IP`, `X-Forwarded-For`, `X-Forwarded-Proto`
  - env deploy dan hostname publik di layer luar
- Ingat perbedaan upstream:
  - K2S frontend dan backend terpisah
  - Logbook frontend dan backend terpisah
  - K3 dan Keamanan domain frontend/API sama-sama menuju backend

## Testing Instructions
- Uji tiap route domain mengarah ke upstream yang benar.
- Verifikasi minimum:
  - auth portal frontend
  - `/.well-known/openid-configuration`
  - `/.well-known/jwks.json`
  - K2S frontend + API
  - Logbook frontend + API
  - K3 frontend/API
  - Keamanan frontend/API
- Jika frontend/backend container direcreate, restart `gateway`; Nginx bisa menahan IP upstream lama dan memicu `502`.

## Security Considerations
- TLS diasumsikan diterminasi di layer luar; gateway internal compose tetap HTTP.
- Header `X-Forwarded-*` harus tetap benar agar aplikasi downstream membaca origin/skema dengan tepat.
- Jangan expose upstream baru tanpa memastikan auth, CORS, healthcheck, dan env deploy service tersebut sudah siap.
