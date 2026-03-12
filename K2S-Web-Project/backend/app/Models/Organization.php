<?php

namespace App\Models;

use App\Models\Concerns\RelaxedRouteBinding;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;

class Organization extends Model
{
    use HasUuids, RelaxedRouteBinding;

    public $incrementing = false;

    protected $keyType = 'string';

    protected $fillable = [
        'instansi_id',
        'unit_name',
        'position_name',
        'level',
        'status',
    ];
}
