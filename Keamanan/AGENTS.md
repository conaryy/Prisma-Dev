# AGENTS.md

## Project Overview
- Folder `Keamanan` sekarang berisi service dashboard keamanan dengan dua aplikasi:
  - `backend`: NestJS API + Prisma + PostgreSQL untuk menyajikan data dashboard dan fallback static serving frontend build.
  - `frontend`: React + TypeScript + Vite untuk dashboard keamanan.
- Service ini masih standalone dan belum terhubung ke `docker-compose.central.yml` atau gateway pusat.
- Data `Personil Keamanan` sekarang dipersist ke PostgreSQL, sedangkan section dashboard lain masih memakai data contoh dari backend.

## Build And Test Commands
- Backend:
  - `cd Keamanan/backend`
  - `npm install`
  - `npm run prisma:push`
  - `npm run prisma:seed`
  - `npm run start:dev`
  - `npm run build`
- Frontend:
  - `cd Keamanan/frontend`
  - `npm install`
  - `npm run dev`
  - `npm run build`

## Code Style Guidelines
- Backend mengikuti pola NestJS sederhana seperti service lain di repo:
  - controller tipis
  - service menyimpan logika dan source data
  - `main.ts` mengatur CORS dan static serving bila diperlukan
- Frontend mengikuti pola React function component + CSS lokal.
- Hindari menambah dependency UI besar bila belum perlu; dashboard saat ini sengaja dibuat ringan tanpa component library eksternal.

## Testing Instructions
- Minimum check:
  - `cd Keamanan/backend && npm run prisma:push`
  - `cd Keamanan/backend && npm run build`
  - `cd Keamanan/frontend && npm run build`
  - jalankan backend dan frontend dev lalu pastikan `GET /api/health` dan `GET /api/dashboard` merespons
  - verifikasi `POST /api/personnel` menyimpan data baru ke PostgreSQL
  - buka dashboard dan cek sidebar, hero, kartu KPI, chart, dan tabel section tampil
  - verifikasi fallback static build bila frontend sudah dibuild lalu backend dijalankan sendiri

## Security Considerations
- Service ini belum memiliki auth/login; jangan expose ke internet publik tanpa lapisan auth/proxy/rate limiting tambahan.
- Jangan tambahkan secret langsung ke source code. Gunakan `.env.example` sebagai template.
- User PostgreSQL untuk development saat ini bisa memakai role terbatas; bila `prisma migrate dev` gagal karena shadow database, gunakan `prisma db push` atau siapkan `shadowDatabaseUrl` terpisah.
- Jika nanti data dashboard diambil dari sumber nyata, validasi input query/filter dan perketat CORS sesuai origin resmi.
