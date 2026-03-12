<?php

namespace App\Models;

use App\Models\Concerns\RelaxedRouteBinding;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;

class SelfAssessmentAreaQuestionCategory extends Model
{
    use HasUuids, RelaxedRouteBinding;

    protected $table = 'self_assessment_area_question_categories';

    public $incrementing = false;

    protected $keyType = 'string';

    protected $fillable = [
        'scope',
        'area',
        'question_category_id',
    ];
}
