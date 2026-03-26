<?php

namespace App\Http\Middleware;

use App\Security\Sso\OidcTokenValidator;
use App\Security\Sso\SsoUserSynchronizer;
use Closure;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Symfony\Component\HttpFoundation\Response;
use Throwable;

class AuthenticateApiRequest
{
    public function __construct(
        private readonly OidcTokenValidator $oidcTokenValidator,
        private readonly SsoUserSynchronizer $ssoUserSynchronizer
    ) {
    }

    public function handle(Request $request, Closure $next): Response
    {
        $mode = (string) config('sso.mode', 'local');

        if ($mode !== 'sso') {
            $sanctumUser = Auth::guard('sanctum')->user();
            if ($sanctumUser) {
                Auth::setUser($sanctumUser);
                $request->setUserResolver(static fn () => $sanctumUser);

                return $next($request);
            }

            if ($mode === 'local') {
                return response()->json(['error' => 'Unauthenticated.'], 401);
            }
        }

        $token = $request->bearerToken();
        if (!$token) {
            return response()->json(['error' => 'Unauthenticated.'], 401);
        }

        try {
            $claims = $this->oidcTokenValidator->validate($token);
            $user = $this->ssoUserSynchronizer->sync($claims);
            if (!$user) {
                return response()->json(['error' => 'Unauthenticated.'], 401);
            }

            Auth::setUser($user);
            $request->setUserResolver(static fn () => $user);
        } catch (Throwable $exception) {
            $error = config('app.debug')
                ? $exception->getMessage()
                : 'Unauthenticated.';

            return response()->json(['error' => $error], 401);
        }

        return $next($request);
    }
}
