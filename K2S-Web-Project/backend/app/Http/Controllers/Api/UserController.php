<?php

namespace App\Http\Controllers\Api;

use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;

class UserController extends ApiController
{
    private const PERMISSION_KEYS = [
        'can_access_admin_portal',
        'can_manage_users',
        'can_manage_admin_module',
        'can_access_k2s_dashboard',
        'can_access_logbook',
        'can_access_k3',
        'can_access_keamanan',
        'can_access_external_dnp',
    ];

    /**
     * Display a listing of the resource.
     */
    public function index(Request $request)
    {
        $limit = (int) $request->query('limit', 20);
        $users = User::query()->paginate($limit);
        return $this->respondPaginated($users);
    }

    /**
     * Store a newly created resource in storage.
     */
    public function store(Request $request)
    {
        $validated = $request->validate([
            'name' => ['required', 'min:2'],
            'username' => ['required', 'string', 'max:50', 'unique:users,username'],
            'email' => ['nullable', 'string', 'max:255', 'unique:users,email'],
            'phone' => ['nullable', 'string', 'regex:/^628\d{7,15}$/'],
            'password' => ['required', 'min:8'],
            'role' => ['required', 'in:Admin,Viewer'],
            'status' => ['nullable', 'in:Active,Disabled'],
            'can_access_external_dnp' => ['nullable', 'boolean'],
            'permissions' => ['nullable', 'array'],
            'permissions.can_access_admin_portal' => ['sometimes', 'boolean'],
            'permissions.can_manage_users' => ['sometimes', 'boolean'],
            'permissions.can_manage_admin_module' => ['sometimes', 'boolean'],
            'permissions.can_access_k2s_dashboard' => ['sometimes', 'boolean'],
            'permissions.can_access_logbook' => ['sometimes', 'boolean'],
            'permissions.can_access_k3' => ['sometimes', 'boolean'],
            'permissions.can_access_keamanan' => ['sometimes', 'boolean'],
            'permissions.can_access_external_dnp' => ['sometimes', 'boolean'],
        ]);

        $email = isset($validated['email']) ? trim((string) $validated['email']) : '';
        $phone = isset($validated['phone']) ? trim((string) $validated['phone']) : '';
        $permissions = $this->applyRolePermissionRules(
            $this->normalizePermissions($validated['permissions'] ?? null),
            $validated['role']
        );
        $canAccessExternalDnp =
            $permissions['can_access_external_dnp']
            ?? (bool) ($validated['can_access_external_dnp'] ?? false);

        $user = User::create([
            'name' => $validated['name'],
            'username' => $validated['username'],
            'email' => $email !== '' ? $email : null,
            'phone' => $phone !== '' ? $phone : null,
            'password' => Hash::make($validated['password']),
            'role' => $validated['role'],
            'status' => $validated['status'] ?? 'Active',
            'can_access_external_dnp' => $canAccessExternalDnp,
            'permissions' => $permissions,
        ]);

        return $this->respondData($user->only(['id', 'name', 'username', 'email', 'phone', 'role', 'status', 'can_access_external_dnp', 'permissions']), 201);
    }

    /**
     * Display the specified resource.
     */
    public function show(User $user)
    {
        return $this->respondData($user->only(['id', 'name', 'username', 'email', 'phone', 'role', 'status', 'can_access_external_dnp', 'permissions']));
    }

    /**
     * Update the specified resource in storage.
     */
    public function update(Request $request, User $user)
    {
        $validated = $request->validate([
            'name' => ['sometimes', 'min:2'],
            'username' => ['sometimes', 'string', 'max:50', 'unique:users,username,' . $user->id],
            'email' => ['sometimes', 'nullable', 'string', 'max:255', 'unique:users,email,' . $user->id],
            'phone' => ['sometimes', 'nullable', 'string', 'regex:/^628\d{7,15}$/'],
            'password' => ['sometimes', 'min:8'],
            'role' => ['sometimes', 'in:Admin,Viewer'],
            'status' => ['sometimes', 'in:Active,Disabled'],
            'can_access_external_dnp' => ['sometimes', 'boolean'],
            'permissions' => ['sometimes', 'nullable', 'array'],
            'permissions.can_access_admin_portal' => ['sometimes', 'boolean'],
            'permissions.can_manage_users' => ['sometimes', 'boolean'],
            'permissions.can_manage_admin_module' => ['sometimes', 'boolean'],
            'permissions.can_access_k2s_dashboard' => ['sometimes', 'boolean'],
            'permissions.can_access_logbook' => ['sometimes', 'boolean'],
            'permissions.can_access_k3' => ['sometimes', 'boolean'],
            'permissions.can_access_keamanan' => ['sometimes', 'boolean'],
            'permissions.can_access_external_dnp' => ['sometimes', 'boolean'],
        ]);

        if (isset($validated['password'])) {
            $validated['password'] = Hash::make($validated['password']);
        }
        if (array_key_exists('email', $validated)) {
            $email = trim((string) ($validated['email'] ?? ''));
            $validated['email'] = $email !== '' ? $email : null;
        }
        if (array_key_exists('phone', $validated)) {
            $phone = trim((string) ($validated['phone'] ?? ''));
            $validated['phone'] = $phone !== '' ? $phone : null;
        }
        if (array_key_exists('permissions', $validated)) {
            $validated['permissions'] = $this->normalizePermissions($validated['permissions']);
            $validated['can_access_external_dnp'] =
                $validated['permissions']['can_access_external_dnp']
                ?? (bool) ($validated['can_access_external_dnp'] ?? false);
        } elseif (array_key_exists('can_access_external_dnp', $validated)) {
            $currentPermissions = $this->normalizePermissions($user->permissions);
            $currentPermissions['can_access_external_dnp'] = (bool) $validated['can_access_external_dnp'];
            $validated['permissions'] = $currentPermissions;
        }

        if (array_key_exists('permissions', $validated) || array_key_exists('role', $validated)) {
            $effectiveRole = (string) ($validated['role'] ?? $user->role ?? 'Viewer');
            $validated['permissions'] = $this->applyRolePermissionRules(
                $this->normalizePermissions($validated['permissions'] ?? $user->permissions),
                $effectiveRole
            );
            $validated['can_access_external_dnp'] = (bool) ($validated['permissions']['can_access_external_dnp'] ?? false);
        }

        $user->fill($validated);
        $user->save();

        return $this->respondData($user->only(['id', 'name', 'username', 'email', 'phone', 'role', 'status', 'can_access_external_dnp', 'permissions']));
    }

    /**
     * Remove the specified resource from storage.
     */
    public function destroy(User $user)
    {
        $user->delete();
        return $this->respondData(['success' => true]);
    }

    /**
     * Reset user password (admin only).
     */
    public function resetPassword(Request $request, User $user)
    {
        $validated = $request->validate([
            'password' => ['required', 'string', 'min:8', 'max:128', 'confirmed'],
            'logout_sessions' => ['nullable', 'boolean'],
        ]);

        $user->password = Hash::make($validated['password']);
        $user->save();

        if (($validated['logout_sessions'] ?? true) === true) {
            $user->tokens()->delete();
        }

        return $this->respondData([
            'user' => $user->only(['id', 'name', 'username', 'email', 'phone', 'role', 'status', 'can_access_external_dnp', 'permissions']),
            'password_reset' => true,
            'logged_out_sessions' => (bool) ($validated['logout_sessions'] ?? true),
        ]);
    }

    /**
     * @param  array<string, mixed>|null  $permissions
     * @return array<string, bool>
     */
    private function normalizePermissions(?array $permissions): array
    {
        $normalized = [];

        foreach (self::PERMISSION_KEYS as $key) {
            if (array_key_exists($key, $permissions ?? [])) {
                $normalized[$key] = (bool) $permissions[$key];
            }
        }

        return $normalized;
    }

    /**
     * @param  array<string, bool>  $permissions
     * @return array<string, bool>
     */
    private function applyRolePermissionRules(array $permissions, string $role): array
    {
        if (strtolower($role) !== 'admin') {
            $permissions['can_access_admin_portal'] = false;
            $permissions['can_manage_users'] = false;
            $permissions['can_manage_admin_module'] = false;
        }

        return $permissions;
    }
}
