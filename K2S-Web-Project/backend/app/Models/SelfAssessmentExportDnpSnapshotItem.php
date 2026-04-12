<?php

namespace App\Models;

use App\Models\Concerns\RelaxedRouteBinding;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class SelfAssessmentExportDnpSnapshotItem extends Model
{
    use HasUuids, RelaxedRouteBinding;

    protected $table = 'self_assessment_export_dnp_snapshot_items';

    public $incrementing = false;

    protected $keyType = 'string';

    protected $fillable = [
        'snapshot_id',
        'sort_order',
        'question_code',
        'question_text',
        'reference',
        'status',
        'comment',
        'evidence_note',
        'plan_id',
        'area_group_id',
        'pq_id',
        'data_id',
        'files',
        'raw_payload',
    ];

    protected $casts = [
        'sort_order' => 'integer',
        'files' => 'array',
        'raw_payload' => 'array',
    ];

    public function snapshot(): BelongsTo
    {
        return $this->belongsTo(SelfAssessmentExportDnpSnapshot::class, 'snapshot_id');
    }
}
