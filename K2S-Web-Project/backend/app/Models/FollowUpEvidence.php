<?php

namespace App\Models;

use App\Models\Concerns\RelaxedRouteBinding;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;

class FollowUpEvidence extends Model
{
    use HasUuids, RelaxedRouteBinding;

    protected $table = 'follow_up_evidence';

    public $timestamps = false;

    public $incrementing = false;

    protected $keyType = 'string';

    protected $fillable = [
        'follow_up_id',
        'name',
        'url',
        'created_at',
    ];

    protected $casts = [
        'created_at' => 'datetime',
    ];
}
