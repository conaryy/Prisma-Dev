<?php

namespace App\Http\Controllers\Api;

use App\Models\SystemNotification;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\URL;

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

    public function streamUrl(Request $request)
    {
        $userId = $request->user()->id;
        $since = $request->query('since');

        $parameters = ['user' => $userId];
        if ($since) {
            $parameters['since'] = $since;
        }

        $url = URL::temporarySignedRoute(
            'notifications.stream',
            now()->addMinutes(5),
            $parameters
        );

        return $this->respondData(['url' => $url]);
    }

    public function stream(Request $request)
    {
        $userId = $request->query('user');
        if (!$userId) {
            return response()->json(['error' => 'Unauthorized.'], 401);
        }

        $user = User::query()->find($userId);
        if (!$user) {
            return response()->json(['error' => 'Unauthorized.'], 401);
        }

        $since = $request->query('since');
        $sinceDate = $since ? date_create($since) : null;
        if ($sinceDate === false) {
            $sinceDate = null;
        }
        $pollSeconds = 5;
        $maxSeconds = 60;

        return response()->stream(function () use ($user, $sinceDate, $pollSeconds, $maxSeconds) {
            if (function_exists('apache_setenv')) {
                @apache_setenv('no-gzip', '1');
            }
            @ini_set('zlib.output_compression', '0');
            @ini_set('implicit_flush', '1');
            @ini_set('output_buffering', '0');
            @ini_set('max_execution_time', '0');
            @set_time_limit(0);

            while (ob_get_level() > 0) {
                @ob_end_flush();
            }
            @ob_implicit_flush(true);
            if (session_status() === PHP_SESSION_ACTIVE) {
                @session_write_close();
            }

            $start = time();
            $lastUnread = null;
            $lastCreatedAt = $sinceDate ? $sinceDate->format('Y-m-d H:i:s') : null;

            while (true) {
                if (connection_aborted()) {
                    break;
                }

                $query = SystemNotification::query()
                    ->where('user_id', $user->id)
                    ->orderBy('created_at');

                if ($lastCreatedAt) {
                    $query->where('created_at', '>', $lastCreatedAt);
                }

                $items = $query->get();
                $latestCreatedAt = $items->last()?->created_at?->toDateTimeString();

                $unreadCount = SystemNotification::query()
                    ->where('user_id', $user->id)
                    ->whereNull('read_at')
                    ->count();

                if ($lastUnread === null || $unreadCount !== $lastUnread || $items->isNotEmpty()) {
                    $payload = [
                        'items' => $items->map(function (SystemNotification $item) {
                            return [
                                'id' => $item->id,
                                'type' => $item->type,
                                'title' => $item->title,
                                'message' => $item->message,
                                'data' => $item->data,
                                'readAt' => optional($item->read_at)->toDateTimeString(),
                                'createdAt' => optional($item->created_at)->toDateTimeString(),
                            ];
                        })->values(),
                        'unreadCount' => $unreadCount,
                        'lastCreatedAt' => $latestCreatedAt,
                    ];
                    echo "event: notification\n";
                    echo 'data: ' . json_encode($payload) . "\n\n";
                } else {
                    echo "event: ping\n";
                    echo "data: {}\n\n";
                }

                @ob_flush();
                @flush();

                $lastUnread = $unreadCount;
                if ($latestCreatedAt) {
                    $lastCreatedAt = $latestCreatedAt;
                }

                if ((time() - $start) >= $maxSeconds) {
                    break;
                }

                sleep($pollSeconds);
            }
        }, 200, [
            'Content-Type' => 'text/event-stream',
            'Cache-Control' => 'no-cache',
            'Connection' => 'keep-alive',
            'X-Accel-Buffering' => 'no',
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
