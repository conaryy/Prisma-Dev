<?php

namespace App\Models;

use App\Models\Concerns\RelaxedRouteBinding;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class ExternalDnpSessionArea extends Model
{
    use HasUuids, RelaxedRouteBinding;

    protected $table = 'external_dnp_session_areas';

    public $incrementing = false;

    protected $keyType = 'string';

    protected $fillable = [
        'session_id',
        'category',
        'is_active',
        'sort_order',
    ];

    protected $casts = [
        'is_active' => 'boolean',
        'sort_order' => 'integer',
    ];

    public function session(): BelongsTo
    {
        return $this->belongsTo(ExternalDnpSession::class, 'session_id');
    }

    public function answers(): HasMany
    {
        return $this->hasMany(ExternalDnpAnswer::class, 'session_area_id');
    }
}
