-- K2S Web Project - Seed Data (based on src/data/seed.ts)

USE k2s_p1;

-- Instansi
INSERT INTO instansi (
  id,
  facility_group,
  kobu,
  bandara,
  cabang_airnav,
  name,
  alias,
  address,
  contact_name,
  contact_email,
  contact_phone,
  fax,
  postal_code,
  longitude,
  latitude,
  service_area,
  operating_hours,
  traffic_type,
  runway_capacity,
  runway_condition,
  location
) VALUES (
  'instansi-1',
  'Pelayanan Navigasi Penerbangan',
  'KANTOR OTORITAS BANDAR UDARA WILAYAH III',
  'JUANDA',
  'PERUM LPPNPI CABANG SURABAYA',
  'Perum LPPNPI Cabang Surabaya',
  'Surabaya',
  'Perum LPPNPI Kantor Cabang Surabaya, Gedung AOB (Tower) Bandar Udara Juanda Surabaya 61253A',
  'Sekretariat Pengawasan',
  'safetyairnavsurabaya@gmail.com',
  '031 2896515',
  '031 86888456',
  '61253',
  '7.3581446372362285',
  '112.79651453661337',
  '172 - 172',
  '08:00 - 16:00',
  '-',
  '-',
  '-',
  ''
);

-- Facilities
INSERT INTO facilities (
  id, instansi_id, facility_group, name, merk, type, frequency, ident, condition_status
) VALUES
('facility-1','instansi-1','COMMUNICATION','VHF-A/G ADC PRIMARY','PARK AIR','T6T DAN T6R','118.3','-','Normal'),
('facility-2','instansi-1','COMMUNICATION','VHF-A/G ADC SECONDARY','OTE','DT100 DAN DRR100','118.10','-','Normal'),
('facility-3','instansi-1','COMMUNICATION','VHF - GROUND CONTROL PRIMARY','PARK AIR','T6T DAN T6R','118.90','-','Normal'),
('facility-4','instansi-1','COMMUNICATION','VHF - GROUND CONTROL SECONDARY','OTE','DT100 DAN DRR100','119.15','-','Normal'),
('facility-5','instansi-1','COMMUNICATION','VHF A/G CDU SECONDARY','PARK AIR','T6','119.15 MHZ','-','Normal'),
('facility-6','instansi-1','COMMUNICATION','VHF - APP DIRECTOR PRIMARY','PARK AIR','T6T DAN T6R','123.20','-','Normal'),
('facility-7','instansi-1','COMMUNICATION','VHF - APP DIRECTOR SECONDARY','OTE','DT100 DAN DRR100','124.50','-','Normal'),
('facility-8','instansi-1','COMMUNICATION','VHF - APP WEST PRIMARY','PARK AIR','T6T DAN T6R','125.10','-','Normal'),
('facility-9','instansi-1','COMMUNICATION','VHF - APP WEST SECONDARY','PARK AIR','T6T DAN T6R','123.55','-','Normal'),
('facility-10','instansi-1','COMMUNICATION','VHF - APP EAST PRIMARY','PARK AIR','T6T DAN T6R','124','-','Normal'),
('facility-11','instansi-1','COMMUNICATION','VHF - APP EAST SECONDARY','OTE','DT100 DAN DRR100','122.85','-','Normal'),
('facility-12','instansi-1','COMMUNICATION','VHF PORTABLE','FUNKE','FSG-90','118.9 MHZ','-','Single'),
('facility-13','instansi-1','COMMUNICATION','VHF - ER ACC MKS PRIMARY','SELEX','DT100 DAN DRR100','123.90','-','Normal'),
('facility-14','instansi-1','COMMUNICATION','ATIS','TERMA','-','128.20','-','Unserviceable');

-- Organizations
INSERT INTO organizations (
  id, instansi_id, unit_name, position_name, level, status
) VALUES (
  'org-1',
  'instansi-1',
  '-',
  'General Manager Perum LPPNPI Cabang Surabaya',
  '1',
  'Aktif'
);

-- Certificates
INSERT INTO certificates (
  id, instansi_id, name, type, number, valid_until, status
) VALUES
('cert-1','instansi-1','Sertifikat Penyelenggara Pelayanan Lalu Lintas Penerbangan','Sertifikat 172','172/LLP/2025','2027-12-31','Berlaku'),
('cert-2','instansi-1','Sertifikat Penyelenggara Pelayanan Lalu Lintas Penerbangan','Sertifikat 172','172/LLP/2026','2028-12-31','Berlaku');

-- Agenda
INSERT INTO agenda (
  id, date, activity_type, location, status
) VALUES
('agenda-1', DATE_ADD(CURDATE(), INTERVAL 7 DAY), 'Audit Internal', 'Gedung Administrasi', 'Direncanakan'),
('agenda-2', DATE_ADD(CURDATE(), INTERVAL -3 DAY), 'Monitoring CNS', 'Unit CNS', 'Selesai');

-- Audits
INSERT INTO audits (
  id, number, date, location, status, focus
) VALUES
('audit-1','AUD-2026-001', DATE_ADD(CURDATE(), INTERVAL -14 DAY), 'CNS Surabaya', 'Selesai', 'Kepatuhan SOP Pelaporan'),
('audit-2','AUD-2026-002', DATE_ADD(CURDATE(), INTERVAL 10 DAY), 'ATC Tower', 'Direncanakan', 'Audit Prosedur Shift');

-- Inspections
INSERT INTO inspections (
  id, number, date, location, status, unit
) VALUES
('inspeksi-1','INS-2026-014', DATE_ADD(CURDATE(), INTERVAL -5 DAY), 'CNS', 'Berjalan', 'CNS'),
('inspeksi-2','INS-2026-015', DATE_ADD(CURDATE(), INTERVAL 12 DAY), 'AOC', 'Direncanakan', 'AOC');

-- Monitoring
INSERT INTO monitoring (
  id, date, location, status, note
) VALUES
('monitor-1', DATE_ADD(CURDATE(), INTERVAL -2 DAY), 'Terminal Radar', 'Aktif', 'Pemantauan parameter komunikasi.'),
('monitor-2', DATE_ADD(CURDATE(), INTERVAL -9 DAY), 'Runway Ops', 'Selesai', 'Monitoring prosedur runway crossing.');

-- Findings
INSERT INTO findings (
  id, source_type, source_id, kategori, deskripsi, severity, status, due_date
) VALUES
('finding-1','Audit','audit-1','Prosedur','SOP pelaporan gangguan belum tersosialisasi penuh ke teknisi shift malam.','High','Open', DATE_ADD(CURDATE(), INTERVAL 8 DAY)),
('finding-2','Monitoring','monitor-1','Dokumentasi','Log komunikasi harian belum ditandatangani supervisor.','Med','In Progress', DATE_ADD(CURDATE(), INTERVAL 3 DAY)),
('finding-3','Inspeksi','inspeksi-1','Peralatan','Kalibrasi perangkat navigasi belum diperbarui di papan kontrol.','Low','Closed', DATE_ADD(CURDATE(), INTERVAL -1 DAY));

-- Follow Ups (CAP)
INSERT INTO follow_ups (
  id, finding_id, aksi_perbaikan, pic, target_date, status
) VALUES
('cap-1','finding-1','Sosialisasi SOP dan refresh training untuk teknisi shift malam.','Tim CNS', DATE_ADD(CURDATE(), INTERVAL 6 DAY), 'In Progress'),
('cap-2','finding-2','Update log dan verifikasi tanda tangan supervisor.','Supervisor Monitoring', DATE_ADD(CURDATE(), INTERVAL 2 DAY), 'Open'),
('cap-3','finding-3','Kalibrasi ulang dan update papan kontrol.','Teknisi Navigasi', DATE_ADD(CURDATE(), INTERVAL -2 DAY), 'Done');

-- Follow Up History
INSERT INTO follow_up_history (
  id, follow_up_id, note
) VALUES
('cap-hist-1','cap-1', CONCAT('Dibuat pada ', NOW())),
('cap-hist-2','cap-2', CONCAT('Dibuat pada ', NOW())),
('cap-hist-3','cap-3', CONCAT('Dibuat pada ', NOW())),
('cap-hist-4','cap-3', 'Selesai dan diverifikasi');
