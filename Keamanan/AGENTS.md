# AGENTS.md

## Project Overview
- Folder `Keamanan` saat ini belum terlihat sebagai service aktif.
- Isi yang ada hanya `readme.md` singkat dengan label `web keamanan`.
- Belum ada source code aplikasi, Dockerfile, package manifest, atau instruksi run yang lengkap.

## Build And Test Commands
- Tidak ada command build/test yang dapat diandalkan saat ini karena implementasi service belum tersedia di folder ini.

## Code Style Guidelines
- Jika folder ini mulai dikembangkan, ikuti pola monorepo yang sudah ada:
  - dokumentasikan stack yang dipakai
  - tambahkan manifest build yang jelas
  - tambahkan env example
  - definisikan entrypoint service dan, jika relevan, Dockerfile

## Testing Instructions
- Saat ini tidak ada instruksi testing karena belum ada service yang bisa dijalankan.

## Security Considerations
- Karena folder ini masih placeholder, jangan daftarkan ke `docker-compose.central.yml` atau gateway sebelum requirement auth, network exposure, dan secret handling jelas.
