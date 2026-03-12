<?php

namespace App\Models;

use App\Models\Concerns\RelaxedRouteBinding;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class SelfAssessmentCapFulfillmentFile extends Model
{
    use HasUuids, RelaxedRouteBinding;

    protected $table = 'self_assessment_cap_fulfillment_files';

    public $timestamps = false;

    public $incrementing = false;

    protected $keyType = 'string';

    protected $fillable = [
        'fulfillment_id',
        'name',
        'url',
        'created_at',
    ];

    protected $casts = [
        'created_at' => 'datetime',
    ];

    public function fulfillment(): BelongsTo
    {
        return $this->belongsTo(SelfAssessmentCapFulfillment::class, 'fulfillment_id');
    }
}
