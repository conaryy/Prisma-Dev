<?php

namespace App\Http\Controllers\Api;

use App\Models\SelfAssessmentCategoryOption;
use App\Models\SelfAssessmentAreaQuestionCategory;
use Illuminate\Http\Request;

class SelfAssessmentCategoryController extends ApiController
{
    public function index(Request $request)
    {
        $validated = $request->validate([
            'scope' => ['required', 'in:audit,monitoring,inspeksi,surveillance'],
        ]);

        $items = SelfAssessmentCategoryOption::query()
            ->where('scope', $validated['scope'])
            ->where('is_active', true)
            ->orderBy('sort_order')
            ->orderBy('name')
            ->get();

        return $this->respondData($items);
    }

    public function adminIndex(Request $request)
    {
        $validated = $request->validate([
            'scope' => ['nullable', 'in:audit,monitoring,inspeksi,surveillance'],
        ]);

        $items = SelfAssessmentCategoryOption::query()
            ->when($validated['scope'] ?? null, function ($query, $scope) {
                $query->where('scope', $scope);
            })
            ->orderBy('scope')
            ->orderBy('sort_order')
            ->orderBy('name')
            ->get();

        return $this->respondData($items);
    }

    public function adminAvailable(Request $request)
    {
        $validated = $request->validate([
            'scope' => ['required', 'in:audit,monitoring,inspeksi,surveillance'],
        ]);

        $areas = SelfAssessmentAreaQuestionCategory::query()
            ->where('scope', $validated['scope'])
            ->pluck('area')
            ->unique()
            ->values();

        if ($areas->isEmpty()) {
            return $this->respondData([]);
        }

        $items = SelfAssessmentCategoryOption::query()
            ->where('scope', $validated['scope'])
            ->whereIn('name', $areas)
            ->where('is_active', true)
            ->orderBy('sort_order')
            ->orderBy('name')
            ->get();

        return $this->respondData($items);
    }

    public function store(Request $request)
    {
        $validated = $request->validate([
            'scope' => ['required', 'in:audit,monitoring,inspeksi,surveillance'],
            'name' => ['required'],
            'isActive' => ['nullable', 'boolean'],
            'sortOrder' => ['nullable', 'integer', 'min:0'],
        ]);

        $payload = $this->normalize($validated, [
            'isActive' => 'is_active',
            'sortOrder' => 'sort_order',
        ]);

        $item = SelfAssessmentCategoryOption::create($payload);

        return $this->respondData($item, 201);
    }

    public function update(Request $request, SelfAssessmentCategoryOption $category)
    {
        $validated = $request->validate([
            'name' => ['sometimes'],
            'isActive' => ['nullable', 'boolean'],
            'sortOrder' => ['nullable', 'integer', 'min:0'],
        ]);

        $payload = $this->normalize($validated, [
            'isActive' => 'is_active',
            'sortOrder' => 'sort_order',
        ]);

        $category->fill($payload)->save();

        return $this->respondData($category);
    }

    public function destroy(SelfAssessmentCategoryOption $category)
    {
        $category->delete();
        return $this->respondData(['success' => true]);
    }
}
