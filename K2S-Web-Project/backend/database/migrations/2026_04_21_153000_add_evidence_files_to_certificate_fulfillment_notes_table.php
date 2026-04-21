<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('certificate_fulfillment_notes', function (Blueprint $table) {
            $table->json('evidence_files')->nullable()->after('evidence_file_url');
        });

        DB::table('certificate_fulfillment_notes')
            ->whereNotNull('evidence_file_url')
            ->orderBy('id')
            ->get(['id', 'evidence_file_name', 'evidence_file_url'])
            ->each(function ($row): void {
                DB::table('certificate_fulfillment_notes')
                    ->where('id', $row->id)
                    ->update([
                        'evidence_files' => json_encode([
                            [
                                'name' => $row->evidence_file_name,
                                'url' => $row->evidence_file_url,
                            ],
                        ]),
                    ]);
            });
    }

    public function down(): void
    {
        Schema::table('certificate_fulfillment_notes', function (Blueprint $table) {
            $table->dropColumn('evidence_files');
        });
    }
};
