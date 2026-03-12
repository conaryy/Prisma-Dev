<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('external_dnp_sessions', function (Blueprint $table) {
            $table->string('instansi_name')->nullable()->after('title');
            $table->index('instansi_name');
        });
    }

    public function down(): void
    {
        Schema::table('external_dnp_sessions', function (Blueprint $table) {
            $table->dropIndex(['instansi_name']);
            $table->dropColumn('instansi_name');
        });
    }
};
