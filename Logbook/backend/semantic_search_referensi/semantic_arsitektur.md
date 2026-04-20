# Arsitektur Semantic Search

## Tujuan

Dokumen ini menjelaskan arsitektur semantic search pada project secara terpisah dari arsitektur chatbot. Fokus utamanya adalah bagaimana data logbook dari PostgreSQL diindeks ke Qdrant, lalu dicari kembali menggunakan embedding dan hybrid reranking.

## Gambaran Umum

Arsitektur semantic search pada project ini terdiri dari empat komponen utama:

- PostgreSQL sebagai sumber data utama
- proses seed sebagai pipeline indexing
- Qdrant sebagai vector index
- backend Express sebagai orchestrator query semantic

Di atas empat komponen itu, sistem juga memakai model embedding untuk mengubah teks menjadi vector.

## Prinsip Dasar

Arsitektur semantic search ini mengikuti beberapa prinsip.

Pertama, data utama tetap berada di PostgreSQL. Semantic search tidak menggantikan database utama.

Kedua, Qdrant hanya berfungsi sebagai semantic index. Qdrant menyimpan vector dan payload, bukan record utama yang menjadi sumber kebenaran.

Ketiga, retrieval semantic dipisah dari detail data. Qdrant dipakai untuk menemukan kandidat relevan, lalu PostgreSQL dipakai untuk mengambil detail record lengkap.

Keempat, hasil semantic tidak diurutkan murni berdasarkan vector score. Backend menambahkan lexical reranking sederhana agar query operasional yang penuh kode atau singkatan tetap lebih presisi.

## Komponen Utama

### 1. PostgreSQL

PostgreSQL menyimpan data logbook utama. Data semantic search diambil dari tiga tabel:

- `tower_logbook_entries`
- `app_logbook_entries`
- `teknik_logbook_entries`

Query PostgreSQL dikelola di [src/postgres.js](/home/frhn/Desktop/file/project_test/Semantic_searc_test/src/postgres.js).

Dalam arsitektur semantic search, PostgreSQL dipakai untuk:

- membaca seluruh data saat proses seed
- mengambil detail record setelah kandidat semantic ditemukan di Qdrant

### 2. Normalisasi Dokumen

Normalisasi dokumen dikelola di [src/logbook-documents.js](/home/frhn/Desktop/file/project_test/Semantic_searc_test/src/logbook-documents.js).

Modul ini bertugas:

- membentuk teks yang akan di-embedding
- membentuk payload Qdrant
- membuat point ID deterministik
- membentuk hasil akhir yang akan ditampilkan ke frontend

Point ID deterministik dipakai agar proses upsert ke Qdrant tidak membuat duplikasi untuk record yang sama.

### 3. Embedding Layer

Embedding dikelola di [src/embedding.js](/home/frhn/Desktop/file/project_test/Semantic_searc_test/src/embedding.js).

Provider yang didukung:

- Ollama lokal
- Gemini API

Embedding dipakai pada dua titik:

- saat indexing atau seed
- saat query search dijalankan

### 4. Qdrant

Qdrant dikelola melalui [src/qdrant.js](/home/frhn/Desktop/file/project_test/Semantic_searc_test/src/qdrant.js).

Qdrant menyimpan:

- vector embedding tiap entri
- payload metadata untuk filtering dan dereferensi

Payload penting yang disimpan:

- `source_type`
- `source_id`
- `entry_date`
- `entry_year`
- `entry_month`
- `entry_day`
- `entry_date_key`

`source_type` dan `source_id` dipakai untuk menghubungkan kembali hasil semantic ke record asli di PostgreSQL.

### 5. Search Service

Search service berada di [src/search-service.js](/home/frhn/Desktop/file/project_test/Semantic_searc_test/src/search-service.js).

Service ini menerima query dari endpoint search, memanggil retrieval layer, lalu mengembalikan hasil ke frontend.

### 6. Retrieval Layer

Retrieval layer berada di [src/retrieval.js](/home/frhn/Desktop/file/project_test/Semantic_searc_test/src/retrieval.js).

Pada arsitektur semantic search, modul ini adalah inti runtime.

Tugasnya:

- membuat embedding query
- memanggil Qdrant
- memetakan hasil ke record PostgreSQL
- melakukan hybrid reranking
- mengembalikan hasil akhir ke service

## Alur Indexing

Indexing dijalankan lewat [scripts/seed.js](/home/frhn/Desktop/file/project_test/Semantic_searc_test/scripts/seed.js).

Langkah-langkahnya:

1. script membaca semua data logbook dari PostgreSQL
2. setiap row dinormalisasi menjadi dokumen semantic
3. teks dokumen dikirim ke embedding provider
4. vector hasil embedding dibuat menjadi point Qdrant
5. collection Qdrant dipastikan tersedia
6. point di-upsert ke Qdrant secara batch
7. progres disimpan di `.seed-state.json`

Dengan cara ini, semantic search tidak perlu membaca seluruh PostgreSQL secara langsung pada setiap query. Query runtime cukup membaca kandidat dari Qdrant.

## Alur Query Semantic Search

Saat user mengirim query dari frontend:

1. frontend memanggil `POST /api/search`
2. backend di [server.js](/home/frhn/Desktop/file/project_test/Semantic_searc_test/server.js) meneruskan request ke search service
3. search service memanggil retrieval layer
4. retrieval layer membuat embedding dari query user
5. retrieval layer memanggil Qdrant untuk mengambil kandidat paling mirip
6. hasil Qdrant dipetakan ke `source_type` dan `source_id`
7. backend mengambil detail lengkap dari PostgreSQL
8. hasil diberi lexical reranking
9. hasil akhir dikirim ke frontend

## Hybrid Reranking

Hasil semantic search tidak lagi diurutkan hanya berdasarkan similarity vector. Backend menambahkan lexical boost sederhana.

Komponen yang dipakai saat ini:

- exact phrase match
- partial substring match
- token overlap

Backend juga mengenali dua mode query:

- `natural`
- `string-heavy`

### Mode `natural`

Dipakai untuk query seperti:

- `go around karena angin`
- `gangguan frekuensi tower`

Pada mode ini, semantic score tetap dominan dan lexical boost hanya berfungsi sebagai penguat kecil.

### Mode `string-heavy`

Dipakai untuk query seperti:

- call sign
- route
- kode perangkat
- log operasional dengan banyak angka dan simbol

Contoh:

- `LNI 804 B739/WARR-WADD/PK LQS RTB. ATA : 07.29`

Pada mode ini, backend menaikkan bobot lexical dengan multiplier khusus agar hasil yang sangat mirip secara teks bisa naik di ranking.

## Debug Search

Frontend search menampilkan metadata debug yang berasal dari retrieval layer:

- `semanticScore`
- `lexicalBoost`
- `queryMode`

Metadata ini berguna untuk:

- memahami kenapa sebuah hasil naik atau turun
- menguji apakah query dibaca sebagai `natural` atau `string-heavy`
- melakukan tuning bobot lexical lewat environment variable

## Konfigurasi Penting

Konfigurasi semantic search yang penting berada di [src/config.js](/home/frhn/Desktop/file/project_test/Semantic_searc_test/src/config.js).

Parameter tuning yang relevan:

- `SEARCH_LEXICAL_EXACT_BOOST`
- `SEARCH_LEXICAL_PARTIAL_BOOST`
- `SEARCH_LEXICAL_OVERLAP_BOOST`
- `SEARCH_LEXICAL_PARTIAL_MIN_LENGTH`
- `SEARCH_LEXICAL_MODE_AUTO`
- `SEARCH_LEXICAL_STRING_HEAVY_MULTIPLIER`
- `SEARCH_LEXICAL_NATURAL_MULTIPLIER`

Konfigurasi ini membuat sistem bisa disesuaikan tanpa harus mengubah algoritma inti retrieval.

## Kelebihan Pendekatan Ini

- PostgreSQL tetap aman sebagai sumber data utama
- Qdrant mempercepat pencarian semantic
- hasil search lebih baik untuk query operasional karena ada hybrid reranking
- query yang miskin makna natural tetap bisa tertangani lebih baik
- arsitektur cukup ringan untuk demo, eksperimen, dan evaluasi

## Batasan Saat Ini

- hybrid reranking masih heuristic-based, belum BM25 penuh
- semantic retrieval masih bergantung pada kualitas embedding model
- hasil exact string belum dijamin selalu nomor satu
- tuning lexical masih perlu penyesuaian sesuai karakter data

## Ringkasan

Arsitektur semantic search pada project ini memakai PostgreSQL sebagai sumber data, Qdrant sebagai semantic index, embedding provider untuk membentuk vector, dan backend Express untuk mengorkestrasi query. Saat runtime, query user diubah menjadi embedding, dicocokkan ke Qdrant, diperkaya dengan detail dari PostgreSQL, lalu diurutkan ulang menggunakan hybrid lexical reranking. Pendekatan ini cukup pragmatis untuk data logbook operasional yang tidak selalu mudah dipahami hanya dengan semantic vector murni.
