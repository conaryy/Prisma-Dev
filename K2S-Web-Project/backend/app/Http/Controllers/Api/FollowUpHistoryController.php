<?php

namespace App\Http\Controllers\Api;

use App\Models\FollowUp;
use App\Models\FollowUpHistory;
use Illuminate\Http\Request;

class FollowUpHistoryController extends ApiController
{
    public function index(Request $request, FollowUp $followUp)
    {
        $limit = (int) $request->query('limit', 50);
        $items = FollowUpHistory::query()
            ->where('follow_up_id', $followUp->id)
            ->orderByDesc('created_at')
            ->paginate($limit);

        return $this->respondPaginated($items);
    }

    public function store(Request $request, FollowUp $followUp)
    {
        $validated = $request->validate([
            'note' => ['required', 'min:2'],
        ]);

        $item = FollowUpHistory::create([
            'follow_up_id' => $followUp->id,
            'note' => $validated['note'],
            'created_at' => now(),
        ]);

        return $this->respondData($item, 201);
    }
}
