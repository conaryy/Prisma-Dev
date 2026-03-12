<?php

namespace App\Models;

use App\Models\Concerns\RelaxedRouteBinding;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasOne;

class SelfAssessmentCap extends Model
{
    use HasUuids, RelaxedRouteBinding;

    protected $table = 'self_assessment_caps';

    public $incrementing = false;

    protected $keyType = 'string';

    protected $fillable = [
        'answer_id',
        'user_id',
        'action_plan',
        'target_date',
        'status',
        'sent_at',
    ];

    protected $casts = [
        'target_date' => 'date',
        'sent_at' => 'datetime',
    ];

    public function answer(): BelongsTo
    {
        return $this->belongsTo(SelfAssessmentAnswer::class, 'answer_id');
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class, 'user_id');
    }

    public function review(): HasOne
    {
        return $this->hasOne(SelfAssessmentCapReview::class, 'cap_id');
    }

    public function fulfillmentReview(): HasOne
    {
        return $this->hasOne(SelfAssessmentCapFulfillmentReview::class, 'cap_id');
    }

    public function monitoringReview(): HasOne
    {
        return $this->hasOne(SelfAssessmentMonitoringReview::class, 'cap_id');
    }

    public function fulfillments(): HasMany
    {
        return $this->hasMany(SelfAssessmentCapFulfillment::class, 'cap_id');
    }

    public function extensions(): HasMany
    {
        return $this->hasMany(SelfAssessmentCapExtension::class, 'cap_id');
    }
}
