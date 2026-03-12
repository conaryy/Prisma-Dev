<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('instansi', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->string('facility_group');
            $table->string('kobu');
            $table->string('bandara');
            $table->string('cabang_airnav');
            $table->string('name');
            $table->string('alias')->nullable();
            $table->text('address')->nullable();
            $table->string('contact_name')->nullable();
            $table->string('contact_email')->nullable();
            $table->string('contact_phone', 100)->nullable();
            $table->string('fax', 100)->nullable();
            $table->string('postal_code', 20)->nullable();
            $table->string('longitude', 50)->nullable();
            $table->string('latitude', 50)->nullable();
            $table->string('service_area')->nullable();
            $table->string('operating_hours', 100)->nullable();
            $table->string('traffic_type', 100)->nullable();
            $table->string('runway_capacity', 100)->nullable();
            $table->string('runway_condition', 100)->nullable();
            $table->string('location')->nullable();
            $table->timestamps();
        });

        Schema::create('facilities', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->uuid('instansi_id')->nullable();
            $table->string('facility_group');
            $table->string('name');
            $table->string('merk')->nullable();
            $table->string('type')->nullable();
            $table->string('frequency', 100)->nullable();
            $table->string('ident', 100)->nullable();
            $table->enum('condition_status', ['Normal', 'Single', 'Unserviceable'])->default('Normal');
            $table->timestamps();
            $table->foreign('instansi_id')->references('id')->on('instansi')->nullOnDelete();
        });

        Schema::create('organizations', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->uuid('instansi_id')->nullable();
            $table->string('unit_name');
            $table->string('position_name');
            $table->string('level', 50)->nullable();
            $table->enum('status', ['Aktif', 'Nonaktif'])->default('Aktif');
            $table->timestamps();
            $table->foreign('instansi_id')->references('id')->on('instansi')->nullOnDelete();
        });

        Schema::create('personil', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->uuid('instansi_id')->nullable();
            $table->string('name');
            $table->string('position')->nullable();
            $table->string('level', 50)->nullable();
            $table->string('field_name', 100)->nullable();
            $table->string('tier', 100)->nullable();
            $table->timestamps();
            $table->foreign('instansi_id')->references('id')->on('instansi')->nullOnDelete();
        });

        Schema::create('certificates', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->uuid('instansi_id')->nullable();
            $table->string('name');
            $table->string('type');
            $table->string('number');
            $table->date('valid_until');
            $table->enum('status', ['Berlaku', 'Tidak Berlaku'])->default('Berlaku');
            $table->timestamps();
            $table->foreign('instansi_id')->references('id')->on('instansi')->nullOnDelete();
        });

        Schema::create('agenda', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->date('date');
            $table->string('activity_type');
            $table->string('location');
            $table->string('status', 100);
            $table->timestamps();
        });

        Schema::create('audits', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->string('number');
            $table->date('date');
            $table->string('location');
            $table->string('status', 100);
            $table->string('focus');
            $table->timestamps();
        });

        Schema::create('inspections', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->string('number');
            $table->date('date');
            $table->string('location');
            $table->string('status', 100);
            $table->string('unit');
            $table->timestamps();
        });

        Schema::create('monitoring', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->date('date');
            $table->string('location');
            $table->string('status', 100);
            $table->text('note')->nullable();
            $table->timestamps();
        });

        Schema::create('findings', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->enum('source_type', ['Audit', 'Inspeksi', 'Monitoring']);
            $table->uuid('source_id');
            $table->string('kategori');
            $table->text('deskripsi');
            $table->enum('severity', ['Low', 'Med', 'High']);
            $table->enum('status', ['Open', 'In Progress', 'Closed']);
            $table->date('due_date');
            $table->timestamps();
            $table->index(['source_type', 'source_id']);
        });

        Schema::create('follow_ups', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->uuid('finding_id');
            $table->text('aksi_perbaikan');
            $table->string('pic');
            $table->date('target_date');
            $table->enum('status', ['Open', 'In Progress', 'Done']);
            $table->timestamps();
            $table->foreign('finding_id')->references('id')->on('findings')->cascadeOnDelete();
        });

        Schema::create('follow_up_history', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->uuid('follow_up_id');
            $table->text('note');
            $table->timestamp('created_at')->useCurrent();
            $table->foreign('follow_up_id')->references('id')->on('follow_ups')->cascadeOnDelete();
        });

        Schema::create('follow_up_evidence', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->uuid('follow_up_id');
            $table->string('name');
            $table->text('url');
            $table->timestamp('created_at')->useCurrent();
            $table->foreign('follow_up_id')->references('id')->on('follow_ups')->cascadeOnDelete();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('follow_up_evidence');
        Schema::dropIfExists('follow_up_history');
        Schema::dropIfExists('follow_ups');
        Schema::dropIfExists('findings');
        Schema::dropIfExists('monitoring');
        Schema::dropIfExists('inspections');
        Schema::dropIfExists('audits');
        Schema::dropIfExists('agenda');
        Schema::dropIfExists('certificates');
        Schema::dropIfExists('personil');
        Schema::dropIfExists('organizations');
        Schema::dropIfExists('facilities');
        Schema::dropIfExists('instansi');
    }
};
