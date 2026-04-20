<?php

namespace App\Http\Controllers\Api;

use App\Models\Facility;
use App\Models\FacilityGroup;
use App\Models\Instansi;
use Illuminate\Http\Request;

class FacilityGroupController extends ApiController
{
    public function index(Request $request)
    {
        $limit = max((int) $request->query('limit', 200), 1);
        $instansiId = Instansi::query()
            ->where('user_id', $request->user()->id)
            ->value('id');

        if (!$instansiId) {
            return $this->respondPaginated(
                FacilityGroup::query()->whereRaw('1 = 0')->paginate($limit)
            );
        }

        $this->syncLegacyGroups($instansiId);

        $items = FacilityGroup::query()
            ->where('instansi_id', $instansiId)
            ->orderBy('sort_order')
            ->orderBy('name')
            ->paginate($limit);

        return $this->respondPaginated($items);
    }

    public function store(Request $request)
    {
        $validated = $request->validate([
            'name' => ['required', 'string', 'max:255'],
        ]);

        $instansiId = Instansi::query()
            ->where('user_id', $request->user()->id)
            ->value('id');
        if (!$instansiId) {
            return response()->json(['error' => 'Instansi belum tersedia.'], 422);
        }

        $name = trim($validated['name']);
        if ($name === '') {
            return response()->json(['error' => 'Nama kelompok fasilitas wajib diisi.'], 422);
        }

        $item = FacilityGroup::query()->firstOrCreate(
            [
                'instansi_id' => $instansiId,
                'name' => $name,
            ],
            [
                'sort_order' => 0,
            ]
        );

        return $this->respondData($item, 201);
    }

    public function destroy(Request $request, FacilityGroup $facilityGroup)
    {
        $instansiId = Instansi::query()
            ->where('user_id', $request->user()->id)
            ->value('id');
        if (!$instansiId || $facilityGroup->instansi_id !== $instansiId) {
            return response()->json(['error' => 'Forbidden.'], 403);
        }

        Facility::query()
            ->where('instansi_id', $instansiId)
            ->where('facility_group', $facilityGroup->name)
            ->delete();

        $facilityGroup->delete();

        return $this->respondData(['success' => true]);
    }

    public static function ensureGroupExists(string $instansiId, ?string $name): void
    {
        $normalizedName = trim((string) $name);
        if ($normalizedName === '') {
            return;
        }

        FacilityGroup::query()->firstOrCreate(
            [
                'instansi_id' => $instansiId,
                'name' => $normalizedName,
            ],
            [
                'sort_order' => 0,
            ]
        );
    }

    private function syncLegacyGroups(string $instansiId): void
    {
        $legacyGroups = Facility::query()
            ->where('instansi_id', $instansiId)
            ->whereNotNull('facility_group')
            ->pluck('facility_group')
            ->filter(fn ($value) => trim((string) $value) !== '')
            ->unique()
            ->values();

        foreach ($legacyGroups as $groupName) {
            self::ensureGroupExists($instansiId, (string) $groupName);
        }
    }
}
