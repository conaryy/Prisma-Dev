<?php

namespace App\Http\Controllers\Api;

use App\Models\Monitoring;
use Illuminate\Http\Request;

class MonitoringController extends ApiController
{
    /**
     * Display a listing of the resource.
     */
    public function index(Request $request)
    {
        $limit = (int) $request->query('limit', 20);
        $items = Monitoring::query()->paginate($limit);
        return $this->respondPaginated($items);
    }

    /**
     * Store a newly created resource in storage.
     */
    public function store(Request $request)
    {
        $validated = $request->validate([
            'date' => ['required', 'date'],
            'location' => ['required'],
            'status' => ['required'],
            'note' => ['nullable'],
        ]);

        $item = Monitoring::create($validated);
        return $this->respondData($item, 201);
    }

    /**
     * Display the specified resource.
     */
    public function show(Monitoring $monitoring)
    {
        return $this->respondData($monitoring);
    }

    /**
     * Update the specified resource in storage.
     */
    public function update(Request $request, Monitoring $monitoring)
    {
        $validated = $request->validate([
            'date' => ['sometimes', 'date'],
            'location' => ['sometimes'],
            'status' => ['sometimes'],
            'note' => ['nullable'],
        ]);

        $monitoring->fill($validated)->save();
        return $this->respondData($monitoring);
    }

    /**
     * Remove the specified resource from storage.
     */
    public function destroy(Monitoring $monitoring)
    {
        $monitoring->delete();
        return $this->respondData(['success' => true]);
    }
}
