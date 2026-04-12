<?php

namespace App\Models;

use App\Models\Concerns\RelaxedRouteBinding;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class SelfAssessmentExportDnpSnapshot extends Model
{
    use HasUuids, RelaxedRouteBinding;

    protected $table = 'self_assessment_export_dnp_snapshots';

    public $incrementing = false;

    protected $keyType = 'string';

    protected $fillable = [
        'session_area_id',
        'user_id',
        'imported_by',
        'scope',
        'year',
        'wrapper_session_id',
        'fill_code1',
        'fill_code2',
        'fill_area',
        'local_area',
        'summary',
        'imported_at',
    ];

    protected $casts = [
        'year' => 'integer',
        'summary' => 'array',
        'imported_at' => 'datetime',
    ];

    public function items(): HasMany
    {
        return $this->hasMany(SelfAssessmentExportDnpSnapshotItem::class, 'snapshot_id');
    }

    public function area(): BelongsTo
    {
        return $this->belongsTo(SelfAssessmentSessionArea::class, 'session_area_id');
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class, 'user_id');
    }
}
