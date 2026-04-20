# Logbook

Service `Logbook` adalah modul pencatatan operasional dengan frontend React/Vite dan backend NestJS/Prisma/PostgreSQL. Service ini memakai SSO pusat dari `Auth` dan saat ini mendukung tiga kategori aktif: `tower`, `app`, dan `teknik`.

## Komponen
- `frontend`
  - React + Vite + TypeScript
  - route utama untuk overview, halaman kategori, dan `Import Center`
- `backend`
  - NestJS + Prisma + PostgreSQL
  - global prefix `api/v1`
  - validasi JWT melalui `SsoAuthGuard`
  - module `semantic-search` resmi untuk integrasi search di backend
- `backend/src/logbook/imports`
  - parser kategori `tower`, `app`, dan `teknik`

## Konsep Operasional Saat Ini
Import `Logbook` sekarang berbasis batch dan tidak lagi diperlakukan sebagai upload sekali pakai.

- setiap import membuat `logbook_import_batch`
- source row mentah disimpan di `logbook_import_sources`
- error parsing disimpan di `logbook_import_errors`
- audit event disimpan di `logbook_audit_trails`
- integrity hash record disimpan di `logbook_integrity_records`
- entry hasil parse terhubung ke batch melalui `import_batch_id`

Lifecycle batch:
- `pending`
- `processing`
- `completed`
- `failed`

Model data aktif:
- query logbook harian hanya membaca batch `completed` yang `is_active = true`
- reimport aman dilakukan untuk kombinasi `kategori + sourcePeriod`
- batch lama tidak dihapus saat reimport; batch lama diarsipkan
- rollback sederhana tersedia untuk mengaktifkan kembali batch archived

Catatan penting tentang revisi:
- revisi tidak melakukan overwrite fisik pada row lama di tabel entry
- row lama tetap tersimpan untuk audit dan rollback
- status aktif atau archived ditentukan di `logbook_import_batches.is_active`
- setiap row entry terhubung ke batch melalui `import_batch_id`
- karena itu consumer eksternal seperti seed semantic search/Qdrant harus ikut memfilter ke batch aktif, bukan membaca semua row mentah PostgreSQL

Model input operator saat ini:
- `Tambah Data Baru` membaca file penuh dan memecah otomatis ke batch bulanan yang belum ada
- `Upload Revisi` dipakai untuk memperbaiki periode yang sudah pernah masuk
- pada `Upload Revisi`, operator memilih `tahun` dan `bulan`, bukan mengetik `sourcePeriod` manual

## Fitur Import yang Sudah Aktif
- import Excel untuk `tower`, `app`, dan `teknik`
- observability melalui `Import Center`
- daftar batch import
- detail batch
- daftar error parsing
- sample source rows
- audit trail per batch
- reimport aman berbasis `sourcePeriod`
- auto split batch bulanan untuk `Tambah Data Baru`
- rollback batch archived

## Endpoint Utama
- `GET /api/v1/health`
- `GET /api/v1/logbook/me`
- `GET /api/v1/logbook/entries`
- `GET /api/v1/logbook/import-batches`
- `GET /api/v1/logbook/import-batches/:batchId`
- `GET /api/v1/logbook/import-batches/:batchId/errors`
- `POST /api/v1/logbook/import/teknik`
- `POST /api/v1/logbook/import/app`
- `POST /api/v1/logbook/import/tower`
- `POST /api/v1/logbook/import-batches/:batchId/rollback`
- `DELETE /api/v1/logbook/purge`
- `GET /api/v1/logbook/search/semantic/status`
- `POST /api/v1/logbook/search/semantic`

## Frontend
Halaman `Import Center` dipakai untuk memantau hasil import dan lifecycle batch.

Saat ini operator bisa:
- memfilter batch per kategori, status, dan kata kunci
- melihat status `active` atau `archived`
- melihat batch hasil reimport
- melihat detail error parsing
- menjalankan rollback untuk batch `completed` yang archived

Pada halaman kategori logbook:
- `Tambah Data Baru` akan mendeteksi semua periode pada file dan membuat batch baru untuk periode yang belum ada
- periode yang sudah punya batch aktif akan dilewati pada mode otomatis
- `Upload Revisi` akan mengganti batch aktif pada periode yang sama
- `Upload Revisi` tetap meminta `tahun` dan `bulan` yang spesifik

## Menjalankan Lokal
Frontend:

```bash
cd Logbook/frontend
cp .env.example .env
npm install
npm run dev
```

Backend:

```bash
cd Logbook/backend
cp .env.example .env
npm install
npm run prisma:generate
npm run prisma:push
npm run start:dev
```

Environment semantic search backend yang mulai dipakai:

```env
SEMANTIC_SEARCH_ENABLED=true
SEMANTIC_SEARCH_QDRANT_URL=http://127.0.0.1:6333
SEMANTIC_SEARCH_QDRANT_COLLECTION=logbook_entries
SEMANTIC_SEARCH_EMBEDDING_PROVIDER=ollama
SEMANTIC_SEARCH_OLLAMA_URL=http://127.0.0.1:11434
SEMANTIC_SEARCH_OLLAMA_EMBEDDING_MODEL=qwen3-embedding
```

Build minimum:

```bash
cd Logbook/backend && npm run build
cd Logbook/frontend && npm run build
```

## Catatan Pengembangan
- jangan bypass `is_active`, `reimport_of_batch_id`, dan `sourcePeriod`
- perubahan read path harus tetap hanya membaca batch aktif
- perubahan parser harus diuji dengan file Excel nyata
- `purge`, `reimport`, dan `rollback` adalah operasi high risk
- untuk file Excel model tabel panjang, nama file bukan identitas batch; identitas batch tetap `kategori + periode`
- `Tambah Data Baru` sekarang adalah jalur utama untuk backfill awal deploy karena file panjang akan dipecah menjadi beberapa batch bulanan
- row yang periodenya tidak bisa dideteksi otomatis tidak akan masuk batch bulanan dan harus ditinjau operator
- integrasi luar seperti Qdrant, ETL, export, atau analytics tidak boleh membaca semua row tabel entry tanpa join/filter ke `logbook_import_batches.is_active = true`
- `backend/semantic_search_referensi` tetap diposisikan sebagai referensi eksperimen; integrasi resmi bergerak ke `backend/src/semantic-search`
- semantic search backend resmi saat ini sudah punya endpoint read-only hybrid; indexing job masih dipertahankan di jalur referensi

## Arah Lanjut
Prioritas berikut yang paling masuk akal:
- role guard untuk import, reimport, rollback, dan purge
- dashboard operasional import
- penanganan row tanpa periode yang bisa dideteksi otomatis
- ringkasan hasil split bulanan yang lebih kaya di UI/operator
- integrity hash level batch/periode
- penyimpanan file sumber asli
