# AGENTS.md

## Project Overview
- Folder `legacy_file` adalah arsip non-runtime untuk file lama, backup, artefak migrasi, dan dokumen/service yang sudah tidak dipakai jalur aktif.
- Folder ini bukan bagian dari deployment aktif dan tidak boleh dianggap sebagai source of truth implementasi saat ini.
- Struktur subfolder sebaiknya mengikuti lokasi asal file agar pelacakan historis tetap mudah.

## Build And Test Commands
- Tidak ada command build/test standar untuk folder ini.
- Jika Anda membuka file di sini, perlakukan itu sebagai artefak referensi atau backup, bukan unit aplikasi yang harus dijalankan.

## Code Style Guidelines
- Jangan mengembangkan fitur baru di dalam `legacy_file`.
- Jika perlu mengarsipkan sesuatu, pindahkan file apa adanya atau dengan perubahan seminimal mungkin.
- Pertahankan struktur path asal semampunya, misalnya `legacy_file/Auth/backend/data/...`.
- Tambahkan catatan singkat di `legacy_file/README.md` jika ada kategori arsip baru yang penting.

## Testing Instructions
- Tidak ada testing rutin untuk folder ini.
- Verifikasi hanya perlu memastikan:
  - file berhasil dipindahkan,
  - file aktif tidak rusak akibat pemindahan,
  - runtime service yang relevan tidak lagi bergantung pada file yang diarsipkan.

## Security Considerations
- Folder ini bisa berisi data lama, backup, atau artefak sensitif.
- Jangan publish atau deploy isi folder ini.
- Jangan memindahkan secret aktif ke sini hanya demi "cleanup".
- Bila arsip berisi database dump, backup, atau credential historis, perlakukan tetap sebagai data sensitif.
