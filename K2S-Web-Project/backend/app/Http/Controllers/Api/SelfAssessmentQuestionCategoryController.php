<?php

namespace App\Http\Controllers\Api;

use App\Models\SelfAssessmentQuestionCategory;
use App\Models\SelfAssessmentQuestionCategoryUser;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Str;

class SelfAssessmentQuestionCategoryController extends ApiController
{
    public function adminIndex(Request $request)
    {
        $validated = $request->validate([
            'scope' => ['nullable', 'in:audit,monitoring,inspeksi,surveillance'],
        ]);

        $items = SelfAssessmentQuestionCategory::query()
            ->when($validated['scope'] ?? null, function ($query, $scope) {
                $query->where('scope', $scope);
            })
            ->orderBy('scope')
            ->orderBy('sort_order')
            ->orderBy('name')
            ->get();

        $categoryIds = $items->pluck('id');
        if ($categoryIds->isNotEmpty()) {
            $assignments = SelfAssessmentQuestionCategoryUser::query()
                ->whereIn('question_category_id', $categoryIds)
                ->get(['question_category_id', 'user_id']);

            $userIds = $assignments->pluck('user_id')->unique()->values();
            $usersById = $userIds->isNotEmpty()
                ? User::query()->whereIn('id', $userIds)->get(['id', 'name', 'email'])->keyBy('id')
                : collect();

            $usersByCategory = $assignments
                ->groupBy('question_category_id')
                ->map(function ($items) use ($usersById) {
                    return $items
                        ->map(function ($item) use ($usersById) {
                            $user = $usersById[$item->user_id] ?? null;
                            return $user ? $user->only(['id', 'name', 'email']) : null;
                        })
                        ->filter()
                        ->values();
                });

            $items->each(function ($category) use ($usersByCategory) {
                $category->setAttribute(
                    'users',
                    ($usersByCategory->get($category->id) ?? collect())->values()->all()
                );
            });
        }

        return $this->respondData($items);
    }

    public function adminAvailableByArea(Request $request)
    {
        $validated = $request->validate([
            'scope' => ['required', 'in:audit,monitoring,inspeksi,surveillance'],
            'area' => ['required'],
        ]);

        $questionKeys = \App\Models\SelfAssessmentQuestion::query()
            ->where('scope', $validated['scope'])
            ->where('category', $validated['area'])
            ->whereNotNull('question_category')
            ->whereNotNull('question_category_prefix')
            ->get(['question_category', 'question_category_prefix'])
            ->mapWithKeys(function ($item) {
                return [$item->question_category_prefix.'|'.$item->question_category => true];
            });

        if ($questionKeys->isEmpty()) {
            return $this->respondData(['categoryIds' => []]);
        }

        $categoryIds = SelfAssessmentQuestionCategory::query()
            ->where('scope', $validated['scope'])
            ->get(['id', 'name', 'prefix'])
            ->filter(function ($category) use ($questionKeys) {
                return isset($questionKeys[$category->prefix.'|'.$category->name]);
            })
            ->pluck('id')
            ->values();

        return $this->respondData(['categoryIds' => $categoryIds]);
    }

    public function store(Request $request)
    {
        $validated = $request->validate([
            'scope' => ['required', 'in:audit,monitoring,inspeksi,surveillance'],
            'name' => ['required'],
            'prefix' => ['required'],
            'isActive' => ['nullable', 'boolean'],
            'sortOrder' => ['nullable', 'integer', 'min:0'],
            'userIds' => ['nullable', 'array'],
            'userIds.*' => ['uuid', 'exists:users,id'],
        ]);

        $userIds = collect($validated['userIds'] ?? [])
            ->filter()
            ->unique()
            ->values();
        unset($validated['userIds']);

        $payload = $this->normalize($validated, [
            'isActive' => 'is_active',
            'sortOrder' => 'sort_order',
        ]);

        $item = SelfAssessmentQuestionCategory::create($payload);

        if ($userIds->isNotEmpty()) {
            $now = now();
            $assignments = $userIds->map(function ($userId) use ($item, $now) {
                return [
                    'id' => (string) Str::uuid(),
                    'question_category_id' => $item->id,
                    'user_id' => $userId,
                    'created_at' => $now,
                    'updated_at' => $now,
                ];
            })->all();
            SelfAssessmentQuestionCategoryUser::query()->insert($assignments);
        }

        return $this->respondData($item, 201);
    }

    public function update(Request $request, SelfAssessmentQuestionCategory $questionCategory)
    {
        $validated = $request->validate([
            'name' => ['sometimes'],
            'prefix' => ['sometimes'],
            'isActive' => ['nullable', 'boolean'],
            'sortOrder' => ['nullable', 'integer', 'min:0'],
            'userIds' => ['nullable', 'array'],
            'userIds.*' => ['uuid', 'exists:users,id'],
        ]);

        $userIds = null;
        if (array_key_exists('userIds', $validated)) {
            $userIds = collect($validated['userIds'] ?? [])
                ->filter()
                ->unique()
                ->values();
            unset($validated['userIds']);
        }

        $payload = $this->normalize($validated, [
            'isActive' => 'is_active',
            'sortOrder' => 'sort_order',
        ]);

        $questionCategory->fill($payload)->save();

        if ($userIds !== null) {
            SelfAssessmentQuestionCategoryUser::query()
                ->where('question_category_id', $questionCategory->id)
                ->delete();
            if ($userIds->isNotEmpty()) {
                $now = now();
                $assignments = $userIds->map(function ($userId) use ($questionCategory, $now) {
                    return [
                        'id' => (string) Str::uuid(),
                        'question_category_id' => $questionCategory->id,
                        'user_id' => $userId,
                        'created_at' => $now,
                        'updated_at' => $now,
                    ];
                })->all();
                SelfAssessmentQuestionCategoryUser::query()->insert($assignments);
            }
        }

        return $this->respondData($questionCategory);
    }

    public function destroy(SelfAssessmentQuestionCategory $questionCategory)
    {
        $questionCategory->delete();
        return $this->respondData(['success' => true]);
    }
}
