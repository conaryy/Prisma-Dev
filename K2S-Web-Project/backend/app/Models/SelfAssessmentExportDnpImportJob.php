<?php

namespace App\Models;

use App\Models\Concerns\RelaxedRouteBinding;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class SelfAssessmentExportDnpImportJob extends Model
{
    use HasUuids, RelaxedRouteBinding;

    protected $table = 'self_assessment_export_dnp_import_jobs';

    public $incrementing = false;

    protected $keyType = 'string';

    protected $fillable = [
        'user_id',
        'session_area_id',
        'target_user_id',
        'scope',
        'year',
        'fill_code1',
        'fill_code2',
        'fill_area',
        'status',
        'message',
        'summary',
        'error_message',
        'started_at',
        'finished_at',
    ];

    protected $casts = [
        'year' => 'integer',
        'summary' => 'array',
        'started_at' => 'datetime',
        'finished_at' => 'datetime',
    ];

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class, 'user_id');
    }

    public function targetUser(): BelongsTo
    {
        return $this->belongsTo(User::class, 'target_user_id');
    }

    public function sessionArea(): BelongsTo
    {
        return $this->belongsTo(SelfAssessmentSessionArea::class, 'session_area_id');
    }
}
