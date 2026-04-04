<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class EnsureInternalApiToken
{
    public function handle(Request $request, Closure $next): Response
    {
        $expectedToken = trim((string) env('WHATSAPP_BOT_INTERNAL_TOKEN', ''));
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
