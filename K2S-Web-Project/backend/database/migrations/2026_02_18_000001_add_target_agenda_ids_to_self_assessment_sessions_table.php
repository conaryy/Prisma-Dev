<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('self_assessment_sessions', function (Blueprint $table) {
            $table->json('target_agenda_ids')->nullable()->after('target_session_area_ids');
        });
    }

    public function down(): void
    {
        Schema::table('self_assessment_sessions', function (Blueprint $table) {
            $table->dropColumn('target_agenda_ids');
        });
    }
};

