<?php

namespace App\Models;

use App\Models\Concerns\RelaxedRouteBinding;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class CertificationNoteRow extends Model
{
    use HasUuids, RelaxedRouteBinding;

    public $incrementing = false;

    protected $keyType = 'string';

    protected $fillable = [
        'certification_note_table_id',
        'sort_order',
        'note',
        'action_office',
        'progress',
        'evidence_files',
    ];

    protected $casts = [
        'sort_order' => 'integer',
        'progress' => 'integer',
        'evidence_files' => 'array',
    ];

    public function table(): BelongsTo
    {
        return $this->belongsTo(CertificationNoteTable::class, 'certification_note_table_id');
    }
}
