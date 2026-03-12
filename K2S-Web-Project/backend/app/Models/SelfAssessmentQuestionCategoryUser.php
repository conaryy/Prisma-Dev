<?php

namespace App\Models;

use App\Models\Concerns\RelaxedRouteBinding;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class SelfAssessmentQuestionCategoryUser extends Model
{
    use HasUuids, RelaxedRouteBinding;

    protected $table = 'self_assessment_question_category_users';

    public $incrementing = false;

    protected $keyType = 'string';

    protected $fillable = [
        'question_category_id',
        'user_id',
    ];

    public function questionCategory(): BelongsTo
    {
        return $this->belongsTo(SelfAssessmentQuestionCategory::class, 'question_category_id');
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class, 'user_id');
    }
}
