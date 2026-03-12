<?php

namespace App\Models;

use App\Models\Concerns\RelaxedRouteBinding;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class SelfAssessmentMonitoringResultFile extends Model
{
    use HasUuids, RelaxedRouteBinding;

    protected $table = 'self_assessment_monitoring_result_files';

    public $incrementing = false;

    protected $keyType = 'string';

    protected $fillable = [
        'result_id',
        'name',
        'url',
    ];

    public function result(): BelongsTo
    {
        return $this->belongsTo(SelfAssessmentMonitoringResult::class, 'result_id');
    }
}
