<?php

namespace App\Models;

use App\Models\Concerns\RelaxedRouteBinding;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;

class CertificateFulfillmentNote extends Model
{
    use HasUuids, RelaxedRouteBinding;

    protected $table = 'certificate_fulfillment_notes';

    public $incrementing = false;

    protected $keyType = 'string';

    protected $fillable = [
        'certificate_id',
        'note',
        'comment',
        'fulfillment_percentage',
        'evidence_file_name',
        'evidence_file_url',
        'evidence_files',
    ];

    protected $casts = [
        'fulfillment_percentage' => 'integer',
        'evidence_files' => 'array',
    ];
}
