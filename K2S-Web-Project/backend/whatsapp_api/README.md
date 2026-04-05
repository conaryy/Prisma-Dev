# WhatsApp API Bridge

Service ini menjadi bridge antara Laravel K2S dan WAHA.

## Tanggung Jawab

- menerima webhook dari WAHA
- mem-parsing command WhatsApp
- mengambil data tertentu dari backend Laravel melalui endpoint internal
- membantu flow admin session WAHA:
  - status sesi
  - QR
  - logout
  - create session
- meneruskan pengiriman pesan dari flow admin Laravel

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
- `POST /webhook/waha`
- endpoint internal admin/session sesuai implementasi `app.py`

## Catatan Integrasi

- Service ini berbicara ke WAHA menggunakan:
  - `WAHA_API_BASE_URL`
  - `WAHA_API_KEY`
  - `WAHA_SESSION_NAME`
- Service ini berbicara ke Laravel memakai:
  - `WHATSAPP_BOT_BACKEND_URL`
  - header `X-Internal-Token: <WHATSAPP_BOT_INTERNAL_TOKEN>`
- Pada deploy pusat saat ini:
  - Laravel memanggil bridge lewat `WHATSAPP_API_SERVICE_URL=http://whatsapp-api:5002`
  - bridge memanggil Laravel internal lewat `http://backend-nginx`

## Catatan Operasional

- Hindari menambah dependency cycle di compose antara:
  - `backend`
  - `backend-nginx`
  - `whatsapp-api`
- Queue Laravel memproses batch send secara asynchronous; Python bridge tidak seharusnya memaksa flow admin menjadi sinkron.
