<?php

namespace App\Models;

use App\Models\Concerns\RelaxedRouteBinding;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasOne;

class ExternalDnpCap extends Model
{
    use HasUuids, RelaxedRouteBinding;

    protected $table = 'external_dnp_caps';

    public $incrementing = false;

    protected $keyType = 'string';

    protected $fillable = [
        'external_cap_id',
        'answer_id',
        'external_plan_id',
        'external_area_group_id',
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
        return $this->belongsTo(ExternalDnpAnswer::class, 'answer_id');
    }

    public function review(): HasOne
    {
        return $this->hasOne(ExternalDnpCapReview::class, 'cap_id');
    }

    public function fulfillments(): HasMany
    {
        return $this->hasMany(ExternalDnpCapFulfillment::class, 'cap_id');
    }

    public function extensions(): HasMany
    {
        return $this->hasMany(ExternalDnpCapExtension::class, 'cap_id');
    }
}
