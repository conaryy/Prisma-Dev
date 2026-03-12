<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('self_assessment_questions', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->string('scope', 50);
            $table->string('category', 50)->nullable();
            $table->string('code', 50);
            $table->text('text');
            $table->string('reference', 255)->nullable();
            $table->boolean('is_active')->default(true);
            $table->unsignedInteger('sort_order')->default(0);
            $table->timestamps();

            $table->index(['scope', 'category']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('self_assessment_questions');
    }
};
