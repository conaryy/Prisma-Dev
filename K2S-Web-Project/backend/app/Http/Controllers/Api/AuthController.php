<?php

namespace App\Http\Controllers\Api;

use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;

class AuthController extends ApiController
{
    private const ADMIN_DEFAULT_PERMISSIONS = [
        'can_access_admin_portal' => true,
        'can_manage_users' => true,
        'can_manage_admin_module' => true,
        'can_access_k2s_dashboard' => true,
        'can_access_logbook' => true,
        'can_access_k3' => true,
        'can_access_keamanan' => true,
        'can_access_external_dnp' => true,
    ];

    private const VIEWER_DEFAULT_PERMISSIONS = [
        'can_access_admin_portal' => false,
        'can_manage_users' => false,
        'can_manage_admin_module' => false,
        'can_access_k2s_dashboard' => true,
        'can_access_logbook' => true,
        'can_access_k3' => false,
        'can_access_keamanan' => false,
        'can_access_external_dnp' => false,
    ];

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
            'user' => $user->only(['id', 'name', 'username', 'email', 'role', 'status', 'can_access_external_dnp', 'permissions', 'external_dnp_instansi_access']),
            'permissions' => $this->permissionsPayload($user),
            'portals' => $this->portalPayload(),
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
        $user = $request->user();
        $userData = $user->only(['id', 'name', 'username', 'email', 'role', 'status', 'phone', 'position', 'can_access_external_dnp', 'permissions', 'external_dnp_instansi_access']);

        return $this->respondData(array_merge(
            $userData,
            [
                'permissions' => $this->permissionsPayload($user),
                'portals' => $this->portalPayload(),
            ]
        ));
    }

    public function session(Request $request)
    {
        $user = $request->user();

        return $this->respondData([
            'user' => $user->only(['id', 'name', 'username', 'email', 'role', 'status', 'phone', 'position', 'can_access_external_dnp', 'permissions', 'external_dnp_instansi_access']),
            'permissions' => $this->permissionsPayload($user),
            'portals' => $this->portalPayload(),
            'sso' => $this->ssoConfigPayload(),
        ]);
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

    /**
     * @return array<string, bool>
     */
    private function permissionsPayload(User $user): array
    {
        $role = strtolower((string) ($user->role ?? 'viewer'));
        $isAdmin = $role === 'admin';
        $storedPermissions = [];
        if (is_array($user->permissions)) {
            $storedPermissions = $user->permissions;
        }

        $defaults = $isAdmin
            ? self::ADMIN_DEFAULT_PERMISSIONS
            : self::VIEWER_DEFAULT_PERMISSIONS;

        $permissions = array_replace($defaults, $storedPermissions);
        $permissions['can_access_external_dnp'] = (bool) (
            $storedPermissions['can_access_external_dnp']
            ?? $user->can_access_external_dnp
            ?? $permissions['can_access_external_dnp']
            ?? false
        );

        if (!$isAdmin) {
            // Viewer tetap tidak boleh memegang hak admin module.
            $permissions['can_access_admin_portal'] = false;
            $permissions['can_manage_users'] = false;
            $permissions['can_manage_admin_module'] = false;
        }

        return [
            'is_admin' => $isAdmin,
            'is_viewer' => !$isAdmin,
            'can_access_external_dnp' => (bool) $permissions['can_access_external_dnp'],
            'can_access_admin_portal' => (bool) $permissions['can_access_admin_portal'],
            'can_manage_users' => (bool) $permissions['can_manage_users'],
            'can_manage_admin_module' => (bool) $permissions['can_manage_admin_module'],
            'can_access_k2s_dashboard' => (bool) $permissions['can_access_k2s_dashboard'],
            'can_access_logbook' => (bool) $permissions['can_access_logbook'],
            'can_access_k3' => (bool) $permissions['can_access_k3'],
            'can_access_keamanan' => (bool) $permissions['can_access_keamanan'],
        ];
    }

    /**
     * @return array<string, string>
     */
    private function portalPayload(): array
    {
        return [
            'auth' => (string) env('AUTH_PORTAL_URL', 'http://localhost:5174'),
            'k2s' => (string) env('K2S_PORTAL_URL', 'http://localhost:5173'),
            'logbook' => (string) env('LOGBOOK_PORTAL_URL', 'http://localhost:5175'),
            'k3' => (string) env('K3_PORTAL_URL', ''),
            'keamanan' => (string) env('KEAMANAN_PORTAL_URL', ''),
        ];
    }
}
