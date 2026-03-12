<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('self_assessment_answers', function (Blueprint $table) {
            $table->text('evidence_note')->nullable()->after('comment');
        });
    }

    public function down(): void
    {
        Schema::table('self_assessment_answers', function (Blueprint $table) {
            $table->dropColumn('evidence_note');
        });
    }
};
