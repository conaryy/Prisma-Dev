<?php

namespace App\Http\Controllers\Api;

use App\Models\SelfAssessmentAreaQuestionCategory;
use App\Models\SelfAssessmentQuestion;
use App\Models\SelfAssessmentQuestionCategory;
use App\Models\SelfAssessmentSessionArea;
use App\Models\SelfAssessmentAnswer;
use App\Models\SelfAssessmentEvidence;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

class SelfAssessmentAreaQuestionCategoryController extends ApiController
{
    public function adminIndex(Request $request)
    {
        $validated = $request->validate([
            'scope' => ['required', 'in:audit,monitoring,inspeksi,surveillance'],
            'area' => ['required'],
        ]);

        $categoryIds = SelfAssessmentAreaQuestionCategory::query()
            ->where('scope', $validated['scope'])
            ->where('area', $validated['area'])
            ->pluck('question_category_id')
            ->values();

        return $this->respondData(['categoryIds' => $categoryIds]);
    }

    public function store(Request $request)
    {
        $validated = $request->validate([
            'scope' => ['required', 'in:audit,monitoring,inspeksi,surveillance'],
            'area' => ['required'],
            'categoryIds' => ['nullable', 'array'],
            'categoryIds.*' => ['uuid', 'exists:self_assessment_question_categories,id'],
        ]);

        $scope = $validated['scope'];
        $area = $validated['area'];
        $categoryIds = collect($validated['categoryIds'] ?? [])
            ->filter()
            ->unique()
            ->values();

        $validCategoryIds = SelfAssessmentQuestionCategory::query()
            ->where('scope', $scope)
            ->whereIn('id', $categoryIds)
            ->pluck('id')
            ->values();

        $categoryIds = $validCategoryIds;

        return DB::transaction(function () use ($scope, $area, $categoryIds) {
            $existingIds = SelfAssessmentAreaQuestionCategory::query()
                ->where('scope', $scope)
                ->where('area', $area)
                ->pluck('question_category_id');

            $removedIds = $existingIds->diff($categoryIds)->values();
            $addedIds = $categoryIds->diff($existingIds)->values();

            if ($removedIds->isNotEmpty()) {
                $this->deleteAnswersForRemovedCategories($scope, $area, $removedIds->all());
                SelfAssessmentAreaQuestionCategory::query()
                    ->where('scope', $scope)
                    ->where('area', $area)
                    ->whereIn('question_category_id', $removedIds)
                    ->delete();
            }

            if ($addedIds->isNotEmpty()) {
                $now = now();
                $rows = $addedIds->map(function ($categoryId) use ($scope, $area, $now) {
                    return [
                        'id' => (string) Str::uuid(),
                        'scope' => $scope,
                        'area' => $area,
                        'question_category_id' => $categoryId,
                        'created_at' => $now,
                        'updated_at' => $now,
                    ];
                })->all();
                SelfAssessmentAreaQuestionCategory::query()->insert($rows);
            }

            return $this->respondData(['categoryIds' => $categoryIds]);
        });
    }

    private function deleteAnswersForRemovedCategories(
        string $scope,
        string $area,
        array $categoryIds
    ): void {
        $categories = SelfAssessmentQuestionCategory::query()
            ->where('scope', $scope)
            ->whereIn('id', $categoryIds)
            ->get(['id', 'name', 'prefix']);

        if ($categories->isEmpty()) {
            return;
        }

        $allowedKeys = $categories->mapWithKeys(function ($category) {
            return [$category->prefix.'|'.$category->name => true];
        });

        $questions = SelfAssessmentQuestion::query()
            ->where('scope', $scope)
            ->where('category', $area)
            ->get(['code', 'question_category_prefix', 'question_category']);

        $questionCodes = $questions->filter(function ($question) use ($allowedKeys) {
            $prefix = $question->question_category_prefix;
            $name = $question->question_category;
            if (!$prefix || !$name) {
                return false;
            }
            return isset($allowedKeys[$prefix.'|'.$name]);
        })->pluck('code');

        if ($questionCodes->isEmpty()) {
            return;
        }

        $areaIds = SelfAssessmentSessionArea::query()
            ->where('category', $area)
            ->whereHas('session', fn ($query) => $query->where('scope', $scope))
            ->pluck('id');

        if ($areaIds->isEmpty()) {
            return;
        }

        SelfAssessmentEvidence::query()
            ->whereIn('session_area_id', $areaIds)
            ->whereIn('question_code', $questionCodes)
            ->delete();

        SelfAssessmentAnswer::query()
            ->whereIn('session_area_id', $areaIds)
            ->whereIn('question_code', $questionCodes)
            ->delete();
    }
}
