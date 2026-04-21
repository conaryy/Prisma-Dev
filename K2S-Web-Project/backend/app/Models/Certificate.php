<?php

namespace App\Models;

use App\Models\Concerns\RelaxedRouteBinding;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;

class Certificate extends Model
{
    use HasUuids, RelaxedRouteBinding;

    public $incrementing = false;

    protected $keyType = 'string';

    protected $fillable = [
        'instansi_id',
        'name',
        'type',
        'number',
        'valid_until',
        'status',
        'evidence_type',
        'file_name',
        'file_url',
    ];

    protected $casts = [
        'valid_until' => 'date',
    ];
}
