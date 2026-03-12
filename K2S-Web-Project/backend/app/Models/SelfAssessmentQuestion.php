<?php

namespace App\Models;

use App\Models\Concerns\RelaxedRouteBinding;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;

class SelfAssessmentQuestion extends Model
{
    use HasUuids, RelaxedRouteBinding;

    protected $table = 'self_assessment_questions';

    public $incrementing = false;

    protected $keyType = 'string';

    protected $fillable = [
        'scope',
        'category',
        'question_category',
        'question_category_prefix',
        'code',
        'text',
        'reference',
        'is_active',
        'sort_order',
    ];

    protected $casts = [
        'is_active' => 'boolean',
        'sort_order' => 'integer',
    ];
}
