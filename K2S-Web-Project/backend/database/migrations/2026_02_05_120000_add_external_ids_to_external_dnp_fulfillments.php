<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('external_dnp_cap_fulfillments', function (Blueprint $table) {
            $table->string('external_step_id', 50)->nullable()->after('cap_id');
            $table->index(['cap_id', 'external_step_id'], 'external_dnp_fulfillments_step_idx');
        });

        Schema::table('external_dnp_cap_fulfillment_files', function (Blueprint $table) {
            $table->string('external_file_id', 50)->nullable()->after('fulfillment_id');
            $table->index(['fulfillment_id', 'external_file_id'], 'external_dnp_fulfillment_files_idx');
        });
    }

    public function down(): void
    {
        Schema::table('external_dnp_cap_fulfillment_files', function (Blueprint $table) {
            $table->dropIndex('external_dnp_fulfillment_files_idx');
            $table->dropColumn('external_file_id');
        });

        Schema::table('external_dnp_cap_fulfillments', function (Blueprint $table) {
            $table->dropIndex('external_dnp_fulfillments_step_idx');
            $table->dropColumn('external_step_id');
        });
    }
};
