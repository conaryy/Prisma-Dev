<?php

namespace App\Support;

use App\Models\User;

class CertificationNoteLocationAccess
{
    private const OPTIONS = [
        'surabaya' => 'Surabaya',
        'sumenep' => 'Sumenep',
        'banyuwangi' => 'Banyuwangi',
        'malang' => 'Malang',
        'kediri' => 'Kediri',
        'blora' => 'Blora',
        'jember' => 'Jember',
        'bawean' => 'Bawean',
    ];

    public static function normalizeKeys(mixed $input): array
    {
        if (!is_array($input)) {
            return [];
        }

        $lookup = array_fill_keys(array_keys(self::OPTIONS), true);

        return array_values(array_unique(array_values(array_filter(array_map(
            static function ($value) use ($lookup) {
                $normalized = strtolower(trim((string) $value));

                return array_key_exists($normalized, $lookup) ? $normalized : null;
            },
            $input
        )))));
    }

    public static function allowedKeysForUser(?User $user): array
    {
        if (!$user) {
            return [];
        }

        if (self::canManage($user)) {
            return array_keys(self::OPTIONS);
        }

        return self::normalizeKeys($user->certification_note_location_access ?? []);
    }

    public static function canManage(?User $user): bool
    {
        return strtolower((string) ($user?->role ?? '')) === 'admin';
    }

    public static function canUserAccessLocation(?User $user, ?string $locationSlug): bool
    {
        $normalized = strtolower(trim((string) $locationSlug));
        if ($normalized === '' || !array_key_exists($normalized, self::OPTIONS)) {
            return false;
        }

        return in_array($normalized, self::allowedKeysForUser($user), true);
    }
}
