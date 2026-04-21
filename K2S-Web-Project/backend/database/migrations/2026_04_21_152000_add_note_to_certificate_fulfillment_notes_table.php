<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('certificate_fulfillment_notes', function (Blueprint $table) {
            $table->text('note')->nullable()->after('certificate_id');
        });
    }

    public function down(): void
    {
        Schema::table('certificate_fulfillment_notes', function (Blueprint $table) {
            $table->dropColumn('note');
        });
    }
};
