<?php

namespace App\Models;

use App\Models\Concerns\RelaxedRouteBinding;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class ExternalDnpReview extends Model
{
    use HasUuids, RelaxedRouteBinding;

    protected $table = 'external_dnp_reviews';

    public $incrementing = false;

    protected $keyType = 'string';

    protected $fillable = [
        'answer_id',
        'reviewer_id',
        'status',
        'comment',
        'severity',
        'probability',
        'resume',
        'description',
        'finding',
        'recommendations',
        'remark',
        'allow_reply',
        'is_final',
        'sent_at',
    ];

    protected $casts = [
        'allow_reply' => 'boolean',
        'is_final' => 'boolean',
        'sent_at' => 'datetime',
    ];

    public function answer(): BelongsTo
    {
        return $this->belongsTo(ExternalDnpAnswer::class, 'answer_id');
    }

    public function reviewer(): BelongsTo
    {
        return $this->belongsTo(User::class, 'reviewer_id');
    }
}
