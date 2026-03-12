<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->boolean('can_access_external_dnp')
                ->default(false)
                ->after('status');
        });

        // Preserve previous behavior for existing users after deployment.
        DB::table('users')->update(['can_access_external_dnp' => true]);
    }

    public function down(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->dropColumn('can_access_external_dnp');
        });
    }
};

