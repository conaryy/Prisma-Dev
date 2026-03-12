# API Smoke Test Checklist (Role-Based)

Dokumen ini untuk verifikasi cepat setelah patch security:
- flow input user tetap normal
- endpoint admin-only benar-benar tertutup untuk Viewer
- akses file publik langsung `/storage/*` tertutup

## 1) Prasyarat

- Backend dan frontend sudah up:
  - `docker compose --env-file .env.production up -d --build backend backend-nginx frontend`
- Tersedia 2 akun:
  - `Admin`
  - `Viewer`
- Siapkan token bearer masing-masing akun dari endpoint login:
  - `POST /api/auth/login`

Contoh login:

```bash
curl -X POST https://apiprisma.ryvidia.my.id/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin","password":"***"}'
```

Simpan token:
- `ADMIN_TOKEN`
- `VIEWER_TOKEN`

## 2) Test Viewer (harus tetap bisa input modul user)

## 2.1 Informasi (milik sendiri)

Pastikan Viewer bisa CRUD data miliknya:
- `GET /api/instansi`
- `POST /api/instansi`
- `PUT /api/instansi/{id}`
- `GET/POST/PUT/DELETE /api/facilities`
- `GET/POST/PUT/DELETE /api/organizations`
- `GET/POST/PUT/DELETE /api/personil`
- `GET/POST/PUT/DELETE /api/certificates`

Expected:
- Semua operasi sesuai kebutuhan user berjalan.
- Tidak bisa mengakses/mengubah data milik user lain (403/404 sesuai implementasi).

## 2.2 Self Assessment / CAP / Monitoring (user-facing)

Lakukan flow normal dari UI:
- isi jawaban self assessment
- simpan draft/kirim CAP
- akses menu monitoring user yang biasa dipakai

Expected:
- Tidak ada regresi fungsional.
- Tidak ada 403 pada flow user normal.

## 3) Test Viewer (harus gagal untuk admin-only)

Coba endpoint write berikut pakai token Viewer:

- `POST /api/agenda`
- `PUT /api/agenda/{id}`
- `DELETE /api/agenda/{id}`

- `POST /api/audits`
- `PUT /api/audits/{id}`
- `DELETE /api/audits/{id}`

- `POST /api/inspections`
- `PUT /api/inspections/{id}`
- `DELETE /api/inspections/{id}`

- `POST /api/monitoring`
- `PUT /api/monitoring/{id}`
- `DELETE /api/monitoring/{id}`

- `POST /api/findings`
- `PUT /api/findings/{id}`
- `DELETE /api/findings/{id}`

- `POST /api/follow-ups`
- `PUT /api/follow-ups/{id}`
- `DELETE /api/follow-ups/{id}`

- `POST /api/follow-ups/{followUp}/history`
- `POST /api/follow-ups/{followUp}/evidence`
- `DELETE /api/follow-ups/{followUp}/evidence/{evidence}`

Expected:
- Semua request di atas return `403` (`Admin access required.`).

## 4) Test Admin

Ulangi endpoint admin-only di atas dengan token Admin.

Expected:
- Request berhasil (`200/201`).
- Data tersimpan/terupdate/terhapus sesuai aksi.

## 5) Test File Access Security

## 5.1 Direct storage harus tertutup

Uji langsung:

```bash
curl -I https://apiprisma.ryvidia.my.id/storage/some-file.pdf
```

Expected:
- `404`

## 5.2 Download via endpoint signed/auth tetap jalan

Uji dari UI (klik file evidence/attachment) atau via signed URL API.

Expected:
- File valid tetap bisa didownload dari endpoint resmi.

## 6) Kriteria Lulus

- Viewer tetap bisa menyelesaikan semua flow user normal.
- Viewer tidak bisa write endpoint admin-only (403 konsisten).
- Admin tetap bisa write endpoint admin-only.
- Direct `/storage/*` tidak bisa diakses.
- Download file via endpoint resmi tetap berfungsi.

## 7) Catatan Investigasi Jika Gagal

Jika ada flow user terganggu:
- cek Network tab: endpoint mana yang kena 403
- cocokkan endpoint itu apakah seharusnya admin-only atau user-facing
- cek route di `backend/routes/api.php`
- cek auth token role di payload `GET /api/auth/me`

## 8) Template Curl (Copy-Paste)

Ganti value berikut sesuai environment:
- `API_BASE=https://apiprisma.ryvidia.my.id`
- username/password admin/viewer
- ID resource (`{id}`, `{followUp}`, `{evidence}`)

```bash
# =========================
# A. Setup variable
# =========================
API_BASE="https://apiprisma.ryvidia.my.id"

# =========================
# B. Login Admin & Viewer
# =========================
ADMIN_TOKEN=$(curl -s -X POST "$API_BASE/api/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"email":"admin","password":"ADMIN_PASSWORD"}' | jq -r '.data.token')

VIEWER_TOKEN=$(curl -s -X POST "$API_BASE/api/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"email":"viewer","password":"VIEWER_PASSWORD"}' | jq -r '.data.token')

echo "ADMIN_TOKEN=${ADMIN_TOKEN:0:20}..."
echo "VIEWER_TOKEN=${VIEWER_TOKEN:0:20}..."

# =========================
# C. Cek role/token valid
# =========================
curl -s "$API_BASE/api/auth/me" -H "Authorization: Bearer $ADMIN_TOKEN" | jq .
curl -s "$API_BASE/api/auth/me" -H "Authorization: Bearer $VIEWER_TOKEN" | jq .

# =========================
# D. Viewer should FAIL (403) on admin-only write endpoints
# =========================
curl -i -X POST "$API_BASE/api/agenda" \
  -H "Authorization: Bearer $VIEWER_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"title":"viewer-test"}'

curl -i -X POST "$API_BASE/api/audits" \
  -H "Authorization: Bearer $VIEWER_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name":"viewer-test"}'

curl -i -X POST "$API_BASE/api/inspections" \
  -H "Authorization: Bearer $VIEWER_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name":"viewer-test"}'

curl -i -X POST "$API_BASE/api/monitoring" \
  -H "Authorization: Bearer $VIEWER_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name":"viewer-test"}'

curl -i -X POST "$API_BASE/api/findings" \
  -H "Authorization: Bearer $VIEWER_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name":"viewer-test"}'

curl -i -X POST "$API_BASE/api/follow-ups" \
  -H "Authorization: Bearer $VIEWER_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"findingId":"dummy","aksiPerbaikan":"x","pic":"x","targetDate":"2026-03-02","status":"Open"}'

curl -i -X POST "$API_BASE/api/follow-ups/{followUp}/history" \
  -H "Authorization: Bearer $VIEWER_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"status":"Open","remark":"viewer-test"}'

curl -i -X POST "$API_BASE/api/follow-ups/{followUp}/evidence" \
  -H "Authorization: Bearer $VIEWER_TOKEN" \
  -F "file=@/path/to/file.pdf"

curl -i -X DELETE "$API_BASE/api/follow-ups/{followUp}/evidence/{evidence}" \
  -H "Authorization: Bearer $VIEWER_TOKEN"

# =========================
# E. Admin should PASS on admin-only write endpoints
# =========================
curl -i -X POST "$API_BASE/api/agenda" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"title":"admin-test"}'

curl -i -X POST "$API_BASE/api/follow-ups" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"findingId":"dummy","aksiPerbaikan":"x","pic":"x","targetDate":"2026-03-02","status":"Open"}'

# =========================
# F. Informasi module (viewer-owned) should still work
# =========================
curl -i "$API_BASE/api/instansi" \
  -H "Authorization: Bearer $VIEWER_TOKEN"

curl -i -X POST "$API_BASE/api/instansi" \
  -H "Authorization: Bearer $VIEWER_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "facilityGroup":"ATS",
    "kobu":"KOBU",
    "bandara":"BANDARA",
    "cabangAirnav":"CABANG",
    "name":"Instansi Viewer"
  }'

curl -i "$API_BASE/api/facilities" \
  -H "Authorization: Bearer $VIEWER_TOKEN"

# =========================
# G. Direct storage must be blocked
# =========================
curl -i "$API_BASE/storage/anything.pdf"
```

Catatan:
- Perintah di atas memakai `jq` untuk parsing token. Jika `jq` belum ada, ambil token manual dari respons JSON login.
- Sebagian endpoint punya validasi payload spesifik per project; sesuaikan body agar lolos validasi saat menguji `PASS` admin.
