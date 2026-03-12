<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('self_assessment_sessions', function (Blueprint $table) {
            $table->string('team_leader')->nullable()->after('title');
            $table->json('team_members')->nullable()->after('team_leader');
            $table->json('team_audity')->nullable()->after('team_members');
        });
    }

    public function down(): void
    {
        Schema::table('self_assessment_sessions', function (Blueprint $table) {
            $table->dropColumn(['team_leader', 'team_members', 'team_audity']);
        });
    }
};
