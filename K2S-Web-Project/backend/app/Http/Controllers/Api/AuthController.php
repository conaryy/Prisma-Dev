<?php

namespace App\Http\Controllers\Api;

use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;

class AuthController extends ApiController
{
    public function login(Request $request)
    {
        $mode = (string) config('sso.mode', 'local');
        if ($mode === 'sso') {
            return response()->json([
                'error' => 'Password login is disabled. Use SSO.',
                'data' => $this->ssoConfigPayload(),
            ], 409);
        }

        $validated = $request->validate([
            'email' => ['required', 'string', 'max:255'],
            'password' => ['required', 'string', 'max:128'],
            'remember' => ['nullable', 'boolean'],
        ]);

        $user = User::query()
            ->where('email', $validated['email'])
            ->orWhere('username', $validated['email'])
            ->first();
        if (!$user || !Hash::check($validated['password'], $user->password)) {
            return response()->json(['error' => 'Invalid credentials.'], 401);
        }
        if (($user->status ?? 'Active') === 'Disabled') {
            return response()->json(['error' => 'Invalid credentials.'], 401);
        }

        $user->last_login_at = now();
        $user->save();

        $token = $user->createToken('api')->plainTextToken;

        return $this->respondData([
            'token' => $token,
            'token_type' => 'Bearer',
            'user' => $user->only(['id', 'name', 'username', 'email', 'role', 'status', 'can_access_external_dnp']),
        ]);
    }

    public function logout(Request $request)
    {
        $request->user()->currentAccessToken()?->delete();

        return $this->respondData([
            'success' => true,
            'sso' => $this->ssoConfigPayload(),
        ]);
    }

    public function me(Request $request)
    {
        return $this->respondData(
            $request->user()->only(['id', 'name', 'username', 'email', 'role', 'status', 'phone', 'position', 'can_access_external_dnp'])
        );
    }

    public function ssoConfig()
    {
        return $this->respondData($this->ssoConfigPayload());
    }

    /**
     * @return array<string, mixed>
     */
    private function ssoConfigPayload(): array
    {
        $mode = (string) config('sso.mode', 'local');
        $authorizeUrl = (string) config('sso.authorize_url', '');
        $clientId = (string) config('sso.client_id', '');
        $scope = (string) config('sso.scope', 'openid profile email');

        return [
            'mode' => $mode,
            'enabled' => in_array($mode, ['hybrid', 'sso'], true),
            'authorizeUrl' => $authorizeUrl,
            'clientId' => $clientId,
            'scope' => $scope,
            'pkceRequired' => true,
            // Optional hint for frontend cache keying across environments.
            'issuer' => (string) config('sso.issuer', ''),
        ];
    }
}
