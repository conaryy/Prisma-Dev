<?php

namespace App\Models;

use App\Models\Concerns\RelaxedRouteBinding;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;

class Instansi extends Model
{
    use HasUuids, RelaxedRouteBinding;

    protected $table = 'instansi';

    public $incrementing = false;

    protected $keyType = 'string';

    protected $fillable = [
        'user_id',
        'facility_group',
        'kobu',
        'bandara',
        'cabang_airnav',
        'name',
        'alias',
        'address',
        'contact_name',
        'contact_email',
        'contact_phone',
        'fax',
        'postal_code',
        'longitude',
        'latitude',
        'service_area',
        'operating_hours',
        'traffic_type',
        'runway_capacity',
        'runway_condition',
        'location',
    ];
}
