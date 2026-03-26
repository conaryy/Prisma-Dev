<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->string('sso_subject', 191)->nullable()->unique()->after('email');
            $table->string('sso_provider', 50)->nullable()->after('sso_subject');
            $table->timestamp('last_sso_login_at')->nullable()->after('last_login_at');
        });
    }

    public function down(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->dropColumn(['last_sso_login_at', 'sso_provider']);
            $table->dropUnique('users_sso_subject_unique');
            $table->dropColumn('sso_subject');
        });
    }
};

