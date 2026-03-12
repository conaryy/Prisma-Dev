<?php

namespace App\Http\Controllers\Api;

use App\Models\Instansi;
use Illuminate\Http\Request;

class InstansiController extends ApiController
{
    /**
     * Display a listing of the resource.
     */
    public function index(Request $request)
    {
        $limit = (int) $request->query('limit', 20);
        $userId = $request->user()->id;

        $existing = Instansi::query()
            ->where('user_id', $userId)
            ->first();

        if (!$existing) {
            $orphan = Instansi::query()
                ->whereNull('user_id')
                ->first();
            if ($orphan) {
                $orphan->user_id = $userId;
                $orphan->save();
            }
        }

        $items = Instansi::query()
            ->where('user_id', $userId)
            ->paginate($limit);
        return $this->respondPaginated($items);
    }

    /**
     * Store a newly created resource in storage.
     */
    public function store(Request $request)
    {
        $validated = $request->validate([
            'facilityGroup' => ['required'],
            'kobu' => ['required'],
            'bandara' => ['required'],
            'cabangAirnav' => ['required'],
            'name' => ['required'],
            'alias' => ['nullable'],
            'address' => ['nullable'],
            'contactName' => ['nullable'],
            'contactEmail' => ['nullable', 'email'],
            'contactPhone' => ['nullable'],
            'fax' => ['nullable'],
            'postalCode' => ['nullable'],
            'longitude' => ['nullable'],
            'latitude' => ['nullable'],
            'serviceArea' => ['nullable'],
            'operatingHours' => ['nullable'],
            'trafficType' => ['nullable'],
            'runwayCapacity' => ['nullable'],
            'runwayCondition' => ['nullable'],
            'location' => ['nullable'],
        ]);

        $payload = $this->normalize($validated);
        $userId = $request->user()->id;
        $existing = Instansi::query()
            ->where('user_id', $userId)
            ->first();

        if ($existing) {
            $existing->fill($payload)->save();
            return $this->respondData($existing);
        }

        $payload['user_id'] = $userId;
        $item = Instansi::create($payload);

        return $this->respondData($item, 201);
    }

    /**
     * Display the specified resource.
     */
    public function show(Instansi $instansi)
    {
        if ($instansi->user_id !== request()->user()->id) {
            return response()->json(['error' => 'Forbidden.'], 403);
        }
        return $this->respondData($instansi);
    }

    /**
     * Update the specified resource in storage.
     */
    public function update(Request $request, Instansi $instansi)
    {
        if ($instansi->user_id !== $request->user()->id) {
            return response()->json(['error' => 'Forbidden.'], 403);
        }
        $validated = $request->validate([
            'facilityGroup' => ['sometimes'],
            'kobu' => ['sometimes'],
            'bandara' => ['sometimes'],
            'cabangAirnav' => ['sometimes'],
            'name' => ['sometimes'],
            'alias' => ['nullable'],
            'address' => ['nullable'],
            'contactName' => ['nullable'],
            'contactEmail' => ['nullable', 'email'],
            'contactPhone' => ['nullable'],
            'fax' => ['nullable'],
            'postalCode' => ['nullable'],
            'longitude' => ['nullable'],
            'latitude' => ['nullable'],
            'serviceArea' => ['nullable'],
            'operatingHours' => ['nullable'],
            'trafficType' => ['nullable'],
            'runwayCapacity' => ['nullable'],
            'runwayCondition' => ['nullable'],
            'location' => ['nullable'],
        ]);

        $payload = $this->normalize($validated);
        $instansi->fill($payload)->save();

        return $this->respondData($instansi);
    }

    /**
     * Remove the specified resource from storage.
     */
    public function destroy(Instansi $instansi)
    {
        if ($instansi->user_id !== request()->user()->id) {
            return response()->json(['error' => 'Forbidden.'], 403);
        }
        $instansi->delete();
        return $this->respondData(['success' => true]);
    }
}
