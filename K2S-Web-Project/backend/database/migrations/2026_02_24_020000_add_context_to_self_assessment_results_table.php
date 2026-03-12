<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (!Schema::hasTable('self_assessment_results')) {
            return;
        }

        Schema::table('self_assessment_results', function (Blueprint $table) {
            if (!Schema::hasColumn('self_assessment_results', 'context')) {
                $table->string('context', 40)
                    ->default('self_assessment')
                    ->after('status');
                $table->index(['context', 'status', 'finalized_at'], 'sa_results_context_status_finalized_idx');
            }
        });
    }

    public function down(): void
    {
        if (!Schema::hasTable('self_assessment_results')) {
            return;
        }

        Schema::table('self_assessment_results', function (Blueprint $table) {
            if (Schema::hasColumn('self_assessment_results', 'context')) {
                $table->dropIndex('sa_results_context_status_finalized_idx');
                $table->dropColumn('context');
            }
        });
    }
};
