<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('self_assessment_question_import_jobs', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->uuid('user_id')->nullable();
            $table->string('scope', 50);
            $table->string('category')->nullable();
            $table->unsignedSmallInteger('year')->nullable();
            $table->string('fill_code1')->nullable();
            $table->string('fill_code2')->nullable();
            $table->text('fill_area')->nullable();
            $table->string('status', 30)->default('queued');
            $table->text('message')->nullable();
            $table->json('summary')->nullable();
            $table->text('error_message')->nullable();
            $table->timestamp('started_at')->nullable();
            $table->timestamp('finished_at')->nullable();
            $table->timestamps();

            $table->index(['user_id', 'status']);
            $table->index(['scope', 'category']);
            $table->foreign('user_id')->references('id')->on('users')->nullOnDelete();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('self_assessment_question_import_jobs');
    }
};
