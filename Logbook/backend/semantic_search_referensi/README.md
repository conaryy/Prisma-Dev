# Semantic Search Qdrant Demo

Starter project sederhana untuk menguji:

- semantic search di atas data logbook
- chat RAG berbasis PostgreSQL dan Qdrant
- hybrid retrieval sederhana untuk data operasional

Teknologi yang dipakai:

- HTML statis
- Express.js
- PostgreSQL sebagai sumber data utama
- Qdrant sebagai vector database
- Ollama lokal atau Gemini untuk embedding
- Ollama atau Gemini untuk chat/rangkuman

## 1. Install dependency

```bash
npm install
```

## 2. Jalankan Qdrant

Cara paling mudah:

```bash
docker compose up -d
```

Qdrant akan tersedia di `http://localhost:6333`.

## 3. Siapkan environment

Copy file contoh:

```bash
cp .env.example .env
```

Contoh minimal untuk Ollama lokal:

```env
EMBEDDING_PROVIDER=ollama
OLLAMA_URL=http://127.0.0.1:11434
OLLAMA_EMBEDDING_MODEL=qwen3-embedding:latest

CHAT_PROVIDER=ollama
OLLAMA_CHAT_MODEL=qwen3.5:4b

DATABASE_URL=postgresql://postgres:password@localhost:5432/your_database
QDRANT_URL=http://localhost:6333
QDRANT_COLLECTION=logbook_entries
```

Contoh jika chat atau embedding memakai Gemini:

```env
EMBEDDING_PROVIDER=gemini
CHAT_PROVIDER=gemini
GEMINI_API_KEY=your_gemini_api_key
GEMINI_EMBEDDING_MODEL=gemini-embedding-001
GEMINI_CHAT_MODEL=gemini-2.5-flash
```

## 4. Seed dokumen ke Qdrant

```bash
npm run seed
```

Script ini akan:

- membaca tiga tabel logbook dari PostgreSQL
- menormalisasi setiap row menjadi dokumen retrieval
- membuat embedding untuk tiap entry
- memastikan collection Qdrant tersedia
- meng-upsert vector dan payload ke Qdrant
- menyimpan checkpoint lokal di `.seed-state.json`

Checkpoint membuat proses seed bisa dilanjutkan jika gagal di tengah jalan.

Jika isi PostgreSQL berubah besar-besaran dan Anda ingin Qdrant benar-benar sinkron ulang dari nol, gunakan:

```bash
npm run seed:full
```

Mode ini akan:

- menghapus collection Qdrant lama
- menghapus checkpoint `.seed-state.json`
- melakukan indexing ulang penuh dari PostgreSQL

## 5. Jalankan website

```bash
npm run dev
```

Lalu buka:

```text
http://localhost:3000
```

## Endpoint API

- `GET /api/health`
- `POST /api/search`
- `POST /api/chat`
- `POST /api/chat/stream`

### `POST /api/search`

Dipakai untuk semantic search biasa.

Flow ringkas:

1. query user diubah menjadi embedding
2. backend mencari kandidat di Qdrant
3. backend mengambil detail record dari PostgreSQL
4. backend melakukan lexical reranking sederhana
5. hasil dikirim ke frontend

Search saat ini bukan pure semantic saja. Hasil akhir dipengaruhi oleh:

- semantic score dari Qdrant
- lexical boost dari backend
- query mode `natural` atau `string-heavy`

Debug yang tampil di UI search:

- `semanticScore`
- `lexicalBoost`
- `queryMode`

### `POST /api/chat`

Dipakai untuk chat RAG dengan hasil final langsung.

Chat menerima filter eksplisit dari UI:

- `sourceType`
- `startDate`
- `endDate`

Aturan jalur retrieval:

- jika `startDate` dan `endDate` kosong, chat memakai semantic retrieval dari Qdrant
- jika `startDate` dan `endDate` diisi, chat memakai structured retrieval langsung dari PostgreSQL

### `POST /api/chat/stream`

Dipakai untuk chat dengan progres pipeline bertahap di frontend.

Endpoint ini mengirim event NDJSON untuk status seperti:

- start
- retrieval
- retrieval_done
- chunking
- chunk
- chunk_done
- final_summary
- done
- error

Event ini adalah debug pipeline backend, bukan chain-of-thought internal model.

## Chunked summarization

Untuk query chat terstruktur dengan hasil yang cukup besar, sistem tidak mengirim semua row ke satu prompt besar.

Sistem akan:

1. mengambil data terstruktur dari PostgreSQL
2. memecah hasil ke beberapa chunk
3. merangkum tiap chunk dengan request model terpisah
4. menyusun final summary dari seluruh ringkasan chunk

Konfigurasi yang mengatur ini:

- `CHAT_STRUCTURED_LIMIT`
- `CHAT_CHUNK_SIZE`
- `CHAT_CHUNK_THRESHOLD`

## Hybrid reranking

Search semantic diperkuat dengan lexical reranking sederhana agar query operasional lebih presisi.

Komponen lexical yang dipakai:

- exact phrase match
- partial substring match
- token overlap

Backend juga mendeteksi dua mode query:

- `natural`
- `string-heavy`

Mode `string-heavy` dipakai untuk query yang penuh dengan pola seperti:

- angka
- huruf kapital
- slash
- dash
- call sign
- route
- timestamp

Pada mode ini, bobot lexical dinaikkan agar hasil exact-like match lebih mudah naik.

## Environment penting

### Chat chunking

- `CHAT_STRUCTURED_LIMIT`
- `CHAT_CHUNK_SIZE`
- `CHAT_CHUNK_THRESHOLD`

### Search lexical tuning

- `SEARCH_LEXICAL_EXACT_BOOST`
- `SEARCH_LEXICAL_PARTIAL_BOOST`
- `SEARCH_LEXICAL_OVERLAP_BOOST`
- `SEARCH_LEXICAL_PARTIAL_MIN_LENGTH`

### Adaptive lexical mode

- `SEARCH_LEXICAL_MODE_AUTO`
- `SEARCH_LEXICAL_STRING_HEAVY_MULTIPLIER`
- `SEARCH_LEXICAL_NATURAL_MULTIPLIER`

## Struktur project

- `public/index.html`: UI search dan chat
- `server.js`: Express server dan endpoint API
- `src/config.js`: pembacaan konfigurasi environment
- `src/embedding.js`: helper embedding provider
- `src/chat-model.js`: helper chat provider
- `src/chat-service.js`: orchestration chat RAG, chunking, dan progress event
- `src/retrieval.js`: semantic retrieval, structured retrieval, dan reranking
- `src/query-filters.js`: normalisasi filter eksplisit dari UI
- `src/postgres.js`: helper query PostgreSQL
- `src/logbook-documents.js`: normalisasi data logbook
- `src/qdrant.js`: helper koneksi Qdrant
- `src/search-service.js`: service search
- `scripts/seed.js`: indexing data PostgreSQL ke Qdrant

## Catatan Operasional

- Seed membaca data dari:
  - `tower_logbook_entries`
  - `app_logbook_entries`
  - `teknik_logbook_entries`
- Default project sekarang mengarah ke Ollama lokal
- Jika collection Qdrant pernah diisi dengan model embedding lain, hapus collection lalu seed ulang agar ukuran vector konsisten
- Jika payload Qdrant berubah, jalankan `npm run seed` lagi
- Jika PostgreSQL diganti besar-besaran dan ingin menghapus orphan point lama di Qdrant, gunakan `npm run seed:full`
- Jika ingin full reseed dari awal, hapus `.seed-state.json` lalu jalankan `npm run seed`
- Untuk chat dengan `startDate` dan `endDate`, sistem akan mengambil data langsung dari PostgreSQL, bukan hanya top-k hasil semantic retrieval

## Ringkasan

Project ini bukan lagi demo semantic search sederhana saja. Saat ini sistem sudah memakai PostgreSQL sebagai sumber data utama, Qdrant sebagai semantic index, hybrid reranking untuk query operasional, dan dua mode chat retrieval. Untuk data terstruktur yang besar, backend juga mendukung chunked summarization dan progress debug di UI.
