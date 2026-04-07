<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('whatsapp_user_notification_recipients', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->string('phone_number', 20);
            $table->json('user_ids')->nullable();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('whatsapp_user_notification_recipients');
    }
};
