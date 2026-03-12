<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (!Schema::hasColumn('users', 'role')) {
            return;
        }

        DB::statement("UPDATE users SET role = 'Viewer' WHERE role IN ('Supervisor','Auditor')");
        DB::statement("ALTER TABLE users MODIFY role ENUM('Admin','Viewer') NOT NULL DEFAULT 'Viewer'");
    }

    public function down(): void
    {
        if (!Schema::hasColumn('users', 'role')) {
            return;
        }

        DB::statement("ALTER TABLE users MODIFY role ENUM('Admin','Supervisor','Auditor','Viewer') NOT NULL DEFAULT 'Viewer'");
    }
};
