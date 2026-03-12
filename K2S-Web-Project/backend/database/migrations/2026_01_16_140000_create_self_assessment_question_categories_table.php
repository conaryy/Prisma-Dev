<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('self_assessment_question_categories', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->string('scope', 50);
            $table->string('name');
            $table->string('prefix', 10);
            $table->boolean('is_active')->default(true);
            $table->unsignedInteger('sort_order')->default(0);
            $table->timestamps();
            $table->index(['scope', 'is_active']);
        });

        Schema::table('self_assessment_questions', function (Blueprint $table) {
            $table->string('question_category')->nullable()->after('category');
            $table->string('question_category_prefix', 10)->nullable()->after('question_category');
        });
    }

    public function down(): void
    {
        Schema::table('self_assessment_questions', function (Blueprint $table) {
            $table->dropColumn(['question_category', 'question_category_prefix']);
        });
        Schema::dropIfExists('self_assessment_question_categories');
    }
};
