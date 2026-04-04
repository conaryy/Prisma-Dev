# K3

Website K3 ini sekarang memakai:

- `NestJS` sebagai backend API.
- `PostgreSQL + Prisma` untuk penyimpanan dokumen audit dan hasil analisis.
- `React + TypeScript + Vite` sebagai frontend.
- Tanpa login.
- Tiga halaman utama: `Dashboard`, `Upload Dokumen`, dan `Checklist Audit`.
- Dokumen Word utama diupload dari menu khusus, lalu `Checklist Audit` memilih dokumen yang ingin dipakai.

## Struktur utama

- `backend/` backend NestJS.
- `backend/prisma/schema.prisma` schema PostgreSQL untuk dokumen audit K3.
- `backend/src/` source utama backend.
- `backend/src/checklist-audit.service.ts` parser Word dan kalkulasi audit.
- `frontend/` aplikasi React TypeScript.
- `frontend/src/pages/UploadDocumentsPage.tsx` halaman upload dan daftar dokumen audit tersimpan.
- `frontend/src/pages/DashboardPage.tsx` halaman dashboard.
- `frontend/src/pages/ChecklistAuditPage.tsx` halaman checklist yang memilih dokumen audit tersimpan.
- `backend/uploads/documents/` penyimpanan file Word audit yang diupload.
- `backend/uploads/checklist-evidence/` penyimpanan file evidence per pertanyaan.

## Catatan parser

- File `.docx` dibaca dengan `mammoth`.
- File `.doc` dibaca lewat ekstraksi teks berbasis `strings` karena template audit yang diberikan masih Word 97-2003.
- Rumus penerapan saat ini: `V / (total kriteria - X) x 100%`.
- Hasil analisis sekarang disimpan per dokumen di PostgreSQL, jadi tidak hilang saat backend restart.
- File Word audit utama disimpan ke folder lokal `backend/uploads/documents`.
- File evidence per pertanyaan disimpan ke folder lokal `backend/uploads/checklist-evidence`.

## Menjalankan saat development

Backend:

```bash
cd K3/backend
cp .env.example .env
npm install
npm run prisma:push
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

Dari folder `K3/backend`:

```bash
npm run build
```

Perintah ini akan build frontend React lalu build backend NestJS.

Jika frontend sudah dibuild, backend NestJS akan melayani file React hasil build dari `../frontend/dist`.

## Flow penggunaan

1. Buka menu `Upload Dokumen` dan upload file Word audit.
2. Dokumen tersimpan di PostgreSQL dan muncul di daftar dokumen.
3. Buka menu `Checklist Audit`, lalu pilih dokumen yang ingin dipakai dari selector di panel atas.
