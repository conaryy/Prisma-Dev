<?php

use Illuminate\Database\Migrations\Migration;

return new class extends Migration
{
    public function up(): void
    {
        // Deprecated migration: monitoring result has been moved
        // to dedicated tables, no unique-key mutation needed.
    }

    public function down(): void
    {
        // No-op.
    }
};
