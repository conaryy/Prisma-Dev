<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('self_assessment_import_dnp_inject_jobs', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->uuid('user_id')->nullable();
            $table->uuid('session_area_id');
            $table->uuid('target_user_id');
            $table->boolean('include_evidence')->default(false);
            $table->unsignedInteger('match_count')->default(0);
            $table->string('status', 30)->default('queued');
            $table->text('message')->nullable();
            $table->json('summary')->nullable();
            $table->text('error_message')->nullable();
            $table->timestamp('started_at')->nullable();
            $table->timestamp('finished_at')->nullable();
            $table->timestamps();

            $table->index(['user_id', 'status'], 'sa_import_dnp_inject_jobs_user_status_idx');
            $table->index(['session_area_id', 'target_user_id'], 'sa_import_dnp_inject_jobs_area_user_idx');
            $table->foreign('user_id')->references('id')->on('users')->nullOnDelete();
            $table->foreign('session_area_id')->references('id')->on('self_assessment_session_areas')->cascadeOnDelete();
            $table->foreign('target_user_id')->references('id')->on('users')->cascadeOnDelete();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('self_assessment_import_dnp_inject_jobs');
    }
};
