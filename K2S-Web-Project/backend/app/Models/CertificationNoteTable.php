<?php

namespace App\Models;

use App\Models\Concerns\RelaxedRouteBinding;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class CertificationNoteTable extends Model
{
    use HasUuids, RelaxedRouteBinding;

    public $incrementing = false;

    protected $keyType = 'string';

    protected $fillable = [
        'instansi_id',
        'location_slug',
        'title',
        'sort_order',
    ];

    protected $casts = [
        'sort_order' => 'integer',
    ];

    public function instansi(): BelongsTo
    {
        return $this->belongsTo(Instansi::class);
    }

    public function rows(): HasMany
    {
        return $this->hasMany(CertificationNoteRow::class)->orderBy('sort_order');
    }
}
