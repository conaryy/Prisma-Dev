<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('self_assessment_area_question_categories', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->string('scope', 50);
            $table->string('area');
            $table->uuid('question_category_id');
            $table->timestamps();

            $table->unique(
                ['scope', 'area', 'question_category_id'],
                'sa_area_qc_unique'
            );
            $table->index(['scope', 'area'], 'sa_area_qc_scope_area_idx');
            $table->foreign('question_category_id', 'sa_area_qc_category_fk')
                ->references('id')
                ->on('self_assessment_question_categories')
                ->cascadeOnDelete();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('self_assessment_area_question_categories');
    }
};
