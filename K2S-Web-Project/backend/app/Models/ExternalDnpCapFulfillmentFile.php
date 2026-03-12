<?php

namespace App\Models;

use App\Models\Concerns\RelaxedRouteBinding;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class ExternalDnpCapFulfillmentFile extends Model
{
    use HasUuids, RelaxedRouteBinding;

    protected $table = 'external_dnp_cap_fulfillment_files';

    public $timestamps = false;

    public $incrementing = false;

    protected $keyType = 'string';

    protected $fillable = [
        'fulfillment_id',
        'external_file_id',
        'name',
        'url',
        'created_at',
    ];

    protected $casts = [
        'created_at' => 'datetime',
    ];

    public function fulfillment(): BelongsTo
    {
        return $this->belongsTo(ExternalDnpCapFulfillment::class, 'fulfillment_id');
    }
}
