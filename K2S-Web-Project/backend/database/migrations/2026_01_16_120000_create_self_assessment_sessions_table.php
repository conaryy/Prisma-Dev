<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('self_assessment_category_options', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->string('scope', 50);
            $table->string('name');
            $table->boolean('is_active')->default(true);
            $table->unsignedInteger('sort_order')->default(0);
            $table->timestamps();
            $table->index(['scope', 'is_active']);
        });

        Schema::create('self_assessment_sessions', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->string('scope', 50);
            $table->string('title')->nullable();
            $table->date('start_date');
            $table->date('end_date');
            $table->boolean('is_published')->default(true);
            $table->timestamps();
            $table->index(['scope', 'is_published']);
        });

        Schema::create('self_assessment_session_areas', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->uuid('session_id');
            $table->string('category');
            $table->boolean('is_active')->default(true);
            $table->unsignedInteger('sort_order')->default(0);
            $table->timestamps();
            $table->foreign('session_id')->references('id')->on('self_assessment_sessions')->cascadeOnDelete();
            $table->index(['session_id', 'category']);
        });

        Schema::create('self_assessment_area_teams', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->uuid('session_area_id');
            $table->uuid('user_id');
            $table->string('leader')->nullable();
            $table->json('dnp')->nullable();
            $table->json('kobo')->nullable();
            $table->timestamps();
            $table->unique(['session_area_id', 'user_id']);
            $table->foreign('session_area_id')->references('id')->on('self_assessment_session_areas')->cascadeOnDelete();
            $table->foreign('user_id')->references('id')->on('users')->cascadeOnDelete();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('self_assessment_area_teams');
        Schema::dropIfExists('self_assessment_session_areas');
        Schema::dropIfExists('self_assessment_sessions');
        Schema::dropIfExists('self_assessment_category_options');
    }
};
