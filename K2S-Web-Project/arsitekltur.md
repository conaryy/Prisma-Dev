# Arsitektur Frontend K2S

Dokumen ini ditujukan untuk developer baru yang akan join ke tim frontend K2S.

Tujuan dokumen ini:
- membantu memahami struktur project dengan cepat
- memberi aturan naming dan boundary code yang konsisten
- menjelaskan alur data frontend tanpa harus menebak-nebak
- mengurangi risiko menambah code di tempat yang salah

Prinsip dokumen ini:
- prioritaskan keterbacaan
- gunakan contoh nyata dari codebase
- jelaskan alasan singkat di balik keputusan arsitektur

---

## 1. Struktur Folder

Berikut struktur utama frontend di `K2S-Web-Project/src` yang perlu dipahami dulu.

```text
src/
├── App.tsx
│   # Root router aplikasi. Semua route besar didefinisikan di sini.
├── AppShell.tsx
│   # Shell utama setelah user masuk. Biasanya jadi penghubung layout + auth hydration.
├── assets/
│   # File statis frontend seperti gambar, icon, atau asset visual lain.
├── components/
│   ├── admin/
│   │   # Komponen khusus area admin yang tidak cukup umum untuk dipakai lintas domain.
│   ├── auth/
│   │   # Guard dan komponen auth, contoh: RequireAuth, RequireAdmin.
│   ├── charts/
│   │   # Komponen visualisasi data.
│   ├── dashboard/
│   │   # Komponen khusus dashboard.
│   ├── detail/
│   │   # Drawer/panel/detail view, contoh: CaseDetailDrawer.tsx.
│   ├── filters/
│   │   # Komponen filter reusable, contoh: FilterBar.tsx.
│   ├── layout/
│   │   # Struktur halaman seperti navbar, sidebar, wrapper layout.
│   ├── notifications/
│   │   # Komponen notifikasi dan related UI.
│   ├── self-assessment/
│   │   # Komponen domain self assessment. Ini area frontend paling aktif saat ini.
│   ├── shared/
│   │   # Shared component level aplikasi, contoh: FormField, FormSection.
│   ├── states/
│   │   # Empty state, loading state, error state, dan variasi UI status lain.
│   ├── table/
│   │   # Komponen tabel reusable atau semi-domain, contoh: CaseTable.tsx.
│   └── ui/
│       # Primitive UI dasar, contoh: Button, Input, Checkbox, Textarea.
├── contexts/
│   └── AppDataContext.tsx
│       # Context global lama untuk data operasional umum.
│       # Saat ini masih besar dan menjadi salah satu hotspot refactor.
├── data/
│   # Seed atau data dummy/helper untuk kebutuhan frontend tertentu.
├── hooks/
│   # Custom hooks reusable.
│   # useAsyncJobPolling.ts    → polling status job async (export DNP, import DNP)
│   # useDnpSessionAreaFlow.ts → flow navigasi area DNP
│   # useDnpMatchSelection.ts  → logika seleksi & matching pertanyaan lokal ↔ DNP
│   # useLocalStorage.ts       → wrapper abstraksi localStorage
│   # use-toast.ts             → helper toast notification
├── lib/
│   # API client, helper domain, dan kontrak request.
│   # File paling penting:
│   # api.ts                         → fondasi fetch, token management (localStorage), auto-refresh
│   # sso.ts                         → PKCE OIDC flow, SSO lock multi-tab
│   # permissions.ts                 → PermissionMap dan helper akses lintas-service
│   # selfAssessment.ts              → kontrak API Self Assessment (terbesar, 36KB)
│   # externalDnp.ts                 → kontrak API External DNP
│   # monitoringReview.ts            → kontrak API monitoring review
│   # certificationNotes.ts          → kontrak API catatan sertifikasi
│   # certificationNoteDocuments.ts  → helper generate/download dokumen catatan sertifikasi
│   # notifications.ts               → kontrak API notifikasi
│   # authPortal.ts                  → integrasi dengan Auth Portal eksternal
│   # selfAssessmentDnpMatching.ts   → util matching pertanyaan DNP
│   # selfAssessmentFilters.ts       → util filter self assessment
│   # download.ts                    → helper download file via signed URL
│   # date.ts                        → utility format tanggal
│   # storage.ts                     → wrapper abstraksi localStorage
│   # theme.ts                       → konfigurasi tema
│   # id.ts, utils.ts                → utility umum
├── pages/
│   # Page-level orchestration. Tempat halaman utama berada.
│   ├── admin/
│   │   # Halaman admin seperti SelfAssessmentReviews.tsx.
│   └── external-dnp/
│       # Halaman khusus alur external DNP.
└── types/
    # Semua type domain TypeScript.
    # Contoh: selfAssessment.ts, kks.ts.
```

### File yang biasanya paling sering disentuh

- `src/App.tsx`
  Alasan: semua route baru biasanya akan masuk lewat sini.

- `src/lib/api.ts`
  Alasan: ini fondasi request API frontend. Token disimpan di **localStorage** (`k2s.authToken`, `k2s.authRefreshToken`, `k2s.authUser`). Ada mekanisme **auto-refresh token** — jika response `401` diterima, `apiFetch` otomatis memanggil `refreshAccessToken()` dan mengulang request dengan token baru.

- `src/lib/sso.ts`
  Alasan: flow PKCE OIDC lengkap ada di sini, termasuk **SSO lock multi-tab** (TTL 15 detik) yang mencegah race condition login di beberapa tab browser sekaligus.

- `src/lib/permissions.ts`
  Alasan: berisi `PermissionMap` lengkap dan helper cek akses untuk seluruh fitur K2S, termasuk akses lintas-service (Logbook, K3, Keamanan).

- `src/lib/selfAssessment.ts`
  Alasan: kontrak API self assessment, admin, DNP, dan CAP saat ini banyak dikumpulkan di sini.

- `src/pages/admin/SelfAssessmentReviews.tsx`
  Alasan: ini orchestration page besar untuk review, export DNP, dan import jawaban DNP.

- `src/pages/DashboardEntry.tsx`
  Alasan: entry point dashboard yang memilih antara dua versi dashboard (`Dashboard.tsx` dan `Dashboard2.tsx`) secara kondisional.

- `src/contexts/AppDataContext.tsx`
  Alasan: banyak data operasional lama masih hidup dari context ini.

### Struktur domain self assessment yang sedang dibentuk

```text
src/components/self-assessment/
├── SelfAssessmentDnpLoginPanel.tsx
│   # Panel login DNP, captcha, area, dan trigger import compare.
├── SelfAssessmentDnpSnapshotPanel.tsx
│   # Panel daftar/snapshot pertanyaan DNP.
├── SelfAssessmentDnpAnswerPairingPanel.tsx
│   # Panel pairing pertanyaan lokal vs DNP.
├── SelfAssessmentAssessmentEditorPanel.tsx
│   # Panel upload evidence dan form assessment lokal admin.
├── SelfAssessmentReviewDetailPanel.tsx
│   # Panel review detail non-DNP.
├── SelfAssessmentResultSubmissionPanel.tsx
│   # Panel pengiriman dokumen hasil audit.
├── SelfAssessmentSubmissionTable.tsx
│   # Tabel daftar submission.
└── SelfAssessmentWorkspace.tsx
    # Wrapper/layout area self assessment.
```

Alasan struktur ini dipakai:
- page jadi lebih ringan
- UI besar dipisah ke panel yang jelas tanggung jawabnya
- tim lebih mudah edit satu bagian tanpa menyentuh semua flow

---

## 2. Naming Convention

Aturan ini harus diikuti agar codebase tetap mudah dibaca.

### Nama File

#### Komponen React
Gunakan `PascalCase.tsx`

Contoh:
- `CaseTable.tsx`
- `FilterBar.tsx`
- `SelfAssessmentDnpLoginPanel.tsx`

Alasan:
- mudah dibedakan dari util/helper
- konsisten dengan ekosistem React dan codebase saat ini

#### Hook
Gunakan `camelCase` dengan prefix `use`

Contoh:
- `useAsyncJobPolling.ts`
- `useDnpSessionAreaFlow.ts`
- `useDnpMatchSelection.ts`

Alasan:
- langsung terbaca sebagai hook React
- menghindari hook tersembunyi di nama umum

#### Utility/API Client
Gunakan `camelCase.ts`

Contoh:
- `api.ts`
- `sso.ts`
- `selfAssessment.ts`
- `selfAssessmentDnpMatching.ts`

Alasan:
- file jenis ini biasanya bukan komponen
- konsisten dengan helper domain yang ada sekarang

#### Type File
Gunakan nama domain, bukan nama generik

Contoh:
- `selfAssessment.ts`
- `kks.ts`

Jangan:
- `types.ts`
- `commonTypes.ts`

Alasan:
- file generic cepat jadi tempat pembuangan semua type

### Nama Komponen

Gunakan `PascalCase`.

Contoh baik:
- `SelfAssessmentReviewDetailPanel`
- `SelfAssessmentResultSubmissionPanel`
- `RequireAdmin`

Contoh yang tidak disarankan:
- `panelReview`
- `resultsubmission`

Aturan:
- nama harus menjelaskan domain + fungsi
- untuk panel besar, akhiri dengan `Panel`
- untuk wrapper/layout, gunakan `Layout`, `Shell`, atau `Workspace`

### Nama Variabel

Gunakan `camelCase`.

Contoh:
- `selectedSubmission`
- `dnpImportMessage`
- `activeAssessmentInput`

Aturan:
- boolean harus terbaca seperti pertanyaan
  Contoh: `isLoading`, `hasCompareSnapshot`, `canOverrideAssessmentLock`
- array harus berbentuk jamak
  Contoh: `dnpAreas`, `submissionRows`, `selectedMatches`

### Nama Fungsi

Gunakan pola berikut:

- `handle...` untuk event UI
  Contoh: `handleImportDnpCompare`, `handleAssessmentSave`

- `fetch...` untuk ambil data
  Contoh: `fetchSelfAssessmentAnswers`

- `submit...` untuk kirim form/review
  Contoh: `submitAdminSelfAssessmentReviews`

- `load...` untuk orchestration load page/domain
  Contoh: `loadDetail`, `loadSubmissions`

- `map...FromApi` untuk mapping DTO
  Contoh: `mapFacilityFromApi`

Alasan:
- developer baru bisa menebak fungsi dari nama saja

### CSS Class

Saat ini project memakai utility class Tailwind-style inline.

Aturan:
- urutkan class berdasarkan fungsi visual yang konsisten
- utamakan group seperti: layout -> spacing -> border -> background -> text -> state

Contoh:
```tsx
className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-600"
```

Jangan:
- menulis class random tanpa urutan
- copy-paste class panjang tanpa alasan

Jika class mulai terlalu panjang:
- pindahkan ke komponen baru
- atau buat helper render pattern yang lebih jelas

---

## 3. Arsitektur Komponen

Frontend K2S dibagi menjadi 4 level utama:

### A. Pages
Lokasi: `src/pages`

Fungsi:
- route target utama
- mengatur orchestration data
- menyusun panel/komponen domain
- menghubungkan hook + API + UI

Contoh:
- `src/pages/admin/SelfAssessmentReviews.tsx`
- `src/pages/DashboardEntry.tsx`

Page tidak seharusnya menjadi tempat semua detail UI ditulis inline.

Alasan:
- page harus mudah dibaca sebagai “alur halaman”
- UI detail lebih mudah dirawat kalau dipisah

### B. Layout
Lokasi: `src/components/layout` dan `AppShell.tsx`

Fungsi:
- struktur global aplikasi
- shell, sidebar, wrapper, top navigation
- tempat komponen lintas halaman hidup

Contoh:
- `AppShell.tsx`

### C. Shared / UI Components
Lokasi:
- `src/components/ui`
- `src/components/shared`
- sebagian `src/components/table`, `filters`, `states`

Fungsi:
- primitive UI
- form field wrapper
- reusable block lintas domain

Contoh:
- `Button`
- `Input`
- `Checkbox`
- `FormField`
- `FilterBar`

### D. Feature Modules
Lokasi:
- `src/components/self-assessment`
- `src/components/detail`
- `src/components/dashboard`
- `src/components/admin`

Fungsi:
- komponen yang spesifik ke satu domain
- biasanya lebih kaya state/callback dibanding primitive UI

Contoh:
- `SelfAssessmentDnpLoginPanel`
- `CaseDetailDrawer`
- `CaseTable`

### Diagram Sederhana

```text
App.tsx
  -> Route
    -> Page
      -> Hook / API Client
      -> Layout / Workspace
      -> Feature Components
        -> Shared Components
          -> UI Primitives
```

### Cara berpikir saat menambah komponen baru

Tanya 4 hal ini:

1. Apakah ini route target?
   Jika ya, masuk `pages/`

2. Apakah ini dipakai lintas domain?
   Jika ya, pertimbangkan `components/ui` atau `components/shared`

3. Apakah ini hanya milik satu domain?
   Jika ya, masuk ke folder feature domain

4. Apakah file page mulai penuh oleh JSX?
   Jika ya, pecah ke panel feature component

---

## 4. State Management

Frontend K2S saat ini memakai state hybrid. Developer baru harus paham pembagiannya.

### A. Local State
Gunakan `useState`, `useMemo`, `useEffect` untuk:
- form input
- modal open/close
- selected row
- pagination
- tab aktif
- UI state sementara

Contoh:
- `activeAnswerId`
- `isDnpLoginCollapsed`
- `dnpQuestionPage`

Gunakan local state jika:
- state hanya dipakai satu page/komponen
- tidak perlu dibagi lintas aplikasi

Alasan:
- paling sederhana
- paling murah dirawat

### B. Global State
Saat ini global state utama masih ada di:
- `src/contexts/AppDataContext.tsx`

Gunakan global state jika:
- data dipakai banyak halaman
- data perlu hidup lama sepanjang sesi
- banyak komponen butuh source yang sama

Contoh domain yang sekarang masih global:
- instansi
- fasilitas
- organisasi
- personil
- sertifikat
- agenda
- audit
- monitoring

Catatan penting:
- `AppDataContext` masih legacy-heavy
- jangan tambahkan domain baru ke sana tanpa alasan kuat
- kalau memungkinkan, lebih baik pecah per bounded context

### C. Server State
Ini adalah data yang source of truth-nya ada di backend.

Saat ini pola yang dipakai:
- page memanggil fungsi di `src/lib/*`
- hasil disimpan ke state page atau context

Contoh:
- `fetchAdminSelfAssessmentSubmissionDetail`
- `fetchSelfAssessmentSessions`
- `fetchAdminSelfAssessmentSubmissions`

Gunakan server state jika:
- data berasal dari API
- perlu refresh/polling
- ada status loading/error/success

### Rekomendasi Tool

Untuk kondisi codebase saat ini:

- local state:
  pakai React built-in (`useState`, `useMemo`, `useEffect`)

- reusable orchestration:
  pakai custom hook di `src/hooks`

- global state:
  lanjutkan Context untuk yang sudah ada, tapi jangan memperbesar `AppDataContext`

- server state:
  saat ini masih ditangani manual melalui `lib/*` + state page

Jika nanti dilakukan modernisasi bertahap, kandidat tool yang masuk akal adalah:
- TanStack Query untuk server state

Alasan:
- cocok untuk data API, caching, invalidation, dan polling
- lebih aman dibanding menambah `useEffect` fetch manual di banyak tempat

Namun:
- jangan langsung migrasi besar-besaran tanpa rencana
- fokus dulu pada domain yang paling sering berubah

---

## 5. Panduan untuk Developer Baru

## Cara Mulai

Kalau baru pertama kali masuk ke frontend K2S, buka file berikut dalam urutan ini:

### 1. `src/App.tsx`
Tujuan:
- lihat semua route utama (50+ route)
- pahami domain mana saja yang ada
- tahu page mana yang menjadi entrypoint tiap menu
- perhatikan 3 guard: `RequireAuth`, `RequireAdmin`, `RequireExternalDnp`

### 2. `src/lib/api.ts`
Tujuan:
- pahami bagaimana request ke backend dilakukan
- **token disimpan di localStorage** (bukan sessionStorage), key: `k2s.authToken`
- ada **auto-refresh token** saat `401`: request diulang otomatis dengan token baru
- ada `consumeTokenFromQuery()` untuk mode token via URL query param (`VITE_ALLOW_QUERY_TOKEN=true`)

### 3. `src/lib/sso.ts`
Tujuan:
- pahami flow PKCE OIDC: state + verifier → code_challenge → authorize → callback → token
- **SSO lock multi-tab** dengan TTL 15 detik (disimpan di localStorage)
- refresh token flow via `refreshAccessToken()`
- logout via `buildSsoLogoutUrl()`

### 4. `src/lib/permissions.ts`
Tujuan:
- pahami `PermissionMap` yang mengontrol akses seluruh fitur
- helper seperti `canAccessCertificationNoteLocation()` untuk access control berbasis lokasi (8 cabang AirNav)
- **permissions mengontrol akses lintas-service**: Logbook, K3, Keamanan

### 5. `src/contexts/AppDataContext.tsx`
Tujuan:
- lihat data operasional umum yang masih dikelola global
- pahami domain mana yang masih bergantung pada provider lama

### 6. `src/lib/selfAssessment.ts`
Tujuan:
- pahami domain self assessment yang menjadi area terbesar saat ini

### 7. `src/pages/admin/SelfAssessmentReviews.tsx`
Tujuan:
- lihat contoh page orchestration yang paling lengkap
- lihat bagaimana hook, panel, dan API client digabung

### 8. `src/pages/DashboardEntry.tsx`
Tujuan:
- entry point dashboard yang memilih antara dua versi: `Dashboard.tsx` dan `Dashboard2.tsx`
- pahami kondisi yang menentukan versi dashboard mana yang tampil

### 9. `refactor_process.md`
Tujuan:
- lihat area refactor yang sedang berlangsung
- hindari mengulang refactor yang sudah selesai

### Alur Data Frontend Secara Sederhana

```text
Route/App.tsx
  -> Page
    -> Hook / API client (src/lib/*)
      -> Backend API
    -> Data kembali ke Page / Context
      -> Diteruskan ke Feature Component
        -> Dirender ke UI
```

Contoh nyata:

```text
SelfAssessmentReviews.tsx
  -> fetchAdminSelfAssessmentSubmissionDetail()
  -> simpan hasil ke state page
  -> kirim data ke SelfAssessmentDnpSnapshotPanel
  -> panel render daftar pertanyaan DNP
```

### 3 Hal yang Wajib Dipahami Sebelum Mulai Coding

#### 1. Bedakan page, hook, dan panel
Kalau logic reusable masuk ke page besar, file akan cepat rusak lagi.

Pahami:
- page = orchestration
- hook = reusable flow/state
- panel/component = presentasi

#### 2. Jangan anggap semua data harus masuk context
Banyak bug maintainability lama muncul karena semua hal dipusatkan di `AppDataContext`.

Gunakan:
- local state untuk state lokal
- hook untuk reusable flow
- context hanya jika benar-benar lintas halaman

#### 3. Self assessment adalah domain paling sensitif
Kalau menyentuh:
- `SelfAssessmentReviews.tsx`
- `selfAssessment.ts`
- hook DNP

maka baca dulu:
- `K2S-Web-Project/AGENTS.md`
- `refactor_process.md`

Alasan:
- area ini sudah punya refactor bertahap
- salah menaruh logic baru akan mengembalikan file jadi god-component

---

## 6. Do's & Don'ts

### Do's

- Pisahkan panel UI besar ke komponen sendiri.
- Taruh logic reusable di `src/hooks`.
- Taruh kontrak request API di `src/lib`.
- Gunakan nama file yang menjelaskan domain dan fungsi.
- Baca page entrypoint dulu sebelum mengubah feature.
- Ikuti pola yang sudah ada di domain tersebut.
- Tambahkan alasan singkat saat membuat boundary baru.

### Don'ts

- Jangan tambahkan logic baru langsung ke file besar kalau bisa diekstrak.
- Jangan masukkan semua state baru ke `AppDataContext`.
- Jangan buat file util generic seperti `helpers.ts` atau `utils.ts` tanpa domain jelas.
- Jangan menaruh request API langsung di komponen presentational.
- Jangan buat komponen “serba bisa” yang dipakai semua domain tetapi sebenarnya domain-specific.
- Jangan copy-paste panel besar antar page; ekstrak jadi komponen atau hook bersama.
- Jangan ubah flow auth/SSO tanpa memahami `api.ts` dan `sso.ts`.

---

## Ringkasan Arsitektur

Kalau harus diringkas ke satu kalimat:

> Frontend K2S sebaiknya dibangun dengan pola `Page sebagai orchestration`, `Hook sebagai reusable logic`, `Feature component sebagai panel domain`, dan `lib sebagai kontrak API`.

Itu pola yang paling aman untuk menjaga codebase ini tetap bisa dipelihara oleh tim yang terus bertambah.
