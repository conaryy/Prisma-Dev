# Arsitektur Backend K2S

Dokumen ini ditujukan untuk developer baru yang akan join ke tim backend K2S.

Fokus dokumen ini:
- membantu memahami struktur backend dengan cepat
- menjelaskan boundary antar layer
- menetapkan aturan naming, response API, middleware, dan keamanan
- memberi panduan praktis agar developer baru bisa mulai bekerja tanpa menebak-nebak

Catatan penting:
- backend utama K2S adalah **Laravel 12 API** di folder `K2S-Web-Project/backend`
- di dalam folder yang sama juga ada **service Python pendamping**:
  - `wrapping` untuk integrasi DNP
  - `whatsapp_api` untuk bridge WhatsApp/WAHA
- dokumen ini fokus utama ke **backend Laravel API**, tetapi tetap menandai posisi service Python karena keduanya memengaruhi arsitektur runtime

---

## 1. Struktur Folder

Berikut struktur backend yang perlu dipahami terlebih dahulu.

```text
backend/
├── app/
│   ├── Http/
│   │   ├── Controllers/
│   │   │   └── Api/
│   │   │       ├── ApiController.php
│   │   │       │   # Base controller API. Menyediakan helper respondData dan respondPaginated.
│   │   │       ├── AuthController.php
│   │   │       │   # Login lokal, logout, session, me, dan sso-config.
│   │   │       ├── DashboardController.php
│   │   │       │   # Endpoint dashboard, insight admin, summary CAP, map summary, dll.
│   │   │       ├── InstansiController.php
│   │   │       │   # CRUD instansi.
│   │   │       ├── FacilityController.php
│   │   │       │   # CRUD fasilitas.
│   │   │       ├── FacilityGroupController.php
│   │   │       │   # Master data kelompok fasilitas untuk modul informasi > fasilitas.
│   │   │       ├── OrganizationController.php
│   │   │       │   # CRUD organisasi.
│   │   │       ├── PersonilController.php
│   │   │       │   # CRUD personil.
│   │   │       ├── CertificateController.php
│   │   │       │   # CRUD sertifikat.
│   │   │       ├── AgendaController.php
│   │   │       │   # Agenda dan sesi self assessment dari agenda.
│   │   │       ├── AuditController.php
│   │   │       │   # Data audit.
│   │   │       ├── InspectionController.php
│   │   │       │   # Data inspeksi.
│   │   │       ├── MonitoringController.php
│   │   │       │   # Data monitoring.
│   │   │       ├── FindingController.php
│   │   │       │   # Data finding.
│   │   │       ├── FollowUpController.php
│   │   │       │   # Data follow-up.
│   │   │       ├── FollowUpEvidenceController.php
│   │   │       │   # Upload/download evidence follow-up.
│   │   │       ├── FollowUpHistoryController.php
│   │   │       │   # History follow-up.
│   │   │       ├── NotificationController.php
│   │   │       │   # Notifikasi, SSE stream URL, mark read.
│   │   │       ├── GuideManualController.php
│   │   │       │   # Manual dan template signed download.
│   │   │       ├── ProfileController.php
│   │   │       │   # Update profile dan password.
│   │   │       ├── UserController.php
│   │   │       │   # Admin user management.
│   │   │       ├── SelfAssessmentQuestionController.php
│   │   │       │   # Admin pertanyaan self assessment, import CSV, import dari DNP.
│   │   │       ├── SelfAssessmentSessionController.php
│   │   │       │   # Session self assessment dan file session.
│   │   │       ├── SelfAssessmentSessionAreaController.php
│   │   │       │   # Assignment area dalam session.
│   │   │       ├── SelfAssessmentAnswerController.php
│   │   │       │   # Jawaban self assessment user dan admin bulk answer.
│   │   │       ├── SelfAssessmentEvidenceController.php
│   │   │       │   # Evidence self assessment, download signed, admin evidence.
│   │   │       ├── SelfAssessmentReviewController.php
│   │   │       │   # Review self assessment, termasuk admin submissions/detail.
│   │   │       ├── SelfAssessmentResultController.php
│   │   │       │   # Final result self assessment dan file final.
│   │   │       ├── SelfAssessmentCapController.php
│   │   │       │   # CAP user/admin, fulfillment, review, extension, download files.
│   │   │       ├── SelfAssessmentExportDnpController.php
│   │   │       │   # Compare DNP, import compare snapshot, save matches, export draft ke DNP.
│   │   │       ├── SelfAssessmentImportDnpController.php
│   │   │       │   # Inject jawaban DNP ke jawaban lokal.
│   │   │       ├── ExternalDnpCapController.php
│   │   │       │   # CAP external DNP dan sync DNP.
│   │   │       ├── ExternalDnpExportDocumentController.php
│   │   │       │   # Generate dan download document external DNP.
│   │   │       ├── ExternalDnpWhatsappController.php
│   │   │       │   # Admin endpoint untuk WhatsApp DNP.
│   │   │       └── SelfAssessmentWhatsappSettingController.php
│   │   │           # Pengaturan notifikasi WhatsApp untuk self assessment.
│   │   └── Middleware/
│   │       ├── AuthenticateApiRequest.php
│   │       │   # Auth bearer token + Sanctum + SSO OIDC sync user.
│   │       ├── EnsureAdmin.php
│   │       │   # Membatasi akses admin.
│   │       ├── EnsureExternalDnpAccess.php
│   │       │   # Membatasi akses fitur external DNP.
│   │       └── EnsureInternalApiToken.php
│   │           # Token internal service-to-service.
│   ├── Jobs/
│   │   ├── RunExternalDnpSync.php
│   │   │   # Queue job sync external DNP.
│   │   ├── RunSelfAssessmentExportDnpImport.php
│   │   │   # Queue job import/compare DNP untuk self assessment.
│   │   ├── RunSelfAssessmentImportDnpInject.php
│   │   │   # Queue job inject jawaban DNP ke lokal.
│   │   ├── RunSelfAssessmentQuestionImport.php
│   │   │   # Queue job import pertanyaan self assessment.
│   │   └── RunWhatsappBatchSend.php
│   │       # Queue job batch send WhatsApp.
│   ├── Models/
│   │   ├── User.php
│   │   │   # User auth dan permission K2S.
│   │   ├── Instansi.php
│   │   ├── Facility.php
│   │   ├── FacilityGroup.php
│   │   ├── Organization.php
│   │   ├── Personil.php
│   │   ├── Certificate.php
│   │   ├── Agenda.php
│   │   ├── Audit.php
│   │   ├── Inspection.php
│   │   ├── Monitoring.php
│   │   ├── Finding.php
│   │   ├── FollowUp.php
│   │   ├── FollowUpEvidence.php
│   │   ├── FollowUpHistory.php
│   │   ├── SelfAssessment*.php
│   │   │   # Semua model domain self assessment, CAP, result, DNP snapshot, inject job, dsb.
│   │   ├── ExternalDnp*.php
│   │   │   # Semua model domain external DNP.
│   │   ├── SystemNotification.php
│   │   │   # Sistem notifikasi.
│   │   ├── WhatsappNotificationPanel.php
│   │   └── WhatsappUserNotificationRecipient.php
│   │       # Domain notifikasi WhatsApp.
│   ├── Providers/
│   │   # Service provider Laravel.
│   ├── Security/
│   │   └── Sso/
│   │       # Validasi OIDC/JWKS dan sinkronisasi user SSO.
│   ├── Services/
│   │   └── Whatsapp/
│   │       └── SelfAssessmentWhatsappNotificationService.php
│   │           # Service domain untuk notifikasi WhatsApp self assessment.
│   └── Support/
│       # Helper/support class tambahan jika ada.
├── bootstrap/
│   └── app.php
│       # Entry point konfigurasi Laravel 12: routing, middleware, exception config.
├── config/
│   ├── cors.php
│   │   # CORS API.
│   ├── sso.php
│   │   # Konfigurasi auth mode dan OIDC.
│   └── *.php
│       # Konfigurasi Laravel lainnya.
├── database/
│   ├── migrations/
│   │   # Semua migration schema database.
│   ├── seeders/
│   │   # Seeder data awal.
│   └── factories/
│       # Factory untuk testing/seeding.
├── docs/
│   # Dokumen backend tambahan bila ada.
├── public/
│   # Public entry Laravel.
├── resources/
│   ├── views/
│   ├── css/
│   ├── js/
│   └── manual/
│       # Resource manual dan asset terkait.
├── routes/
│   ├── api.php
│   │   # Semua route API utama.
│   ├── web.php
│   │   # Route web bila ada.
│   └── console.php
│       # Route/command console.
├── storage/
│   ├── app/
│   │   # File upload, hasil export, evidence, dsb.
│   ├── framework/
│   └── logs/
│       # Log aplikasi.
├── tests/
│   ├── Feature/
│   │   # Test endpoint/flow aplikasi.
│   └── Unit/
│       # Test unit logic kecil.
├── wrapping/
│   # Service Python untuk integrasi wrapper DNP. Bukan bagian request cycle Laravel biasa.
├── whatsapp_api/
│   # Service Python untuk bridge WhatsApp/WAHA. Bukan bagian request cycle Laravel biasa.
├── .env.example
│   # Template environment lokal.
├── composer.json
│   # Dependency dan script Composer.
└── artisan
    # CLI utama Laravel.
```

### Catatan penting tentang struktur saat ini

- **Repository layer belum hadir sebagai folder resmi** seperti `app/Repositories`.
- Saat ini banyak controller masih berbicara langsung dengan Eloquent model.
- Untuk query sederhana ini masih bisa diterima, tetapi untuk query kompleks atau integrasi luar, sebaiknya logic dipindahkan ke service atau repository/query object.
- Domain `Informasi > Fasilitas` sekarang memakai dua tabel:
  - `facility_groups` sebagai master daftar kelompok fasilitas
  - `facilities` sebagai item fasilitas yang memakai salah satu kelompok tersebut
- Saat ini relasi antara `facilities` dan `facility_groups` masih berbasis nama grup `facility_group`, belum memakai foreign key `facility_group_id`.
- Karena itu, perubahan rename/hapus kelompok fasilitas harus diperlakukan hati-hati dan dicek dampaknya ke seluruh item fasilitas yang memakai nama grup tersebut.

Alasan catatan ini penting:
- developer baru tidak bingung mencari folder repository yang memang belum ada
- tim tetap punya arah arsitektur yang jelas untuk perbaikan bertahap

---

## 2. Arsitektur Layer

Backend K2S sebaiknya dipahami dengan urutan layer berikut:

```text
Route
  -> Middleware
    -> Controller
      -> Service
        -> Repository / Query Object
          -> Model / Database
```

### Diagram sederhana

```text
HTTP Request
  -> routes/api.php
  -> Middleware (auth, admin, external-dnp-access, internal.api, signed, throttle)
  -> Controller
  -> Service
  -> Repository / Query Object
  -> Eloquent Model / DB
  -> JSON Response
```

## Tanggung jawab tiap layer

### 1. Routes
Lokasi:
- `routes/api.php`

Tugas:
- mendefinisikan URL
- memasang middleware
- mengarahkan request ke controller

Routes **boleh memanggil**:
- controller saja

Routes **tidak boleh**:
- menulis business logic
- menulis query database
- memanggil service luar langsung

Alasan:
- route harus tetap tipis dan mudah discan

Contoh benar:
```php
Route::post('auth/login', [AuthController::class, 'login'])->middleware('throttle:20,1');
```

Contoh salah:
```php
Route::post('auth/login', function () {
    $user = \App\Models\User::first();
    return response()->json($user);
});
```

### 2. Controllers
Lokasi:
- `app/Http/Controllers/Api`

Tugas:
- menerima request
- validasi input awal
- memanggil service/domain logic
- mengembalikan response JSON

Controller **boleh memanggil**:
- service
- repository/query object
- model langsung untuk kasus CRUD sangat sederhana

Controller **tidak boleh**:
- menulis business logic panjang
- menulis integrasi HTTP eksternal besar di dalam method controller bila bisa dipindah ke service
- mencampur validation, orchestration, transformasi, dan query berat dalam satu method besar

Alasan:
- controller yang tipis lebih mudah dites dan dibaca

### 3. Services
Lokasi saat ini:
- `app/Services`
- sebagian logic domain masih belum dipindah ke sini dan masih berada di controller

Tugas:
- memegang business logic yang bisa dipakai ulang
- mengorkestrasi beberapa model / query / integrasi
- menjadi boundary untuk side effect seperti external HTTP, file process, atau notification logic

Service **boleh memanggil**:
- repository
- model
- helper/support class
- service lain jika memang perlu

Service **tidak boleh**:
- tahu detail HTTP request Laravel terlalu dalam
- mengembalikan response JSON langsung

Alasan:
- service harus reusable dari controller, job, atau command

Contoh nyata:
- `SelfAssessmentWhatsappNotificationService`

### 4. Repository / Query Object
Lokasi ideal:
- `app/Repositories` atau `app/Domain/.../Repositories`

Status saat ini:
- **belum diterapkan konsisten di repo ini**

Rekomendasi:
- gunakan layer ini untuk query yang sudah kompleks
- terutama jika query dipakai ulang di beberapa controller/service

Repository **boleh memanggil**:
- model
- query builder
- database transaction helper

Repository **tidak boleh**:
- mengurus response JSON
- mengurus auth/HTTP

Alasan:
- query berat sebaiknya tidak hidup di controller

### 5. Database
Lapisan paling bawah:
- Eloquent model
- migration
- seeder

Tugas:
- representasi tabel
- relation
- query persistence

Model **boleh memanggil**:
- relation lain
- accessor/mutator
- scope yang memang terkait model itu

Model **tidak boleh**:
- memanggil HTTP client
- memegang business flow lintas domain yang besar

---

## Aturan “layer ini boleh memanggil siapa”

### Boleh

- Route -> Controller
- Controller -> Service
- Controller -> Repository
- Controller -> Model langsung untuk CRUD sederhana
- Service -> Repository
- Service -> Model
- Repository -> Model
- Job -> Service
- Job -> Repository

### Tidak boleh

- Route -> Model
- Route -> DB query langsung
- Middleware -> query domain berat
- Repository -> Response JSON
- Service -> `response()->json(...)`
- Model -> HTTP external service

---

## 3. Naming Convention

Aturan ini dibuat supaya backend tetap konsisten dan aman dibaca.

### A. File

#### Controller
Gunakan suffix `Controller`

Benar:
- `AuthController.php`
- `SelfAssessmentExportDnpController.php`

Salah:
- `Auth.php`
- `handleExportDnp.php`

Alasan:
- langsung terlihat sebagai entrypoint request

#### Service
Gunakan suffix `Service`

Benar:
- `SelfAssessmentWhatsappNotificationService.php`

Salah:
- `WhatsappHelper.php`
- `SelfAssessmentNotif.php`

#### Job
Gunakan prefix `Run` atau aksi yang sangat jelas

Benar:
- `RunSelfAssessmentExportDnpImport.php`
- `RunWhatsappBatchSend.php`

Salah:
- `Job1.php`
- `ExportDnp.php`

#### Middleware
Gunakan prefix `Ensure` atau nama yang menjelaskan guard

Benar:
- `EnsureAdmin.php`
- `EnsureInternalApiToken.php`
- `AuthenticateApiRequest.php`

### B. Function / Method

Gunakan `camelCase`.

Benar:
- `adminIndex`
- `storeBulk`
- `injectStatus`
- `ssoConfigPayload`

Salah:
- `Admin_Index`
- `store_bulk`
- `Injectstatus`

#### Penamaan method controller

- `index`, `show`, `store`, `update`, `destroy` untuk resource biasa
- `adminIndex`, `adminShow`, `adminStore` untuk admin variant
- `syncInit`, `syncStart`, `syncRun`, `syncStatus` untuk flow berlangkah

Alasan:
- developer baru bisa menebak fungsi method dari namanya

### C. Variabel

Gunakan `camelCase`.

Benar:
- `$validated`
- `$sessionArea`
- `$selectedMatches`

Boolean harus terbaca seperti pertanyaan:

Benar:
- `$isAdmin`
- `$hasAccess`
- `$isPending`

Salah:
- `$adminFlag`
- `$pendingState`

### D. Nama Tabel Database

Gunakan `snake_case` dan bentuk plural.

Benar:
- `users`
- `self_assessment_answers`
- `self_assessment_export_dnp_snapshots`

Salah:
- `User`
- `selfAssessmentAnswers`
- `tbl_snapshots`

Alasan:
- konsisten dengan konvensi Laravel

### E. Endpoint URL

Gunakan:
- huruf kecil
- dash untuk kata majemuk
- hierarki domain yang jelas

Benar:
- `/api/auth/login`
- `/api/admin/self-assessment/export-dnp/import`
- `/api/external-dnp/export-document/generate`

Salah:
- `/api/Auth/Login`
- `/api/admin/selfAssessment/exportDnp/import`
- `/api/export_document`

### F. Response JSON

#### Sukses
Gunakan key `data`.

Benar:
```json
{
  "data": {
    "token": "..."
  }
}
```

#### Error
Saat ini banyak endpoint memakai key `error`.

Benar untuk kondisi codebase saat ini:
```json
{
  "error": "Unauthenticated."
}
```

Target jangka menengah:
- standardisasi error agar lebih konsisten

---

## 4. Standar API Response

Backend K2S saat ini sudah punya pola dasar:
- sukses biasa: `data`
- paginated sukses: `data` + `meta`
- error bisnis/akses: `error`
- error validasi Laravel: `message` + `errors`

Untuk endpoint baru, gunakan standar berikut.

### A. Success Response

Format:
```json
{
  "data": {}
}
```

Contoh nyata:
```json
{
  "data": {
    "token": "1|abcxyz",
    "token_type": "Bearer",
    "user": {
      "id": "usr_123",
      "name": "Admin K2S",
      "email": "admin@example.com",
      "role": "admin"
    }
  }
}
```

Alasan:
- frontend K2S saat ini membaca response sukses dari key `data`
- base helper `respondData()` juga mengikuti pola ini

### B. Validation Error

Format Laravel default:
```json
{
  "message": "The given data was invalid.",
  "errors": {
    "email": [
      "The email field is required."
    ]
  }
}
```

Contoh:
```json
{
  "message": "The given data was invalid.",
  "errors": {
    "password": [
      "The password field is required."
    ],
    "email": [
      "The email field is required."
    ]
  }
}
```

Alasan:
- ini response default Laravel saat `Request::validate()` gagal
- tidak perlu dipaksa jadi format custom lain kecuali seluruh codebase sepakat migrasi

### C. Business / Access Error

Format:
```json
{
  "error": "Forbidden."
}
```

Contoh:
```json
{
  "error": "External DNP access required."
}
```

Alasan:
- ini pola yang paling banyak dipakai di controller dan middleware repo saat ini

### D. Server Error

Format:
```json
{
  "error": "Terjadi kesalahan pada server."
}
```

Contoh nyata yang ada saat ini:
```json
{
  "error": "Gagal menginisiasi sesi captcha DNP."
}
```

Aturan:
- jangan bocorkan stack trace ke client
- jika `APP_DEBUG=true`, detail masih bisa terlihat di lokal, tapi endpoint baru tetap harus hati-hati

### E. Pagination Response

Format baku backend saat ini:
```json
{
  "data": [],
  "meta": {
    "page": 1,
    "limit": 10,
    "total": 100,
    "totalPages": 10
  }
}
```

Contoh:
```json
{
  "data": [
    {
      "id": "fac_1",
      "name": "ILS",
      "type": "Navigation"
    }
  ],
  "meta": {
    "page": 1,
    "limit": 10,
    "total": 37,
    "totalPages": 4
  }
}
```

Alasan:
- helper `respondPaginated()` di `ApiController` sudah memakai format ini

### Contoh kode nyata base response

```php
protected function respondData(mixed $data, int $status = 200): JsonResponse
{
    return response()->json(['data' => $data], $status);
}

protected function respondPaginated(LengthAwarePaginator $paginator): JsonResponse
{
    return response()->json([
        'data' => $paginator->items(),
        'meta' => [
            'page' => $paginator->currentPage(),
            'limit' => $paginator->perPage(),
            'total' => $paginator->total(),
            'totalPages' => $paginator->lastPage(),
        ],
    ]);
}
```

---

## 5. Error Handling & Logging

## Cara error ditangkap

Saat ini error ditangani lewat kombinasi:
- validasi Laravel (`$request->validate(...)`)
- guard/middleware yang mengembalikan JSON 401/403/500
- `try/catch` di controller tertentu
- `report($exception)` untuk integrasi eksternal
- `Log::warning()` / `Log::error()` di job asynchronous

### Error handler dipasang di mana?

Titik utama:
- global exception pipeline Laravel di `bootstrap/app.php`
- saat ini blok `withExceptions(...)` masih minimal
- banyak endpoint masih menangani error langsung di controller/middleware

Artinya:
- untuk error umum Laravel, framework tetap menangani
- untuk domain error sensitif, controller masih banyak memformat response manual

### Kapan error cukup dikembalikan ke client

Tidak perlu log detail penuh jika error adalah:
- validasi input gagal
- unauthorized / forbidden yang memang expected
- data tidak ditemukan untuk request user biasa
- business rule error yang memang normal terjadi

Contoh:
- `Invalid credentials.`
- `Forbidden.`
- `Snapshot compare DNP belum tersedia.`

Alasan:
- ini error operasional biasa, bukan indikasi kerusakan sistem

### Kapan error wajib di-log / di-report

Perlu `report()` atau `Log::error()` jika:
- request ke service eksternal gagal
- wrapper DNP memberi response tidak valid
- job async gagal
- ada exception yang menandakan bug code
- ada config penting yang hilang

Contoh nyata:
- exception pada WhatsApp API
- exception pada wrapper DNP
- batch send job gagal

### Kapan pakai warning

Gunakan `Log::warning()` jika:
- request masih bisa lanjut tetapi ada data yang dilewati
- ada payload tidak lengkap
- ada fallback behavior yang tetap berhasil

Contoh nyata dari job:
- target WhatsApp dilewati karena payload tidak lengkap

### Contoh nyata logging di job

```php
Log::warning('WhatsApp batch target dilewati karena payload tidak lengkap.', [
    'target' => $target,
]);
```

```php
Log::error('Gagal mengirim pesan WhatsApp dari job batch.', [
    'target' => $target,
    'response' => $responseBody,
]);
```

### Aturan praktis tim

- 4xx yang expected: cukup response ke client
- 5xx atau integration failure: log/report
- jangan kirim detail exception sensitif ke client production
- log harus menyertakan context penting: `user_id`, `job_id`, `session_area_id`, atau payload ringkas bila aman

---

## 6. Middleware & Keamanan

## Middleware yang wajib dipahami

### Global middleware
Dipakai di `bootstrap/app.php`:
- `HandleCors`
- `TrustProxies`

Alasan:
- CORS harus dipasang paling awal untuk API lintas domain
- proxy trust penting di deploy gateway/reverse proxy

### Route-level middleware penting

- `auth.api`
  untuk auth bearer token, Sanctum, dan SSO

- `admin`
  untuk endpoint admin

- `external-dnp-access`
  untuk endpoint external DNP

- `internal.api`
  untuk service internal seperti bridge/bot

- `signed` / `signed:relative`
  untuk download URL sensitif

- `throttle`
  untuk endpoint rawan abuse seperti login, stream, captcha, signed file

## Urutan middleware yang disarankan

Urutan umum request:

```text
Global middleware
  -> CORS
  -> TrustProxies
  -> Route middleware
     -> throttle
     -> signed (jika route signed)
     -> auth.api
     -> admin / external-dnp-access / internal.api
  -> Controller
```

### Kenapa urutan ini dipilih

- CORS harus lebih awal agar browser dapat response yang benar
- throttle lebih awal untuk membatasi abuse
- signed harus lebih awal untuk validasi URL sensitif
- auth lebih awal sebelum controller
- role/access middleware setelah auth, karena butuh user yang sudah resolved

## Middleware yang wajib ada untuk endpoint baru

- auth jika endpoint private
- validasi input
- throttle untuk endpoint sensitif
- signed untuk download tanpa auth login
- admin atau permission guard jika endpoint administratif

### Contoh route yang benar

```php
Route::post('auth/login', [AuthController::class, 'login'])->middleware('throttle:20,1');
```

```php
Route::prefix('admin/self-assessment')->middleware('admin')->group(function () {
    Route::post('export-dnp/import', [SelfAssessmentExportDnpController::class, 'import']);
});
```

### Keamanan minimum yang harus dijaga

- semua endpoint admin harus ada guard admin
- endpoint external DNP harus ada access guard
- internal endpoint wajib pakai token internal
- file download sensitif wajib signed URL
- jangan percaya input client tanpa validasi
- jangan simpan secret di code

---

## 7. Environment & Konfigurasi

## Prinsip pengelolaan env

Semua konfigurasi sensitif atau environment-specific harus datang dari:
- `.env`
- `config/*.php`

Jangan:
- hardcode URL service
- hardcode token internal
- hardcode credential

## File env yang penting

- `.env.example`
  template lokal

- `.env`
  environment lokal nyata, **tidak boleh masuk version control**

## Contoh kelompok env penting di backend ini

### App
- `APP_NAME`
- `APP_ENV`
- `APP_DEBUG`
- `APP_URL`

### Logging
- `LOG_CHANNEL`
- `LOG_LEVEL`

### Database
- `DB_CONNECTION`
- `DB_HOST`
- `DB_PORT`
- `DB_DATABASE`
- `DB_USERNAME`
- `DB_PASSWORD`

### Session / Sanctum
- `SESSION_DRIVER`
- `SANCTUM_STATEFUL_DOMAINS`
- `SANCTUM_EXPIRATION`

### Auth / SSO
- `AUTH_MODE`
- `SSO_ISSUER`
- `SSO_JWKS_URL`
- `SSO_AUTHORIZE_URL`
- `SSO_TOKEN_URL`
- `SSO_CLIENT_ID`

### Portal mapping
- `AUTH_PORTAL_URL`
- `K2S_PORTAL_URL`
- `LOGBOOK_PORTAL_URL`
- `K3_PORTAL_URL`
- `KEAMANAN_PORTAL_URL`

### CORS
- `CORS_ALLOW_ORIGINS`

### External DNP Wrapper
- `EXTERNAL_DNP_WRAPPER_URL`
- `EXTERNAL_DNP_WEB2_URL`
- `EXTERNAL_DNP_WRAPPER_INTERNAL_TOKEN`

### WhatsApp internal bridge
- `WHATSAPP_BOT_INTERNAL_TOKEN`
- `WHATSAPP_API_SERVICE_URL`

## Yang boleh masuk version control

- `.env.example`
- file config yang membaca env
- dokumentasi nama env

## Yang tidak boleh masuk version control

- `.env`
- token internal asli
- API key
- password database
- secret OAuth/SSO production
- key privat

Alasan:
- keamanan dan isolasi environment

## Aturan struktur env

Sebaiknya kelompokkan env seperti ini:

```env
# App
APP_ENV=local
APP_DEBUG=true

# DB
DB_CONNECTION=mysql
DB_HOST=127.0.0.1

# Auth / SSO
AUTH_MODE=sso
SSO_ISSUER=http://localhost:3104

# External services
EXTERNAL_DNP_WRAPPER_URL=http://127.0.0.1:5001
WHATSAPP_API_SERVICE_URL=http://127.0.0.1:5002
```

Alasan:
- lebih mudah dibaca
- lebih mudah audit config

---

## 8. Panduan untuk Developer Baru

## Cara Mulai

### File yang dibaca pertama

Urutan yang disarankan:

1. `bootstrap/app.php`
   Tujuan: pahami middleware global dan alias middleware.

2. `routes/api.php`
   Tujuan: pahami semua domain endpoint dan boundary route.

3. `app/Http/Controllers/Api/ApiController.php`
   Tujuan: pahami base response JSON.

4. `app/Http/Middleware/AuthenticateApiRequest.php`
   Tujuan: pahami auth API aktual, termasuk Sanctum + SSO.

5. Controller domain yang ingin disentuh
   Contoh:
   - `SelfAssessmentExportDnpController.php`
   - `SelfAssessmentImportDnpController.php`
   - `SelfAssessmentCapController.php`

6. Model yang terlibat
   Contoh:
   - `SelfAssessmentAnswer.php`
   - `SelfAssessmentExportDnpSnapshot.php`
   - `SelfAssessmentImportDnpInjectJob.php`

7. Job jika ada flow async
   Contoh:
   - `RunSelfAssessmentExportDnpImport.php`
   - `RunSelfAssessmentImportDnpInject.php`

### Cara menjalankan project lokal

#### Backend Laravel

```bash
cd K2S-Web-Project/backend
composer install
cp .env.example .env
php artisan key:generate
php artisan migrate --force
php artisan serve
php artisan queue:work
```

#### Alternatif dev terpadu

```bash
cd K2S-Web-Project/backend
composer dev
```

#### Jika menyentuh wrapper DNP

```bash
cd K2S-Web-Project/backend/wrapping
pip install -r requirements.txt
python app.py
```

#### Jika menyentuh WhatsApp bridge

```bash
cd K2S-Web-Project/backend/whatsapp_api
pip install -r requirements.txt
python app.py
```

### Alur request dari masuk sampai response keluar

```text
Client request
  -> routes/api.php
  -> middleware global
  -> middleware route (auth/admin/signed/throttle)
  -> controller
  -> service / model / job dispatch
  -> response JSON
```

Contoh nyata:

```text
POST /api/admin/self-assessment/export-dnp/import
  -> routes/api.php
  -> auth.api
  -> admin
  -> SelfAssessmentExportDnpController@import
  -> validasi request
  -> simpan job import DNP
  -> dispatch RunSelfAssessmentExportDnpImport
  -> return JSON jobId ke client
```

### 3 hal wajib dipahami sebelum mulai coding

#### 1. Banyak flow penting berjalan async
Contoh:
- import compare DNP
- inject jawaban DNP
- import pertanyaan
- batch WhatsApp

Artinya:
- jangan anggap semua fitur selesai dalam satu request sinkron
- cek job dan queue worker

#### 2. Auth backend ini hybrid
`auth.api` bisa memakai:
- Sanctum user lokal
- OIDC bearer token + user sync

Artinya:
- jangan ubah auth hanya dari satu sisi
- baca `AuthenticateApiRequest.php` dan `config/sso.php` dulu

#### 3. Tidak semua logic sudah rapi di service
Banyak controller lama masih memegang logic domain cukup tebal.

Artinya:
- saat menambah fitur, jangan menambah kepadatan controller
- jika logic mulai reusable atau panjang, pindah ke service atau repository/query object

---

## 9. Do's & Don'ts

### Do's

- Buat controller tetap tipis.
- Gunakan `respondData()` dan `respondPaginated()` untuk endpoint baru bila cocok.
- Validasi request di boundary controller.
- Log error integrasi eksternal dan job async.
- Gunakan middleware yang sesuai sejak route level.
- Gunakan queue untuk proses berat atau lambat.
- Pakai nama endpoint yang konsisten dan lowercase.
- Simpan config sensitif di env.

### Don'ts

- Jangan tulis query berat langsung di route.
- Jangan letakkan business logic panjang di controller jika bisa dipindah ke service.
- Jangan bocorkan stack trace atau secret ke client.
- Jangan hardcode token, URL service, atau credential.
- Jangan lepas middleware auth/admin/signed hanya demi “mempermudah testing”.
- Jangan anggap wrapper Python dan WhatsApp bridge bagian opsional jika fitur terkait sedang disentuh.
- Jangan buat response JSON baru dengan format aneh sendiri bila pola yang ada sudah cukup.

---

## Ringkasan Arsitektur

Kalau harus diringkas ke satu kalimat:

> Backend K2S dibangun dengan pola `Route -> Middleware -> Controller -> Service/Repository -> Model/Database`, dengan queue job untuk flow berat, dan middleware yang ketat untuk auth, role, signed URL, serta integrasi internal.

Prinsip terpenting untuk developer baru:
- jaga controller tetap masuk akal
- pahami auth dan queue sebelum ubah flow besar
- gunakan struktur yang konsisten, bukan solusi cepat yang menambah hutang teknis
