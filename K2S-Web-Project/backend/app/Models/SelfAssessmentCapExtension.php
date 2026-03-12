<?php

namespace App\Models;

use App\Models\Concerns\RelaxedRouteBinding;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class SelfAssessmentCapExtension extends Model
{
    use HasUuids, RelaxedRouteBinding;

    protected $table = 'self_assessment_cap_extensions';

    public $incrementing = false;

    protected $keyType = 'string';

    protected $fillable = [
        'cap_id',
        'due_date',
        'file_name',
        'file_url',
        'status',
    ];

    protected $casts = [
        'due_date' => 'date',
    ];

    public function cap(): BelongsTo
    {
        return $this->belongsTo(SelfAssessmentCap::class, 'cap_id');
    }
}
