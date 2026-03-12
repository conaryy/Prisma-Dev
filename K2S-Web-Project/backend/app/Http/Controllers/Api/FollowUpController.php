<?php

namespace App\Http\Controllers\Api;

use App\Models\FollowUp;
use Illuminate\Http\Request;

class FollowUpController extends ApiController
{
    /**
     * Display a listing of the resource.
     */
    public function index(Request $request)
    {
        $limit = (int) $request->query('limit', 20);
        $items = FollowUp::query()->paginate($limit);
        return $this->respondPaginated($items);
    }

    /**
     * Store a newly created resource in storage.
     */
    public function store(Request $request)
    {
        $validated = $request->validate([
            'findingId' => ['required'],
            'aksiPerbaikan' => ['required'],
            'pic' => ['required'],
            'targetDate' => ['required', 'date'],
            'status' => ['required', 'in:Open,In Progress,Done'],
        ]);

        $payload = $this->normalize($validated);
        $item = FollowUp::create($payload);

        return $this->respondData($item, 201);
    }

    /**
     * Display the specified resource.
     */
    public function show(FollowUp $followUp)
    {
        return $this->respondData($followUp);
    }

    /**
     * Update the specified resource in storage.
     */
    public function update(Request $request, FollowUp $followUp)
    {
        $validated = $request->validate([
            'findingId' => ['sometimes'],
            'aksiPerbaikan' => ['sometimes'],
            'pic' => ['sometimes'],
            'targetDate' => ['sometimes', 'date'],
            'status' => ['sometimes', 'in:Open,In Progress,Done'],
        ]);

        $payload = $this->normalize($validated);
        $followUp->fill($payload)->save();

        return $this->respondData($followUp);
    }

    /**
     * Remove the specified resource from storage.
     */
    public function destroy(FollowUp $followUp)
    {
        $followUp->delete();
        return $this->respondData(['success' => true]);
    }
}
