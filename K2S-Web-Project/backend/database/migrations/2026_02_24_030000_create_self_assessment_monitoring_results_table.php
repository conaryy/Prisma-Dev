<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (!Schema::hasTable('self_assessment_monitoring_results')) {
            Schema::create('self_assessment_monitoring_results', function (Blueprint $table) {
                $table->uuid('id')->primary();
                $table->uuid('session_area_id');
                $table->uuid('user_id');
                $table->string('status', 20);
                $table->uuid('finalized_by')->nullable();
                $table->timestamp('finalized_at')->nullable();
                $table->timestamps();

                $table->unique(['session_area_id', 'user_id'], 'sa_monitoring_results_area_user_unique');
                $table->index(['status', 'finalized_at'], 'sa_monitoring_results_status_finalized_idx');
                $table->foreign('session_area_id')
                    ->references('id')
                    ->on('self_assessment_session_areas')
                    ->cascadeOnDelete();
                $table->foreign('user_id')
                    ->references('id')
                    ->on('users')
                    ->cascadeOnDelete();
                $table->foreign('finalized_by')
                    ->references('id')
                    ->on('users')
                    ->nullOnDelete();
            });
        }

        if (!Schema::hasTable('self_assessment_monitoring_result_files')) {
            Schema::create('self_assessment_monitoring_result_files', function (Blueprint $table) {
                $table->uuid('id')->primary();
                $table->uuid('result_id');
                $table->string('name');
                $table->text('url');
                $table->timestamps();

                $table->foreign('result_id')
                    ->references('id')
                    ->on('self_assessment_monitoring_results')
                    ->cascadeOnDelete();
            });
        }
    }

    public function down(): void
    {
        Schema::dropIfExists('self_assessment_monitoring_result_files');
        Schema::dropIfExists('self_assessment_monitoring_results');
    }
};
