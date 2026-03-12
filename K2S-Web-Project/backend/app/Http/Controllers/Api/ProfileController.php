<?php

namespace App\Http\Controllers\Api;

use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;

class ProfileController extends ApiController
{
    public function update(Request $request)
    {
        $user = $request->user();

        $validated = $request->validate([
            'name' => ['required', 'min:2'],
            'email' => ['required', 'min:3', 'unique:users,email,' . $user->id],
            'phone' => ['nullable', 'min:6'],
            'position' => ['nullable', 'min:2'],
        ]);

        $user->fill($validated);
        $user->save();

        return $this->respondData($user->only([
            'id',
            'name',
            'email',
            'role',
            'status',
            'phone',
            'position',
        ]));
    }

    public function changePassword(Request $request)
    {
        $user = $request->user();

        $validated = $request->validate([
            'current_password' => ['required'],
            'password' => ['required', 'min:8', 'confirmed'],
        ]);

        if (!Hash::check($validated['current_password'], $user->password)) {
            return response()->json(['error' => 'Current password is incorrect.'], 422);
        }

        $user->password = $validated['password'];
        $user->save();

        return $this->respondData(['success' => true]);
    }
}
