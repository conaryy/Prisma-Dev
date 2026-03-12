<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('self_assessment_caps', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->uuid('answer_id');
            $table->uuid('user_id');
            $table->text('action_plan');
            $table->date('target_date');
            $table->string('status')->default('draft');
            $table->timestamp('sent_at')->nullable();
            $table->timestamps();

            $table->unique(['answer_id', 'user_id'], 'sa_caps_answer_user_unique');
            $table->index(['user_id', 'status']);
            $table->foreign('answer_id')
                ->references('id')
                ->on('self_assessment_answers')
                ->cascadeOnDelete();
            $table->foreign('user_id')
                ->references('id')
                ->on('users')
                ->cascadeOnDelete();
        });

        Schema::create('self_assessment_cap_reviews', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->uuid('cap_id');
            $table->uuid('reviewer_id');
            $table->string('result')->nullable();
            $table->text('comment')->nullable();
            $table->string('status')->nullable();
            $table->timestamp('reviewed_at')->nullable();
            $table->timestamps();

            $table->unique('cap_id');
            $table->index(['reviewer_id', 'reviewed_at']);
            $table->foreign('cap_id')
                ->references('id')
                ->on('self_assessment_caps')
                ->cascadeOnDelete();
            $table->foreign('reviewer_id')
                ->references('id')
                ->on('users')
                ->cascadeOnDelete();
        });

        Schema::create('self_assessment_cap_fulfillments', function (Blueprint $table) {
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
                ->on('self_assessment_caps')
                ->cascadeOnDelete();
        });

        Schema::create('self_assessment_cap_fulfillment_files', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->uuid('fulfillment_id');
            $table->string('name');
            $table->text('url');
            $table->timestamp('created_at')->useCurrent();

            $table->index('fulfillment_id');
            $table->foreign('fulfillment_id')
                ->references('id')
                ->on('self_assessment_cap_fulfillments')
                ->cascadeOnDelete();
        });

        Schema::create('self_assessment_cap_extensions', function (Blueprint $table) {
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
                ->on('self_assessment_caps')
                ->cascadeOnDelete();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('self_assessment_cap_extensions');
        Schema::dropIfExists('self_assessment_cap_fulfillment_files');
        Schema::dropIfExists('self_assessment_cap_fulfillments');
        Schema::dropIfExists('self_assessment_cap_reviews');
        Schema::dropIfExists('self_assessment_caps');
    }
};
