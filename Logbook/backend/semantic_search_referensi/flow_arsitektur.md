# Flow Arsitektur

## Gambaran Umum

Project ini memakai empat komponen inti:

- PostgreSQL sebagai sumber data utama
- Qdrant sebagai vector index
- model embedding untuk mengubah teks menjadi vector
- model chat untuk menjawab atau merangkum berdasarkan konteks

Frontend berada di [public/index.html](/home/frhn/Desktop/file/project_test/Semantic_searc_test/public/index.html). Frontend hanya berbicara ke backend Express. Semua akses ke PostgreSQL, Qdrant, dan model AI dilakukan oleh backend.

Secara umum sistem dibagi menjadi dua jalur:

- jalur indexing atau seed
- jalur runtime untuk search dan chat

## Alur Seed

Proses seed dimulai dari [scripts/seed.js](/home/frhn/Desktop/file/project_test/Semantic_searc_test/scripts/seed.js).

Langkahnya:

1. script membaca seluruh data logbook dari PostgreSQL melalui [src/postgres.js](/home/frhn/Desktop/file/project_test/Semantic_searc_test/src/postgres.js)
2. data berasal dari tabel:
   - `tower_logbook_entries`
   - `app_logbook_entries`
   - `teknik_logbook_entries`
3. tiap row dinormalisasi dengan [src/logbook-documents.js](/home/frhn/Desktop/file/project_test/Semantic_searc_test/src/logbook-documents.js)
4. teks hasil normalisasi dikirim ke [src/embedding.js](/home/frhn/Desktop/file/project_test/Semantic_searc_test/src/embedding.js)
5. embedding yang dihasilkan di-upsert ke Qdrant melalui [src/qdrant.js](/home/frhn/Desktop/file/project_test/Semantic_searc_test/src/qdrant.js)
6. progres seed disimpan di `.seed-state.json`

Payload Qdrant tidak hanya menyimpan identitas data, tetapi juga metadata waktu:

- `entry_date`
- `entry_year`
- `entry_month`
- `entry_day`
- `entry_date_key`

`entry_date_key` adalah bentuk angka tanggal seperti `20250228`. Field ini dipakai untuk filter yang lebih stabil pada payload Qdrant.

Checkpoint `.seed-state.json` membuat seed bisa dilanjutkan jika proses berhenti di tengah jalan.

## Alur Semantic Search

Saat user memakai form search, request masuk ke `POST /api/search` di [server.js](/home/frhn/Desktop/file/project_test/Semantic_searc_test/server.js).

Langkah runtime-nya:

1. backend memanggil [src/search-service.js](/home/frhn/Desktop/file/project_test/Semantic_searc_test/src/search-service.js)
2. search service memanggil [src/retrieval.js](/home/frhn/Desktop/file/project_test/Semantic_searc_test/src/retrieval.js)
3. query user dibuat menjadi embedding melalui [src/embedding.js](/home/frhn/Desktop/file/project_test/Semantic_searc_test/src/embedding.js)
4. Qdrant mengembalikan kandidat semantic terdekat
5. kandidat dipetakan kembali ke detail record PostgreSQL
6. hasil diberi lexical reranking sederhana
7. hasil akhir dikirim ke frontend

Search saat ini tidak lagi pure semantic. Backend menambahkan reranking berbasis teks untuk memperbaiki query yang banyak berisi istilah operasional.

Komponen lexical yang dipakai:

- exact phrase match
- partial substring match
- token overlap

Backend juga mengklasifikasikan query menjadi:

- `natural`
- `string-heavy`

Query `string-heavy` biasanya berisi banyak:

- angka
- huruf kapital
- slash
- dash
- timestamp
- kode operasional

Pada mode ini, lexical boost diperbesar agar exact-like match tidak kalah oleh semantic score murni.

Frontend menerima metadata debug seperti:

- `semanticScore`
- `lexicalBoost`
- `queryMode`

## Alur Chat RAG

Mode chat memiliki dua endpoint:

- `POST /api/chat`
- `POST /api/chat/stream`

Keduanya memakai [src/chat-service.js](/home/frhn/Desktop/file/project_test/Semantic_searc_test/src/chat-service.js). Perbedaannya hanya pada cara respons dikirim:

- `/api/chat` mengembalikan hasil final langsung
- `/api/chat/stream` mengirim status pipeline bertahap dalam NDJSON

### Input chat

Frontend mengirim:

- `question`
- `sourceType`
- `startDate`
- `endDate`

Filter ini dibaca sebagai filter eksplisit aplikasi. Sistem tidak lagi mencoba menebak tanggal dari bahasa natural.

### Penentuan jalur retrieval

Penentuan jalur dibantu oleh [src/query-filters.js](/home/frhn/Desktop/file/project_test/Semantic_searc_test/src/query-filters.js).

Jika `startDate` dan `endDate` kosong:

- chat memakai jalur semantic
- backend memanggil `retrieveDocuments()`
- retrieval dilakukan ke Qdrant lalu diperkaya detail PostgreSQL

Jika `startDate` dan `endDate` diisi:

- chat memakai jalur structured
- backend memanggil `retrieveStructuredDocuments()`
- data diambil langsung dari PostgreSQL
- jumlah row dibatasi oleh `CHAT_STRUCTURED_LIMIT`

### Single-pass summary

Jika hasil retrieval relatif kecil, chat service membuat satu prompt berisi:

- pertanyaan user
- konteks hasil retrieval

Prompt ini dikirim ke [src/chat-model.js](/home/frhn/Desktop/file/project_test/Semantic_searc_test/src/chat-model.js), lalu jawaban final dikembalikan ke frontend.

### Chunked summarization

Jika jalur structured dipakai dan jumlah hasil mencapai `CHAT_CHUNK_THRESHOLD`, sistem tidak mengirim semua data sekaligus ke satu prompt.

Langkahnya:

1. hasil dipecah menjadi beberapa chunk dengan ukuran `CHAT_CHUNK_SIZE`
2. setiap chunk diringkas lewat request model terpisah
3. semua ringkasan chunk digabung
4. model dipanggil lagi untuk final synthesis

Artinya, satu pertanyaan user bisa menghasilkan beberapa request AI. Ini memang desain yang disengaja agar sistem tetap stabil pada data periode yang lebih besar.

### Stream debug

Jika frontend memakai `POST /api/chat/stream`, backend mengirim event progres seperti:

- `start`
- `retrieval`
- `retrieval_done`
- `chunking`
- `chunk`
- `chunk_done`
- `final_summary`
- `done`
- `error`

Event ini bukan chain-of-thought model. Event ini adalah status pipeline backend agar proses chat lebih mudah dipantau saat development.

## Peran Masing-Masing Komponen

PostgreSQL menyimpan data utama dan melayani query terstruktur. Qdrant menyimpan vector dan payload retrieval. Model embedding mengubah teks menjadi vector. Model chat membuat jawaban berdasarkan konteks yang sudah dipilih backend.

Dengan pembagian ini:

- model chat tidak membaca seluruh database
- filter exact tidak dibebankan ke LLM
- semantic search tetap cepat
- chat untuk periode besar tetap bisa ditangani dengan chunking

## Batasan Implementasi Saat Ini

- lexical reranking masih heuristic-based, belum BM25 penuh
- jalur structured tetap dibatasi oleh `CHAT_STRUCTURED_LIMIT`
- chunking membuat satu pertanyaan user bisa memicu beberapa request model
- kualitas jawaban tetap bergantung pada kualitas retrieval
- perubahan payload Qdrant tetap memerlukan seed ulang

## Ringkasan

Arsitektur saat ini memakai PostgreSQL sebagai sumber data utama, Qdrant sebagai semantic index, hybrid reranking untuk search, dan dua jalur retrieval untuk chat. Jalur chat dapat berjalan sebagai semantic retrieval biasa atau structured retrieval langsung dari PostgreSQL. Jika data terlalu besar, backend merangkum per chunk lalu menyusun jawaban final. Dokumentasi ini mencerminkan pola kerja sistem saat ini, bukan hanya desain awal project.
