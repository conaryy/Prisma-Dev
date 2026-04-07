<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;

class WhatsappNotificationPanel extends Model
{
    use HasUuids;

    protected $table = 'whatsapp_notification_panels';

    public $incrementing = false;

    protected $keyType = 'string';

    protected $fillable = [
        'panel',
        'enabled',
        'phone_numbers',
    ];

    protected $casts = [
        'enabled' => 'boolean',
        'phone_numbers' => 'array',
    ];
}
