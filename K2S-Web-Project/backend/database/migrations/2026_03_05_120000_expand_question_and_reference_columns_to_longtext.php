<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        DB::statement('ALTER TABLE `self_assessment_questions` MODIFY `text` LONGTEXT NOT NULL');
        DB::statement('ALTER TABLE `self_assessment_questions` MODIFY `reference` LONGTEXT NULL');

        DB::statement('ALTER TABLE `external_dnp_questions` MODIFY `text` LONGTEXT NOT NULL');
        DB::statement('ALTER TABLE `external_dnp_questions` MODIFY `reference` LONGTEXT NULL');
    }

    public function down(): void
    {
        DB::statement('ALTER TABLE `self_assessment_questions` MODIFY `text` TEXT NOT NULL');
        DB::statement('ALTER TABLE `self_assessment_questions` MODIFY `reference` VARCHAR(255) NULL');

        DB::statement('ALTER TABLE `external_dnp_questions` MODIFY `text` TEXT NOT NULL');
        DB::statement('ALTER TABLE `external_dnp_questions` MODIFY `reference` VARCHAR(255) NULL');
    }
};

