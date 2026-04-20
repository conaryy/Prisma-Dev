<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('facility_groups', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->uuid('instansi_id')->nullable();
            $table->string('name');
            $table->unsignedInteger('sort_order')->default(0);
            $table->timestamps();

            $table->foreign('instansi_id')->references('id')->on('instansi')->cascadeOnDelete();
            $table->unique(['instansi_id', 'name']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('facility_groups');
    }
};
