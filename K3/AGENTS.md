# AGENTS.md

## Project Overview
- Folder ini berisi aplikasi K3 yang terdiri dari:
  - backend NestJS di `K3/src`
  - frontend React + TypeScript + Vite di `K3/frontend`
- Fokus utama aplikasi:
  - dashboard K3
  - checklist audit
  - upload dokumen Word audit
  - upload/delete evidence per pertanyaan
- Backend juga dapat menyajikan `frontend/dist` jika frontend sudah dibuild.

## Build And Test Commands
- Backend dev:
  - `cd K3`
  - `npm install`
  - `npm run start:dev`
- Frontend dev:
  - `cd K3/frontend`
  - `npm install`
  - `npm run dev`
- Build production:
  - `cd K3`
  - `npm run build`

## Code Style Guidelines
- Backend memakai NestJS dengan TypeScript `strict`.
- Endpoint ada langsung di `AppController`; service parsing utama ada di `checklist-audit.service.ts`.
- Pertahankan pola DTO/body sederhana dan validasi/exception dekat boundary endpoint.
- Frontend masih relatif ringan; ikuti pola React + TypeScript yang sudah ada tanpa menambah kompleksitas state management baru bila belum perlu.

## Testing Instructions
- Tidak terlihat suite test formal.
- Minimum check:
  - `cd K3 && npm run build`
  - jalankan backend dan frontend dev
  - uji upload dokumen `.docx` atau `.doc`
  - uji tambah/hapus evidence
  - uji refresh/restart backend untuk memastikan Anda sadar bahwa state analisis terakhir tersimpan di memori dan akan hilang saat restart

## Security Considerations
- Tidak ada auth/login saat ini. Jangan expose service ini ke internet publik tanpa lapisan auth/proxy/rate limiting tambahan.
- Upload utama dibatasi 15 MB, evidence 20 MB; pertahankan atau perketat limit ini.
- Evidence disimpan di folder lokal `uploads/`; pastikan permission dan pembersihan file aman.
- Karena backend menyajikan file statis dari `uploads`, validasi nama/path file penting untuk mencegah akses file yang tidak diinginkan.
- Hasil analisis terakhir disimpan di memori proses; jangan anggap data ini persisten atau multi-instance safe.
