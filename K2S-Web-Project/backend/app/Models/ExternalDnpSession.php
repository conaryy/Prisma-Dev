<?php

namespace App\Models;

use App\Models\Concerns\RelaxedRouteBinding;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

class ExternalDnpSession extends Model
{
    use HasUuids, RelaxedRouteBinding;

    protected $table = 'external_dnp_sessions';

    public $incrementing = false;

    protected $keyType = 'string';

    protected $fillable = [
        'scope',
        'title',
        'instansi_name',
        'start_date',
        'end_date',
        'is_published',
        'team_leader',
        'team_members',
        'team_audity',
        'target_session_area_ids',
    ];

    protected $casts = [
        'start_date' => 'date',
        'end_date' => 'date',
        'is_published' => 'boolean',
        'team_members' => 'array',
        'team_audity' => 'array',
        'target_session_area_ids' => 'array',
    ];

    public function areas(): HasMany
    {
        return $this->hasMany(ExternalDnpSessionArea::class, 'session_id');
    }
}
