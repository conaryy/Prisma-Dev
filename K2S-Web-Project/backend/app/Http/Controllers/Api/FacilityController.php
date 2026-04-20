<?php

namespace App\Http\Controllers\Api;

use App\Models\Facility;
use App\Models\Instansi;
use Illuminate\Http\Request;

class FacilityController extends ApiController
{
    /**
     * Display a listing of the resource.
     */
    public function index(Request $request)
    {
        $limit = (int) $request->query('limit', 20);
        $instansiId = Instansi::query()
            ->where('user_id', $request->user()->id)
            ->value('id');

        if (!$instansiId) {
            return $this->respondPaginated(Facility::query()->whereRaw('1 = 0')->paginate($limit));
        }

        $items = Facility::query()
            ->where('instansi_id', $instansiId)
            ->paginate($limit);
        return $this->respondPaginated($items);
    }

    /**
     * Store a newly created resource in storage.
     */
    public function store(Request $request)
    {
        $validated = $request->validate([
            'group' => ['required'],
            'name' => ['required'],
            'merk' => ['nullable'],
            'type' => ['nullable'],
            'frequency' => ['nullable'],
            'ident' => ['nullable'],
            'condition' => ['required', 'in:Normal,Single,Unserviceable'],
        ]);

        $payload = $this->normalize($validated, [
            'group' => 'facility_group',
            'condition' => 'condition_status',
        ]);

        $instansiId = Instansi::query()
            ->where('user_id', $request->user()->id)
            ->value('id');
        if (!$instansiId) {
            return response()->json(['error' => 'Instansi belum tersedia.'], 422);
        }

        $payload['instansi_id'] = $instansiId;
        FacilityGroupController::ensureGroupExists($instansiId, $validated['group'] ?? null);
        $item = Facility::create($payload);

        return $this->respondData($item, 201);
    }

    /**
     * Display the specified resource.
     */
    public function show(Facility $facility)
    {
        $instansiId = Instansi::query()
            ->where('user_id', request()->user()->id)
            ->value('id');
        if ($instansiId && $facility->instansi_id !== $instansiId) {
            return response()->json(['error' => 'Forbidden.'], 403);
        }
        return $this->respondData($facility);
    }

    /**
     * Update the specified resource in storage.
     */
    public function update(Request $request, Facility $facility)
    {
        $instansiId = Instansi::query()
            ->where('user_id', $request->user()->id)
            ->value('id');
        if ($instansiId && $facility->instansi_id !== $instansiId) {
            return response()->json(['error' => 'Forbidden.'], 403);
        }

        $validated = $request->validate([
            'group' => ['sometimes'],
            'name' => ['sometimes'],
            'merk' => ['nullable'],
            'type' => ['nullable'],
            'frequency' => ['nullable'],
            'ident' => ['nullable'],
            'condition' => ['nullable', 'in:Normal,Single,Unserviceable'],
        ]);

        $payload = $this->normalize($validated, [
            'group' => 'facility_group',
            'condition' => 'condition_status',
        ]);
        FacilityGroupController::ensureGroupExists($instansiId, $validated['group'] ?? null);
        $facility->fill($payload)->save();

        return $this->respondData($facility);
    }

    /**
     * Remove the specified resource from storage.
     */
    public function destroy(Facility $facility)
    {
        $instansiId = Instansi::query()
            ->where('user_id', request()->user()->id)
            ->value('id');
        if ($instansiId && $facility->instansi_id !== $instansiId) {
            return response()->json(['error' => 'Forbidden.'], 403);
        }
        $facility->delete();
        return $this->respondData(['success' => true]);
    }

}
