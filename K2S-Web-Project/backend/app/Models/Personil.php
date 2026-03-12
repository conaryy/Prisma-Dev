<?php

namespace App\Models;

use App\Models\Concerns\RelaxedRouteBinding;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;

class Personil extends Model
{
    use HasUuids, RelaxedRouteBinding;

    protected $table = 'personil';

    public $incrementing = false;

    protected $keyType = 'string';

    protected $fillable = [
        'instansi_id',
        'name',
        'position',
        'level',
        'field_name',
        'tier',
    ];
}
