<?php

namespace App\Http\Controllers\Api;

use App\Models\Organization;
use App\Models\Instansi;
use Illuminate\Http\Request;

class OrganizationController extends ApiController
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
            return $this->respondPaginated(Organization::query()->whereRaw('1 = 0')->paginate($limit));
        }
        $items = Organization::query()
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
            'unitName' => ['required'],
            'positionName' => ['required'],
            'level' => ['nullable'],
            'status' => ['required', 'in:Aktif,Nonaktif'],
        ]);

        $payload = $this->normalize($validated);
        $instansiId = Instansi::query()
            ->where('user_id', $request->user()->id)
            ->value('id');
        if (!$instansiId) {
            return response()->json(['error' => 'Instansi belum tersedia.'], 422);
        }
        $payload['instansi_id'] = $instansiId;
        $item = Organization::create($payload);

        return $this->respondData($item, 201);
    }

    /**
     * Display the specified resource.
     */
    public function show(Organization $organization)
    {
        $instansiId = Instansi::query()
            ->where('user_id', request()->user()->id)
            ->value('id');
        if ($instansiId && $organization->instansi_id !== $instansiId) {
            return response()->json(['error' => 'Forbidden.'], 403);
        }
        return $this->respondData($organization);
    }

    /**
     * Update the specified resource in storage.
     */
    public function update(Request $request, Organization $organization)
    {
        $instansiId = Instansi::query()
            ->where('user_id', $request->user()->id)
            ->value('id');
        if ($instansiId && $organization->instansi_id !== $instansiId) {
            return response()->json(['error' => 'Forbidden.'], 403);
        }
        $validated = $request->validate([
            'unitName' => ['sometimes'],
            'positionName' => ['sometimes'],
            'level' => ['nullable'],
            'status' => ['sometimes', 'in:Aktif,Nonaktif'],
        ]);

        $payload = $this->normalize($validated);
        $organization->fill($payload)->save();

        return $this->respondData($organization);
    }

    /**
     * Remove the specified resource from storage.
     */
    public function destroy(Organization $organization)
    {
        $instansiId = Instansi::query()
            ->where('user_id', request()->user()->id)
            ->value('id');
        if ($instansiId && $organization->instansi_id !== $instansiId) {
            return response()->json(['error' => 'Forbidden.'], 403);
        }
        $organization->delete();
        return $this->respondData(['success' => true]);
    }
}
