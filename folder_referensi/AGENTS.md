# AGENTS.md

## Project Overview
- Folder ini berisi bahan referensi, bukan service production utama.
- Logbook dan frontend lain kadang memakai folder ini sebagai acuan visual atau pola implementasi.
- Isi folder ini bukan source of truth untuk domain, env, SSO, atau deploy runtime saat ini.

## Build And Test Commands
- Tidak ada command wajib dari root untuk folder ini.
- Jalankan sesuatu di sini hanya jika memang sedang mengambil referensi atau membandingkan implementasi.

## Code Style Guidelines
- Jangan menjadikan folder ini sumber kebenaran runtime.
- Hindari mengedit referensi kecuali memang sedang memperbarui bahan acuan.
- Jika mengambil inspirasi kode/UI dari sini, port perubahan ke service aktif yang relevan dan dokumentasikan alasan adaptasinya.

## Testing Instructions
- Tidak ada testing wajib untuk folder referensi.

## Security Considerations
- Jangan deploy isi folder ini.
- Jangan menganggap env, package, atau aset di sini aman dipakai langsung tanpa review.
