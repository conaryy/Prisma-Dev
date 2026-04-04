# WhatsApp API Bridge

Service ini menerima webhook dari WAHA, mem-parsing command WhatsApp, lalu mengambil data `external DNP` dari backend Laravel melalui endpoint internal.

Command yang didukung saat ini:

- `/temuan all`
- `/temuan audit all`
- `/temuan audit 2025`
- `/temuan inspeksi all`
- `/temuan surveillance 2026`

## Menjalankan Lokal

1. Salin env:
   - `cp .env.example .env`
2. Install dependency:
   - `pip install -r requirements.txt`
3. Jalankan service:
   - `python app.py`

## Endpoint

- `GET /health`
- `POST /command`
  - body: `{ "text": "/temuan audit 2025" }`
- `POST /webhook/waha`

## Catatan Integrasi

- Service ini mengirim balasan ke WAHA menggunakan `POST /api/sendText`.
- Service ini mengambil data ke Laravel memakai:
  - `GET /api/internal/whatsapp/external-dnp/temuan`
- Header internal yang wajib:
  - `X-Internal-Token: <WHATSAPP_BOT_INTERNAL_TOKEN>`
