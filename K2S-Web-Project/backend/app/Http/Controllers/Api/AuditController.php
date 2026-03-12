<?php

namespace App\Http\Controllers\Api;

use App\Models\Audit;
use Illuminate\Http\Request;

class AuditController extends ApiController
{
    /**
     * Display a listing of the resource.
     */
    public function index(Request $request)
    {
        $limit = (int) $request->query('limit', 20);
        $items = Audit::query()->paginate($limit);
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
            'focus' => ['required'],
        ]);

        $item = Audit::create($validated);
        return $this->respondData($item, 201);
    }

    /**
     * Display the specified resource.
     */
    public function show(Audit $audit)
    {
        return $this->respondData($audit);
    }

    /**
     * Update the specified resource in storage.
     */
    public function update(Request $request, Audit $audit)
    {
        $validated = $request->validate([
            'number' => ['sometimes'],
            'date' => ['sometimes', 'date'],
            'location' => ['sometimes'],
            'status' => ['sometimes'],
            'focus' => ['sometimes'],
        ]);

        $audit->fill($validated)->save();
        return $this->respondData($audit);
    }

    /**
     * Remove the specified resource from storage.
     */
    public function destroy(Audit $audit)
    {
        $audit->delete();
        return $this->respondData(['success' => true]);
    }
}
