# Desain Parser dan Schema Logbook

## Tujuan

Dokumen ini menjabarkan desain teknis awal untuk:

- parser data logbook dari dokumen arsip terstruktur
- aturan normalisasi data hasil parsing
- usulan evolusi schema penyimpanan di backend Logbook

Dokumen ini disusun berdasarkan temuan dari file referensi di `folder_referensi`, khususnya:

- `2024-2025.xlsx`
- `log_book_app2024-2025.xlsx`

## Temuan Dari Data Referensi

### 1. Kategori Data Nyata

Bentuk data arsip saat ini terbagi menjadi:

- `Teknik`
- `APP`
- `TWR`

Header tabel yang teridentifikasi:

#### Teknik

- `NO`
- `TANGGAL`
- `JAM`
- `Peralatan`
- `Freq / Bagian Peralatan`
- `KEJADIAN`

#### APP / TWR

- `No.`
- `Tanggal`
- `Time`
- `Facility / Operation Report`
- `Facility`
- `Call Sign A/C`
- `Keterangan`

### 2. Karakteristik Data

Data arsip tidak sepenuhnya flat. Ada beberapa pola penting:

- nilai `Tanggal` masih berupa serial date Excel
- satu entri logbook dapat berlanjut ke beberapa baris
- baris lanjutan sering mengosongkan kolom `No`, `Tanggal`, atau field lainnya
- informasi konteks dari baris sebelumnya harus diwariskan ke baris berikutnya
- pada APP/TWR, kolom `Facility / Operation Report` berfungsi sebagai tipe aktivitas

Kesimpulan penting:

- parser tidak cukup membaca tiap baris sebagai satu record mandiri
- parser harus memiliki mekanisme `carry-forward context`
- model data perlu mempertimbangkan level `entry` dan kemungkinan `detail line`

## Evaluasi Schema Saat Ini

Schema Prisma saat ini:

- `TowerLogbookEntry`
- `AppLogbookEntry`
- `TeknikLogbookEntry`

Kelebihan:

- sederhana
- cukup untuk tahap awal pembacaan data flat
- cocok untuk query cepat per kategori

Keterbatasan:

- belum ada konsep `import batch`
- belum ada jejak error import
- belum ada audit khusus import
- belum ada metadata hash
- belum ada cara eksplisit untuk merepresentasikan baris lanjutan dari satu entri

## Rekomendasi Desain Data

Untuk implementasi awal yang pragmatis, saya sarankan desain bertahap:

### Tahap 1

Pertahankan tabel kategori utama:

- `TowerLogbookEntry`
- `AppLogbookEntry`
- `TeknikLogbookEntry`

Namun tambahkan layer umum:

- `LogbookImportBatch`
- `LogbookImportSource`
- `LogbookImportError`
- `LogbookAuditTrail`
- `LogbookIntegrityRecord`

### Tahap 2

Jika nanti dibutuhkan relasi entry-detail yang lebih kaya, barulah pertimbangkan:

- `LogbookEntryHeader`
- `LogbookEntryLine`

Untuk saat ini, karena frontend aktif dan API yang ada sudah mengarah ke struktur flat per kategori, strategi paling aman adalah:

- tetap menyimpan hasil normalisasi sebagai flat entry per kategori
- tetapi menyimpan metadata import dan integritas secara terpisah

## Usulan Entitas Tambahan

### A. LogbookImportBatch

Fungsi:

- merepresentasikan satu proses ingestion
- menyimpan status proses import
- menjadi penghubung ke audit dan integrity record

Field yang disarankan:

- `id`
- `sourceCategory`
- `sourcePeriod`
- `sourceFileName`
- `status`
- `totalRows`
- `validRows`
- `invalidRows`
- `importedBy`
- `startedAt`
- `completedAt`
- `notes`

### B. LogbookImportSource

Fungsi:

- menyimpan metadata sumber input
- membantu traceability jika suatu saat sumber arsip perlu diidentifikasi ulang

Field yang disarankan:

- `id`
- `batchId`
- `sheetName`
- `rowNumber`
- `rawDateValue`
- `rawTimeValue`
- `rawPayload`

### C. LogbookImportError

Fungsi:

- menyimpan error parsing atau validasi
- penting untuk kebutuhan audit dan perbaikan data

Field yang disarankan:

- `id`
- `batchId`
- `sheetName`
- `rowNumber`
- `fieldName`
- `errorCode`
- `errorMessage`
- `rawPayload`

### D. LogbookAuditTrail

Fungsi:

- mencatat aktivitas resmi sistem
- misalnya import, correction, verification, reprocessing

Field yang disarankan:

- `id`
- `actorId`
- `action`
- `targetType`
- `targetId`
- `batchId`
- `metadata`
- `createdAt`

### E. LogbookIntegrityRecord

Fungsi:

- menyimpan metadata hash off-chain
- menjadi sumber verifikasi sebelum atau sesudah anchoring ke Fabric

Field yang disarankan:

- `id`
- `batchId`
- `recordType`
- `recordRef`
- `hashType`
- `hashValue`
- `anchored`
- `anchoredAt`
- `anchorRef`

## Strategi Normalisasi Data

### 1. Normalisasi Tanggal

Input referensi menunjukkan `Tanggal` sering muncul sebagai serial date Excel, misalnya `45597`.

Aturan:

- jika nilai tanggal numerik dan sesuai pola serial Excel, konversi ke `DateTime`
- jika nilai tanggal kosong, gunakan konteks dari baris sebelumnya dalam entri yang sama
- jika nilai tidak bisa dikenali, tandai sebagai error import

### 2. Normalisasi Waktu

Aturan:

- simpan format waktu string hasil normalisasi, misalnya `10:00`
- jika waktu kosong pada baris lanjutan, gunakan nilai waktu sebelumnya hanya jika memang konteks entri berlanjut
- jika tidak aman untuk diwariskan, simpan null lalu tandai kebutuhan review

### 3. Carry-Forward Context

Karena banyak baris lanjutan mengosongkan kolom utama, parser perlu menyimpan konteks aktif:

- `currentEntryNo`
- `currentEntryDate`
- `currentCategory`
- `currentOperationType` untuk APP/TWR bila perlu
- `currentEquipment` untuk Teknik bila pola baris menunjukkan lanjutan

Aturan umum:

- jika kolom `No` terisi, anggap sebagai awal entri baru
- jika `No` kosong tetapi kolom lain masih berisi deskripsi lanjutan, anggap sebagai lanjutan entri sebelumnya

### 4. Normalisasi APP / TWR

Mapping yang disarankan:

- `No.` -> `entryNo`
- `Tanggal` -> `entryDate`
- `Time` -> `entryTime`
- `Facility / Operation Report` -> `operationType`
- `Facility` -> `facility`
- `Call Sign A/C` -> `callSign`
- `Keterangan` -> `description`

### 5. Normalisasi Teknik

Mapping yang disarankan:

- `NO` -> `entryNo`
- `TANGGAL` -> `entryDate`
- `JAM` -> `entryTime`
- `Peralatan` -> `equipment`
- `Freq / Bagian Peralatan` -> `frequencySection`
- `KEJADIAN` -> `incident`

## Model Hash Yang Disepakati

Sistem integritas menggunakan 3 level hash:

### 1. Record Hash

Hash untuk setiap entri logbook.

Tujuan:

- verifikasi granular per record
- membuktikan satu entri tidak berubah

### 2. Daily Batch Hash

Hash agregasi dari kumpulan `record hash` dalam satu hari operasional.

Tujuan:

- verifikasi tingkat menengah
- lebih realistis untuk data logbook yang bersifat time-series

### 3. Monthly Anchor Hash

Hash agregasi dari kumpulan `daily batch hash` dalam satu bulan.

Tujuan:

- menjadi unit anchoring ke Hyperledger Fabric
- menjaga efisiensi integrasi blockchain

## Rekomendasi Proses Parser

Flow parser yang disarankan:

1. user memulai proses import
2. backend membuat `LogbookImportBatch`
3. parser membaca sheet yang relevan
4. parser mendeteksi header tabel
5. parser membaca row per row
6. parser menerapkan `carry-forward context`
7. parser melakukan validasi field
8. parser mengubah data mentah menjadi record normalisasi
9. record valid disimpan ke tabel kategori terkait
10. metadata raw dan error disimpan ke tabel import
11. `record hash` dibentuk untuk setiap record
12. `daily batch hash` dibentuk dari record per tanggal
13. `monthly anchor hash` dibentuk dari kumpulan daily batch
14. event diterbitkan untuk audit, search indexing, dan blockchain anchoring

## Rekomendasi Query Frontend

Dengan bentuk data saat ini, frontend cukup tetap membaca tabel flat hasil normalisasi.

Query minimal:

- list entry per kategori
- filter berdasarkan tanggal
- pencarian teks
- rekap per kategori aktivitas

Keuntungan pendekatan ini:

- frontend tetap sederhana
- parser menangani kompleksitas sumber data
- API tetap konsisten walau format arsip sumber bervariasi

## Rekomendasi Evolusi Schema Prisma

Jika ingin tetap kompatibel dengan implementasi sekarang, evolusi minimal yang disarankan adalah:

- pertahankan `TowerLogbookEntry`
- pertahankan `AppLogbookEntry`
- pertahankan `TeknikLogbookEntry`
- tambah tabel import, audit, dan integrity

Ini lebih aman daripada langsung merombak seluruh model domain.

## Kesimpulan

Berdasarkan bentuk data referensi, parser Logbook harus dirancang sebagai parser semi-terstruktur, bukan parser flat sederhana.

Keputusan desain yang paling aman adalah:

- hasil normalisasi tetap disimpan ke tabel kategori utama
- metadata import dipisahkan ke tabel khusus
- audit trail dipisahkan sebagai catatan resmi
- integritas data memakai tiga level hash:
  - `record hash`
  - `daily batch hash`
  - `monthly anchor hash`

Pendekatan ini menjaga implementasi tetap realistis, kompatibel dengan frontend saat ini, dan siap dikembangkan ke semantic search serta Hyperledger Fabric.
