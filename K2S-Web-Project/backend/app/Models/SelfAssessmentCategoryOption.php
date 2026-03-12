<?php

namespace App\Models;

use App\Models\Concerns\RelaxedRouteBinding;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;

class SelfAssessmentCategoryOption extends Model
{
    use HasUuids, RelaxedRouteBinding;

    protected $table = 'self_assessment_category_options';

    public $incrementing = false;

    protected $keyType = 'string';

    protected $fillable = [
        'scope',
        'name',
        'is_active',
        'sort_order',
    ];

    protected $casts = [
        'is_active' => 'boolean',
        'sort_order' => 'integer',
    ];
}
