<?php

namespace App\Http\Controllers\Api;

use App\Models\SystemNotification;
use Illuminate\Http\Request;

class NotificationController extends ApiController
{
    public function index(Request $request)
    {
        $validated = $request->validate([
            'limit' => ['nullable', 'integer', 'min:1', 'max:100'],
            'unread' => ['nullable', 'boolean'],
        ]);

        $limit = $validated['limit'] ?? 30;
        $userId = $request->user()->id;

        $query = SystemNotification::query()
            ->where('user_id', $userId)
            ->orderByDesc('created_at');

        if (($validated['unread'] ?? false) === true) {
            $query->whereNull('read_at');
        }

        $items = $query->limit($limit)->get();
        $unreadCount = SystemNotification::query()
            ->where('user_id', $userId)
            ->whereNull('read_at')
            ->count();

        $payload = $items->map(function (SystemNotification $item) {
            return [
                'id' => $item->id,
                'type' => $item->type,
                'title' => $item->title,
                'message' => $item->message,
                'data' => $item->data,
                'readAt' => optional($item->read_at)->toDateTimeString(),
                'createdAt' => optional($item->created_at)->toDateTimeString(),
            ];
        });

        return $this->respondData([
            'items' => $payload,
            'unreadCount' => $unreadCount,
        ]);
    }

    public function markRead(Request $request, SystemNotification $notification)
    {
        if ($notification->user_id !== $request->user()->id) {
            return response()->json(['error' => 'Forbidden.'], 403);
        }

        $notification->read_at = now();
        $notification->save();

        return $this->respondData(['success' => true]);
    }

    public function markAllRead(Request $request)
    {
        SystemNotification::query()
            ->where('user_id', $request->user()->id)
            ->whereNull('read_at')
            ->update(['read_at' => now()]);

        return $this->respondData(['success' => true]);
    }
}
