<?php

namespace App\Models;

use App\Models\Concerns\RelaxedRouteBinding;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\Relations\HasMany;

class SelfAssessmentSession extends Model
{
    use HasUuids, RelaxedRouteBinding;

    protected $table = 'self_assessment_sessions';

    public $incrementing = false;

    protected $keyType = 'string';

    protected $fillable = [
        'scope',
        'title',
        'team_leader',
        'team_members',
        'team_audity',
        'file_name',
        'file_url',
        'start_date',
        'end_date',
        'is_published',
        'target_session_area_ids',
        'target_agenda_ids',
    ];

    protected $casts = [
        'start_date' => 'date',
        'end_date' => 'date',
        'is_published' => 'boolean',
        'team_members' => 'array',
        'team_audity' => 'array',
        'target_session_area_ids' => 'array',
        'target_agenda_ids' => 'array',
    ];

    public function sessionUsers(): HasMany
    {
        return $this->hasMany(SelfAssessmentSessionUser::class, 'session_id');
    }

    public function users(): BelongsToMany
    {
        return $this->belongsToMany(
            User::class,
            'self_assessment_session_users',
            'session_id',
            'user_id'
        )->withTimestamps();
    }
}
