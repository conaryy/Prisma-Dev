# Refactor Process

## 2026-04-17

### Step 1: Shared DNP matching utilities
- Tujuan:
  Mengurangi duplikasi logika DNP question matching antara `src/pages/admin/SelfAssessmentReviews.tsx` dan `src/pages/admin/SelfAssessmentImportDnpDetail.tsx`.
- Perubahan:
  Menambahkan util bersama di `src/lib/selfAssessmentDnpMatching.ts` untuk normalisasi teks pertanyaan, pembentukan bigram, similarity scoring, dan class tone badge.
- Dampak:
  Dua halaman admin sekarang memakai util yang sama untuk perilaku matching sehingga tuning threshold/scoring berikutnya cukup diubah di satu tempat.
- Verifikasi:
  Menjalankan `npm run typecheck` di root `K2S-Web-Project` dan hasilnya lolos.

### Step 2: Shared async job polling hook
- Tujuan:
  Mengurangi duplikasi logika polling job async untuk import DNP dan inject DNP di dua halaman admin.
- Perubahan:
  Menambahkan hook `src/hooks/useAsyncJobPolling.ts` lalu memakainya di `SelfAssessmentReviews.tsx` dan `SelfAssessmentImportDnpDetail.tsx`.
- Dampak:
  Manajemen `setTimeout` dan cleanup polling tidak lagi ditulis manual berulang di tiap halaman.
- Verifikasi:
  Menjalankan `npm run typecheck` di root `K2S-Web-Project` dan hasilnya lolos.

### Step 3: Shared DNP session and area flow
- Tujuan:
  Mengurangi duplikasi state dan handler untuk sesi captcha DNP serta pemuatan area DNP.
- Perubahan:
  Menambahkan hook `src/hooks/useDnpSessionAreaFlow.ts` untuk mengelola session id, captcha image, kredensial, tahun, daftar area, dan aksi `initializeSession/loadAreas`.
- Dampak:
  Halaman admin tidak perlu lagi menulis state form DNP dan request area secara manual satu per satu.
- Verifikasi:
  Menjalankan `npm run typecheck` di root `K2S-Web-Project` dan hasilnya lolos.

### Step 4: Shared DNP pairing selection hook
- Tujuan:
  Mengurangi kepadatan logic pairing pertanyaan lokal vs DNP di `SelfAssessmentReviews.tsx` agar perubahan aturan pairing lebih mudah dirawat oleh tim.
- Perubahan:
  Menambahkan hook `src/hooks/useDnpMatchSelection.ts` untuk mengelola restore mapping dari snapshot, kandidat match per pertanyaan, auto pairing berdasarkan threshold, toggle collapse, pilih/ganti match, batalkan satu match, dan kosongkan semua match.
- Dampak:
  `SelfAssessmentReviews.tsx` tidak lagi menyimpan detail state machine pairing secara langsung; halaman sekarang lebih fokus ke orchestration API dan rendering panel. Ini menurunkan coupling antara UI admin dan aturan pairing DNP.
- Verifikasi:
  Menjalankan `npm run typecheck` di root `K2S-Web-Project` dan hasilnya lolos.

### Step 5: Split DNP UI panels into presentational components
- Tujuan:
  Mengurangi ukuran dan beban baca `SelfAssessmentReviews.tsx` dengan memisahkan panel UI DNP yang paling padat dari halaman utama.
- Perubahan:
  Menambahkan `src/components/self-assessment/SelfAssessmentDnpSnapshotPanel.tsx` untuk panel snapshot/list pertanyaan DNP dan `src/components/self-assessment/SelfAssessmentDnpAnswerPairingPanel.tsx` untuk panel pairing per jawaban aktif.
- Dampak:
  Halaman admin sekarang lebih mudah dibaca karena concern presentasi DNP dipisahkan dari orchestration data. Tim lain bisa mengubah tampilan snapshot atau pairing tanpa harus menyentuh keseluruhan page flow.
- Verifikasi:
  Menjalankan `npm run typecheck` di root `K2S-Web-Project` dan hasilnya lolos.

### Step 6: Split result submission and review detail panels
- Tujuan:
  Mengurangi hotspot edit di `SelfAssessmentReviews.tsx` untuk area review biasa dan pengiriman hasil audit.
- Perubahan:
  Menambahkan `src/components/self-assessment/SelfAssessmentResultSubmissionPanel.tsx` untuk panel pengiriman dokumen hasil audit dan `src/components/self-assessment/SelfAssessmentReviewDetailPanel.tsx` untuk panel review detail non-DNP.
- Dampak:
  `SelfAssessmentReviews.tsx` makin fokus sebagai orchestration page. Perubahan form review atau form final result sekarang bisa dikerjakan di komponen yang lebih kecil dan lebih mudah dibaca oleh tim maintenance.
- Verifikasi:
  Menjalankan `npm run typecheck` di root `K2S-Web-Project` dan hasilnya lolos.

### Step 7: Split assessment editor panel
- Tujuan:
  Mengurangi ukuran blok assessment mode yang masih mencampur upload evidence, status lock, form assessment, dan pairing DNP di halaman utama.
- Perubahan:
  Menambahkan `src/components/self-assessment/SelfAssessmentAssessmentEditorPanel.tsx` lalu memindahkan UI upload evidence admin, daftar evidence existing, indikator lock/override, dan form assessment lokal ke komponen tersebut.
- Dampak:
  `SelfAssessmentReviews.tsx` sekarang lebih konsisten sebagai orchestration layer, sementara perubahan UI/validasi assessment mode bisa difokuskan ke satu komponen yang lebih kecil.
- Verifikasi:
  Menjalankan `npm run typecheck` di root `K2S-Web-Project` dan hasilnya lolos.

### Step 8: Split DNP login and import panel
- Tujuan:
  Menuntaskan sisa blok UI besar di kolom kiri `SelfAssessmentReviews.tsx` untuk alur login DNP, captcha, pilih area, dan trigger import compare.
- Perubahan:
  Menambahkan `src/components/self-assessment/SelfAssessmentDnpLoginPanel.tsx` lalu memindahkan panel login/import DNP dari halaman utama ke komponen presentational terpisah.
- Dampak:
  `SelfAssessmentReviews.tsx` sekarang hampir sepenuhnya berperan sebagai orchestration page. Perubahan pada UI login DNP tidak lagi bercampur dengan list pertanyaan, review, assessment, dan result submission.
- Verifikasi:
  Menjalankan `npm run typecheck` di root `K2S-Web-Project` dan hasilnya lolos.
