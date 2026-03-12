<?php

namespace App\Http\Controllers\Api;

use App\Models\SelfAssessmentSession;
use App\Models\SelfAssessmentSessionArea;
use App\Models\SelfAssessmentSessionUser;
use App\Models\SelfAssessmentAreaQuestionCategory;
use App\Models\SelfAssessmentQuestion;
use App\Models\SystemNotification;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Str;

class SelfAssessmentSessionAreaController extends ApiController
{
    public function adminIndex(Request $request, SelfAssessmentSession $session)
    {
        $items = SelfAssessmentSessionArea::query()
            ->where('session_id', $session->id)
            ->orderBy('sort_order')
            ->orderBy('category')
            ->get();

        return $this->respondData($items);
    }

    public function store(Request $request, SelfAssessmentSession $session)
    {
        $validated = $request->validate([
            'category' => ['required'],
            'isActive' => ['nullable', 'boolean'],
            'sortOrder' => ['nullable', 'integer', 'min:0'],
        ]);

        $hasMapping = SelfAssessmentAreaQuestionCategory::query()
            ->where('scope', $session->scope)
            ->where('area', $validated['category'])
            ->exists();
        if (!$hasMapping) {
            $hasQuestions = SelfAssessmentQuestion::query()
                ->where('scope', $session->scope)
                ->where('category', $validated['category'])
                ->whereNotNull('question_category')
                ->whereNotNull('question_category_prefix')
                ->exists();
            if ($hasQuestions) {
                $hasMapping = true;
            }
        }
        if (!$hasMapping) {
            return response()->json([
                'error' => 'Area belum memiliki mapping kategori pertanyaan.',
            ], 422);
        }

        $payload = $this->normalize($validated, [
            'isActive' => 'is_active',
            'sortOrder' => 'sort_order',
        ]);
        $payload['session_id'] = $session->id;

        $item = SelfAssessmentSessionArea::create($payload);

        $targetUserIds = SelfAssessmentSessionUser::query()
            ->where('session_id', $session->id)
            ->pluck('user_id')
            ->unique();
        $users = $targetUserIds->isNotEmpty()
            ? User::query()->whereIn('id', $targetUserIds)->get(['id'])
            : User::query()->where('role', '!=', 'admin')->get(['id']);
        $now = now();
        $notifications = $users->map(function ($user) use ($session, $item, $now) {
            return [
                'id' => (string) Str::uuid(),
                'user_id' => $user->id,
                'type' => 'category-opened',
                'title' => 'Kategori self assessment baru',
                'message' => sprintf(
                    'Kategori %s tersedia di %s.',
                    $item->category,
                    ucfirst($session->scope)
                ),
                'data' => json_encode([
                    'scope' => $session->scope,
                    'sessionId' => $session->id,
                    'sessionAreaId' => $item->id,
                    'category' => $item->category,
                ]),
                'created_at' => $now,
                'updated_at' => $now,
            ];
        })->all();

        if (!empty($notifications)) {
            SystemNotification::query()->insert($notifications);
        }

        return $this->respondData($item, 201);
    }

    public function update(Request $request, SelfAssessmentSessionArea $area)
    {
        $validated = $request->validate([
            'category' => ['sometimes'],
            'isActive' => ['nullable', 'boolean'],
            'sortOrder' => ['nullable', 'integer', 'min:0'],
        ]);

        $payload = $this->normalize($validated, [
            'isActive' => 'is_active',
            'sortOrder' => 'sort_order',
        ]);

        $area->fill($payload)->save();

        return $this->respondData($area);
    }

    public function destroy(SelfAssessmentSessionArea $area)
    {
        $area->delete();
        return $this->respondData(['success' => true]);
    }
}
