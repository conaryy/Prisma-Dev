const { PrismaClient, PersonnelStatus } = require('@prisma/client');

const prisma = new PrismaClient();

async function ensureSupervisionStorage(prismaClient) {
  await prismaClient.$executeRawUnsafe(`
    DO $$
    BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'SupervisionCategory') THEN
        CREATE TYPE "SupervisionCategory" AS ENUM ('AUDIT', 'INSPEKSI', 'TEST');
      END IF;
    END
    $$;
  `);

  await prismaClient.$executeRawUnsafe(`
    DO $$
    BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'SupervisionStatus') THEN
        CREATE TYPE "SupervisionStatus" AS ENUM ('BELUM_TERLAKSANA', 'TERLAKSANA', 'PERLU_TINDAK_LANJUT');
      END IF;
    END
    $$;
  `);

  await prismaClient.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "SupervisionActivity" (
      "id" TEXT PRIMARY KEY,
      "slug" TEXT NOT NULL UNIQUE,
      "title" TEXT NOT NULL,
      "category" "SupervisionCategory" NOT NULL,
      "location" TEXT,
      "inspectorNames" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
      "scheduleLabel" TEXT NOT NULL,
      "scheduleYear" INTEGER NOT NULL,
      "scheduleMonth" INTEGER,
      "scheduleWeek" INTEGER,
      "sourceDocument" TEXT,
      "status" "SupervisionStatus" NOT NULL DEFAULT 'BELUM_TERLAKSANA',
      "completedAt" TIMESTAMPTZ,
      "completionNote" TEXT,
      "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

  await prismaClient.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "SupervisionEvidence" (
      "id" TEXT PRIMARY KEY,
      "activityId" TEXT NOT NULL REFERENCES "SupervisionActivity"("id") ON DELETE CASCADE,
      "fileName" TEXT NOT NULL,
      "storageName" TEXT NOT NULL UNIQUE,
      "mimeType" TEXT,
      "sizeBytes" INTEGER NOT NULL,
      "uploadedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

  await prismaClient.$executeRawUnsafe(`
    CREATE INDEX IF NOT EXISTS "SupervisionActivity_schedule_idx"
    ON "SupervisionActivity" ("category", "scheduleYear", "scheduleMonth", "scheduleWeek");
  `);

  await prismaClient.$executeRawUnsafe(`
    CREATE INDEX IF NOT EXISTS "SupervisionEvidence_activity_uploaded_idx"
    ON "SupervisionEvidence" ("activityId", "uploadedAt");
  `);
}

const personnelSeed = [
  {
    slug: 'ibni-ramadan-sumenep-2024',
    name: 'Ibni Ramadan',
    location: 'Cabang Pembantu Sumenep',
    documentPeriod: 'Tahun 2024',
    sourceDocument: 'DATA REKAM JEJAK PERSONEL SECURITY SUMENEP TAHUN 2025.docx',
    licenseNumber: '-',
    birthPlaceDate: 'Sumenep, 16-02-1995',
    address: 'Ds. Tanjung Alang RT 01 / RW 01 Padike',
    maritalStatus: 'Belum Kawin',
    religion: 'Islam',
    status: 'Valid',
    educationHistory: [
      'SD - SDN 3 Talango (2007)',
      'SMP - Madrasah Tsanawiyah (2010)',
      'SMA - SMK Negeri 1 Kalianget (2013)',
    ],
    workHistory: [
      'Ground Staff - Lion Group (2014 - 2018)',
      'Karyawan - PT Angkasa Pura Support (2022 - 2023)',
    ],
    trainingHistory: ['Diklat Basic AVSEC (2022)'],
    refreshmentExisting: '8 Januari 2025',
    refreshmentPlan: '-',
    recurrentExisting: '-',
    recurrentPlan: '8 Januari 2027',
  },
  {
    slug: 'achmad-yordan-sumenep-2024',
    name: 'Achmad Yordan',
    location: 'Cabang Pembantu Sumenep',
    documentPeriod: 'Tahun 2024',
    sourceDocument: 'DATA REKAM JEJAK PERSONEL SECURITY SUMENEP TAHUN 2025.docx',
    licenseNumber: '-',
    birthPlaceDate: 'Sumenep, 15-01-1975',
    address: 'Jl. Gapura RT.02 RW.02 Parsanga',
    maritalStatus: 'Kawin',
    religion: 'Islam',
    status: 'Perpanjangan',
    educationHistory: [
      'SD - Bangselok 3 Sumenep (1988)',
      'SMP - SMP Negeri 3 Sumenep (1991)',
      'SMA - PGRI Sumenep (1994)',
    ],
    workHistory: [],
    trainingHistory: ['Diklat Basic AVSEC (2018)'],
    refreshmentExisting: '-',
    refreshmentPlan: '-',
    recurrentExisting: '-',
    recurrentPlan: '-',
  },
  {
    slug: 'erik-agustian-sumenep-2024',
    name: 'Erik Agustian',
    location: 'Cabang Pembantu Sumenep',
    documentPeriod: 'Tahun 2024',
    sourceDocument: 'DATA REKAM JEJAK PERSONEL SECURITY SUMENEP TAHUN 2025.docx',
    licenseNumber: '-',
    birthPlaceDate: 'Sumenep, 26-08-2000',
    address: 'Ds. Tanjung Alang RT 03 / RW 01 Padike Talango',
    maritalStatus: 'Belum Kawin',
    religion: 'Islam',
    status: 'Pelatihan',
    educationHistory: [
      'SD - SDN 3 Talango (2012)',
      'SMP - SMP I Kalianget (2015)',
      'SMA - SMA Sayyid Yusuf Talango (2018)',
      'S1 - Universitas Wiraraja Sumenep (2022)',
    ],
    workHistory: [],
    trainingHistory: ['Diklat Basic AVSEC (2023)'],
    refreshmentExisting: '-',
    refreshmentPlan: '-',
    recurrentExisting: '-',
    recurrentPlan: '-',
  },
  {
    slug: 'moh-imam-sumenep-2024',
    name: 'Moh. Imam',
    location: 'Cabang Pembantu Sumenep',
    documentPeriod: 'Tahun 2024',
    sourceDocument: 'DATA REKAM JEJAK PERSONEL SECURITY SUMENEP TAHUN 2025.docx',
    licenseNumber: '-',
    birthPlaceDate: 'Sumenep, 22-03-1991',
    address: 'Ds. Tanjung Alang RT 03 / RW 01 Padike Kec. Talango',
    maritalStatus: 'Kawin',
    religion: 'Islam',
    status: 'Perpanjangan',
    educationHistory: [
      'SD - SDN Gadding I (2004)',
      'SMP - Paket B Darul Falah (2011)',
      'SMA - MA Al-Bajigur (2015)',
    ],
    workHistory: [],
    trainingHistory: ['Diklat Basic AVSEC (2019)'],
    refreshmentExisting: '-',
    refreshmentPlan: '-',
    recurrentExisting: '-',
    recurrentPlan: '-',
  },
  {
    slug: 'achmad-azharul-azis-banyuwangi-2024',
    name: 'Achmad Azharul Azis',
    location: 'Cabang Pembantu Banyuwangi',
    documentPeriod: 'Tahun 2024',
    sourceDocument: 'DATA REKAM JEJAK PERSONEL SECURITY BANYUWANGI TAHUN 2024.docx',
    licenseNumber: '007818/AS-J/DKP/IX/2020',
    birthPlaceDate: 'Sidoarjo, 06-04-1997',
    address: 'Kedung Kampil RT.02/RW.03 Porong, Sidoarjo',
    maritalStatus: 'Menikah',
    religion: 'Islam',
    status: 'Perpanjangan',
    educationHistory: [
      "SD - MI Ma'arif Kedung Solo (2009)",
      'SMP - SMP Avisena Kedung Cangkring (2012)',
      'SMA - SMA Avisena Kedung Cangkring (2015)',
    ],
    workHistory: [
      'Security - Salam Pacifik Lines',
      'Security - Malindo Feedmill',
    ],
    trainingHistory: [
      'Diklat Garda Pratama (2019)',
      'Basic AVSEC (2017)',
      'Junior AVSEC (2019)',
    ],
    refreshmentExisting: '15 Des 2023',
    refreshmentPlan: '15 Des 2024',
    recurrentExisting: '12 Okt 2022',
    recurrentPlan: '12 Okt 2024',
  },
  {
    slug: 'achmad-azharul-azis-surabaya-2025',
    name: 'Achmad Azharul Azis',
    location: 'Cabang Surabaya',
    documentPeriod: 'Maret 2025',
    sourceDocument: 'DATA REKAM JEJAK PERSONEL SECURITY SURABAYA JUNI TAHUN 2025.docx',
    licenseNumber: '007818/AS-J/DKP/IX/2020',
    birthPlaceDate: 'Sidoarjo, 06-04-1997',
    address: 'Kedung Kampil RT.02/RW.03 Porong, Sidoarjo',
    maritalStatus: 'Menikah',
    religion: 'Islam',
    status: 'Valid',
    educationHistory: [
      "SD - MI Ma'arif Kedung Solo (2009)",
      'SMP - SMP Avisena Kedung Cangkring (2012)',
      'SMA - SMA Avisena Kedung Cangkring (2015)',
    ],
    workHistory: [
      'Security - Salam Pacifik Lines',
      'Security - Malindo Feedmill',
    ],
    trainingHistory: [
      'Diklat Garda Pratama (2019)',
      'Basic AVSEC (2017)',
      'Junior AVSEC (2019)',
    ],
    refreshmentExisting: '15 Des 2023',
    refreshmentPlan: '2026',
    recurrentExisting: '11 Maret 2025',
    recurrentPlan: '11 Maret 2027',
  },
  {
    slug: 'achmad-quluki-surabaya-2025',
    name: 'Achmad Quluki',
    location: 'Cabang Surabaya',
    documentPeriod: 'Maret 2025',
    sourceDocument: 'DATA REKAM JEJAK PERSONEL SECURITY SURABAYA JUNI TAHUN 2025.docx',
    licenseNumber: '022532/AS-B/DKP/IX/2022',
    birthPlaceDate: 'Sidoarjo, 02-09-1995',
    address: 'Wadung Asih RT.02/RW.01 Buduran, Sidoarjo',
    maritalStatus: 'Menikah',
    religion: 'Islam',
    status: 'Valid',
    educationHistory: [
      'SD - SDN Wadungasih 1 Buduran (2008)',
      'SMP - SMP PGRI 1 Buduran (2011)',
      'SMA - SMK Antartika 1 Sidoarjo (2014)',
    ],
    workHistory: ['Pramuniaga - Toko Emas Gadjah Sidoarjo (2017)'],
    trainingHistory: [
      'Diklat Garda Pratama (2017)',
      'Basic AVSEC (2018)',
    ],
    refreshmentExisting: '15 Des 2023',
    refreshmentPlan: '2025',
    recurrentExisting: '24 Okt 2024',
    recurrentPlan: '24 Okt 2026',
  },
  {
    slug: 'adi-pramono-surabaya-2025',
    name: 'Adi Pramono',
    location: 'Cabang Surabaya',
    documentPeriod: 'Maret 2025',
    sourceDocument: 'DATA REKAM JEJAK PERSONEL SECURITY SURABAYA JUNI TAHUN 2025.docx',
    licenseNumber: '018893/AS-J/DKP/X/2021',
    birthPlaceDate: 'Sidoarjo, 22-12-1996',
    address: 'Desa Grogol RT 01 RW 03 Tulangan, Sidoarjo',
    maritalStatus: 'Belum Menikah',
    religion: 'Islam',
    status: 'Perpanjangan',
    educationHistory: [
      'SD - SDN 2 Sugihwaras (2004)',
      'SMP - SMP Darussalam Baureno (2007)',
      'SMA - SMK Negeri 1 Baureno (2010)',
    ],
    workHistory: [
      'Marketing - Bank Permata (2010)',
      'Operator - Persada Makmur (2011)',
      'Operator - Multi Colour (2013)',
      'Security - Bank BRI Syariah (2017)',
    ],
    trainingHistory: [
      'Diklat Garda Pratama (2020)',
      'Basic AVSEC (2017)',
      'Junior AVSEC (2018)',
    ],
    refreshmentExisting: '15 Des 2023',
    refreshmentPlan: '15 Des 2024',
    recurrentExisting: '9 Nov 2023',
    recurrentPlan: '9 Nov 2025',
  },
  {
    slug: 'andri-yunus-surabaya-2025',
    name: 'Andri Yunus',
    location: 'Cabang Surabaya',
    documentPeriod: 'Maret 2025',
    sourceDocument: 'DATA REKAM JEJAK PERSONEL SECURITY SURABAYA JUNI TAHUN 2025.docx',
    licenseNumber: '022534/AS-B/DKP/IX/2022',
    birthPlaceDate: 'Sidoarjo, 10-03-1990',
    address: 'Ds. Balonggarut RT.01/RW.01 Krembung, Sidoarjo',
    maritalStatus: 'Menikah',
    religion: 'Islam',
    status: 'Valid',
    educationHistory: [
      'SD - SDN Balonggarut (2003)',
      'SMP - SMP Islam Krembung (2006)',
      'SMA - SMK Persatuan 2 Tulangan (2009)',
    ],
    workHistory: ['PT Tata Makmur Bersama'],
    trainingHistory: [
      'Diklat Garda Pratama (2017)',
      'Basic AVSEC (2018)',
    ],
    refreshmentExisting: '15 Des 2023',
    refreshmentPlan: '2025',
    recurrentExisting: '24 Okt 2024',
    recurrentPlan: '24 Okt 2026',
  },
  {
    slug: 'arestu-frananda-surabaya-2025',
    name: 'Arestu Frananda',
    location: 'Cabang Surabaya',
    documentPeriod: 'Maret 2025',
    sourceDocument: 'DATA REKAM JEJAK PERSONEL SECURITY SURABAYA JUNI TAHUN 2025.docx',
    licenseNumber: '022533/AS-B/DKP/IX/2022',
    birthPlaceDate: 'Sidoarjo, 25-05-1998',
    address: 'Ds. Keret RT.05/RW.02 Krembung, Sidoarjo',
    maritalStatus: 'Belum Menikah',
    religion: 'Islam',
    status: 'Valid',
    educationHistory: [
      'SD - SDN Keret Krembung (2010)',
      'SMP - SMP Negeri 2 Krembung (2013)',
      'SMA - SMK Trisakti Tulangan (2016)',
    ],
    workHistory: [
      'Welding - PT BMP',
      'Operator - PT UPS',
    ],
    trainingHistory: [
      'Diklat Garda Pratama (2017)',
      'Basic AVSEC (2018)',
    ],
    refreshmentExisting: '15 Des 2023',
    refreshmentPlan: '2025',
    recurrentExisting: '24 Okt 2024',
    recurrentPlan: '24 Okt 2026',
  },
  {
    slug: 'arif-purwanto-surabaya-2025',
    name: 'Arif Purwanto',
    location: 'Cabang Surabaya',
    documentPeriod: 'Maret 2025',
    sourceDocument: 'DATA REKAM JEJAK PERSONEL SECURITY SURABAYA JUNI TAHUN 2025.docx',
    licenseNumber: '012174/AS-B/DKP/II/2021',
    birthPlaceDate: 'Mojokerto, 19-03-1996',
    address: 'Ds. Wadung, Kedung Anyar, Wringinanom, Gresik',
    maritalStatus: 'Menikah',
    religion: 'Islam',
    status: 'Perpanjangan',
    educationHistory: [
      'SD - SDN Kedunganyar 1 (2008)',
      'SMP - SMP 2 Wringinanom (2011)',
      'SMA - SMK Negeri 1 Jetis Mojokerto (2014)',
    ],
    workHistory: ['PT Keramik Diamond Industries (2016)'],
    trainingHistory: [
      'Diklat Garda Pratama (2019)',
      'Basic AVSEC (2017)',
    ],
    refreshmentExisting: '15 Des 2023',
    refreshmentPlan: '15 Des 2024',
    recurrentExisting: '30 Jan 2023',
    recurrentPlan: '30 Jan 2025',
  },
  {
    slug: 'dwi-nanda-saputra-surabaya-2025',
    name: 'Dwi Nanda Saputra',
    location: 'Cabang Surabaya',
    documentPeriod: 'Maret 2025',
    sourceDocument: 'DATA REKAM JEJAK PERSONEL SECURITY SURABAYA JUNI TAHUN 2025.docx',
    licenseNumber: '007819/AS-J/DKP/IX/2020',
    birthPlaceDate: 'Bangkalan, 25-10-1996',
    address: 'Jl. Kapten Safitri VI RT.04/RW.02 Pejagan, Bangkalan',
    maritalStatus: 'Belum Menikah',
    religion: 'Islam',
    status: 'Valid',
    educationHistory: [
      'SD - SD Kraton 2 Bangkalan (2009)',
      'SMP - SMP Negeri 5 Bangkalan (2012)',
      'SMA - SMK Negeri 2 Bangkalan (2015)',
    ],
    workHistory: ['Maintenance - Neko Computer (2017)'],
    trainingHistory: [
      'Diklat Garda Pratama (2019)',
      'Basic AVSEC (2017)',
      'Junior AVSEC (tahun tidak tercantum jelas)',
    ],
    refreshmentExisting: '15 Des 2023',
    refreshmentPlan: '2025',
    recurrentExisting: '16 Des 2024',
    recurrentPlan: '16 Des 2026',
  },
  {
    slug: 'eko-iswanto-surabaya-2025',
    name: 'Eko Iswanto',
    location: 'Cabang Surabaya',
    documentPeriod: 'Maret 2025',
    sourceDocument: 'DATA REKAM JEJAK PERSONEL SECURITY SURABAYA JUNI TAHUN 2025.docx',
    licenseNumber: '007820/AS-J/DKP/IX/2020',
    birthPlaceDate: 'Jombang, 18-06-1984',
    address: 'Lebak Timur Asri 01 No. 4 Tambak Sari, Surabaya',
    maritalStatus: 'Menikah',
    religion: 'Islam',
    status: 'Valid',
    educationHistory: [
      'SD - SD Kenongo Porong (1996)',
      'SMP - SMP Bhayangkari 7 Porong (1999)',
      'SMA - SMA Walisongo Gempol (2002)',
    ],
    workHistory: [
      'PO - Hotel Bandara (2004)',
      'Security - PT Boxer Guard (2015)',
    ],
    trainingHistory: [
      'Diklat Garda Pratama (2017)',
      'Basic AVSEC (2018)',
      'Junior AVSEC (2019)',
    ],
    refreshmentExisting: '15 Des 2023',
    refreshmentPlan: '2026',
    recurrentExisting: '11 Maret 2025',
    recurrentPlan: '11 Maret 2027',
  },
  {
    slug: 'indera-waskito-kuncaring-cahyo-surabaya-2025',
    name: 'Indera Waskito Kuncaring Cahyo',
    location: 'Cabang Surabaya',
    documentPeriod: 'Maret 2025',
    sourceDocument: 'DATA REKAM JEJAK PERSONEL SECURITY SURABAYA JUNI TAHUN 2025.docx',
    licenseNumber: '012175/AS-B/DKP/II/2021',
    birthPlaceDate: 'Trenggalek, 10-09-1990',
    address: 'Desa Senden RT 07 RW 04 Kec. Kampak, Trenggalek',
    maritalStatus: 'Menikah',
    religion: 'Islam',
    status: 'Valid',
    educationHistory: [
      'SD - SDN 1 Sinden (2003)',
      'SMP - SMP Islam Kampak (2006)',
      'SMA - SMA 1 Kampak (2009)',
      'S1 - Universitas Terbuka Malang (2015)',
    ],
    workHistory: ['Security - JTrust Bank (2019)'],
    trainingHistory: [
      'Diklat Garda Pratama (2019)',
      'Basic AVSEC (2017)',
    ],
    refreshmentExisting: '15 Des 2023',
    refreshmentPlan: '15 Des 2024',
    recurrentExisting: '25 Maret 2025',
    recurrentPlan: '25 Maret 2027',
  },
  {
    slug: 'muhammad-fiky-dharmawan-surabaya-2025',
    name: 'Muhammad Fiky Dharmawan',
    location: 'Cabang Surabaya',
    documentPeriod: 'Maret 2025',
    sourceDocument: 'DATA REKAM JEJAK PERSONEL SECURITY SURABAYA JUNI TAHUN 2025.docx',
    licenseNumber: '012173/AS-B/DKP/II/2021',
    birthPlaceDate: 'Sidoarjo, 25-05-1998',
    address: 'Ds. Kebonsari RT.04/RW.02 Candi, Sidoarjo',
    maritalStatus: 'Belum Menikah',
    religion: 'Islam',
    status: 'Valid',
    educationHistory: [
      'SD - SDN Kebonsari (2010)',
      'SMP - SMP Negeri 2 Tanggulangin (2013)',
      'SMA - SMK Penerbangan Sidoarjo (2016)',
    ],
    workHistory: [],
    trainingHistory: [
      'Diklat Garda Pratama (2018)',
      'Basic AVSEC (2017)',
    ],
    refreshmentExisting: '15 Des 2023',
    refreshmentPlan: '15 Des 2024',
    recurrentExisting: '25 Maret 2025',
    recurrentPlan: '25 Maret 2027',
  },
  {
    slug: 'sapta-adhi-sasmita-surabaya-2025',
    name: 'Sapta Adhi Sasmita',
    location: 'Cabang Surabaya',
    documentPeriod: 'Maret 2025',
    sourceDocument: 'DATA REKAM JEJAK PERSONEL SECURITY SURABAYA JUNI TAHUN 2025.docx',
    licenseNumber: '012172/AS-B/DKP/II/2021',
    birthPlaceDate: 'Timika, 05-07-1990',
    address: 'Asrama Pusdik Brimob Watukosek Gempol, Pasuruan',
    maritalStatus: 'Menikah',
    religion: 'Islam',
    status: 'Valid',
    educationHistory: [
      'SD - SD Bhayangkari 10 Porong (2002)',
      'SMP - SMP Negeri 1 Porong (2005)',
      'SMA - SMK Avisena Jabon (2008)',
      'S1 - Sunan Giri Malang (2010)',
    ],
    workHistory: ['Suplier - PT Freeport (2010)'],
    trainingHistory: [
      'Diklat Garda Pratama (2018)',
      'Basic AVSEC (2016)',
    ],
    refreshmentExisting: '15 Des 2023',
    refreshmentPlan: '15 Des 2024',
    recurrentExisting: '25 Maret 2025',
    recurrentPlan: '25 Maret 2027',
  },
  {
    slug: 'david-putra-wibowo-surabaya-2025',
    name: 'David Putra Wibowo',
    location: 'Cabang Surabaya',
    documentPeriod: 'Maret 2025',
    sourceDocument: 'DATA REKAM JEJAK PERSONEL SECURITY SURABAYA JUNI TAHUN 2025.docx',
    licenseNumber: '011464/AS-J/DKP/I/2021',
    birthPlaceDate: 'Sidoarjo, 28-03-1992',
    address: 'Perumahan Griya Nirwana Blok D1 No.01 Sumorame, Candi, Sidoarjo',
    maritalStatus: 'Menikah',
    religion: 'Islam',
    status: 'Valid',
    educationHistory: [
      'SD - SDN 1 Jatirejo Porong (1998)',
      'SMP - SMPN 1 Porong (2004)',
      'SMA - SMA Kemala Bhayangkari 3 Porong (2007)',
    ],
    workHistory: ['Junior AVSEC - Angkasapura Support (2013 - 2022)'],
    trainingHistory: [
      'Diklat Garda Pratama (2013)',
      'Basic AVSEC (2016)',
      'Junior AVSEC (tahun tidak tercantum jelas)',
    ],
    refreshmentExisting: '15 Des 2024',
    refreshmentPlan: '-',
    recurrentExisting: '11 Maret 2025',
    recurrentPlan: '11 Maret 2027',
  },
  {
    slug: 'm-khalaf-zur-zahran-surabaya-2025',
    name: 'M. Khalaf Zur Zahran',
    location: 'Cabang Surabaya',
    documentPeriod: 'Maret 2025',
    sourceDocument: 'DATA REKAM JEJAK PERSONEL SECURITY SURABAYA JUNI TAHUN 2025.docx',
    licenseNumber: '025320/AS-B/DKP/VIII/2023',
    birthPlaceDate: 'Sleman, 30-04-2005',
    address: 'Medari Gede RT01 RW10, Caturharjo, Sleman, Yogyakarta',
    maritalStatus: 'Belum Menikah',
    religion: 'Islam',
    status: 'Pelatihan',
    educationHistory: [
      'SD - SD IT Bakti Insani (2010)',
      'SMP - MTs Negeri 4 Sleman (2017)',
      'SMA - SMA Negeri 1 Tempel (2020)',
    ],
    workHistory: [],
    trainingHistory: [
      'Diklat Garda Pratama (2023)',
      'Basic AVSEC (tahun tidak tercantum jelas)',
    ],
    refreshmentExisting: '15 Des 2024',
    refreshmentPlan: '-',
    recurrentExisting: '25 Agustus 2023',
    recurrentPlan: '25 Agustus 2025',
  },
];

const inspectorNames = ['Arif Hartono', 'Adhe Rafika Yulianti'];
const supervisionSourceDocument = 'Jadwal Kegiatan Pengawasan Keamanan - Tahun 2026.pdf';
const testScheduleMonths = [
  { month: 2, label: 'Minggu II Februari 2026' },
  { month: 4, label: 'Minggu II April 2026' },
  { month: 6, label: 'Minggu II Juni 2026' },
  { month: 8, label: 'Minggu II Agustus 2026' },
  { month: 10, label: 'Minggu II Oktober 2026' },
  { month: 12, label: 'Minggu II Desember 2026' },
];

const supervisionActivitySeed = [
  {
    id: 'audit-internal-keamanan-2026',
    slug: 'audit-internal-keamanan-2026',
    title: 'Audit Internal Keamanan',
    category: 'AUDIT',
    location: 'Perum LPPNPI Cabang Surabaya',
    inspectorNames,
    scheduleLabel: '1 kali dalam 2 tahun (internal)',
    scheduleYear: 2026,
    scheduleMonth: null,
    scheduleWeek: null,
    sourceDocument: supervisionSourceDocument,
  },
  ...[
    'Cabang Surabaya',
    'KCP Banyuwangi',
    'KCP Malang',
    'KCP Sumenep',
    'Penyedia Personel AVSEC',
  ].map((location) => ({
    id: `inspeksi-${location.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-2026`,
    slug: `inspeksi-${location.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-2026`,
    title: 'Inspeksi Keamanan',
    category: 'INSPEKSI',
    location,
    inspectorNames,
    scheduleLabel: '1 kali dalam tahun 2026 (lokasi pelaksanaan menyesuaikan program pengawasan)',
    scheduleYear: 2026,
    scheduleMonth: null,
    scheduleWeek: null,
    sourceDocument: supervisionSourceDocument,
  })),
  ...['Cabang Surabaya', 'KCP Banyuwangi', 'KCP Sumenep'].flatMap((location) =>
    testScheduleMonths.map(({ month, label }) => ({
      id: `test-${location.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${month}-2026`,
      slug: `test-${location.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${month}-2026`,
      title: 'Pengujian (Test) Keamanan',
      category: 'TEST',
      location,
      inspectorNames,
      scheduleLabel: label,
      scheduleYear: 2026,
      scheduleMonth: month,
      scheduleWeek: 2,
      sourceDocument: supervisionSourceDocument,
    }))
  ),
];

function toPersonnelStatus(status) {
  if (status === 'Perpanjangan') return PersonnelStatus.PERPANJANGAN;
  if (status === 'Pelatihan') return PersonnelStatus.PELATIHAN;
  return PersonnelStatus.VALID;
}

function nestedCreate(values) {
  return values.map((value) => ({ value }));
}

async function main() {
  for (const item of personnelSeed) {
    const {
      educationHistory,
      workHistory,
      trainingHistory,
      status,
      ...personnel
    } = item;

    await prisma.personnel.upsert({
      where: { slug: personnel.slug },
      update: {
        ...personnel,
        status: toPersonnelStatus(status),
        educationHistories: {
          deleteMany: {},
          create: nestedCreate(educationHistory),
        },
        workHistories: {
          deleteMany: {},
          create: nestedCreate(workHistory),
        },
        trainingHistories: {
          deleteMany: {},
          create: nestedCreate(trainingHistory),
        },
      },
      create: {
        ...personnel,
        status: toPersonnelStatus(status),
        educationHistories: {
          create: nestedCreate(educationHistory),
        },
        workHistories: {
          create: nestedCreate(workHistory),
        },
        trainingHistories: {
          create: nestedCreate(trainingHistory),
        },
      },
    });
  }

  await ensureSupervisionStorage(prisma);

  for (const item of supervisionActivitySeed) {
    await prisma.$executeRaw`
      INSERT INTO "SupervisionActivity" (
        "id",
        "slug",
        "title",
        "category",
        "location",
        "inspectorNames",
        "scheduleLabel",
        "scheduleYear",
        "scheduleMonth",
        "scheduleWeek",
        "sourceDocument"
      )
      VALUES (
        ${item.id},
        ${item.slug},
        ${item.title},
        ${item.category}::"SupervisionCategory",
        ${item.location},
        ${item.inspectorNames},
        ${item.scheduleLabel},
        ${item.scheduleYear},
        ${item.scheduleMonth},
        ${item.scheduleWeek},
        ${item.sourceDocument}
      )
      ON CONFLICT ("slug") DO UPDATE SET
        "title" = EXCLUDED."title",
        "category" = EXCLUDED."category",
        "location" = EXCLUDED."location",
        "inspectorNames" = EXCLUDED."inspectorNames",
        "scheduleLabel" = EXCLUDED."scheduleLabel",
        "scheduleYear" = EXCLUDED."scheduleYear",
        "scheduleMonth" = EXCLUDED."scheduleMonth",
        "scheduleWeek" = EXCLUDED."scheduleWeek",
        "sourceDocument" = EXCLUDED."sourceDocument"
    `;
  }

  console.log(
    `Seed keamanan selesai: ${personnelSeed.length} personel, ${supervisionActivitySeed.length} agenda pengawasan.`
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
