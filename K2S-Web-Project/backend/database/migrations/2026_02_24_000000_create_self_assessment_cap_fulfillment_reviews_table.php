<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasTable('self_assessment_cap_fulfillment_reviews')) {
            return;
        }

        Schema::create('self_assessment_cap_fulfillment_reviews', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->uuid('cap_id');
            $table->uuid('reviewer_id');
            $table->string('result')->nullable();
            $table->text('comment')->nullable();
            $table->string('status')->nullable();
            $table->timestamp('reviewed_at')->nullable();
            $table->timestamps();

            $table->unique('cap_id');
            $table->index(['reviewer_id', 'reviewed_at'], 'sa_cap_fulfill_reviews_reviewer_reviewed_idx');
            $table->foreign('cap_id', 'sa_cap_fulfill_reviews_cap_fk')
                ->references('id')
                ->on('self_assessment_caps')
                ->cascadeOnDelete();
            $table->foreign('reviewer_id', 'sa_cap_fulfill_reviews_reviewer_fk')
                ->references('id')
                ->on('users')
                ->cascadeOnDelete();
        });
    }

    public function down(): void
    {
        if (Schema::hasTable('self_assessment_cap_fulfillment_reviews')) {
            Schema::dropIfExists('self_assessment_cap_fulfillment_reviews');
        }
    }
};
