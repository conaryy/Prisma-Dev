# Auth Frontend

Frontend login terpisah untuk SSO/Auth portal.

## Catatan

- Desain halaman login disalin dari login `K2S-Web-Project` agar tampilan konsisten.
- Endpoint default API: `http://localhost:8000` (bisa diubah via `VITE_API_BASE_URL`).
- Target portal K2S bisa diatur via `VITE_K2S_BASE_URL` (contoh: `https://k2s.example.com`).

## Menjalankan

```bash
npm install
npm run dev
```

## Build

```bash
npm run build
npm run preview
```
