<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('self_assessment_export_dnp_snapshots', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->uuid('session_area_id');
            $table->uuid('user_id');
            $table->uuid('imported_by')->nullable();
            $table->string('scope', 50);
            $table->unsignedSmallInteger('year')->nullable();
            $table->string('wrapper_session_id')->nullable();
            $table->string('fill_code1')->nullable();
            $table->string('fill_code2')->nullable();
            $table->text('fill_area')->nullable();
            $table->text('local_area')->nullable();
            $table->json('summary')->nullable();
            $table->timestamp('imported_at')->nullable();
            $table->timestamps();

            $table->unique(['session_area_id', 'user_id'], 'sa_exp_dnp_snapshots_sa_user_uq');
            $table->index(['scope', 'year'], 'sa_exp_dnp_snapshots_scope_year_idx');
            $table->foreign('session_area_id', 'sa_exp_dnp_snapshots_sa_fk')
                ->references('id')
                ->on('self_assessment_session_areas')
                ->cascadeOnDelete();
            $table->foreign('user_id', 'sa_exp_dnp_snapshots_user_fk')
                ->references('id')
                ->on('users')
                ->cascadeOnDelete();
            $table->foreign('imported_by', 'sa_exp_dnp_snapshots_imported_by_fk')
                ->references('id')
                ->on('users')
                ->nullOnDelete();
        });

        Schema::create('self_assessment_export_dnp_snapshot_items', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->uuid('snapshot_id');
            $table->unsignedInteger('sort_order')->default(0);
            $table->string('question_code')->nullable();
            $table->text('question_text')->nullable();
            $table->longText('reference')->nullable();
            $table->string('status', 50)->nullable();
            $table->longText('comment')->nullable();
            $table->longText('evidence_note')->nullable();
            $table->string('plan_id')->nullable();
            $table->string('area_group_id')->nullable();
            $table->string('pq_id')->nullable();
            $table->string('data_id')->nullable();
            $table->json('files')->nullable();
            $table->json('raw_payload')->nullable();
            $table->timestamps();

            $table->index(['snapshot_id', 'sort_order'], 'sa_exp_dnp_snapshot_items_sort_idx');
            $table->foreign('snapshot_id', 'sa_exp_dnp_snapshot_items_snapshot_fk')
                ->references('id')
                ->on('self_assessment_export_dnp_snapshots')
                ->cascadeOnDelete();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('self_assessment_export_dnp_snapshot_items');
        Schema::dropIfExists('self_assessment_export_dnp_snapshots');
    }
};
