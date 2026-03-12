<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class EnsureExternalDnpAccess
{
    public function handle(Request $request, Closure $next): Response
    {
        $user = $request->user();

        if (!$user) {
            return response()->json(['error' => 'Unauthenticated.'], 401);
        }

        if ((bool) ($user->can_access_external_dnp ?? false) !== true) {
            return response()->json(['error' => 'External DNP access required.'], 403);
        }

        return $next($request);
    }
}

