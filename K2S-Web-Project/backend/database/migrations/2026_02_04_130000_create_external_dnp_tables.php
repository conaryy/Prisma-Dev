<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('external_dnp_questions', function (Blueprint $table) {
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

        Schema::create('external_dnp_sessions', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->string('scope', 50);
            $table->string('title')->nullable();
            $table->date('start_date');
            $table->date('end_date');
            $table->boolean('is_published')->default(true);
            $table->string('team_leader')->nullable();
            $table->json('team_members')->nullable();
            $table->json('team_audity')->nullable();
            $table->json('target_session_area_ids')->nullable();
            $table->timestamps();

            $table->index(['scope', 'is_published']);
        });

        Schema::create('external_dnp_session_areas', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->uuid('session_id');
            $table->string('category');
            $table->boolean('is_active')->default(true);
            $table->unsignedInteger('sort_order')->default(0);
            $table->timestamps();

            $table->foreign('session_id')
                ->references('id')
                ->on('external_dnp_sessions')
                ->cascadeOnDelete();
            $table->index(['session_id', 'category']);
        });

        Schema::create('external_dnp_answers', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->uuid('session_area_id');
            $table->string('question_code');
            $table->string('status');
            $table->text('comment')->nullable();
            $table->text('evidence_note')->nullable();
            $table->boolean('is_submitted')->default(false);
            $table->timestamp('submitted_at')->nullable();
            $table->timestamps();

            $table->unique(['session_area_id', 'question_code'], 'external_dnp_answers_unique');
            $table->index(['session_area_id', 'question_code']);
            $table->foreign('session_area_id')
                ->references('id')
                ->on('external_dnp_session_areas')
                ->cascadeOnDelete();
        });

        Schema::create('external_dnp_reviews', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->uuid('answer_id');
            $table->uuid('reviewer_id')->nullable();
            $table->string('status');
            $table->text('comment')->nullable();
            $table->string('severity')->nullable();
            $table->string('probability')->nullable();
            $table->string('resume')->nullable();
            $table->text('description')->nullable();
            $table->text('finding')->nullable();
            $table->text('recommendations')->nullable();
            $table->text('remark')->nullable();
            $table->boolean('allow_reply')->default(false);
            $table->boolean('is_final')->default(false);
            $table->timestamp('sent_at')->nullable();
            $table->timestamps();

            $table->unique('answer_id');
            $table->index(['reviewer_id', 'sent_at']);
            $table->foreign('answer_id')
                ->references('id')
                ->on('external_dnp_answers')
                ->cascadeOnDelete();
            $table->foreign('reviewer_id')
                ->references('id')
                ->on('users')
                ->nullOnDelete();
        });

        Schema::create('external_dnp_caps', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->uuid('answer_id');
            $table->text('action_plan');
            $table->date('target_date');
            $table->string('status')->default('draft');
            $table->timestamp('sent_at')->nullable();
            $table->timestamps();

            $table->unique('answer_id');
            $table->index(['status']);
            $table->foreign('answer_id')
                ->references('id')
                ->on('external_dnp_answers')
                ->cascadeOnDelete();
        });

        Schema::create('external_dnp_cap_reviews', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->uuid('cap_id');
            $table->uuid('reviewer_id')->nullable();
            $table->string('result')->nullable();
            $table->text('comment')->nullable();
            $table->string('status')->nullable();
            $table->timestamp('reviewed_at')->nullable();
            $table->timestamps();

            $table->unique('cap_id');
            $table->index(['reviewer_id', 'reviewed_at']);
            $table->foreign('cap_id')
                ->references('id')
                ->on('external_dnp_caps')
                ->cascadeOnDelete();
            $table->foreign('reviewer_id')
                ->references('id')
                ->on('users')
                ->nullOnDelete();
        });

        Schema::create('external_dnp_cap_fulfillments', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->uuid('cap_id');
            $table->integer('step')->default(1);
            $table->text('propose_action');
            $table->text('action_office');
            $table->text('evidence_reference')->nullable();
            $table->date('complete_date');
            $table->integer('progress')->default(0);
            $table->string('status')->default('draft');
            $table->timestamp('submitted_at')->nullable();
            $table->timestamps();

            $table->index(['cap_id', 'status']);
            $table->foreign('cap_id')
                ->references('id')
                ->on('external_dnp_caps')
                ->cascadeOnDelete();
        });

        Schema::create('external_dnp_cap_fulfillment_files', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->uuid('fulfillment_id');
            $table->string('name');
            $table->text('url');
            $table->timestamp('created_at')->useCurrent();

            $table->index('fulfillment_id');
            $table->foreign('fulfillment_id')
                ->references('id')
                ->on('external_dnp_cap_fulfillments')
                ->cascadeOnDelete();
        });

        Schema::create('external_dnp_cap_extensions', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->uuid('cap_id');
            $table->date('due_date');
            $table->string('file_name');
            $table->text('file_url');
            $table->string('status')->default('submitted');
            $table->timestamps();

            $table->index('cap_id');
            $table->foreign('cap_id')
                ->references('id')
                ->on('external_dnp_caps')
                ->cascadeOnDelete();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('external_dnp_cap_extensions');
        Schema::dropIfExists('external_dnp_cap_fulfillment_files');
        Schema::dropIfExists('external_dnp_cap_fulfillments');
        Schema::dropIfExists('external_dnp_cap_reviews');
        Schema::dropIfExists('external_dnp_caps');
        Schema::dropIfExists('external_dnp_reviews');
        Schema::dropIfExists('external_dnp_answers');
        Schema::dropIfExists('external_dnp_session_areas');
        Schema::dropIfExists('external_dnp_sessions');
        Schema::dropIfExists('external_dnp_questions');
    }
};
