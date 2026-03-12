<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('self_assessment_evidence', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->uuid('session_area_id');
            $table->uuid('user_id');
            $table->string('question_code');
            $table->string('name');
            $table->text('url');
            $table->timestamp('created_at')->useCurrent();
            $table->foreign('session_area_id')->references('id')->on('self_assessment_session_areas')->cascadeOnDelete();
            $table->foreign('user_id')->references('id')->on('users')->cascadeOnDelete();
            $table->index(['session_area_id', 'question_code', 'user_id'], 'sa_evidence_area_question_user_idx');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('self_assessment_evidence');
    }
};
