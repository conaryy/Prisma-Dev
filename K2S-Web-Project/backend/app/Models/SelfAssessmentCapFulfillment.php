<?php

namespace App\Models;

use App\Models\Concerns\RelaxedRouteBinding;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class SelfAssessmentCapFulfillment extends Model
{
    use HasUuids, RelaxedRouteBinding;

    protected $table = 'self_assessment_cap_fulfillments';

    public $incrementing = false;

    protected $keyType = 'string';

    protected $fillable = [
        'cap_id',
        'step',
        'propose_action',
        'action_office',
        'evidence_reference',
        'complete_date',
        'progress',
        'status',
        'submitted_at',
    ];

    protected $casts = [
        'complete_date' => 'date',
        'submitted_at' => 'datetime',
    ];

    public function cap(): BelongsTo
    {
        return $this->belongsTo(SelfAssessmentCap::class, 'cap_id');
    }

    public function files(): HasMany
    {
        return $this->hasMany(SelfAssessmentCapFulfillmentFile::class, 'fulfillment_id');
    }
}
