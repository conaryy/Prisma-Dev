<?php

namespace App\Http\Controllers\Api;

use App\Models\Finding;
use Illuminate\Http\Request;

class FindingController extends ApiController
{
    /**
     * Display a listing of the resource.
     */
    public function index(Request $request)
    {
        $limit = (int) $request->query('limit', 20);
        $items = Finding::query()->paginate($limit);
        return $this->respondPaginated($items);
    }

    /**
     * Store a newly created resource in storage.
     */
    public function store(Request $request)
    {
        $validated = $request->validate([
            'sourceType' => ['required', 'in:Audit,Inspeksi,Monitoring'],
            'sourceId' => ['required'],
            'kategori' => ['required'],
            'deskripsi' => ['required'],
            'severity' => ['required', 'in:Low,Med,High'],
            'status' => ['required', 'in:Open,In Progress,Closed'],
            'dueDate' => ['required', 'date'],
        ]);

        $payload = $this->normalize($validated);
        $item = Finding::create($payload);

        return $this->respondData($item, 201);
    }

    /**
     * Display the specified resource.
     */
    public function show(Finding $finding)
    {
        return $this->respondData($finding);
    }

    /**
     * Update the specified resource in storage.
     */
    public function update(Request $request, Finding $finding)
    {
        $validated = $request->validate([
            'sourceType' => ['sometimes', 'in:Audit,Inspeksi,Monitoring'],
            'sourceId' => ['sometimes'],
            'kategori' => ['sometimes'],
            'deskripsi' => ['sometimes'],
            'severity' => ['sometimes', 'in:Low,Med,High'],
            'status' => ['sometimes', 'in:Open,In Progress,Closed'],
            'dueDate' => ['sometimes', 'date'],
        ]);

        $payload = $this->normalize($validated);
        $finding->fill($payload)->save();

        return $this->respondData($finding);
    }

    /**
     * Remove the specified resource from storage.
     */
    public function destroy(Finding $finding)
    {
        $finding->delete();
        return $this->respondData(['success' => true]);
    }
}
