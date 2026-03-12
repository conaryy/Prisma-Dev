# Dashboard K3/HSE - Sistem Monitoring Keselamatan dan Kesehatan Kerja

Dashboard modern dan interaktif untuk monitoring dan analisis data K3 (Keselamatan dan Kesehatan Kerja) / HSE (Health, Safety, Environment).

## Fitur Utama

### 📊 Dashboard Overview
- **KPI Cards** dengan trend indicator
  - Total Finding
  - Open Cases
  - Overdue Cases
  - Total Occurrence
  - Go Around
- **Visualisasi Data Interaktif**
  - Distribusi Status (Pie Chart)
  - Top Kategori (Bar Chart)
  - Top Lokasi (Bar Chart)
  - Trend Kasus (Line Chart dengan toggle Harian/Mingguan/Bulanan)

### 🔍 Filter & Pencarian
- **Global Filter Bar** dengan opsi:
  - Rentang Tanggal
  - Branch/Unit
  - Lokasi
  - Kategori
  - Status
  - PIC (Person in Charge)
  - Pencarian teks bebas
- **Active Filter Display** dengan badge yang dapat dihapus

### 📈 Drill-Down Interaktif
- Klik pada KPI card untuk filter otomatis
- Klik pada chart (status, kategori, lokasi) untuk drill-down
- Sistem drill-down terintegrasi dengan filter global
- Tabel kasus otomatis ter-filter

### 📋 Tabel Data
- **Sorting** multi-kolom (Case Number, Tanggal, Status, Severity)
- **Pagination** dengan opsi jumlah per halaman (10, 20, 50, 100)
- **Klik Row** untuk membuka detail case
- **Badge** visual untuk Status dan Severity

### 📑 Detail Case (Drawer)
Drawer dengan 5 tabs:
1. **Ringkasan** - Informasi umum, PIC, dan timeline
2. **Deskripsi** - Deskripsi lengkap dan temuan
3. **Tindak Lanjut** - Tindakan korektif dan preventif
4. **Lampiran** - Daftar file lampiran dengan download
5. **Audit Trail** - Riwayat perubahan dengan timeline visual

### 🔔 Notification Center
- Panel notifikasi dengan badge counter
- Filter berdasarkan tipe:
  - New (Kasus baru)
  - Due Soon (Deadline mendekat)
  - Overdue (Melewati deadline)
  - High Severity (Severity tinggi)
- Klik notifikasi untuk langsung ke detail case

### 📤 Upload Excel
- Modal upload dengan drag & drop
- Progress indicator
- Ringkasan import (total, berhasil, error)
- Daftar error row dengan detail

### 📄 Halaman Khusus

#### Occurrence
- Analisis kecelakaan dan near miss
- KPI khusus: Total Occurrence, Incident, Near Miss, Critical Cases
- Distribusi severity dengan bar progress

#### Go Around Analysis
- Monitoring inspeksi dan patrol
- KPI: Total Go Around, Selesai, Bulan Ini, Completion Rate
- Top 5 lokasi inspeksi
- Status inspeksi

#### Compliance & Findings
- Pemantauan temuan dan kepatuhan
- KPI: Total Findings, Open, Overdue, Compliance Rate
- Temuan per kategori
- Status per branch dengan visual breakdown

## Teknologi

- **React 18** dengan TypeScript
- **React Router** untuk navigasi
- **Tailwind CSS** untuk styling
- **shadcn/ui** untuk komponen UI
- **Recharts** untuk visualisasi data
- **Lucide React** untuk ikon
- **date-fns** untuk manipulasi tanggal

## Responsive Design

Dashboard fully responsive dengan breakpoint:
- Mobile (< 768px): Menu sidebar collapse, layout 1 kolom
- Tablet (768px - 1024px): Layout 2 kolom
- Desktop (> 1024px): Sidebar tetap, layout multi-kolom

## Mock Data

Data mock tersedia di `src/data/mockData.ts` dengan:
- 8 sample cases dengan berbagai status, severity, dan kategori
- 4 notifikasi
- KPI data
- Chart data
- Audit trail lengkap

## State Management

Context API (`DashboardContext`) untuk:
- Manage filter state
- Drill-down functionality
- Selected case
- Case detail drawer open/close
- Last updated timestamp

## Cara Menjalankan

```bash
# Install dependencies
npm install

# Development
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview
```

## Struktur File

```
src/
├── components/
│   ├── admin/          # Upload modal
│   ├── charts/         # Chart components
│   ├── dashboard/      # KPI cards
│   ├── detail/         # Case detail drawer
│   ├── filters/        # Filter bar
│   ├── layout/         # Sidebar, topbar, main layout
│   ├── notifications/  # Notification center
│   ├── states/         # Loading, error, empty states
│   ├── table/          # Data table
│   └── ui/             # shadcn/ui components
├── contexts/           # React contexts
├── data/               # Mock data
├── pages/              # Page components
└── types/              # TypeScript types
```

## Fitur Interaktivitas

1. **Click on KPI Card** → Auto-filter berdasarkan status
2. **Click on Chart** → Drill-down ke data spesifik
3. **Click on Table Row** → Buka detail case drawer
4. **Click on Notification** → Buka detail case yang relevan
5. **Click on Filter Badge** → Hapus filter individual
6. **Reset Button** → Hapus semua filter

## Loading & Error States

- **LoadingState** - Spinner dengan pesan
- **LoadingOverlay** - Full screen loading
- **LoadingSkeleton** - Skeleton loader untuk list
- **ErrorState** - Error display dengan retry button
- **EmptyState** - Empty state dengan ilustrasi
- **NoResultsState** - Untuk hasil filter kosong

## Catatan Pengembangan

Dashboard ini siap untuk:
- Integrasi dengan Supabase database
- Implementasi real-time updates
- Export data ke Excel/PDF
- Advanced analytics dan reporting
- Multi-user authentication
- Role-based access control

## Customization

Untuk mengubah warna tema, edit `tailwind.config.js` dan `src/index.css` untuk CSS variables.

Untuk menambah/mengubah menu, edit `src/components/layout/Sidebar.tsx`.

---

**Dibuat dengan:** React + TypeScript + Tailwind CSS + shadcn/ui
