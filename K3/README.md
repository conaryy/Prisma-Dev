# K3

Website K3 ini sekarang memakai:

- `NestJS` sebagai backend API.
- `React + TypeScript + Vite` sebagai frontend.
- Tanpa login.
- Dua halaman: `Dashboard` dan `Checklist Audit`.
- Upload file Word utama dan upload file evidence per pertanyaan.

## Struktur utama

- `src/` backend NestJS.
- `src/checklist-audit.service.ts` parser Word dan kalkulasi audit.
- `frontend/` aplikasi React TypeScript.
- `frontend/src/pages/DashboardPage.tsx` halaman dashboard.
- `frontend/src/pages/ChecklistAuditPage.tsx` halaman upload dan hasil checklist.
- `uploads/checklist-evidence/` penyimpanan file evidence per pertanyaan.

## Catatan parser

- File `.docx` dibaca dengan `mammoth`.
- File `.doc` dibaca lewat ekstraksi teks berbasis `strings` karena template audit yang diberikan masih Word 97-2003.
- Rumus penerapan saat ini: `V / (total kriteria - X) x 100%`.
- Hasil upload terakhir disimpan di memori backend. Jika backend restart, data terakhir ikut hilang.
- File evidence per pertanyaan disimpan ke folder lokal `uploads/checklist-evidence`.
- Jika upload dokumen audit utama diulang, evidence dari analisis sebelumnya ikut dibersihkan.

## Menjalankan saat development

Backend:

```bash
cd K3
npm install
npm run start:dev
```

Frontend:

```bash
cd K3/frontend
npm install
npm run dev
```

Akses frontend di `http://localhost:5173`.
API backend berjalan di `http://localhost:3000`.

## Build production

Dari folder `K3`:

```bash
npm run build
```

Perintah ini akan build frontend React lalu build backend NestJS.

Jika frontend sudah dibuild, backend NestJS akan melayani file React hasil build dari `frontend/dist`.
