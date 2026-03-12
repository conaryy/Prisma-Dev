<?php

namespace App\Http\Controllers\Api;

use App\Models\Inspection;
use Illuminate\Http\Request;

class InspectionController extends ApiController
{
    /**
     * Display a listing of the resource.
     */
    public function index(Request $request)
    {
        $limit = (int) $request->query('limit', 20);
        $items = Inspection::query()->paginate($limit);
        return $this->respondPaginated($items);
    }

    /**
     * Store a newly created resource in storage.
     */
    public function store(Request $request)
    {
        $validated = $request->validate([
            'number' => ['required'],
            'date' => ['required', 'date'],
            'location' => ['required'],
            'status' => ['required'],
            'unit' => ['required'],
        ]);

        $item = Inspection::create($validated);
        return $this->respondData($item, 201);
    }

    /**
     * Display the specified resource.
     */
    public function show(Inspection $inspection)
    {
        return $this->respondData($inspection);
    }

    /**
     * Update the specified resource in storage.
     */
    public function update(Request $request, Inspection $inspection)
    {
        $validated = $request->validate([
            'number' => ['sometimes'],
            'date' => ['sometimes', 'date'],
            'location' => ['sometimes'],
            'status' => ['sometimes'],
            'unit' => ['sometimes'],
        ]);

        $inspection->fill($validated)->save();
        return $this->respondData($inspection);
    }

    /**
     * Remove the specified resource from storage.
     */
    public function destroy(Inspection $inspection)
    {
        $inspection->delete();
        return $this->respondData(['success' => true]);
    }
}
