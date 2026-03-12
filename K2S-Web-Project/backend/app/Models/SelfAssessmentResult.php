<?php

namespace App\Models;

use App\Models\Concerns\RelaxedRouteBinding;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class SelfAssessmentResult extends Model
{
    use HasUuids, RelaxedRouteBinding;

    protected $table = 'self_assessment_results';

    public $incrementing = false;

    protected $keyType = 'string';

    protected $fillable = [
        'session_area_id',
        'user_id',
        'status',
        'finalized_by',
        'finalized_at',
    ];

    protected $casts = [
        'finalized_at' => 'datetime',
    ];

    public function files(): HasMany
    {
        return $this->hasMany(SelfAssessmentResultFile::class, 'result_id');
    }

    public function sessionArea(): BelongsTo
    {
        return $this->belongsTo(SelfAssessmentSessionArea::class, 'session_area_id');
    }
}
