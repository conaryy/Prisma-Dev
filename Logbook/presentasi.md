# Materi Presentasi Logbook

## Slide 1 - Judul dan Konteks Penelitian

**Perancangan Arsitektur Sistem Logbook Berbasis Layanan**

Fokus penelitian:

- integrasi data logbook dari dokumen arsip terstruktur
- pengelolaan data operasional dalam basis data terpusat
- pengembangan semantic search berbasis konteks
- penerapan tamper-evidence berbasis Hyperledger Fabric

Poin penyampaian:

- Sistem Logbook dirancang sebagai fondasi aplikasi yang mampu mengelola data operasional secara terstruktur.
- Penelitian ini tidak hanya membahas tampilan aplikasi, tetapi juga perancangan arsitektur yang mendukung skalabilitas, maintainability, dan integritas data.

## Slide 2 - Latar Belakang dan Rumusan Masalah

**Latar Belakang**

- Data logbook operasional umumnya masih berasal dari dokumen arsip terstruktur.
- Pendekatan tersebut kurang efisien untuk kebutuhan pencarian, pelacakan riwayat, dan integrasi antarsistem.
- Sistem modern membutuhkan sumber data yang terpusat, dapat diaudit, dan mudah dikembangkan.

**Rumusan Masalah**

- bagaimana mentransformasikan data arsip menjadi data operasional yang siap diproses sistem
- bagaimana merancang arsitektur yang mendukung pencarian berbasis makna
- bagaimana menjaga integritas data tanpa membebani sistem operasional utama

Poin penyampaian:

- Permasalahan utama bukan hanya pada penyimpanan data, tetapi pada bagaimana data tersebut diubah menjadi aset digital yang dapat dikelola secara berkelanjutan.

## Slide 3 - Tujuan dan Pendekatan Solusi

**Tujuan**

- merancang arsitektur Logbook dengan PostgreSQL sebagai source of truth
- membangun alur ingestion data yang terstruktur
- menyediakan fondasi untuk semantic search dan audit trail
- menyiapkan mekanisme integrity proof berbasis blockchain

**Pendekatan Solusi**

- data arsip diparse dan dinormalisasi ke basis data
- layanan backend menangani validasi, pemrosesan, dan akses data
- proses lanjutan seperti indexing dan integrity anchoring dijalankan secara asynchronous

Poin penyampaian:

- Pendekatan ini dipilih agar domain inti sistem tetap sederhana, sedangkan fitur lanjutan dapat dikembangkan secara modular.

## Slide 4 - Arsitektur Sistem yang Diusulkan

**Lapisan Arsitektur**

1. Presentation Layer
   frontend untuk interaksi pengguna
2. API and Application Layer
   backend API, validasi autentikasi, query service
3. Data Ingestion Layer
   parser, validator, normalizer, deduplication
4. Core Domain and Persistence
   logbook core service, audit trail, PostgreSQL
5. Extension Layer
   semantic search dan Hyperledger Fabric

Poin penyampaian:

- Data operasional utama disimpan pada PostgreSQL.
- Audit trail dicatat sebagai bagian dari persistence utama.
- Semantic search dan blockchain ditempatkan sebagai extension layer agar tidak mengganggu performa jalur utama aplikasi.

## Slide 5 - Alur Operasional Sistem

**Alur Utama**

1. Pengguna melakukan autentikasi melalui Auth Portal / SSO.
2. Data arsip diterima oleh backend melalui modul ingestion.
3. Sistem melakukan parsing, validasi, normalisasi, dan deduplication.
4. Data valid disimpan ke PostgreSQL sebagai basis data utama.
5. Audit trail dicatat untuk setiap aktivitas penting.
6. Event diterbitkan untuk proses indexing semantic search dan integrity anchoring.

Poin penyampaian:

- Jalur utama sistem hanya berfokus pada penyimpanan data operasional dan pencatatan audit.
- Proses komputasi tambahan dipisahkan ke mekanisme asynchronous agar sistem tetap efisien.

## Slide 6 - Semantic Search, Integrity Proof, dan Kesimpulan

**Semantic Search**

- dibangun dari data yang sudah tersimpan di PostgreSQL
- memanfaatkan indexing service dan semantic index storage
- mendukung pencarian berbasis makna dan konteks

**Integrity Proof**

- menggunakan Hyperledger Fabric sebagai lapisan pembuktian integritas
- data mentah tidak disimpan di blockchain
- blockchain hanya menyimpan hash, reference ID, event, dan timestamp

**Kesimpulan**

- arsitektur yang dirancang memungkinkan sistem Logbook berkembang dari pengelolaan data arsip menjadi platform data operasional modern
- PostgreSQL berperan sebagai source of truth
- semantic search dan blockchain diintegrasikan sebagai pengembangan bertahap yang modular

Poin penyampaian:

- Pendekatan yang digunakan adalah `raw data off-chain, proof on-chain`.
- Dengan demikian, sistem tetap efisien secara operasional, namun tetap memiliki fondasi untuk auditabilitas dan pengembangan teknologi lanjutan.
