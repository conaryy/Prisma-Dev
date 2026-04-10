<?php

namespace App\Support;

use App\Models\User;
use Illuminate\Support\Collection;
use Illuminate\Support\Str;

class ExternalDnpInstansiAccess
{
    private const OPTIONS = [
        'surabaya' => [
            'label' => 'Cabang Surabaya',
            'aliases' => [
                'perum lppnpi cabang surabaya',
                'cabang surabaya',
            ],
        ],
        'malang' => [
            'label' => 'KCP Malang',
            'aliases' => [
                'perum lppnpi cabang pembantu malang',
                'cabang pembantu malang',
                'capem malang',
                'kcp malang',
            ],
        ],
        'banyuwangi' => [
            'label' => 'KCP Banyuwangi',
            'aliases' => [
                'perum lppnpi cabang pembantu banyuwangi',
                'cabang pembantu banyuwangi',
                'capem banyuwangi',
                'kcp banyuwangi',
            ],
        ],
        'sumenep' => [
            'label' => 'KCP Sumenep',
            'aliases' => [
                'perum lppnpi cabang pembantu sumenep',
                'cabang pembantu sumenep',
                'capem sumenep',
                'kcp sumenep',
            ],
        ],
        'kediri' => [
            'label' => 'Unit Kediri',
            'aliases' => [
                'perum lppnpi unit kediri',
                'unit kediri',
            ],
        ],
        'ngloram' => [
            'label' => 'Unit Ngloram (Blora)',
            'aliases' => [
                'perum lppnpi unit ngloram',
                'unit ngloram',
                'perum lppnpi unit blora',
                'unit blora',
            ],
        ],
        'bawean' => [
            'label' => 'Unit Bawean',
            'aliases' => [
                'perum lppnpi unit bawean',
                'unit bawean',
            ],
        ],
        'jember' => [
            'label' => 'Unit Jember',
            'aliases' => [
                'perum lppnpi unit jember',
                'unit jember',
            ],
        ],
    ];

    public static function normalizeKeys(mixed $input): array
    {
        if (!is_array($input)) {
            return [];
        }

        $lookup = array_fill_keys(array_keys(self::OPTIONS), true);

        return array_values(array_unique(array_values(array_filter(array_map(
            static function ($value) use ($lookup) {
                $normalized = trim(Str::of((string) $value)->lower()->value());

                return array_key_exists($normalized, $lookup) ? $normalized : null;
            },
            $input
        )))));
    }

    public static function canManage(?User $user): bool
    {
        return strtolower((string) ($user?->role ?? '')) === 'admin';
    }

    public static function allowedKeysForUser(?User $user): array
    {
        if (!$user || !(bool) ($user->can_access_external_dnp ?? false)) {
            return [];
        }

        if (self::canManage($user)) {
            return array_keys(self::OPTIONS);
        }

        return self::normalizeKeys($user->external_dnp_instansi_access ?? []);
    }

    public static function canUserAccessInstansi(?User $user, ?string $instansiName): bool
    {
        if (!$user || !(bool) ($user->can_access_external_dnp ?? false)) {
            return false;
        }

        if (self::canManage($user)) {
            return true;
        }

        $matchedKey = self::matchKey($instansiName);
        if ($matchedKey === '') {
            return false;
        }

        return in_array($matchedKey, self::allowedKeysForUser($user), true);
    }

    /**
     * @template TItem
     * @param  Collection<int, TItem>  $items
     * @param  callable(TItem): (?string)  $instansiResolver
     * @return Collection<int, TItem>
     */
    public static function filterCollectionForUser(
        Collection $items,
        ?User $user,
        callable $instansiResolver
    ): Collection {
        if (!$user || !(bool) ($user->can_access_external_dnp ?? false)) {
            return collect();
        }

        if (self::canManage($user)) {
            return $items->values();
        }

        $allowedKeys = self::allowedKeysForUser($user);
        if (empty($allowedKeys)) {
            return collect();
        }

        return $items
            ->filter(function ($item) use ($allowedKeys, $instansiResolver) {
                $matchedKey = self::matchKey($instansiResolver($item));

                return $matchedKey !== '' && in_array($matchedKey, $allowedKeys, true);
            })
            ->values();
    }

    public static function matchKey(?string $instansiName): string
    {
        $normalized = self::normalizeText($instansiName);
        if ($normalized === '') {
            return '';
        }

        foreach (self::OPTIONS as $key => $config) {
            foreach ($config['aliases'] as $alias) {
                $normalizedAlias = self::normalizeText($alias);
                if ($normalizedAlias !== '' && str_contains($normalized, $normalizedAlias)) {
                    return $key;
                }
            }
        }

        return '';
    }

    private static function normalizeText(?string $value): string
    {
        $normalized = Str::of((string) ($value ?? ''))->lower()->squish()->value();
        $normalized = preg_replace('/[^[:alnum:]\s]+/u', ' ', $normalized) ?? $normalized;
        $normalized = preg_replace('/\s+/u', ' ', $normalized) ?? $normalized;

        return trim($normalized);
    }
}
