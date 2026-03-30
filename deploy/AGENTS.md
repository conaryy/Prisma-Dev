# AGENTS.md

## Project Overview
- Folder ini menyimpan artefak deploy/infrastruktur untuk gateway pusat.
- File aktif yang terlihat adalah `deploy/nginx/gateway.conf`.
- Gateway ini merutekan domain publik ke service container internal:
  - Auth portal
  - K2S frontend
  - K2S backend nginx
- Routing Logbook belum diaktifkan default agar profile opsional tidak memecahkan gateway saat tidak dijalankan.

## Build And Test Commands
- Dari root repo:
  - `docker compose --env-file .env.central -f docker-compose.central.yml up -d --build`
- Setelah perubahan gateway:
  - rebuild/restart stack compose terkait
  - verifikasi request ke setiap `server_name` yang didefinisikan di `gateway.conf`

## Code Style Guidelines
- Jaga konfigurasi Nginx tetap sederhana dan eksplisit.
- Saat menambah service baru, definisikan `server_name`, `proxy_pass`, dan header proxy standar secara konsisten.
- Sinkronkan perubahan `gateway.conf` dengan domain/env yang dijelaskan di `.env.central` dan `DEPLOY_CENTRAL.md`.

## Testing Instructions
- Uji resolusi domain atau host override ke gateway.
- Verifikasi tiap route domain mengarah ke upstream yang benar.
- Jika menambah profile opsional, pastikan gateway tetap aman saat profile tersebut tidak aktif.

## Security Considerations
- Gateway saat ini berjalan di HTTP port 80; terminasi TLS kemungkinan berada di luar compose ini atau belum disiapkan.
- Header `X-Forwarded-*` harus dipertahankan agar aplikasi downstream membaca skema/origin dengan benar.
- Jangan expose upstream internal baru tanpa memastikan auth, CORS, dan health check service tersebut sudah siap.
