<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    private const TABLE = 'self_assessment_cap_fulfillment_reviews';
    private const INDEX_REVIEWER_REVIEWED = 'sa_cap_fulfill_reviews_reviewer_reviewed_idx';
    private const FK_CAP = 'sa_cap_fulfill_reviews_cap_fk';
    private const FK_REVIEWER = 'sa_cap_fulfill_reviews_reviewer_fk';

    public function up(): void
    {
        if (!Schema::hasTable(self::TABLE) || DB::getDriverName() !== 'mysql') {
            return;
        }

        if (!$this->indexExists(self::INDEX_REVIEWER_REVIEWED)) {
            Schema::table(self::TABLE, function (Blueprint $table) {
                $table->index(['reviewer_id', 'reviewed_at'], self::INDEX_REVIEWER_REVIEWED);
            });
        }

        if (!$this->foreignKeyExistsOnColumn('cap_id')) {
            Schema::table(self::TABLE, function (Blueprint $table) {
                $table->foreign('cap_id', self::FK_CAP)
                    ->references('id')
                    ->on('self_assessment_caps')
                    ->cascadeOnDelete();
            });
        }

        if (!$this->foreignKeyExistsOnColumn('reviewer_id')) {
            Schema::table(self::TABLE, function (Blueprint $table) {
                $table->foreign('reviewer_id', self::FK_REVIEWER)
                    ->references('id')
                    ->on('users')
                    ->cascadeOnDelete();
            });
        }
    }

    public function down(): void
    {
        if (!Schema::hasTable(self::TABLE) || DB::getDriverName() !== 'mysql') {
            return;
        }

        Schema::table(self::TABLE, function (Blueprint $table) {
            if ($this->foreignKeyExists(self::FK_CAP)) {
                $table->dropForeign(self::FK_CAP);
            }

            if ($this->foreignKeyExists(self::FK_REVIEWER)) {
                $table->dropForeign(self::FK_REVIEWER);
            }

            if ($this->indexExists(self::INDEX_REVIEWER_REVIEWED)) {
                $table->dropIndex(self::INDEX_REVIEWER_REVIEWED);
            }
        });
    }

    private function indexExists(string $indexName): bool
    {
        $database = DB::getDatabaseName();

        return DB::table('information_schema.statistics')
            ->where('table_schema', $database)
            ->where('table_name', self::TABLE)
            ->where('index_name', $indexName)
            ->exists();
    }

    private function foreignKeyExists(string $constraintName): bool
    {
        $database = DB::getDatabaseName();

        return DB::table('information_schema.table_constraints')
            ->where('table_schema', $database)
            ->where('table_name', self::TABLE)
            ->where('constraint_name', $constraintName)
            ->where('constraint_type', 'FOREIGN KEY')
            ->exists();
    }

    private function foreignKeyExistsOnColumn(string $columnName): bool
    {
        $database = DB::getDatabaseName();

        return DB::table('information_schema.key_column_usage')
            ->where('table_schema', $database)
            ->where('table_name', self::TABLE)
            ->where('column_name', $columnName)
            ->whereNotNull('referenced_table_name')
            ->exists();
    }
};
