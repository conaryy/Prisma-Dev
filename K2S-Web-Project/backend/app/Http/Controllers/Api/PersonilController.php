<?php

namespace App\Http\Controllers\Api;

use App\Models\Personil;
use App\Models\Instansi;
use Illuminate\Http\Request;

class PersonilController extends ApiController
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
            return $this->respondPaginated(Personil::query()->whereRaw('1 = 0')->paginate($limit));
        }
        $items = Personil::query()
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
            'name' => ['required'],
            'position' => ['nullable'],
            'level' => ['nullable'],
            'field' => ['nullable'],
            'tier' => ['nullable'],
        ]);

        $payload = $this->normalize($validated, [
            'field' => 'field_name',
        ]);
        $instansiId = Instansi::query()
            ->where('user_id', $request->user()->id)
            ->value('id');
        if (!$instansiId) {
            return response()->json(['error' => 'Instansi belum tersedia.'], 422);
        }
        $payload['instansi_id'] = $instansiId;
        $item = Personil::create($payload);

        return $this->respondData($item, 201);
    }

    /**
     * Display the specified resource.
     */
    public function show(Personil $personil)
    {
        $instansiId = Instansi::query()
            ->where('user_id', request()->user()->id)
            ->value('id');
        if ($instansiId && $personil->instansi_id !== $instansiId) {
            return response()->json(['error' => 'Forbidden.'], 403);
        }
        return $this->respondData($personil);
    }

    /**
     * Update the specified resource in storage.
     */
    public function update(Request $request, Personil $personil)
    {
        $instansiId = Instansi::query()
            ->where('user_id', $request->user()->id)
            ->value('id');
        if ($instansiId && $personil->instansi_id !== $instansiId) {
            return response()->json(['error' => 'Forbidden.'], 403);
        }
        $validated = $request->validate([
            'name' => ['sometimes'],
            'position' => ['nullable'],
            'level' => ['nullable'],
            'field' => ['nullable'],
            'tier' => ['nullable'],
        ]);

        $payload = $this->normalize($validated, [
            'field' => 'field_name',
        ]);
        $personil->fill($payload)->save();

        return $this->respondData($personil);
    }

    /**
     * Remove the specified resource from storage.
     */
    public function destroy(Personil $personil)
    {
        $instansiId = Instansi::query()
            ->where('user_id', request()->user()->id)
            ->value('id');
        if ($instansiId && $personil->instansi_id !== $instansiId) {
            return response()->json(['error' => 'Forbidden.'], 403);
        }
        $personil->delete();
        return $this->respondData(['success' => true]);
    }
}
