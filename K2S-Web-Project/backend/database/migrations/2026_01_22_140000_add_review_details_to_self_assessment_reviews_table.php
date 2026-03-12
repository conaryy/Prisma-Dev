<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('self_assessment_reviews', function (Blueprint $table) {
            $table->string('severity')->nullable()->after('comment');
            $table->string('probability')->nullable()->after('severity');
            $table->string('resume')->nullable()->after('probability');
            $table->text('description')->nullable()->after('resume');
            $table->text('finding')->nullable()->after('description');
            $table->text('recommendations')->nullable()->after('finding');
            $table->text('remark')->nullable()->after('recommendations');
        });
    }

    public function down(): void
    {
        Schema::table('self_assessment_reviews', function (Blueprint $table) {
            $table->dropColumn([
                'severity',
                'probability',
                'resume',
                'description',
                'finding',
                'recommendations',
                'remark',
            ]);
        });
    }
};
