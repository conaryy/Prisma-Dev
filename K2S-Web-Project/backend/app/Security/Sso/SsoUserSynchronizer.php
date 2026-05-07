<?php

namespace App\Security\Sso;

use App\Models\User;
use App\Support\CertificationNoteLocationAccess;
use App\Support\ExternalDnpInstansiAccess;
use Illuminate\Support\Arr;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Str;

class SsoUserSynchronizer
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

    private ?bool $supportsExternalDnpInstansiAccessColumn = null;
    private ?bool $supportsCertificationNoteLocationAccessColumn = null;

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
        $externalDnpInstansiAccess = $this->extractExternalDnpInstansiAccess($claims);
        $certificationNoteLocationAccess = $this->extractCertificationNoteLocationAccess($claims);
        $permissions = $this->extractPermissions($claims, $localRole, $canAccessExternalDnp);

        return DB::transaction(function () use (
            $subject,
            $email,
            $username,
            $name,
            $phone,
            $localRole,
            $canAccessExternalDnp,
            $externalDnpInstansiAccess,
            $certificationNoteLocationAccess,
            $permissions
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
            if ($permissions !== null) {
                $user->permissions = $permissions;
            }
            if ($this->supportsExternalDnpInstansiAccessColumn()) {
                $user->external_dnp_instansi_access = $canAccessExternalDnp
                    ? ($localRole === 'Admin' ? [] : $externalDnpInstansiAccess)
                    : [];
            }
            if ($this->supportsCertificationNoteLocationAccessColumn()) {
                $user->certification_note_location_access = $localRole === 'Admin'
                    ? CertificationNoteLocationAccess::normalizeKeys([
                        'surabaya',
                        'sumenep',
                        'banyuwangi',
                        'malang',
                        'kediri',
                        'blora',
                        'jember',
                        'bawean',
                    ])
                    : $certificationNoteLocationAccess;
            }
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

    /**
     * @param  array<string, mixed>  $claims
     * @return array<int, string>
     */
    private function extractExternalDnpInstansiAccess(array $claims): array
    {
        $raw = Arr::get($claims, 'external_dnp_instansi_access');
        if (!is_array($raw)) {
            $raw = Arr::get($claims, 'externalDnpInstansiAccess');
        }

        return ExternalDnpInstansiAccess::normalizeKeys($raw);
    }

    /**
     * @param  array<string, mixed>  $claims
     * @return array<int, string>
     */
    private function extractCertificationNoteLocationAccess(array $claims): array
    {
        $raw = Arr::get($claims, 'certification_note_location_access');
        if (!is_array($raw)) {
            $raw = Arr::get($claims, 'certificationNoteLocationAccess');
        }

        return CertificationNoteLocationAccess::normalizeKeys($raw);
    }

    /**
     * @param  array<string, mixed>  $claims
     * @return array<string, bool>|null
     */
    private function extractPermissions(array $claims, string $role, bool $canAccessExternalDnp): ?array
    {
        $rawPermissions = Arr::get($claims, 'permissions');
        if (!is_array($rawPermissions)) {
            return null;
        }

        $permissions = [];
        foreach (self::PERMISSION_KEYS as $key) {
            if (array_key_exists($key, $rawPermissions)) {
                $permissions[$key] = (bool) $rawPermissions[$key];
            }
        }

        $permissions['can_access_external_dnp'] = $canAccessExternalDnp;

        if (strtolower($role) !== 'admin') {
            $permissions['can_access_admin_portal'] = false;
            $permissions['can_manage_users'] = false;
            $permissions['can_manage_admin_module'] = false;
        }

        return $permissions;
    }

    private function supportsExternalDnpInstansiAccessColumn(): bool
    {
        return $this->supportsExternalDnpInstansiAccessColumn
            ??= Schema::hasColumn('users', 'external_dnp_instansi_access');
    }

    private function supportsCertificationNoteLocationAccessColumn(): bool
    {
        return $this->supportsCertificationNoteLocationAccessColumn
            ??= Schema::hasColumn('users', 'certification_note_location_access');
    }

    private function toString(mixed $value): string
    {
        return is_string($value) ? trim($value) : '';
    }

    private function normalizePhone(string $value): string
    {
        $phone = preg_replace('/[\s().-]+/', '', $value) ?? '';
        $phone = ltrim($phone, '+');
        if (str_starts_with($phone, '08')) {
            $phone = '62' . substr($phone, 1);
        }

        return preg_match('/^[1-9]\d{7,14}$/', $phone) === 1 ? $phone : '';
    }
}
