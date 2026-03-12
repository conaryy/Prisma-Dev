<?php

namespace App\Models;

use App\Models\Concerns\RelaxedRouteBinding;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasOne;

class ExternalDnpAnswer extends Model
{
    use HasUuids, RelaxedRouteBinding;

    protected $table = 'external_dnp_answers';

    public $incrementing = false;

    protected $keyType = 'string';

    protected $fillable = [
        'external_answer_id',
        'session_area_id',
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
        return $this->belongsTo(ExternalDnpSessionArea::class, 'session_area_id');
    }

    public function review(): HasOne
    {
        return $this->hasOne(ExternalDnpReview::class, 'answer_id');
    }
}
