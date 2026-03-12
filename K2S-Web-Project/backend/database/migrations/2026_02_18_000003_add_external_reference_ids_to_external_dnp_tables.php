<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('external_dnp_answers', function (Blueprint $table) {
            $table->string('external_answer_id')->nullable()->after('id');
            $table->index('external_answer_id');
        });

        Schema::table('external_dnp_caps', function (Blueprint $table) {
            $table->string('external_cap_id')->nullable()->after('id');
            $table->index('external_cap_id');
        });
    }

    public function down(): void
    {
        Schema::table('external_dnp_caps', function (Blueprint $table) {
            $table->dropIndex(['external_cap_id']);
            $table->dropColumn('external_cap_id');
        });

        Schema::table('external_dnp_answers', function (Blueprint $table) {
            $table->dropIndex(['external_answer_id']);
            $table->dropColumn('external_answer_id');
        });
    }
};
