<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('certification_note_tables', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->uuid('instansi_id')->nullable();
            $table->string('location_slug', 50);
            $table->string('title')->default('Tabel 1');
            $table->unsignedInteger('sort_order')->default(1);
            $table->timestamps();

            $table->foreign('instansi_id')
                ->references('id')
                ->on('instansi')
                ->nullOnDelete();

            $table->index(['instansi_id', 'location_slug', 'sort_order'], 'cert_note_tables_instansi_location_sort_idx');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('certification_note_tables');
    }
};
