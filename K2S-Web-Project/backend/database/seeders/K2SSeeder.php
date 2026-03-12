<?php

namespace Database\Seeders;

use App\Models\Agenda;
use App\Models\Audit;
use App\Models\Certificate;
use App\Models\Facility;
use App\Models\Finding;
use App\Models\FollowUp;
use App\Models\FollowUpHistory;
use App\Models\Inspection;
use App\Models\Instansi;
use App\Models\Monitoring;
use App\Models\Organization;
use App\Models\User;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Hash;

class K2SSeeder extends Seeder
{
    public function run(): void
    {
        $now = now();

        $admin = User::create([
            'name' => 'Admin',
            'email' => 'admin',
            'password' => Hash::make('admin'),
            'role' => 'Admin',
            'status' => 'Active',
            'can_access_external_dnp' => true,
        ]);

        $instansiId = 'instansi-1';

        Instansi::create([
            'id' => $instansiId,
            'user_id' => $admin->id,
            'facility_group' => 'Pelayanan Navigasi Penerbangan',
            'kobu' => 'KANTOR OTORITAS BANDAR UDARA WILAYAH III',
            'bandara' => 'JUANDA',
            'cabang_airnav' => 'PERUM LPPNPI CABANG SURABAYA',
            'name' => 'Perum LPPNPI Cabang Surabaya',
            'alias' => 'Surabaya',
            'address' => 'Perum LPPNPI Kantor Cabang Surabaya, Gedung AOB (Tower) Bandar Udara Juanda Surabaya 61253A',
            'contact_name' => 'Sekretariat Pengawasan',
            'contact_email' => 'safetyairnavsurabaya@gmail.com',
            'contact_phone' => '031 2896515',
            'fax' => '031 86888456',
            'postal_code' => '61253',
            'longitude' => '7.3581446372362285',
            'latitude' => '112.79651453661337',
            'service_area' => '172 - 172',
            'operating_hours' => '08:00 - 16:00',
            'traffic_type' => '-',
            'runway_capacity' => '-',
            'runway_condition' => '-',
            'location' => '',
        ]);

        $facilities = [
            ['facility-1', 'COMMUNICATION', 'VHF-A/G ADC PRIMARY', 'PARK AIR', 'T6T DAN T6R', '118.3', '-', 'Normal'],
            ['facility-2', 'COMMUNICATION', 'VHF-A/G ADC SECONDARY', 'OTE', 'DT100 DAN DRR100', '118.10', '-', 'Normal'],
            ['facility-3', 'COMMUNICATION', 'VHF - GROUND CONTROL PRIMARY', 'PARK AIR', 'T6T DAN T6R', '118.90', '-', 'Normal'],
            ['facility-4', 'COMMUNICATION', 'VHF - GROUND CONTROL SECONDARY', 'OTE', 'DT100 DAN DRR100', '119.15', '-', 'Normal'],
            ['facility-5', 'COMMUNICATION', 'VHF A/G CDU SECONDARY', 'PARK AIR', 'T6', '119.15 MHZ', '-', 'Normal'],
            ['facility-6', 'COMMUNICATION', 'VHF - APP DIRECTOR PRIMARY', 'PARK AIR', 'T6T DAN T6R', '123.20', '-', 'Normal'],
            ['facility-7', 'COMMUNICATION', 'VHF - APP DIRECTOR SECONDARY', 'OTE', 'DT100 DAN DRR100', '124.50', '-', 'Normal'],
            ['facility-8', 'COMMUNICATION', 'VHF - APP WEST PRIMARY', 'PARK AIR', 'T6T DAN T6R', '125.10', '-', 'Normal'],
            ['facility-9', 'COMMUNICATION', 'VHF - APP WEST SECONDARY', 'PARK AIR', 'T6T DAN T6R', '123.55', '-', 'Normal'],
            ['facility-10', 'COMMUNICATION', 'VHF - APP EAST PRIMARY', 'PARK AIR', 'T6T DAN T6R', '124', '-', 'Normal'],
            ['facility-11', 'COMMUNICATION', 'VHF - APP EAST SECONDARY', 'OTE', 'DT100 DAN DRR100', '122.85', '-', 'Normal'],
            ['facility-12', 'COMMUNICATION', 'VHF PORTABLE', 'FUNKE', 'FSG-90', '118.9 MHZ', '-', 'Single'],
            ['facility-13', 'COMMUNICATION', 'VHF - ER ACC MKS PRIMARY', 'SELEX', 'DT100 DAN DRR100', '123.90', '-', 'Normal'],
            ['facility-14', 'COMMUNICATION', 'ATIS', 'TERMA', '-', '128.20', '-', 'Unserviceable'],
        ];
        foreach ($facilities as $facility) {
            Facility::create([
                'id' => $facility[0],
                'instansi_id' => $instansiId,
                'facility_group' => $facility[1],
                'name' => $facility[2],
                'merk' => $facility[3],
                'type' => $facility[4],
                'frequency' => $facility[5],
                'ident' => $facility[6],
                'condition_status' => $facility[7],
            ]);
        }

        Organization::create([
            'id' => 'org-1',
            'instansi_id' => $instansiId,
            'unit_name' => '-',
            'position_name' => 'General Manager Perum LPPNPI Cabang Surabaya',
            'level' => '1',
            'status' => 'Aktif',
        ]);

        Certificate::create([
            'id' => 'cert-1',
            'instansi_id' => $instansiId,
            'name' => 'Sertifikat Penyelenggara Pelayanan Lalu Lintas Penerbangan',
            'type' => 'Sertifikat 172',
            'number' => '172/LLP/2025',
            'valid_until' => $now->copy()->addYears(2)->setDate(2027, 12, 31)->toDateString(),
            'status' => 'Berlaku',
        ]);
        Certificate::create([
            'id' => 'cert-2',
            'instansi_id' => $instansiId,
            'name' => 'Sertifikat Penyelenggara Pelayanan Lalu Lintas Penerbangan',
            'type' => 'Sertifikat 172',
            'number' => '172/LLP/2026',
            'valid_until' => $now->copy()->addYears(3)->setDate(2028, 12, 31)->toDateString(),
            'status' => 'Berlaku',
        ]);

        Agenda::create([
            'id' => 'agenda-1',
            'date' => $now->copy()->addDays(7)->toDateString(),
            'activity_type' => 'Audit Internal',
            'location' => 'Gedung Administrasi',
            'status' => 'Direncanakan',
        ]);
        Agenda::create([
            'id' => 'agenda-2',
            'date' => $now->copy()->addDays(-3)->toDateString(),
            'activity_type' => 'Monitoring CNS',
            'location' => 'Unit CNS',
            'status' => 'Selesai',
        ]);

        Audit::create([
            'id' => 'audit-1',
            'number' => 'AUD-2026-001',
            'date' => $now->copy()->addDays(-14)->toDateString(),
            'location' => 'CNS Surabaya',
            'status' => 'Selesai',
            'focus' => 'Kepatuhan SOP Pelaporan',
        ]);
        Audit::create([
            'id' => 'audit-2',
            'number' => 'AUD-2026-002',
            'date' => $now->copy()->addDays(10)->toDateString(),
            'location' => 'ATC Tower',
            'status' => 'Direncanakan',
            'focus' => 'Audit Prosedur Shift',
        ]);

        Inspection::create([
            'id' => 'inspeksi-1',
            'number' => 'INS-2026-014',
            'date' => $now->copy()->addDays(-5)->toDateString(),
            'location' => 'CNS',
            'status' => 'Berjalan',
            'unit' => 'CNS',
        ]);
        Inspection::create([
            'id' => 'inspeksi-2',
            'number' => 'INS-2026-015',
            'date' => $now->copy()->addDays(12)->toDateString(),
            'location' => 'AOC',
            'status' => 'Direncanakan',
            'unit' => 'AOC',
        ]);

        Monitoring::create([
            'id' => 'monitor-1',
            'date' => $now->copy()->addDays(-2)->toDateString(),
            'location' => 'Terminal Radar',
            'status' => 'Aktif',
            'note' => 'Pemantauan parameter komunikasi.',
        ]);
        Monitoring::create([
            'id' => 'monitor-2',
            'date' => $now->copy()->addDays(-9)->toDateString(),
            'location' => 'Runway Ops',
            'status' => 'Selesai',
            'note' => 'Monitoring prosedur runway crossing.',
        ]);

        Finding::create([
            'id' => 'finding-1',
            'source_type' => 'Audit',
            'source_id' => 'audit-1',
            'kategori' => 'Prosedur',
            'deskripsi' => 'SOP pelaporan gangguan belum tersosialisasi penuh ke teknisi shift malam.',
            'severity' => 'High',
            'status' => 'Open',
            'due_date' => $now->copy()->addDays(8)->toDateString(),
        ]);
        Finding::create([
            'id' => 'finding-2',
            'source_type' => 'Monitoring',
            'source_id' => 'monitor-1',
            'kategori' => 'Dokumentasi',
            'deskripsi' => 'Log komunikasi harian belum ditandatangani supervisor.',
            'severity' => 'Med',
            'status' => 'In Progress',
            'due_date' => $now->copy()->addDays(3)->toDateString(),
        ]);
        Finding::create([
            'id' => 'finding-3',
            'source_type' => 'Inspeksi',
            'source_id' => 'inspeksi-1',
            'kategori' => 'Peralatan',
            'deskripsi' => 'Kalibrasi perangkat navigasi belum diperbarui di papan kontrol.',
            'severity' => 'Low',
            'status' => 'Closed',
            'due_date' => $now->copy()->addDays(-1)->toDateString(),
        ]);

        FollowUp::create([
            'id' => 'cap-1',
            'finding_id' => 'finding-1',
            'aksi_perbaikan' => 'Sosialisasi SOP dan refresh training untuk teknisi shift malam.',
            'pic' => 'Tim CNS',
            'target_date' => $now->copy()->addDays(6)->toDateString(),
            'status' => 'In Progress',
        ]);
        FollowUp::create([
            'id' => 'cap-2',
            'finding_id' => 'finding-2',
            'aksi_perbaikan' => 'Update log dan verifikasi tanda tangan supervisor.',
            'pic' => 'Supervisor Monitoring',
            'target_date' => $now->copy()->addDays(2)->toDateString(),
            'status' => 'Open',
        ]);
        FollowUp::create([
            'id' => 'cap-3',
            'finding_id' => 'finding-3',
            'aksi_perbaikan' => 'Kalibrasi ulang dan update papan kontrol.',
            'pic' => 'Teknisi Navigasi',
            'target_date' => $now->copy()->addDays(-2)->toDateString(),
            'status' => 'Done',
        ]);

        $createdStamp = 'Dibuat pada ' . $now->toDateTimeString();
        FollowUpHistory::create([
            'id' => 'cap-hist-1',
            'follow_up_id' => 'cap-1',
            'note' => $createdStamp,
            'created_at' => $now,
        ]);
        FollowUpHistory::create([
            'id' => 'cap-hist-2',
            'follow_up_id' => 'cap-2',
            'note' => $createdStamp,
            'created_at' => $now,
        ]);
        FollowUpHistory::create([
            'id' => 'cap-hist-3',
            'follow_up_id' => 'cap-3',
            'note' => $createdStamp,
            'created_at' => $now,
        ]);
        FollowUpHistory::create([
            'id' => 'cap-hist-4',
            'follow_up_id' => 'cap-3',
            'note' => 'Selesai dan diverifikasi',
            'created_at' => $now,
        ]);
    }
}
