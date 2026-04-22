<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('certification_note_rows', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->uuid('certification_note_table_id');
            $table->unsignedInteger('sort_order')->default(1);
            $table->text('note')->nullable();
            $table->text('action_office')->nullable();
            $table->unsignedTinyInteger('progress')->default(0);
            $table->json('evidence_files')->nullable();
            $table->timestamps();

            $table->foreign('certification_note_table_id')
                ->references('id')
                ->on('certification_note_tables')
                ->cascadeOnDelete();

            $table->index(['certification_note_table_id', 'sort_order'], 'cert_note_rows_table_sort_idx');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('certification_note_rows');
    }
};
