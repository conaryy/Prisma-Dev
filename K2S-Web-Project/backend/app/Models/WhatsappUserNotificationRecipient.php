<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;

class WhatsappUserNotificationRecipient extends Model
{
    use HasUuids;

    protected $table = 'whatsapp_user_notification_recipients';

    public $incrementing = false;

    protected $keyType = 'string';

    protected $fillable = [
        'phone_number',
        'user_ids',
    ];

    protected $casts = [
        'user_ids' => 'array',
    ];
}
