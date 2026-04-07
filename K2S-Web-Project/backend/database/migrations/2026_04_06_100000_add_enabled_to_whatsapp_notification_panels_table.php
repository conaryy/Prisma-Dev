<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('whatsapp_notification_panels', function (Blueprint $table) {
            $table->boolean('enabled')->default(true)->after('panel');
        });
    }

    public function down(): void
    {
        Schema::table('whatsapp_notification_panels', function (Blueprint $table) {
            $table->dropColumn('enabled');
        });
    }
};
