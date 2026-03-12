<?php

namespace App\Models;

use App\Models\Concerns\RelaxedRouteBinding;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;

class SelfAssessmentEvidence extends Model
{
    use HasUuids, RelaxedRouteBinding;

    protected $table = 'self_assessment_evidence';

    public $timestamps = false;

    public $incrementing = false;

    protected $keyType = 'string';

    protected $fillable = [
        'session_area_id',
        'user_id',
        'question_code',
        'name',
        'url',
        'created_at',
    ];

    protected $casts = [
        'created_at' => 'datetime',
    ];
}
