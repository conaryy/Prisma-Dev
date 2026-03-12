<?php

namespace App\Models;

use App\Models\Concerns\RelaxedRouteBinding;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasOne;

class SelfAssessmentAnswer extends Model
{
    use HasUuids, RelaxedRouteBinding;

    protected $table = 'self_assessment_answers';

    public $incrementing = false;

    protected $keyType = 'string';

    protected $fillable = [
        'session_area_id',
        'user_id',
        'question_code',
        'status',
        'comment',
        'evidence_note',
        'is_submitted',
        'submitted_at',
    ];

    protected $casts = [
        'is_submitted' => 'boolean',
        'submitted_at' => 'datetime',
    ];

    public function sessionArea(): BelongsTo
    {
        return $this->belongsTo(SelfAssessmentSessionArea::class, 'session_area_id');
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class, 'user_id');
    }

    public function review(): HasOne
    {
        return $this->hasOne(SelfAssessmentReview::class, 'answer_id');
    }
}
