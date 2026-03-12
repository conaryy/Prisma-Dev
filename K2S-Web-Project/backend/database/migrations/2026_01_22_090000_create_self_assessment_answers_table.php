<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('self_assessment_answers', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->uuid('session_area_id');
            $table->uuid('user_id');
            $table->string('question_code');
            $table->string('status');
            $table->text('comment')->nullable();
            $table->boolean('is_submitted')->default(false);
            $table->timestamp('submitted_at')->nullable();
            $table->timestamps();

            $table->unique(['session_area_id', 'user_id', 'question_code'], 'self_assessment_answers_unique');
            $table->index(['user_id', 'is_submitted']);
            $table->index(['session_area_id', 'question_code']);
            $table->foreign('session_area_id')
                ->references('id')
                ->on('self_assessment_session_areas')
                ->cascadeOnDelete();
            $table->foreign('user_id')
                ->references('id')
                ->on('users')
                ->cascadeOnDelete();
        });

        Schema::create('self_assessment_reviews', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->uuid('answer_id');
            $table->uuid('reviewer_id');
            $table->string('status');
            $table->text('comment')->nullable();
            $table->boolean('allow_reply')->default(false);
            $table->boolean('is_final')->default(false);
            $table->timestamp('sent_at')->nullable();
            $table->timestamps();

            $table->unique('answer_id');
            $table->index(['reviewer_id', 'sent_at']);
            $table->foreign('answer_id')
                ->references('id')
                ->on('self_assessment_answers')
                ->cascadeOnDelete();
            $table->foreign('reviewer_id')
                ->references('id')
                ->on('users')
                ->cascadeOnDelete();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('self_assessment_reviews');
        Schema::dropIfExists('self_assessment_answers');
    }
};
