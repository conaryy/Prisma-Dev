# AGENTS.md

## Project Overview
- Folder ini berisi aplikasi K3 yang terdiri dari:
  - backend NestJS di `K3/backend/src`
  - frontend React + TypeScript + Vite di `K3/frontend`
- Fokus utama aplikasi:
  - dashboard K3
  - upload dan penyimpanan dokumen audit ke PostgreSQL
  - checklist audit
  - pemilihan dokumen audit tersimpan di halaman checklist
  - upload/delete evidence per pertanyaan
- Backend juga dapat menyajikan `frontend/dist` jika frontend sudah dibuild.

## Build And Test Commands
- Backend dev:
  - `cd K3/backend`
  - `cp .env.example .env`
  - `npm install`
  - `npm run prisma:push`
  - `npm run start:dev`
- Frontend dev:
  - `cd K3/frontend`
  - `npm install`
  - `npm run dev`
- Build production:
  - `cd K3/backend`
  - `npm run build`

## Code Style Guidelines
- Backend memakai NestJS dengan TypeScript `strict`.
- Endpoint ada langsung di `AppController`; service parsing utama ada di `checklist-audit.service.ts`.
- Pertahankan pola DTO/body sederhana dan validasi/exception dekat boundary endpoint.
- Frontend masih relatif ringan; ikuti pola React + TypeScript yang sudah ada tanpa menambah kompleksitas state management baru bila belum perlu.

## Testing Instructions
- Tidak terlihat suite test formal.
- Minimum check:
  - `cd K3/backend && npm run build`
  - jalankan backend dan frontend dev
  - uji upload dokumen `.docx` atau `.doc` dari menu `Upload Dokumen`
  - uji pemilihan dokumen di menu `Checklist Audit`
  - uji tambah/hapus evidence
  - uji refresh/restart backend untuk memastikan data dokumen tetap terbaca dari PostgreSQL

## Security Considerations
- Tidak ada auth/login saat ini. Jangan expose service ini ke internet publik tanpa lapisan auth/proxy/rate limiting tambahan.
- Upload utama dibatasi 15 MB, evidence 20 MB; pertahankan atau perketat limit ini.
- Dokumen Word dan evidence disimpan di folder lokal `uploads/`; pastikan permission dan akses file publik tetap aman.
- Karena backend menyajikan file statis dari `uploads`, validasi nama/path file penting untuk mencegah akses file yang tidak diinginkan.
- Hasil analisis kini persisten di PostgreSQL, tapi service masih tanpa auth. Jangan anggap aman untuk environment publik.
