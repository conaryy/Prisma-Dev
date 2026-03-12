<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('self_assessment_session_question_category_users', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->uuid('session_id');
            $table->uuid('question_category_id');
            $table->uuid('user_id');
            $table->timestamps();

            $table->unique(
                ['session_id', 'question_category_id', 'user_id'],
                'sa_sqc_users_unique'
            );
            $table->index(['session_id', 'user_id'], 'sa_sqc_users_session_user_idx');

            $table->foreign('session_id', 'sa_sqc_users_session_fk')
                ->references('id')
                ->on('self_assessment_sessions')
                ->cascadeOnDelete();
            $table->foreign('question_category_id', 'sa_sqc_users_qc_fk')
                ->references('id')
                ->on('self_assessment_question_categories')
                ->cascadeOnDelete();
            $table->foreign('user_id', 'sa_sqc_users_user_fk')
                ->references('id')
                ->on('users')
                ->cascadeOnDelete();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('self_assessment_session_question_category_users');
    }
};
