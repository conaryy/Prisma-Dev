<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('certificate_fulfillment_notes', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->uuid('certificate_id');
            $table->text('comment');
            $table->unsignedTinyInteger('fulfillment_percentage')->default(0);
            $table->string('evidence_file_name')->nullable();
            $table->text('evidence_file_url')->nullable();
            $table->timestamps();

            $table->foreign('certificate_id')
                ->references('id')
                ->on('certificates')
                ->cascadeOnDelete();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('certificate_fulfillment_notes');
    }
};
