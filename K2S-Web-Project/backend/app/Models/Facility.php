<?php

namespace App\Models;

use App\Models\Concerns\RelaxedRouteBinding;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;

class Facility extends Model
{
    use HasUuids, RelaxedRouteBinding;

    public $incrementing = false;

    protected $keyType = 'string';

    protected $fillable = [
        'instansi_id',
        'facility_group',
        'name',
        'merk',
        'type',
        'frequency',
        'ident',
        'condition_status',
    ];
}
