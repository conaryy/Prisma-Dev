<?php

namespace App\Models;

use App\Models\Concerns\RelaxedRouteBinding;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class ExternalDnpCapReview extends Model
{
    use HasUuids, RelaxedRouteBinding;

    protected $table = 'external_dnp_cap_reviews';

    public $incrementing = false;

    protected $keyType = 'string';

    protected $fillable = [
        'cap_id',
        'reviewer_id',
        'result',
        'comment',
        'status',
        'reviewed_at',
    ];

    protected $casts = [
        'reviewed_at' => 'datetime',
    ];

    public function cap(): BelongsTo
    {
        return $this->belongsTo(ExternalDnpCap::class, 'cap_id');
    }

    public function reviewer(): BelongsTo
    {
        return $this->belongsTo(User::class, 'reviewer_id');
    }
}
