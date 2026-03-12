<?php

namespace App\Models;

use App\Models\Concerns\RelaxedRouteBinding;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;

class SelfAssessmentAreaTeam extends Model
{
    use HasUuids, RelaxedRouteBinding;

    protected $table = 'self_assessment_area_teams';

    public $incrementing = false;

    protected $keyType = 'string';

    protected $fillable = [
        'session_area_id',
        'user_id',
        'leader',
        'dnp',
        'kobo',
    ];

    protected $casts = [
        'dnp' => 'array',
        'kobo' => 'array',
    ];
}
