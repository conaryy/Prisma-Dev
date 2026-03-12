<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('external_dnp_caps', function (Blueprint $table) {
            $table->string('external_plan_id', 50)->nullable()->after('answer_id');
            $table->string('external_area_group_id', 50)->nullable()->after('external_plan_id');
            $table->index(['external_plan_id', 'external_area_group_id'], 'external_dnp_caps_meta_idx');
        });
    }

    public function down(): void
    {
        Schema::table('external_dnp_caps', function (Blueprint $table) {
            $table->dropIndex('external_dnp_caps_meta_idx');
            $table->dropColumn('external_plan_id');
            $table->dropColumn('external_area_group_id');
        });
    }
};
