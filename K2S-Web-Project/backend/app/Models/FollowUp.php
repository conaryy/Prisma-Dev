<?php

namespace App\Models;

use App\Models\Concerns\RelaxedRouteBinding;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;

class FollowUp extends Model
{
    use HasUuids, RelaxedRouteBinding;

    public $incrementing = false;

    protected $keyType = 'string';

    protected $fillable = [
        'finding_id',
        'aksi_perbaikan',
        'pic',
        'target_date',
        'status',
    ];

    protected $casts = [
        'target_date' => 'date',
    ];
}
