<?php

namespace App\Models;

use App\Models\Concerns\RelaxedRouteBinding;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;

class Agenda extends Model
{
    use HasUuids, RelaxedRouteBinding;

    protected $table = 'agenda';

    public $incrementing = false;

    protected $keyType = 'string';

    protected $fillable = [
        'date',
        'activity_type',
        'location',
        'status',
    ];

    protected $casts = [
        'date' => 'date',
    ];
}
