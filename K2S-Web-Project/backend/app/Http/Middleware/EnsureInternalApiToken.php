<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class EnsureInternalApiToken
{
    public function handle(Request $request, Closure $next, string $scope = 'whatsapp'): Response
    {
        $envKey = match ($scope) {
            'auth-user-sync' => 'AUTH_K2S_USER_SYNC_TOKEN',
            'whatsapp' => 'WHATSAPP_BOT_INTERNAL_TOKEN',
            default => '',
        };

        if ($envKey === '') {
            return response()->json(['error' => 'Internal API token scope tidak dikenal.'], 500);
        }

        $expectedToken = trim((string) env($envKey, ''));
        if ($expectedToken === '') {
            return response()->json(['error' => 'Internal API token belum dikonfigurasi.'], 500);
        }

        $providedToken = trim((string) $request->header('X-Internal-Token', ''));
        if ($providedToken === '' || !hash_equals($expectedToken, $providedToken)) {
            return response()->json(['error' => 'Unauthorized internal access.'], 403);
        }

        return $next($request);
    }
}
