<?php

namespace App\Http\Controllers\Api;

use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;

class UserController extends ApiController
{
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
            'password' => ['required', 'min:8'],
            'role' => ['required', 'in:Admin,Viewer'],
            'status' => ['nullable', 'in:Active,Disabled'],
            'can_access_external_dnp' => ['nullable', 'boolean'],
        ]);

        $email = isset($validated['email']) ? trim((string) $validated['email']) : '';

        $user = User::create([
            'name' => $validated['name'],
            'username' => $validated['username'],
            'email' => $email !== '' ? $email : null,
            'password' => Hash::make($validated['password']),
            'role' => $validated['role'],
            'status' => $validated['status'] ?? 'Active',
            'can_access_external_dnp' => (bool) ($validated['can_access_external_dnp'] ?? false),
        ]);

        return $this->respondData($user->only(['id', 'name', 'username', 'email', 'role', 'status', 'can_access_external_dnp']), 201);
    }

    /**
     * Display the specified resource.
     */
    public function show(User $user)
    {
        return $this->respondData($user->only(['id', 'name', 'username', 'email', 'role', 'status', 'can_access_external_dnp']));
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
            'password' => ['sometimes', 'min:8'],
            'role' => ['sometimes', 'in:Admin,Viewer'],
            'status' => ['sometimes', 'in:Active,Disabled'],
            'can_access_external_dnp' => ['sometimes', 'boolean'],
        ]);

        if (isset($validated['password'])) {
            $validated['password'] = Hash::make($validated['password']);
        }
        if (array_key_exists('email', $validated)) {
            $email = trim((string) ($validated['email'] ?? ''));
            $validated['email'] = $email !== '' ? $email : null;
        }

        $user->fill($validated);
        $user->save();

        return $this->respondData($user->only(['id', 'name', 'username', 'email', 'role', 'status', 'can_access_external_dnp']));
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
            'user' => $user->only(['id', 'name', 'username', 'email', 'role', 'status', 'can_access_external_dnp']),
            'password_reset' => true,
            'logged_out_sessions' => (bool) ($validated['logout_sessions'] ?? true),
        ]);
    }
}
