# Legacy File Archive

Folder ini dipakai untuk menyimpan file lama, artefak migrasi, backup, atau hasil cleanup yang tidak lagi dipakai runtime aktif.

## Tujuan
- Menjaga folder service aktif tetap bersih.
- Menyimpan artefak lama yang masih mungkin dibutuhkan untuk audit, rollback manual, atau referensi historis.
- Memisahkan file runtime aktif dari file legacy/non-production.

## Aturan Pakai
- Pindahkan ke folder ini hanya file yang sudah tidak dipakai runtime aktif.
- Jangan jalankan aplikasi langsung dari folder ini.
- Jangan jadikan folder ini sebagai source of truth untuk konfigurasi terbaru.
- Jika memindahkan file ke sini, usahakan pertahankan struktur asalnya agar mudah ditelusuri.

## Isi Saat Ini
- `Auth/backend/data/`
  - artefak SQLite lama dan backup Auth sebelum dibersihkan ke PostgreSQL penuh.

## Pengecualian
- File yang masih dipakai runtime, secret aktif, atau key aktif tidak boleh dipindah ke sini.
- Contoh: `Auth/backend/data/jwks-private.json` tetap harus tinggal di folder service aktif selama masih dipakai.
