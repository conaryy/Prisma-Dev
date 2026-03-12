<?php

namespace App\Models;

use App\Models\Concerns\RelaxedRouteBinding;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;

class Monitoring extends Model
{
    use HasUuids, RelaxedRouteBinding;

    protected $table = 'monitoring';

    public $incrementing = false;

    protected $keyType = 'string';

    protected $fillable = [
        'date',
        'location',
        'status',
        'note',
    ];

    protected $casts = [
        'date' => 'date',
    ];
}
