<?php

namespace App\Security\Sso;

use App\Models\User;
use Illuminate\Support\Arr;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

class SsoUserSynchronizer
{
    /**
     * @param  array<string, mixed>  $claims
     */
    public function sync(array $claims): ?User
    {
        $subjectClaim = (string) config('sso.claims.subject', 'sub');
        $emailClaim = (string) config('sso.claims.email', 'email');
        $usernameClaim = (string) config('sso.claims.username', 'preferred_username');
        $nameClaim = (string) config('sso.claims.name', 'name');

        $subject = $this->toString(Arr::get($claims, $subjectClaim));
        $email = strtolower($this->toString(Arr::get($claims, $emailClaim)));
        $username = $this->toString(Arr::get($claims, $usernameClaim));
        $name = $this->toString(Arr::get($claims, $nameClaim));
        $phone = $this->normalizePhone($this->toString(Arr::get($claims, 'phone')));

        if ($subject === '' && $email === '' && $username === '') {
            return null;
        }

        $roles = $this->extractRoles($claims);
        $localRole = $this->mapLocalRole($roles);
        $canAccessExternalDnp = $this->hasExternalDnpAccess($roles);

        return DB::transaction(function () use (
            $subject,
            $email,
            $username,
            $name,
            $phone,
            $localRole,
            $canAccessExternalDnp
        ) {
            $query = User::query();
            if ($subject !== '') {
                $query->orWhere('sso_subject', $subject);
            }
            if ($email !== '') {
                $query->orWhere('email', $email);
            }
            if ($username !== '') {
                $query->orWhere('username', $username);
            }

            $user = $query->first();
            $shouldProvision = (bool) config('sso.provision_users', false);

            if (!$user && !$shouldProvision) {
                return null;
            }

            if (!$user) {
                $user = new User();
                $user->password = Str::password(40);
                $user->status = 'Active';
            }

            if ($subject !== '') {
                $user->sso_subject = $subject;
            }
            if ($email !== '') {
                $user->email = $email;
            }
            if ($username !== '') {
                $user->username = $username;
            }
            $user->phone = $phone !== '' ? $phone : null;

            if ($name !== '') {
                $user->name = $name;
            } elseif (!$user->name) {
                $fallbackName = $username !== '' ? $username : $email;
                $user->name = $fallbackName !== '' ? $fallbackName : 'SSO User';
            }

            $user->role = $localRole;
            $user->can_access_external_dnp = $canAccessExternalDnp;
            $user->last_sso_login_at = now();
            $user->last_login_at = now();
            $user->save();

            return $user;
        });
    }

    /**
     * @param  array<string, mixed>  $claims
     * @return array<int, string>
     */
    private function extractRoles(array $claims): array
    {
        $roles = [];

        $realmRoles = Arr::get($claims, 'realm_access.roles');
        if (is_array($realmRoles)) {
            foreach ($realmRoles as $role) {
                if (is_string($role) && $role !== '') {
                    $roles[] = strtolower($role);
                }
            }
        }

        $resourceAccess = Arr::get($claims, 'resource_access');
        if (is_array($resourceAccess)) {
            foreach ($resourceAccess as $clientAccess) {
                if (!is_array($clientAccess)) {
                    continue;
                }
                foreach (($clientAccess['roles'] ?? []) as $role) {
                    if (is_string($role) && $role !== '') {
                        $roles[] = strtolower($role);
                    }
                }
            }
        }

        $directRoles = Arr::get($claims, 'roles');
        if (is_array($directRoles)) {
            foreach ($directRoles as $role) {
                if (is_string($role) && $role !== '') {
                    $roles[] = strtolower($role);
                }
            }
        }

        // Support simple role claim from internal Auth service.
        $singleRole = Arr::get($claims, 'role');
        if (is_string($singleRole) && trim($singleRole) !== '') {
            $roles[] = strtolower(trim($singleRole));
        }

        // Bridge permission-based claims into pseudo roles for mapping.
        $permissions = Arr::get($claims, 'permissions');
        if (is_array($permissions)) {
            if (($permissions['can_access_admin_portal'] ?? false) === true
                || ($permissions['can_manage_admin_module'] ?? false) === true) {
                $roles[] = 'admin';
            }
            if (($permissions['can_access_external_dnp'] ?? false) === true) {
                $roles[] = 'external_dnp';
            }
        }

        return array_values(array_unique($roles));
    }

    /**
     * @param  array<int, string>  $roles
     */
    private function mapLocalRole(array $roles): string
    {
        $lookup = array_flip($roles);

        foreach (['admin' => 'Admin', 'viewer' => 'Viewer'] as $bucket => $localRole) {
            $candidates = array_map(
                static fn (string $role): string => strtolower(trim($role)),
                (array) config("sso.roles.$bucket", [])
            );

            foreach ($candidates as $candidate) {
                if ($candidate !== '' && isset($lookup[$candidate])) {
                    return $localRole;
                }
            }
        }

        return 'Viewer';
    }

    /**
     * @param  array<int, string>  $roles
     */
    private function hasExternalDnpAccess(array $roles): bool
    {
        $lookup = array_flip($roles);
        $candidates = array_map(
            static fn (string $role): string => strtolower(trim($role)),
            (array) config('sso.roles.external_dnp', [])
        );

        foreach ($candidates as $candidate) {
            if ($candidate !== '' && isset($lookup[$candidate])) {
                return true;
            }
        }

        return false;
    }

    private function toString(mixed $value): string
    {
        return is_string($value) ? trim($value) : '';
    }

    private function normalizePhone(string $value): string
    {
        $phone = preg_replace('/[\s().-]+/', '', $value) ?? '';

        return preg_match('/^62\d{7,15}$/', $phone) === 1 ? $phone : '';
    }
}
