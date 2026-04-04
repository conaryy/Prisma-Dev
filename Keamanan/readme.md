# Web Keamanan

Service `Keamanan` sekarang terdiri dari dua aplikasi terpisah:

- `backend`: NestJS API + Prisma + PostgreSQL untuk menyajikan data dashboard keamanan.
- `frontend`: React + TypeScript + Vite untuk dashboard monitoring keamanan.

## Struktur

- `backend/src/app.controller.ts`: endpoint `GET /api/health`, `GET /api/dashboard`, dan `POST /api/personnel`
- `backend/src/dashboard.service.ts`: agregasi data dashboard dan persistence personel keamanan
- `backend/prisma/schema.prisma`: schema Prisma untuk PostgreSQL
- `backend/prisma/seed.js`: seed data awal personel keamanan
- `frontend/src/App.tsx`: layout utama dashboard
- `frontend/src/styles/index.css`: styling dashboard

## Menjalankan Development

Backend:

```bash
cd Keamanan/backend
npm install
npm run prisma:setup
npm run start:dev
```

Frontend:

```bash
cd Keamanan/frontend
npm install
npm run dev
```

Frontend dev akan berjalan di `http://localhost:5174` dan otomatis mem-proxy `/api` ke backend dev `http://localhost:6001`.

Port default:

- `npm run start` menjalankan backend utama di `6000`
- `npm run start:dev` menjalankan backend dev/watch di `6001`

## Build

Backend:

```bash
cd Keamanan/backend
npm run build
```

Frontend:

```bash
cd Keamanan/frontend
npm run build
```

## Catatan

- Backend akan menyajikan `frontend/dist` bila frontend sudah dibuild.
- Data `Personil Keamanan` sekarang dibaca dari PostgreSQL.
- Untuk role database yang belum punya hak `CREATE DATABASE`, gunakan `npm run prisma:push` atau `npm run prisma:setup`.
- `npm run prisma:migrate` tetap membutuhkan shadow database atau role PostgreSQL dengan hak `CREATEDB`.
- Seluruh perubahan dibatasi hanya di dalam folder `Keamanan`.
