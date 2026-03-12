<?php

namespace App\Models;

use App\Models\Concerns\RelaxedRouteBinding;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;

class ExternalDnpQuestion extends Model
{
    use HasUuids, RelaxedRouteBinding;

    protected $table = 'external_dnp_questions';

    public $incrementing = false;

    protected $keyType = 'string';

    protected $fillable = [
        'scope',
        'category',
        'code',
        'text',
        'reference',
        'is_active',
        'sort_order',
    ];

    protected $casts = [
        'is_active' => 'boolean',
        'sort_order' => 'integer',
    ];
}
